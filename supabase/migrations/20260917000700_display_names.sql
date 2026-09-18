-- =============================================================================
-- LisanHub — display names next to usernames (Ahmed, 2026-09-17)
--
-- `username` stays the unique Latin handle; `display_name` is the free-form
-- name shown to people and may be written in any script (Arabic included).
-- It defaults to the username so every profile always has one.
-- =============================================================================

alter table public.profiles add column display_name text;
update public.profiles set display_name = username where display_name is null;
alter table public.profiles
  alter column display_name set not null,
  add constraint profiles_display_name_check check (char_length(display_name) between 1 and 60);
comment on column public.profiles.display_name is 'Name shown to the community, any script; defaults to the username.';

grant update (display_name) on public.profiles to authenticated;

drop view public.profile_cards;
create view public.profile_cards as
  select id, username, display_name, primary_role, is_founding_member
    from public.profiles;
comment on view public.profile_cards is
  'Public attribution data for every account, independent of profile visibility. Never add private columns.';
grant select on public.profile_cards to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'user_' || left(replace(new.id::text, '-', ''), 8)
  );
begin
  insert into public.profiles (id, username, display_name, ui_locale)
  values (
    new.id,
    chosen_username,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 60), ''), chosen_username),
    coalesce(nullif(new.raw_user_meta_data ->> 'ui_locale', ''), 'ar')
  );
  return new;
end;
$$;
