-- =============================================================================
-- LisanHub — learning content stays inside its language pair; English titles
-- with optional translations (decisions R15 and R16, 2026-09-18)
--
-- R15: every learning item belongs to exactly one pair (comfortable language ->
--      target language). A course only ever holds packages of its own pair, so a
--      learner of one pair never meets material of another.
-- R16: the title of a package or course is written in English (Latin script);
--      translating it — and the summary — into the interface languages is
--      optional and stored in `translations`, never a second required field.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- R15: a course and its lessons share one pair (and lessons are packages)
-- -----------------------------------------------------------------------------
create or replace function public.course_lessons_same_pair()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.content_items%rowtype;
  v_lesson public.content_items%rowtype;
begin
  select * into v_course from public.content_items where id = new.course_id;
  select * into v_lesson from public.content_items where id = new.lesson_id;
  if v_course.id is null or v_lesson.id is null then
    raise exception 'course or lesson not found' using errcode = 'foreign_key_violation';
  end if;
  if v_course.kind <> 'course' or v_lesson.kind <> 'package' then
    raise exception 'a course holds packages only' using errcode = 'check_violation';
  end if;
  if v_course.source_lang <> v_lesson.source_lang or v_course.target_lang <> v_lesson.target_lang then
    raise exception 'a course holds packages of its own language pair only (decision R15)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger course_lessons_same_pair
  before insert or update on public.course_lessons
  for each row execute function public.course_lessons_same_pair();

-- The pair of an item is fixed once it is inside a course (or is a course with lessons).
create or replace function public.content_items_pair_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.source_lang, new.target_lang) is distinct from (old.source_lang, old.target_lang) then
    if exists (select 1 from public.course_lessons l where l.course_id = new.id or l.lesson_id = new.id) then
      raise exception 'the language pair cannot change while the item belongs to a course (decision R15)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger content_items_pair_locked
  before update of source_lang, target_lang on public.content_items
  for each row execute function public.content_items_pair_locked();

-- -----------------------------------------------------------------------------
-- R16: English title, optional translations of title and summary
-- -----------------------------------------------------------------------------
-- Latin letters (with accents), digits, spaces and common punctuation; at least one letter or digit.
alter table public.content_items
  add constraint content_items_title_latin check (
    title ~ '^[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ ''’.,:;!?()&/+"–—-]*$'
  );

-- {"ar": {"title": "...", "summary": "..."}, "fr": {...}} — every key optional, interface languages only.
create or replace function public.content_translations_valid(value jsonb)
returns boolean
language sql
immutable
as $$
  select value is not null
     and jsonb_typeof(value) = 'object'
     and not exists (
       select 1 from jsonb_each(value) as t(locale, entry)
        where t.locale not in ('ar', 'fr', 'en')
           or jsonb_typeof(t.entry) <> 'object'
           or exists (
             select 1 from jsonb_each(t.entry) as f(field, text)
              where f.field not in ('title', 'summary')
                 or jsonb_typeof(f.text) <> 'string'
                 or (f.field = 'title' and char_length(f.text #>> '{}') > 200)
                 or (f.field = 'summary' and char_length(f.text #>> '{}') > 2000)
           )
     );
$$;

alter table public.content_items
  add column translations jsonb not null default '{}'::jsonb,
  add constraint content_items_translations_valid check (public.content_translations_valid(translations));

comment on column public.content_items.translations is
  'Optional translations of title and summary per interface language (decision R16). The English title stays in `title`.';

-- Search covers the translated titles too (metadata only, decision Q19).
alter table public.content_items drop column search;
alter table public.content_items add column search tsvector generated always as (
  to_tsvector('simple',
    coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' ||
    coalesce(translations #>> '{ar,title}', '') || ' ' ||
    coalesce(translations #>> '{fr,title}', '') || ' ' ||
    coalesce(translations #>> '{en,title}', ''))
) stored;
create index content_items_search_idx on public.content_items using gin (search);
