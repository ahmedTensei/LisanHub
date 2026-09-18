-- =============================================================================
-- LisanHub — richer profiles and an unrestricted Platform Owner (Ahmed, 2026-09-17)
--
--   * profile picture (object key in the public store, ADR 0005), bio, location
--   * the Platform Owner rank is never limited by the primary role: it may
--     create community content like a Content Creator (decision R6)
-- =============================================================================

alter table public.profiles
  add column avatar_key text check (avatar_key is null or avatar_key ~ '^avatars/[0-9a-f-]{36}/[a-z0-9._-]+$'),
  add column bio text check (bio is null or char_length(bio) <= 500),
  add column location text check (location is null or char_length(location) <= 80);
comment on column public.profiles.avatar_key is 'Relative object key in the public store (never a URL).';

grant update (avatar_key, bio, location) on public.profiles to authenticated;

drop view public.profile_cards;
create view public.profile_cards as
  select id, username, display_name, avatar_key, primary_role, is_founding_member
    from public.profiles;
comment on view public.profile_cards is
  'Public attribution data for every account, independent of profile visibility. Never add private columns.';
grant select on public.profile_cards to anon, authenticated;

-- The Platform Owner creates community content without holding the Content Creator role.
drop policy content_items_insert_creator on public.content_items;
create policy content_items_insert_creator on public.content_items for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (public.current_primary_role() = 'content_creator' or public.current_admin_level() >= 4)
  );
