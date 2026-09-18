-- =============================================================================
-- LisanHub — role changes by administration (Ahmed, 2026-09-17)
--
-- A member becomes a Content Creator once, deliberately, through
-- become_content_creator(). There is no self-service way back: returning to
-- Student is a support decision, taken by an Administrator (rank 2+) after
-- reviewing the case. Every change is audited (trigger audit_profile_role).
-- =============================================================================

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
  if p_role = 'contributor' then
    raise exception 'the contributor role is not open yet' using errcode = '42501';
  end if;

  select primary_role into current_role_value from public.profiles where id = p_user for update;
  if current_role_value is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if current_role_value = 'contributor' then
    raise exception 'contributor accounts cannot be changed here' using errcode = '42501';
  end if;

  update public.profiles set primary_role = p_role where id = p_user;
  return p_role;
end;
$$;
comment on function public.admin_set_primary_role(uuid, public.primary_role) is
  'Support action: Administrator rank or above moves an account between Student and Content Creator after review.';
revoke execute on function public.admin_set_primary_role(uuid, public.primary_role) from public, anon;
grant execute on function public.admin_set_primary_role(uuid, public.primary_role) to authenticated;

-- Where members are told to write when they need support (empty until Ahmed decides the channel).
insert into public.platform_settings (key, value, description) values
  ('support.email', '""', 'Address shown to members who must contact support (for example to return to a Student account).')
on conflict (key) do nothing;
