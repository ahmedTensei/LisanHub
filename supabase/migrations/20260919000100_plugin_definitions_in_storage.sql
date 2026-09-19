-- =============================================================================
-- LisanHub — plugin definitions leave the database for the file store
-- (decision R13, completed 2026-09-19 at Ahmed's request: Supabase keeps no
-- plugin or learning content, only accounts and metadata)
--
-- A plugin definition (the JSON document the studio builds) is now a file in
-- Cloudflare R2, exactly like a content package: the database keeps its key,
-- its sha256, and the metadata the platform needs to list, publish and stop it.
--   drafts    : plugins/<owner_id>/<plugin_row_id>-draft.lisanplugin.json  (rewritten on every save)
--   versions  : plugins/<owner_id>/<file_id>.lisanplugin.json               (immutable)
--   platform  : plugins/core/<plugin_id>-<version>.lisanplugin.json          (uploaded by `npm run core:plugins:upload`)
-- The two seeded reference plugins are repointed at their exported files; no
-- community version exists yet (the studio opened the day before).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plugin_versions: definition -> definition_key
-- -----------------------------------------------------------------------------
alter table public.plugin_versions
  add column definition_key text
    check (definition_key ~ '^plugins/[a-z0-9-]+/[a-z0-9._-]+\.lisanplugin\.json$');

update public.plugin_versions v
   set definition_key = 'plugins/core/' || p.plugin_id || '-' || v.version || '.lisanplugin.json'
  from public.plugins p
 where p.id = v.plugin_id and p.owner_id is null;

do $$
begin
  if exists (select 1 from public.plugin_versions where definition_key is null) then
    raise exception 'a community plugin version has no definition file yet; upload it before applying this migration';
  end if;
end $$;

-- The append-only guard names the file instead of the document.
create or replace function public.plugin_versions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.definition_key is distinct from old.definition_key
     or new.definition_sha256 is distinct from old.definition_sha256
     or new.version is distinct from old.version
     or new.version_number is distinct from old.version_number
     or new.schema_version is distinct from old.schema_version
     or new.plugin_id is distinct from old.plugin_id
     or new.author_id is distinct from old.author_id
     or new.change_note is distinct from old.change_note
     or new.created_at is distinct from old.created_at then
    raise exception 'plugin versions are append-only' using errcode = '42501';
  end if;
  if new.disabled is distinct from old.disabled
     and not (public.is_moderator() or auth.uid() is null or coalesce(current_setting('lisanhub.trusted_write', true), 'off') = 'on') then
    raise exception 'only moderation can disable a plugin version' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.plugin_versions alter column definition_key set not null;
alter table public.plugin_versions drop column definition;
comment on column public.plugin_versions.definition_key is
  'Object key of the immutable definition file in the private store (decision R13); definition_sha256 pins its canonical JSON.';

-- -----------------------------------------------------------------------------
-- plugin_publish_requests: the snapshot under review is a file too
-- -----------------------------------------------------------------------------
alter table public.plugin_publish_requests
  add column definition_key text
    check (definition_key ~ '^plugins/[a-z0-9-]+/[a-z0-9._-]+\.lisanplugin\.json$'),
  add column schema_version integer
    check (schema_version >= 1);
-- No request exists before this migration; both columns are required from now on.
delete from public.plugin_publish_requests where definition_key is null;
alter table public.plugin_publish_requests alter column definition_key set not null;
alter table public.plugin_publish_requests alter column schema_version set not null;
alter table public.plugin_publish_requests drop column definition;

-- -----------------------------------------------------------------------------
-- plugins: draft -> draft_key + draft_sha256
-- -----------------------------------------------------------------------------
alter table public.plugins
  add column draft_key text
    check (draft_key ~ '^plugins/[a-z0-9-]+/[a-z0-9._-]+\.lisanplugin\.json$'),
  add column draft_sha256 text
    check (draft_sha256 ~ '^[0-9a-f]{64}$');

-- The platform's reference plugins have no editable draft: their draft is the published file.
update public.plugins p
   set draft_key = v.definition_key,
       draft_sha256 = v.definition_sha256
  from public.plugin_versions v
 where v.id = p.current_version_id and p.owner_id is null;

create or replace function public.plugins_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Moderation, migrations, and the publishing functions (which mark the transaction).
  staff boolean := public.is_moderator() or auth.uid() is null or coalesce(current_setting('lisanhub.trusted_write', true), 'off') = 'on';
begin
  if tg_op = 'INSERT' then
    if not staff then
      if new.owner_id is distinct from auth.uid() then
        raise exception 'a plugin belongs to the account that creates it' using errcode = '42501';
      end if;
      if new.status <> 'draft' or new.disabled or new.current_version_id is not null or new.published_at is not null then
        raise exception 'a new plugin starts as a draft' using errcode = '42501';
      end if;
      -- The draft file lives in the owner's own folder of the store.
      if new.draft_key is not null and new.draft_key not like 'plugins/' || new.owner_id::text || '/%' then
        raise exception 'a draft file belongs in its owner''s folder' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if not staff then
    if new.owner_id is distinct from old.owner_id
       or new.status is distinct from old.status
       or new.current_version_id is distinct from old.current_version_id
       or new.disabled is distinct from old.disabled
       or new.disabled_message is distinct from old.disabled_message
       or new.published_at is distinct from old.published_at then
      raise exception 'field is not editable by the owner' using errcode = '42501';
    end if;
    if new.draft_key is not null and new.draft_key not like 'plugins/' || new.owner_id::text || '/%' then
      raise exception 'a draft file belongs in its owner''s folder' using errcode = '42501';
    end if;
  end if;
  if new.plugin_id is distinct from old.plugin_id and old.current_version_id is not null then
    raise exception 'a published plugin keeps its identifier' using errcode = '42501';
  end if;
  if new.current_version_id is not null and not exists (
    select 1 from public.plugin_versions v where v.id = new.current_version_id and v.plugin_id = new.id
  ) then
    raise exception 'current version must belong to the same plugin' using errcode = '23514';
  end if;
  return new;
