-- =============================================================================
-- LisanHub — storage buckets and object ownership (ADR 0005)
--
-- Two logical stores, one bucket each, behind the StorageProvider abstraction:
--   * media-public  : assets with a stable public URL (lesson media, avatars)
--   * media-private : per-user files reached through signed URLs (exports)
--
-- Object keys follow src/modules/storage/keys.ts: `<area>/<owner_id>/<file>`.
-- The owner id in the second path segment is what these policies check, so
-- ownership is enforced by the database even for direct API calls, exactly
-- like the ownership rules on content. Bucket-level size and MIME ceilings are
-- infrastructure guards; per-area limits become platform settings with the
-- first upload feature (S2).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media-public', 'media-public', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/ogg', 'audio/webm']),
  ('media-private', 'media-private', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'application/json'])
on conflict (id) do nothing;

-- Owner of an object according to the platform key layout (`area/<owner_id>/file`).
create or replace function public.storage_object_owner(object_name text)
returns text
language sql
immutable
as $$
  select case
    when array_length(storage.foldername(object_name), 1) = 2 then (storage.foldername(object_name))[2]
    else null
  end;
$$;

create policy media_public_read on storage.objects for select
  using (bucket_id = 'media-public');

create policy media_public_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media-public' and public.storage_object_owner(name) = auth.uid()::text);

create policy media_public_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media-public' and public.storage_object_owner(name) = auth.uid()::text)
  with check (bucket_id = 'media-public' and public.storage_object_owner(name) = auth.uid()::text);

create policy media_public_delete_own_or_moderation on storage.objects for delete to authenticated
  using (bucket_id = 'media-public' and (public.storage_object_owner(name) = auth.uid()::text or public.is_moderator()));

create policy media_private_read_own_or_moderation on storage.objects for select to authenticated
  using (bucket_id = 'media-private' and (public.storage_object_owner(name) = auth.uid()::text or public.is_moderator()));

create policy media_private_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media-private' and public.storage_object_owner(name) = auth.uid()::text);

create policy media_private_update_own on storage.objects for update to authenticated
  using (bucket_id = 'media-private' and public.storage_object_owner(name) = auth.uid()::text)
  with check (bucket_id = 'media-private' and public.storage_object_owner(name) = auth.uid()::text);

create policy media_private_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media-private' and public.storage_object_owner(name) = auth.uid()::text);
