-- =============================================================================
-- LisanHub — S1: accounts, roles and language pairs
--
--   * profile visibility (specification ch.7 "account and privacy settings"):
--     public by default; a restricted profile is readable by its owner and by
--     moderation only. The display name and the Founding Member badge stay
--     available to everyone through `profile_cards`, because every piece of
--     community content must carry a clear owner (roles-permissions, content-lineage).
--     Decided by Ahmed on 2026-09-17 (docs/decisions/resolved-decisions.md, R3).
--   * language search by ISO 639-3 code, ISO 639-1 code or English name
--   * a language pair joins two different languages
--   * the only role change of the MVP (Student -> Content Creator) is audited
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profile visibility
-- -----------------------------------------------------------------------------
create type public.profile_visibility as enum ('public', 'restricted');

alter table public.profiles
  add column visibility public.profile_visibility not null default 'public';
comment on column public.profiles.visibility is
  'public: anyone can read the profile. restricted: owner and moderation only; display name stays visible through profile_cards.';

grant update (visibility) on public.profiles to authenticated;

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (visibility = 'public' or id = auth.uid() or public.is_moderator());

-- Attribution card: the subset of a profile that community content, ratings and
-- chat may always show, whatever the visibility setting. Owned by the migration
-- role, so it reads through row level security on purpose (no private column here).
create view public.profile_cards as
  select id, display_name, primary_role, is_founding_member
    from public.profiles;
comment on view public.profile_cards is
  'Public attribution data for every account, independent of profile visibility. Never add private columns.';
grant select on public.profile_cards to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Language search (reference data; readable by guests)
-- -----------------------------------------------------------------------------
create index languages_name_en_trgm_idx on public.languages using gin (name_en extensions.gin_trgm_ops);

create or replace function public.search_languages(q text, max_results integer default 20)
returns table (code text, iso639_1 text, name_en text, direction text)
language sql
stable
set search_path = public
as $$
  with needle as (
    select lower(trim(coalesce(q, ''))) as n
  )
  select l.code, l.iso639_1, l.name_en, l.direction
    from public.languages l, needle
   where needle.n <> ''
     and (
       l.code like needle.n || '%'
       or l.iso639_1 = needle.n
       or l.name_en ilike '%' || needle.n || '%'
     )
   order by
     (l.code = needle.n or coalesce(l.iso639_1, '') = needle.n) desc,
     (l.code like needle.n || '%') desc,
     (l.lang_type = 'L') desc,
     (l.scope = 'I') desc,
     (l.name_en ilike needle.n || '%') desc,
     l.name_en
   limit greatest(1, least(coalesce(max_results, 20), 50));
$$;
comment on function public.search_languages(text, integer) is
  'Typeahead over ISO 639-3 languages: exact code first, then code prefix, living and individual languages, then name.';
grant execute on function public.search_languages(text, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Language pairs: comfortable language -> target language, never the same one
-- -----------------------------------------------------------------------------
alter table public.language_pairs
  add constraint language_pairs_distinct_languages check (native_lang <> target_lang);

-- -----------------------------------------------------------------------------
-- Audit: primary role changes (Student -> Content Creator through become_content_creator)
-- -----------------------------------------------------------------------------
create trigger audit_profile_role after update of primary_role on public.profiles
  for each row
  when (old.primary_role is distinct from new.primary_role)
  execute function public.write_audit_log();
