-- =============================================================================
-- LisanHub — plugins, their append-only versions and publish requests
-- (decisions R7 and R10, ADR 0006; Ahmed, 2026-09-18)
--
--   * a plugin defines a *kind* of learning activity; the platform stores its
--     definition as data and never executes it (the player is sandboxed)
--   * Contributors build plugins; publishing to the catalogue goes through a
--     moderation review in phase A, the Platform Owner publishes directly
--   * versions are append-only and pinned by a sha256 the player verifies
--   * kill switch per plugin and per version, hiding for moderation only,
--     and none of it ever damages an existing package
-- =============================================================================

create type public.plugin_status as enum ('draft', 'pending_review', 'published', 'hidden');
create type public.plugin_request_status as enum ('pending', 'approved', 'rejected');

-- Content authored for a plugin is a package (ADR 0006). Usable from the next migration on.
alter type public.content_kind add value if not exists 'package';

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.plugins (
  id                  uuid primary key default gen_random_uuid(),
  plugin_id           text not null unique
                      check (plugin_id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and char_length(plugin_id) between 3 and 60),
  -- Null only for the platform's own reference plugins seeded by a migration.
  owner_id            uuid references public.profiles (id),
  status              public.plugin_status not null default 'draft',
  -- The definition being built in the studio (partial until it passes the contract).
  draft               jsonb not null default '{}'::jsonb,
  current_version_id  uuid,
  -- Kill switch: blocks authoring and playback at once, with a translated message.
  disabled            boolean not null default false,
  disabled_message    jsonb not null default '{}'::jsonb,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.plugins is
  'A kind of learning activity. Definitions are data; the platform never imports or executes them (decision R7).';
comment on column public.plugins.disabled_message is 'Per-locale explanation shown while disabled, e.g. {"ar": "...", "fr": "..."}';
create index plugins_owner_idx on public.plugins (owner_id);
create index plugins_status_idx on public.plugins (status);

create table public.plugin_versions (
  id                 uuid primary key default gen_random_uuid(),
  plugin_id          uuid not null references public.plugins (id) on delete cascade,
  version            text not null check (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  version_number     integer not null,
  schema_version     integer not null check (schema_version >= 1),
  definition         jsonb not null,
  definition_sha256  text not null check (definition_sha256 ~ '^[0-9a-f]{64}$'),
  -- Null for seeded reference data.
  author_id          uuid references public.profiles (id),
  change_note        text check (change_note is null or char_length(change_note) <= 500),
  disabled           boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (plugin_id, version),
  unique (plugin_id, version_number)
);
comment on table public.plugin_versions is
  'Append-only. A published version is never edited; the player checks definition_sha256 before rendering.';

alter table public.plugins
  add constraint plugins_current_version_fk
    foreign key (current_version_id) references public.plugin_versions (id) on delete set null;

create table public.plugin_publish_requests (
  id                 uuid primary key default gen_random_uuid(),
  plugin_id          uuid not null references public.plugins (id) on delete cascade,
  requested_by       uuid not null references public.profiles (id),
  version            text not null check (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  definition         jsonb not null,
  definition_sha256  text not null check (definition_sha256 ~ '^[0-9a-f]{64}$'),
  change_note        text check (change_note is null or char_length(change_note) <= 500),
  status             public.plugin_request_status not null default 'pending',
  -- Translated in the interface from a fixed set of codes.
  decision_reason    text check (decision_reason is null or decision_reason in ('contract', 'quality', 'duplicate', 'policy', 'other')),
  decision_note      text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by         uuid references public.profiles (id),
  decided_at         timestamptz,
  created_at         timestamptz not null default now()
);
comment on table public.plugin_publish_requests is
  'A Contributor asks moderation to publish a version of their plugin (decision R10). One pending request per plugin.';
create unique index plugin_publish_requests_one_pending_idx on public.plugin_publish_requests (plugin_id)
  where status = 'pending';
create index plugin_publish_requests_queue_idx on public.plugin_publish_requests (status, created_at);

-- -----------------------------------------------------------------------------
-- Triggers: numbering, append-only history, owner-editable columns, audit
-- -----------------------------------------------------------------------------
create trigger plugins_set_updated_at before update on public.plugins
  for each row execute function public.set_updated_at();

create or replace function public.plugin_versions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.plugin_versions
   where plugin_id = new.plugin_id;
  return new;
end;
$$;
create trigger plugin_versions_number before insert on public.plugin_versions
  for each row execute function public.plugin_versions_before_insert();

-- The only change a published version accepts is its kill switch, by moderation.
create or replace function public.plugin_versions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.definition is distinct from old.definition
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
create trigger plugin_versions_append_only before update on public.plugin_versions
  for each row execute function public.plugin_versions_guard();

-- An owner edits the draft of their own plugin and nothing else; status,
-- publication pointer, kill switch and ownership belong to moderation and to
-- the publishing functions below.
create or replace function public.plugins_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Moderation, migrations, and the publishing functions below (which mark the transaction).
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
create trigger plugins_guard before insert or update on public.plugins
  for each row execute function public.plugins_guard();

create trigger audit_plugins after insert or update or delete on public.plugins
  for each row execute function public.write_audit_log();
create trigger audit_plugin_versions after insert or update on public.plugin_versions
  for each row execute function public.write_audit_log();
create trigger audit_plugin_publish_requests after insert or update on public.plugin_publish_requests
  for each row execute function public.write_audit_log();

-- -----------------------------------------------------------------------------
-- Roles: the Contributor path opens (decision R10)
-- -----------------------------------------------------------------------------
create or replace function public.become_contributor()
returns public.primary_role
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.primary_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.profiles
     set primary_role = 'contributor'
   where id = auth.uid()
     and primary_role = 'student'
  returning primary_role into result;

  if result is null then
    select primary_role into result from public.profiles where id = auth.uid();
    if result <> 'contributor' then
      raise exception 'role change from % to contributor is not allowed', result using errcode = '42501';
    end if;
  end if;

  return result;
end;
$$;
comment on function public.become_contributor() is
  'Student -> Contributor, chosen by the member after one server-verified acknowledgement. Never from Content Creator: one path only.';
revoke execute on function public.become_contributor() from public, anon;
grant execute on function public.become_contributor() to authenticated;

-- Support may now move an account between any of the three primary roles after review.
create or replace function public.admin_set_primary_role(p_user uuid, p_role public.primary_role)
returns public.primary_role
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role_value public.primary_role;
begin
  if public.current_admin_level() < 2 then
    raise exception 'administrator rank required' using errcode = '42501';
  end if;

  select primary_role into current_role_value from public.profiles where id = p_user for update;
  if current_role_value is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  update public.profiles set primary_role = p_role where id = p_user;
  return p_role;
end;
$$;
comment on function public.admin_set_primary_role(uuid, public.primary_role) is
  'Support action: Administrator rank or above moves an account between Student, Content Creator and Contributor after review.';

-- -----------------------------------------------------------------------------
-- Publishing (decision R10): the owner of the platform publishes directly,
-- a Contributor asks for a review. Both paths write the same append-only row.
-- -----------------------------------------------------------------------------
create or replace function public.plugin_publish_version(
  p_plugin uuid,
  p_version text,
  p_definition jsonb,
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
  insert into public.plugin_versions (plugin_id, version, schema_version, definition, definition_sha256, author_id, change_note)
  values (p_plugin, p_version, coalesce((p_definition ->> 'schema_version')::integer, 1), p_definition, p_sha256, p_author, p_note)
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
revoke execute on function public.plugin_publish_version(uuid, text, jsonb, text, uuid, text) from public, anon, authenticated;

create or replace function public.submit_plugin_version(
  p_plugin uuid,
  p_version text,
  p_definition jsonb,
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
  if (p_definition ->> 'plugin_id') is distinct from plugin_row.plugin_id then
    raise exception 'definition does not belong to this plugin' using errcode = '23514';
  end if;
  if exists (select 1 from public.plugin_versions v where v.plugin_id = p_plugin and v.version = p_version) then
    raise exception 'version % already exists', p_version using errcode = '23505';
  end if;

  -- plugins.publish: the Platform Owner in phase A (verified Contributors later, decision R10).
  if public.current_admin_level() >= 4 then
    perform public.plugin_publish_version(p_plugin, p_version, p_definition, p_sha256, auth.uid(), p_note);
    return 'published';
  end if;

  insert into public.plugin_publish_requests (plugin_id, requested_by, version, definition, definition_sha256, change_note)
  values (p_plugin, auth.uid(), p_version, p_definition, p_sha256, p_note);
  perform set_config('lisanhub.trusted_write', 'on', true);
  update public.plugins set status = 'pending_review' where id = p_plugin and status = 'draft';
  return 'requested';
end;
$$;
comment on function public.submit_plugin_version(uuid, text, jsonb, text, text) is
  'The owner of a plugin submits a validated definition: published at once with plugins.publish, otherwise queued for moderation review.';
revoke execute on function public.submit_plugin_version(uuid, text, jsonb, text, text) from public, anon;
grant execute on function public.submit_plugin_version(uuid, text, jsonb, text, text) to authenticated;

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
    perform public.plugin_publish_version(req.plugin_id, req.version, req.definition, req.definition_sha256, req.requested_by, req.change_note);
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
comment on function public.review_plugin_publish_request(uuid, boolean, text, text) is
  'plugins.review: moderation approves (publishes the requested version) or rejects with a translated reason code.';
revoke execute on function public.review_plugin_publish_request(uuid, boolean, text, text) from public, anon;
grant execute on function public.review_plugin_publish_request(uuid, boolean, text, text) to authenticated;

-- Kill switch (plugin or one version) and hiding: moderation only, effective at once.
create or replace function public.set_plugin_disabled(
  p_plugin uuid,
  p_version uuid,
  p_disabled boolean,
  p_message jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'moderator rank required' using errcode = '42501';
  end if;
  if p_version is null then
    update public.plugins set disabled = p_disabled, disabled_message = coalesce(p_message, '{}'::jsonb) where id = p_plugin;
  else
    update public.plugin_versions set disabled = p_disabled where id = p_version and plugin_id = p_plugin;
  end if;
  if not found then
    raise exception 'plugin not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_plugin_disabled(uuid, uuid, boolean, jsonb) from public, anon;
grant execute on function public.set_plugin_disabled(uuid, uuid, boolean, jsonb) to authenticated;

create or replace function public.set_plugin_hidden(p_plugin uuid, p_hidden boolean)
returns public.plugin_status
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.plugin_status;
begin
  if not public.is_moderator() then
    raise exception 'moderator rank required' using errcode = '42501';
  end if;
  update public.plugins
     set status = case when p_hidden then 'hidden'::public.plugin_status else 'published'::public.plugin_status end
   where id = p_plugin and current_version_id is not null and status in ('published', 'hidden')
  returning status into result;
  if result is null then
    raise exception 'only a published plugin can be hidden or shown' using errcode = '42501';
  end if;
  return result;
end;
$$;
revoke execute on function public.set_plugin_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_plugin_hidden(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.plugins enable row level security;
alter table public.plugin_versions enable row level security;
alter table public.plugin_publish_requests enable row level security;

-- Published plugins are public; hidden ones stay readable for the packages that use them;
-- drafts and pending ones are for their owner and moderation.
create policy plugins_read on public.plugins for select
  using (status in ('published', 'hidden') or owner_id = auth.uid() or public.is_moderator());
create policy plugins_insert_contributor on public.plugins for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (public.current_primary_role() = 'contributor' or public.current_admin_level() >= 4)
  );
create policy plugins_update_owner_or_moderator on public.plugins for update to authenticated
  using (owner_id = auth.uid() or public.is_moderator())
  with check (owner_id = auth.uid() or public.is_moderator());
create policy plugins_delete_own_draft on public.plugins for delete to authenticated
  using ((owner_id = auth.uid() and current_version_id is null and status = 'draft') or public.is_moderator());

create policy plugin_versions_read on public.plugin_versions for select
  using (
    exists (
      select 1 from public.plugins p
       where p.id = plugin_versions.plugin_id
         and (p.status in ('published', 'hidden') or p.owner_id = auth.uid() or public.is_moderator())
    )
  );
-- Versions are written by the publishing functions only.
revoke insert, update, delete on public.plugin_versions from authenticated, anon;
grant update (disabled) on public.plugin_versions to authenticated;
create policy plugin_versions_disable_moderation on public.plugin_versions for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy plugin_publish_requests_read on public.plugin_publish_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_moderator());
revoke insert, update, delete on public.plugin_publish_requests from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Limits are settings, never constants (decision R7)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('plugins.max_templates', '10', 'Templates a plugin definition may carry.'),
  ('plugins.max_definition_bytes', '262144', 'Size limit of one plugin definition, in bytes.')
on conflict (key) do nothing;
