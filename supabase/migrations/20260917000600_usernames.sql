-- =============================================================================
-- LisanHub — usernames (Ahmed, 2026-09-17)
--
-- The profile name becomes a unique username: 4–30 characters, letters, digits,
-- underscore and dot, starting with a letter or digit, unique without regard
-- to letter case. It is what other members see and, later, the public profile
-- address. Accounts created without a username (dashboard, imports) get a
-- generated one they can change.
-- =============================================================================

alter table public.profiles rename column display_name to username;
alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles
  add constraint profiles_username_check check (username ~ '^[A-Za-z0-9][A-Za-z0-9_.]{3,29}$');
create unique index profiles_username_unique on public.profiles (lower(username));
comment on column public.profiles.username is
  'Unique handle shown to the community (case-insensitive uniqueness, 4-30 chars, [A-Za-z0-9_.]).';

-- Public attribution card follows the rename (a view cannot rename a column in place).
drop view public.profile_cards;
create view public.profile_cards as
  select id, username, primary_role, is_founding_member
    from public.profiles;
comment on view public.profile_cards is
  'Public attribution data for every account, independent of profile visibility. Never add private columns.';
grant select on public.profile_cards to anon, authenticated;

-- Profile creation reads the username chosen at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, ui_locale)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      'user_' || left(replace(new.id::text, '-', ''), 8)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'ui_locale', ''), 'ar')
  );
  return new;
end;
$$;

-- Availability check for the sign-up form (guests included). Reveals only whether
-- a handle is free, never who holds it.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[A-Za-z0-9][A-Za-z0-9_.]{3,29}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;
grant execute on function public.username_available(text) to anon, authenticated;
