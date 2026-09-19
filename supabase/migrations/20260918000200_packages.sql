-- =============================================================================
-- LisanHub — content is a package file built for a plugin (decision R7, ADR 0006)
--
--   * content_items keeps metadata plus the plugin reference, the key of the
--     working copy (`.lisanpkg` in the private store) and its sha256
--   * content_versions no longer carries a body: each version points at an
--     immutable package key and hash, so rollback is a pointer change
--   * courses order packages of their own author (decision R11)
--   * limits are settings; published packages are downloadable by members
--
-- Applied while content_items and content_versions are empty (no authoring
-- existed before S2), which is why the new NOT NULL columns need no backfill.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- content_items: the working copy and the plugin reference
-- -----------------------------------------------------------------------------
alter table public.content_items
  add column plugin_id          uuid references public.plugins (id),
  add column plugin_version_id  uuid references public.plugin_versions (id),
  add column package_key        text check (package_key is null or package_key ~ '^packages/[0-9a-f-]{36}/[a-z0-9._-]+\.lisanpkg$'),
  add column package_sha256     text check (package_sha256 is null or package_sha256 ~ '^[0-9a-f]{64}$'),
  add column items_count        integer not null default 0 check (items_count >= 0);
comment on column public.content_items.package_key is
  'Relative object key of the working copy in the private store (never a URL). Versions keep their own immutable keys.';

-- A course orders packages and has no plugin; a package always has one. Lesson and deck kinds are retired.
alter table public.content_items
  add constraint content_items_kind_plugin check (
    (kind = 'course' and plugin_id is null and plugin_version_id is null and package_key is null and package_sha256 is null)
    or (kind = 'package' and plugin_id is not null)
  );
create index content_items_plugin_idx on public.content_items (plugin_id);

-- -----------------------------------------------------------------------------
-- content_versions: a pointer to a package, never the content
-- -----------------------------------------------------------------------------
alter table public.content_versions drop column body;
alter table public.content_versions
  add column package_key        text not null check (package_key ~ '^packages/[0-9a-f-]{36}/[a-z0-9._-]+\.lisanpkg$'),
  add column package_sha256     text not null check (package_sha256 ~ '^[0-9a-f]{64}$'),
  add column plugin_version_id  uuid references public.plugin_versions (id),
  add column items_count        integer not null default 0 check (items_count >= 0);
comment on table public.content_versions is
  'Append-only history. Each version points at an immutable package file; rolling back adds a version that points at an earlier file.';

-- A package is published only once it has a version to show.
create or replace function public.content_items_publish_guard()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'package' and new.status = 'published' and new.current_version_id is null then
    raise exception 'a package needs a published version' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger content_items_publish_guard before insert or update on public.content_items
  for each row execute function public.content_items_publish_guard();

-- Rollback: the owner (or moderation) republishes an earlier version as a new
-- one. The server copies the file to the working copy first; here only pointers move.
create or replace function public.rollback_content_version(p_item uuid, p_version uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.content_items%rowtype;
  target public.content_versions%rowtype;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into item_row from public.content_items where id = p_item for update;
  if item_row.id is null then
    raise exception 'content not found' using errcode = 'P0002';
  end if;
  if item_row.owner_id <> auth.uid() and not public.is_moderator() then
    raise exception 'only the owner or moderation can roll back' using errcode = '42501';
  end if;
  select * into target from public.content_versions where id = p_version and item_id = p_item;
  if target.id is null then
    raise exception 'version not found' using errcode = 'P0002';
  end if;
  if target.id = item_row.current_version_id then
    raise exception 'already the current version' using errcode = '23514';
  end if;

  insert into public.content_versions (item_id, package_key, package_sha256, plugin_version_id, items_count, author_id, change_note)
  values (p_item, target.package_key, target.package_sha256, target.plugin_version_id, target.items_count, auth.uid(),
          'rollback:' || target.version_number)
  returning id into new_id;

  update public.content_items
     set current_version_id = new_id,
         package_sha256 = target.package_sha256,
         plugin_version_id = target.plugin_version_id,
         items_count = target.items_count
   where id = p_item;
  return new_id;
end;
$$;
revoke execute on function public.rollback_content_version(uuid, uuid) from public, anon;
grant execute on function public.rollback_content_version(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Courses order the author's own packages (decision R11)
-- -----------------------------------------------------------------------------
drop policy course_lessons_write_owner on public.course_lessons;
create policy course_lessons_write_owner on public.course_lessons for all to authenticated
  using (exists (select 1 from public.content_items c where c.id = course_lessons.course_id and c.owner_id = auth.uid()))
  with check (
    exists (
      select 1
        from public.content_items c
        join public.content_items l on l.id = course_lessons.lesson_id
       where c.id = course_lessons.course_id
         and c.owner_id = auth.uid()
         and c.kind = 'course'
         and l.kind = 'package'
         and l.owner_id = c.owner_id
    )
  );

-- -----------------------------------------------------------------------------
-- Storage: packages live in the private store; members read published ones
-- -----------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array_append(allowed_mime_types, 'application/zip')
 where id = 'media-private' and not ('application/zip' = any (allowed_mime_types));

-- True for the package file of the current published version of a published item.
create or replace function public.package_readable(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.content_items i
      join public.content_versions v on v.id = i.current_version_id
     where v.package_key = object_name
       and i.status = 'published'
  );
$$;

create policy media_private_read_published_packages on storage.objects for select to authenticated
  using (bucket_id = 'media-private' and public.package_readable(name));

-- -----------------------------------------------------------------------------
-- Limits are settings, never constants (decision R7)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, description) values
  ('packages.max_bytes', '10485760', 'Size limit of one .lisanpkg file, in bytes.'),
  ('packages.max_items', '200', 'Items one package may hold.'),
  ('packages.max_assets', '50', 'Assets one package may hold.'),
  ('packages.max_asset_bytes', '1048576', 'Size limit of one asset inside a package, in bytes.')
on conflict (key) do nothing;
