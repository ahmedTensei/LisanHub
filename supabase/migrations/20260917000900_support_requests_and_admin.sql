-- =============================================================================
-- LisanHub — support requests and the first administration tools (Ahmed, 2026-09-17)
--
-- Members write to support from inside the platform (no email needed). Staff
-- handle requests, reports and feedback from a dedicated administration area
-- instead of the Supabase dashboard. Every administrative change stays a
-- database function guarded by the administrative ranks and audited.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Support requests
-- -----------------------------------------------------------------------------
create type public.support_request_kind as enum ('revert_to_student', 'other');
create type public.support_request_status as enum ('open', 'in_review', 'resolved', 'rejected');

create table public.support_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  kind             public.support_request_kind not null,
  message          text check (message is null or char_length(message) <= 2000),
  status           public.support_request_status not null default 'open',
  handled_by       uuid references public.profiles (id),
  resolution_note  text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
comment on table public.support_requests is
  'Requests members send to support from the platform; handled by staff in the administration area.';
create index support_requests_queue_idx on public.support_requests (status, created_at);
create index support_requests_user_idx on public.support_requests (user_id);
-- One pending request of a kind per member.
create unique index support_requests_one_pending_idx on public.support_requests (user_id, kind)
  where status in ('open', 'in_review');

create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function public.set_updated_at();
create trigger audit_support_requests after update on public.support_requests
  for each row execute function public.write_audit_log();

alter table public.support_requests enable row level security;
create policy support_requests_insert_own on public.support_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy support_requests_read_own_or_staff on public.support_requests for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
revoke update, delete on public.support_requests from authenticated, anon;

-- Staff decision. Returning a member to Student is executed here, atomically,
-- and needs Administrator rank; other requests need Moderator rank.
create or replace function public.resolve_support_request(
  p_request uuid,
  p_status public.support_request_status,
  p_note text default null
)
returns public.support_request_status
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.support_requests%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'moderator rank required' using errcode = '42501';
  end if;
  if p_status = 'open' then
    raise exception 'a handled request cannot be reopened here' using errcode = '22023';
  end if;

  select * into req from public.support_requests where id = p_request for update;
  if req.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if req.status in ('resolved', 'rejected') then
    raise exception 'request already closed' using errcode = '22023';
  end if;

  if p_status = 'resolved' and req.kind = 'revert_to_student' then
    perform public.admin_set_primary_role(req.user_id, 'student');
  end if;

  update public.support_requests
     set status = p_status,
         handled_by = auth.uid(),
         resolution_note = coalesce(p_note, resolution_note),
         resolved_at = case when p_status in ('resolved', 'rejected') then now() else resolved_at end
   where id = p_request;

  insert into public.notifications (user_id, kind, payload)
  values (req.user_id, 'support.request_' || p_status::text, jsonb_build_object('request_id', req.id, 'kind', req.kind));

  return p_status;
end;
$$;
revoke execute on function public.resolve_support_request(uuid, public.support_request_status, text) from public, anon;
grant execute on function public.resolve_support_request(uuid, public.support_request_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Administrative ranks assigned from the administration area
-- -----------------------------------------------------------------------------
-- Super Administrator or above assigns Moderator/Administrator; only the
-- Platform Owner touches Super Administrator or Platform Owner ranks. Nobody
-- changes a rank equal to or above their own unless they are the owner.
create or replace function public.admin_set_rank(p_user uuid, p_rank public.admin_rank)
returns public.admin_rank
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_level integer := public.current_admin_level();
  target_level integer := coalesce((select public.admin_rank_level(rank) from public.admin_ranks where user_id = p_user), 0);
  new_level integer := coalesce(public.admin_rank_level(p_rank), 0);
begin
  if caller_level < 3 then
    raise exception 'super administrator rank required' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot change your own rank' using errcode = '42501';
  end if;
  if caller_level < 4 and (target_level >= caller_level or new_level >= caller_level) then
    raise exception 'only the platform owner assigns or removes this rank' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if p_rank is null then
    delete from public.admin_ranks where user_id = p_user;
  else
    insert into public.admin_ranks (user_id, rank, granted_by)
    values (p_user, p_rank, auth.uid())
    on conflict (user_id) do update set rank = excluded.rank, granted_by = excluded.granted_by, granted_at = now();
  end if;
  return p_rank;
end;
$$;
revoke execute on function public.admin_set_rank(uuid, public.admin_rank) from public, anon;
grant execute on function public.admin_set_rank(uuid, public.admin_rank) to authenticated;

-- -----------------------------------------------------------------------------
-- Staff can triage platform feedback (the policy already restricts it to moderation).
-- -----------------------------------------------------------------------------
grant update (status) on public.product_feedback to authenticated;