end;
$$;

alter table public.plugins drop column draft;
comment on column public.plugins.draft_key is
  'Object key of the working copy the studio edits (decision R13); null until the first save, draft_sha256 pins its canonical JSON.';

-- -----------------------------------------------------------------------------
-- Publishing functions: the file key travels instead of the document
-- -----------------------------------------------------------------------------
drop function if exists public.plugin_publish_version(uuid, text, jsonb, text, uuid, text);
drop function if exists public.submit_plugin_version(uuid, text, jsonb, text, text);

create or replace function public.plugin_publish_version(
  p_plugin uuid,
  p_version text,
  p_schema_version integer,
  p_definition_key text,
  p_sha256 text,
  p_author uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_id uuid;
begin
  insert into public.plugin_versions (plugin_id, version, schema_version, definition_key, definition_sha256, author_id, change_note)
  values (p_plugin, p_version, p_schema_version, p_definition_key, p_sha256, p_author, p_note)
  returning id into version_id;

  perform set_config('lisanhub.trusted_write', 'on', true);
  update public.plugins
     set current_version_id = version_id,
         status = case when status = 'hidden' then 'hidden'::public.plugin_status else 'published'::public.plugin_status end,
         published_at = coalesce(published_at, now())
   where id = p_plugin;

  return version_id;
end;
$$;

create or replace function public.submit_plugin_version(
  p_plugin uuid,
  p_version text,
  p_schema_version integer,
  p_definition_key text,
  p_sha256 text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  plugin_row public.plugins%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into plugin_row from public.plugins where id = p_plugin for update;
  if plugin_row.id is null then
    raise exception 'plugin not found' using errcode = 'P0002';
  end if;
  if plugin_row.owner_id is distinct from auth.uid() and public.current_admin_level() < 4 then
    raise exception 'only the owner of a plugin submits its versions' using errcode = '42501';
  end if;
  if plugin_row.disabled then
    raise exception 'a disabled plugin cannot be published' using errcode = '42501';
  end if;
  if p_schema_version is null or p_schema_version < 1 then
    raise exception 'schema_version must be a positive integer' using errcode = '23514';
  end if;
  -- The file must sit in the folder of the plugin's owner (or the platform's).
  if p_definition_key not like 'plugins/' || coalesce(plugin_row.owner_id::text, 'core') || '/%' then
    raise exception 'definition file does not belong to this plugin' using errcode = '23514';
  end if;
  if exists (select 1 from public.plugin_versions v where v.plugin_id = p_plugin and v.version = p_version) then
    raise exception 'version % already exists', p_version using errcode = '23505';
  end if;

  -- plugins.publish: the Platform Owner in phase A (verified Contributors later, decision R10).
  if public.current_admin_level() >= 4 then
    perform public.plugin_publish_version(p_plugin, p_version, p_schema_version, p_definition_key, p_sha256, auth.uid(), p_note);
    return 'published';
  end if;

  insert into public.plugin_publish_requests (plugin_id, requested_by, version, schema_version, definition_key, definition_sha256, change_note)
  values (p_plugin, auth.uid(), p_version, p_schema_version, p_definition_key, p_sha256, p_note);
  perform set_config('lisanhub.trusted_write', 'on', true);
  update public.plugins set status = 'pending_review' where id = p_plugin and status = 'draft';
  return 'requested';
end;
$$;
revoke execute on function public.submit_plugin_version(uuid, text, integer, text, text, text) from public, anon;
grant execute on function public.submit_plugin_version(uuid, text, integer, text, text, text) to authenticated;

create or replace function public.review_plugin_publish_request(
  p_request uuid,
  p_approve boolean,
  p_reason text default null,
  p_note text default null
)
returns public.plugin_request_status
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.plugin_publish_requests%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'moderator rank required' using errcode = '42501';
  end if;
  select * into req from public.plugin_publish_requests where id = p_request for update;
  if req.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already decided' using errcode = '42501';
  end if;

  if p_approve then
    perform public.plugin_publish_version(req.plugin_id, req.version, req.schema_version, req.definition_key, req.definition_sha256, req.requested_by, req.change_note);
    update public.plugin_publish_requests
       set status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
     where id = p_request;
    return 'approved';
  end if;

  if p_reason is null then
    raise exception 'a rejection needs a reason' using errcode = '23514';
  end if;
  update public.plugin_publish_requests
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason, decision_note = p_note
   where id = p_request;
  update public.plugins
     set status = case when current_version_id is null then 'draft'::public.plugin_status else status end
   where id = req.plugin_id and status = 'pending_review';
  return 'rejected';
end;
$$;
