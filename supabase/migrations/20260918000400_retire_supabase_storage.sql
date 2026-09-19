-- =============================================================================
-- LisanHub — files leave Supabase Storage for Cloudflare R2 (decision R13, ADR 0008)
--
-- Supabase keeps accounts and metadata (object keys, hashes, plugin references);
-- every file — packages, package assets, profile pictures — lives in R2 behind
-- the platform's StorageProvider. Ownership of files is now decided by the
-- application layer (src/server/packages/access.ts, the account actions), which
-- already checks the actor and row level security on the metadata rows.
--
-- Fail closed: the migration refuses to run while a file is still in a bucket.
-- The two empty buckets themselves cannot be dropped from SQL (Supabase refuses
-- direct writes to storage tables); without any policy they accept and serve
-- nothing, and they are removed once through the Storage API:
--   npx supabase storage rm ss:///media-public ss:///media-private -r --linked --experimental
-- (docs/SETUP.md). `npm run db:verify` checks they are gone or inert.
-- =============================================================================

do $$
begin
  if exists (select 1 from storage.objects where bucket_id in ('media-public', 'media-private')) then
    raise exception 'Supabase Storage still holds objects in media-public/media-private; move them to R2 first (docs/adr/0008-files-on-cloudflare-r2.md)';
  end if;
end $$;

drop policy if exists media_private_read_published_packages on storage.objects;
drop policy if exists media_public_read on storage.objects;
drop policy if exists media_public_insert_own on storage.objects;
drop policy if exists media_public_update_own on storage.objects;
drop policy if exists media_public_delete_own_or_moderation on storage.objects;
drop policy if exists media_private_read_own_or_moderation on storage.objects;
drop policy if exists media_private_insert_own on storage.objects;
drop policy if exists media_private_update_own on storage.objects;
drop policy if exists media_private_delete_own on storage.objects;

drop function if exists public.package_readable(text);
drop function if exists public.storage_object_owner(text);
