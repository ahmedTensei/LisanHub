-- =============================================================================
-- LisanHub — initial schema (MVP foundations)
--
-- Encodes the specification's structural rules at the database boundary:
--   * ownership: a user edits only what they own; only the four administrative
--     ranks may edit content they do not own                  (roles-permissions)
--   * a Student never publishes; only a Content Creator creates community
--     content. Local personal copies never reach this database (ugc-content-system)
--   * content history is append-only; derivation keeps provenance (content-lineage)
--   * account and learning progress is stored for every user, free
--   * the platform is entirely free until the final stage: no subscriptions,
--     payments, entitlements or paid content tables exist yet
--     (docs/decisions/resolved-decisions.md, decision R2)
--   * moderation thresholds are configuration, not code
--
-- Authorization in application code mirrors these rules through the capability
-- layer in src/modules/authorization. The database is the last line of defence.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.primary_role as enum ('student', 'content_creator', 'contributor');
create type public.admin_rank as enum ('moderator', 'administrator', 'super_administrator', 'platform_owner');
create type public.content_kind as enum ('course', 'lesson', 'deck');
create type public.content_status as enum ('draft', 'published', 'archived', 'hidden', 'removed');
create type public.quality_label as enum ('founding_team_reviewed', 'new_community_content', 'community_trusted');
create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type public.language_skill as enum ('listening', 'reading', 'pronunciation', 'writing');
create type public.report_type as enum ('error', 'violation', 'outdated_expression', 'copyright');
create type public.report_status as enum ('open', 'acknowledged', 'resolved', 'dismissed', 'escalated');
create type public.progress_state as enum ('not_started', 'in_progress', 'completed');
create type public.feature_mode as enum ('enabled', 'create_disabled', 'read_only', 'disabled');

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Languages (reference data, filled by a later migration)
-- -----------------------------------------------------------------------------
create table public.languages (
  code        text primary key check (code ~ '^[a-z]{3}$'),
  iso639_1    text check (iso639_1 is null or iso639_1 ~ '^[a-z]{2}$'),
  name_en     text not null,
  scope       text not null default 'I',
  lang_type   text not null default 'L',
  direction   text not null default 'ltr' check (direction in ('ltr', 'rtl')),
  created_at  timestamptz not null default now()
);
comment on table public.languages is
  'ISO 639-3 languages. A content language pair references two rows. New languages are data, never code.';

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null check (char_length(display_name) between 1 and 60),
  ui_locale           text not null default 'ar' check (ui_locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  -- Exactly one primary role per user; Content Creator and Contributor are
  -- mutually exclusive by construction.
  primary_role        public.primary_role not null default 'student',
  is_founding_member  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on column public.profiles.ui_locale is 'Interface language. Never used to filter learning content.';

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.admin_ranks (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  rank        public.admin_rank not null,
  granted_by  uuid references public.profiles (id),
  granted_at  timestamptz not null default now()
);
comment on table public.admin_ranks is
  'Administrative ranks are assigned directly by administration; never earned through reputation or verification.';

create or replace function public.admin_rank_level(r public.admin_rank)
returns integer
language sql
immutable
as $$
  select case r
    when 'moderator' then 1
    when 'administrator' then 2
    when 'super_administrator' then 3
    when 'platform_owner' then 4
  end;
$$;

create or replace function public.current_admin_level()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.admin_rank_level(rank) from public.admin_ranks where user_id = auth.uid()),
    0
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
as $$
  select public.current_admin_level() >= 1;
$$;

create or replace function public.current_primary_role()
returns public.primary_role
language sql
stable
security definer
set search_path = public
as $$
  select primary_role from public.profiles where id = auth.uid();
$$;

-- Create a Student profile for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, ui_locale)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Learner'),
    coalesce(nullif(new.raw_user_meta_data ->> 'ui_locale', ''), 'ar')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The only way to change a primary role in the MVP: Student -> Content Creator.
-- Contributor is deferred with all executable content (mvp-scope).
create or replace function public.become_content_creator()
returns public.primary_role
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.primary_role;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.profiles
     set primary_role = 'content_creator'
   where id = auth.uid()
     and primary_role = 'student'
  returning primary_role into result;

  if result is null then
    select primary_role into result from public.profiles where id = auth.uid();
    if result <> 'content_creator' then
      raise exception 'role change from % to content_creator is not allowed', result using errcode = '42501';
    end if;
  end if;

  return result;
end;
$$;

create table public.language_pairs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  native_lang  text not null references public.languages (code),
  target_lang  text not null references public.languages (code),
  -- Preferred dialect of the target language: a ranking signal, never a filter.
  dialect_tag  text check (dialect_tag is null or dialect_tag ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  goal         text check (goal is null or char_length(goal) <= 200),
  created_at   timestamptz not null default now(),
  unique (user_id, native_lang, target_lang)
);

-- -----------------------------------------------------------------------------
-- Community content, versions and lineage
-- -----------------------------------------------------------------------------
create table public.content_items (
  id                       uuid primary key default gen_random_uuid(),
  kind                     public.content_kind not null,
  owner_id                 uuid not null references public.profiles (id),
  source_lang              text not null references public.languages (code),
  target_lang              text not null references public.languages (code),
  dialect_tag              text check (dialect_tag is null or dialect_tag ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                    text not null check (char_length(title) between 1 and 200),
  summary                  text check (summary is null or char_length(summary) <= 2000),
  cefr_level               public.cefr_level,
  cefr_sublevel            smallint check (cefr_sublevel between 1 and 9),
  skills                   public.language_skill[] not null default '{}',
  tags                     text[] not null default '{}',
  status                   public.content_status not null default 'draft',
  -- Always false until the final commercial stage. Kept so the rule "paid content
  -- cannot be derived" is enforced from day one without a later data migration.
  is_paid                  boolean not null default false,
  -- Licence of freely reusable content: pending decision Q7 (docs/decisions/open-decisions.md).
  license                  text,
  quality_label            public.quality_label not null default 'new_community_content',
  maintenance_paused       boolean not null default false,
  current_version_id       uuid,
  derived_from_version_id  uuid,
  root_item_id             uuid references public.content_items (id) on delete set null,
  -- Attribution snapshot captured at derivation time; survives source removal.
  provenance               jsonb,
  published_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  search                   tsvector generated always as (
                             to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, ''))
                           ) stored,
  constraint cefr_sublevel_requires_level check (cefr_sublevel is null or cefr_level is not null)
);
comment on column public.content_items.owner_id is
  'Clear owner at all times. Account deletion keeps public contributions (spec ch.7); handled by the account-deletion workflow.';

create index content_items_discovery_idx on public.content_items (status, source_lang, target_lang, cefr_level);
create index content_items_owner_idx on public.content_items (owner_id);
create index content_items_tags_idx on public.content_items using gin (tags);
create index content_items_search_idx on public.content_items using gin (search);
create index content_items_title_trgm_idx on public.content_items using gin (title extensions.gin_trgm_ops);
create index content_items_root_idx on public.content_items (root_item_id);

create trigger content_items_set_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

create table public.content_versions (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.content_items (id) on delete cascade,
  version_number  integer not null,
  body            jsonb not null,
  schema_version  integer not null default 1,
  author_id       uuid not null references public.profiles (id),
  change_note     text check (change_note is null or char_length(change_note) <= 500),
  created_at      timestamptz not null default now(),
  unique (item_id, version_number)
);
comment on table public.content_versions is
  'Append-only history. Rolling back creates a new version with an earlier body; history is never rewritten.';

alter table public.content_items
  add constraint content_items_current_version_fk
    foreign key (current_version_id) references public.content_versions (id) on delete set null,
  add constraint content_items_derived_from_version_fk
    foreign key (derived_from_version_id) references public.content_versions (id) on delete set null;

create table public.course_lessons (
  course_id  uuid not null references public.content_items (id) on delete cascade,
  lesson_id  uuid not null references public.content_items (id) on delete cascade,
  position   integer not null check (position >= 0),
  primary key (course_id, lesson_id)
);

create or replace function public.published_version_number(p_item uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select v.version_number
    from public.content_items i
    join public.content_versions v on v.id = i.current_version_id
   where i.id = p_item;
$$;

-- Version numbering and author are assigned by the database.
create or replace function public.content_versions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.content_versions
   where item_id = new.item_id;

  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger content_versions_number before insert on public.content_versions
  for each row execute function public.content_versions_before_insert();

create or replace function public.forbid_history_rewrite()
returns trigger
language plpgsql
as $$
begin
  raise exception 'content history is append-only' using errcode = '42501';
end;
$$;

create trigger content_versions_append_only before update on public.content_versions
  for each row execute function public.forbid_history_rewrite();

-- Guards the fields an ordinary owner may not change, and validates derivation.
create or replace function public.content_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_as_moderator boolean := public.is_moderator() or auth.uid() is null;
  src record;
begin
  if tg_op = 'INSERT' then
    if not acting_as_moderator then
      new.quality_label := 'new_community_content';
      if new.status not in ('draft', 'published') then
        raise exception 'new content must start as draft or published' using errcode = '42501';
      end if;
    end if;

    if new.derived_from_version_id is not null then
      select i.id, i.title, i.owner_id, i.status, i.is_paid, i.root_item_id, v.version_number
        into src
        from public.content_versions v
        join public.content_items i on i.id = v.item_id
       where v.id = new.derived_from_version_id;

      if src.id is null then
        raise exception 'derivation source not found' using errcode = '23503';
      end if;
      if src.is_paid then
        raise exception 'paid content cannot be copied or derived' using errcode = '42501';
      end if;
      if src.status <> 'published' then
        raise exception 'only published content can be derived' using errcode = '42501';
      end if;

      new.root_item_id := coalesce(src.root_item_id, src.id);
      new.provenance := jsonb_build_object(
        'source_item_id', src.id,
        'source_version_id', new.derived_from_version_id,
        'source_version_number', src.version_number,
        'source_title', src.title,
        'source_owner_id', src.owner_id,
        'derived_at', now()
      );
    else
      new.root_item_id := null;
      new.provenance := null;
    end if;
  else
    if not acting_as_moderator then
      if new.owner_id is distinct from old.owner_id
         or new.quality_label is distinct from old.quality_label
         or new.derived_from_version_id is distinct from old.derived_from_version_id
         or new.root_item_id is distinct from old.root_item_id
         or new.provenance is distinct from old.provenance
         or new.is_paid is distinct from old.is_paid then
        raise exception 'field is not editable by the owner' using errcode = '42501';
      end if;
      if new.status in ('hidden', 'removed') and new.status is distinct from old.status then
        raise exception 'only moderation can hide or remove content' using errcode = '42501';
      end if;
      if old.status in ('hidden', 'removed') and new.status is distinct from old.status then
        raise exception 'only moderation can restore hidden or removed content' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.current_version_id is not null and not exists (
    select 1 from public.content_versions v where v.id = new.current_version_id and v.item_id = new.id
  ) then
    raise exception 'current version must belong to the same item' using errcode = '23514';
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger content_items_guard before insert or update on public.content_items
  for each row execute function public.content_items_guard();

-- -----------------------------------------------------------------------------
-- Learning progress — free for every registered user, never gated
-- -----------------------------------------------------------------------------
create table public.progress (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  item_id        uuid not null references public.content_items (id) on delete cascade,
  version_id     uuid references public.content_versions (id) on delete set null,
  state          public.progress_state not null default 'in_progress',
  last_block_id  text,
  score          numeric(5, 4) check (score between 0 and 1),
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, item_id)
);
comment on table public.progress is
  'Account and learning progress. Stored server-side for every registered user, free, and never gated.';

create trigger progress_set_updated_at before update on public.progress
  for each row execute function public.set_updated_at();

create table public.review_states (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  card_key        text not null check (char_length(card_key) between 1 and 200),
  item_id         uuid references public.content_items (id) on delete cascade,
  due             timestamptz not null,
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  scheduled_days  integer not null default 0,
  learning_steps  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  state           smallint not null default 0 check (state between 0 and 3),
  last_review     timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, card_key)
);
comment on table public.review_states is 'FSRS scheduling state per learner and card. Progress data: always free.';
create index review_states_due_idx on public.review_states (user_id, due);

create trigger review_states_set_updated_at before update on public.review_states
  for each row execute function public.set_updated_at();

create table public.activity_days (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null,
  primary key (user_id, day)
);
comment on table public.activity_days is 'Activity streak source. Progress data: always free.';

-- -----------------------------------------------------------------------------
-- Community quality: reports, feedback, ratings
-- -----------------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  item_id          uuid not null references public.content_items (id) on delete cascade,
  version_id       uuid references public.content_versions (id) on delete set null,
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  report_type      public.report_type not null,
  -- Precise location inside the content: {"blockId": "...", "from": 0, "to": 12}
  anchor           jsonb check (anchor is null or anchor ? 'blockId'),
  message          text check (message is null or char_length(message) <= 2000),
  status           public.report_status not null default 'open',
  resolution_note  text,
  resolved_by      uuid references public.profiles (id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index reports_item_status_idx on public.reports (item_id, status);

-- Behavioural disputes between users: a separate path straight to moderators.
create table public.conduct_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references public.profiles (id) on delete cascade,
  reported_user_id  uuid not null references public.profiles (id) on delete cascade,
  context           text not null check (context in ('chat', 'profile', 'other')),
  room_id           uuid,
  message           text not null check (char_length(message) between 1 and 2000),
  status            public.report_status not null default 'open',
  created_at        timestamptz not null default now(),
  constraint conduct_not_self check (reporter_id <> reported_user_id)
);

create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.content_items (id) on delete cascade,
  from_user_id  uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 4000),
  anchor        jsonb check (anchor is null or anchor ? 'blockId'),
  state         text not null default 'new' check (state in ('new', 'applied', 'declined')),
  created_at    timestamptz not null default now()
);

create table public.ratings (
  item_id      uuid not null references public.content_items (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  review       text check (review is null or char_length(review) <= 2000),
  owner_reply  text check (owner_reply is null or char_length(owner_reply) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (item_id, user_id)
);

create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function public.set_updated_at();

-- Feedback about the platform itself (not about a lesson): how the founding users
-- rate the product while it is free, so it can be improved before any commercial stage.
create table public.product_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  score       smallint check (score between 1 and 5),
  category    text not null default 'general'
              check (category in ('general', 'bug', 'idea', 'learning', 'content', 'community')),
  message     text check (message is null or char_length(message) <= 4000),
  page_path   text check (page_path is null or char_length(page_path) <= 300),
  ui_locale   text,
  app_version text,
  status      text not null default 'new' check (status in ('new', 'reviewed', 'planned', 'done', 'dismissed')),
  created_at  timestamptz not null default now(),
  constraint feedback_has_content check (score is not null or message is not null)
);
create index product_feedback_created_idx on public.product_feedback (created_at desc);

-- -----------------------------------------------------------------------------
-- Community chat (no posts, no feed, no file uploads)
-- -----------------------------------------------------------------------------
create table public.chat_rooms (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  source_lang  text references public.languages (code),
  target_lang  text references public.languages (code),
  created_at   timestamptz not null default now()
);

create table public.chat_messages (
  id              bigint generated always as identity primary key,
  room_id         uuid not null references public.chat_rooms (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  -- Sharing is limited to content already on the platform.
  linked_item_id  uuid references public.content_items (id) on delete set null,
  pinned          boolean not null default false,
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at desc);

create table public.user_blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  mute_only   boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint block_not_self check (blocker_id <> blocked_id)
);

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Operations: settings, feature switches, audit
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key          text primary key,
  value        jsonb not null,
  description  text,
  updated_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now()
);

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), p_default);
$$;

create table public.feature_flags (
  key         text primary key,
  mode        public.feature_mode not null default 'enabled',
  message     jsonb not null default '{}',
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
comment on column public.feature_flags.message is 'Per-locale user-facing explanation, e.g. {"ar": "...", "fr": "..."}';

create table public.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid,
  action        text not null,
  target_table  text not null,
  target_id     text,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_target_idx on public.audit_log (target_table, target_id, created_at desc);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
begin
  if tg_op = 'DELETE' then
    target := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'user_id', to_jsonb(old) ->> 'key');
  else
    target := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'user_id', to_jsonb(new) ->> 'key');
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'search' end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'search' end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_content_items after insert or update or delete on public.content_items
  for each row execute function public.write_audit_log();
create trigger audit_content_versions after insert on public.content_versions
  for each row execute function public.write_audit_log();
create trigger audit_admin_ranks after insert or update or delete on public.admin_ranks
  for each row execute function public.write_audit_log();
create trigger audit_feature_flags after insert or update or delete on public.feature_flags
  for each row execute function public.write_audit_log();
create trigger audit_platform_settings after insert or update or delete on public.platform_settings
  for each row execute function public.write_audit_log();

-- Repeated justified reports with no owner response move to the moderation queue.
create or replace function public.escalate_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer := public.setting_int('moderation.escalation_open_reports', 3);
  open_count integer;
begin
  if new.report_type = 'copyright' then
    update public.reports set status = 'escalated' where id = new.id;
    return new;
  end if;

  select count(*) into open_count
    from public.reports
   where item_id = new.item_id
     and status = 'open'
     and report_type in ('error', 'violation', 'outdated_expression');

  if open_count >= threshold then
    update public.reports
       set status = 'escalated'
     where item_id = new.item_id
       and status = 'open';
  end if;

  insert into public.notifications (user_id, kind, payload)
  select i.owner_id, 'report.received', jsonb_build_object('item_id', i.id, 'report_type', new.report_type)
    from public.content_items i
   where i.id = new.item_id;

  return new;
end;
$$;

create trigger reports_escalate after insert on public.reports
  for each row execute function public.escalate_reports();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.languages enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_ranks enable row level security;
alter table public.language_pairs enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.course_lessons enable row level security;
alter table public.progress enable row level security;
alter table public.review_states enable row level security;
alter table public.activity_days enable row level security;
alter table public.product_feedback enable row level security;
alter table public.reports enable row level security;
alter table public.conduct_reports enable row level security;
alter table public.feedback enable row level security;
alter table public.ratings enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.platform_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_log enable row level security;

-- Reference and configuration data: readable by everyone.
create policy languages_read on public.languages for select using (true);
create policy platform_settings_read on public.platform_settings for select using (true);
create policy feature_flags_read on public.feature_flags for select using (true);
create policy platform_settings_admin_write on public.platform_settings for all to authenticated
  using (public.current_admin_level() >= 2) with check (public.current_admin_level() >= 2);
create policy feature_flags_admin_write on public.feature_flags for all to authenticated
  using (public.current_admin_level() >= 2) with check (public.current_admin_level() >= 2);

-- Profiles: public learning identity; users edit their own display fields only.
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy admin_ranks_read_staff on public.admin_ranks for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

create policy language_pairs_own on public.language_pairs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Content: published and archived content is public; drafts, hidden and removed
-- content is visible to its owner and to moderation only.
create policy content_items_read on public.content_items for select
  using (status in ('published', 'archived') or owner_id = auth.uid() or public.is_moderator());
create policy content_items_insert_creator on public.content_items for insert to authenticated
  with check (owner_id = auth.uid() and public.current_primary_role() = 'content_creator');
create policy content_items_update_owner_or_moderator on public.content_items for update to authenticated
  using (owner_id = auth.uid() or public.is_moderator())
  with check (owner_id = auth.uid() or public.is_moderator());

create policy content_versions_read on public.content_versions for select
  using (
    exists (
      select 1 from public.content_items i
       where i.id = content_versions.item_id
         and (
           i.owner_id = auth.uid()
           or public.is_moderator()
           or content_versions.version_number <= coalesce(public.published_version_number(i.id), 0)
         )
    )
  );
create policy content_versions_insert_owner on public.content_versions for insert to authenticated
  with check (
    exists (
      select 1 from public.content_items i
       where i.id = content_versions.item_id
         and (i.owner_id = auth.uid() or public.is_moderator())
    )
  );

create policy course_lessons_read on public.course_lessons for select
  using (exists (select 1 from public.content_items i where i.id = course_lessons.course_id));
create policy course_lessons_write_owner on public.course_lessons for all to authenticated
  using (exists (select 1 from public.content_items i where i.id = course_lessons.course_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.content_items i where i.id = course_lessons.course_id and i.owner_id = auth.uid()));

-- Progress: private to the learner, free for everyone.
create policy progress_own on public.progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy review_states_own on public.review_states for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_days_own on public.activity_days for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reports and feedback: anyone signed in may report published content; the owner
-- sees and answers reports on their content; moderation sees everything.
create policy reports_insert on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and exists (select 1 from public.content_items i where i.id = reports.item_id and i.status = 'published')
  );
create policy reports_read on public.reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_moderator()
    or exists (select 1 from public.content_items i where i.id = reports.item_id and i.owner_id = auth.uid())
  );
create policy reports_update_owner_or_moderator on public.reports for update to authenticated
  using (
    public.is_moderator()
    or exists (select 1 from public.content_items i where i.id = reports.item_id and i.owner_id = auth.uid())
  )
  with check (
    public.is_moderator()
    or (
      status in ('acknowledged', 'resolved', 'dismissed')
      and exists (select 1 from public.content_items i where i.id = reports.item_id and i.owner_id = auth.uid())
    )
  );

create policy conduct_reports_insert on public.conduct_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy conduct_reports_read on public.conduct_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());
create policy conduct_reports_moderate on public.conduct_reports for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    from_user_id = auth.uid()
    and state = 'new'
    and exists (select 1 from public.content_items i where i.id = feedback.item_id and i.status = 'published')
  );
create policy feedback_read on public.feedback for select to authenticated
  using (
    from_user_id = auth.uid()
    or public.is_moderator()
    or exists (select 1 from public.content_items i where i.id = feedback.item_id and i.owner_id = auth.uid())
  );
create policy feedback_owner_decides on public.feedback for update to authenticated
  using (exists (select 1 from public.content_items i where i.id = feedback.item_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.content_items i where i.id = feedback.item_id and i.owner_id = auth.uid()));

create policy ratings_read on public.ratings for select using (true);
create policy ratings_write_own on public.ratings for insert to authenticated
  with check (
    user_id = auth.uid()
    and owner_reply is null
    and exists (select 1 from public.content_items i where i.id = ratings.item_id and i.status = 'published')
  );
create policy ratings_update_own on public.ratings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chat
create policy chat_rooms_read on public.chat_rooms for select to authenticated using (true);
create policy chat_rooms_admin on public.chat_rooms for all to authenticated
  using (public.current_admin_level() >= 2) with check (public.current_admin_level() >= 2);
create policy chat_messages_read on public.chat_messages for select to authenticated
  using (not hidden or public.is_moderator());
create policy chat_messages_insert_own on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and pinned = false and hidden = false);
create policy chat_messages_moderate on public.chat_messages for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy product_feedback_insert_own on public.product_feedback for insert to authenticated
  with check (user_id = auth.uid() and status = 'new');
create policy product_feedback_read on public.product_feedback for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy product_feedback_triage on public.product_feedback for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create policy user_blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_log_read_moderation on public.audit_log for select to authenticated
  using (public.is_moderator());

-- -----------------------------------------------------------------------------
-- Column-level privileges (defence in depth on top of RLS and triggers)
-- -----------------------------------------------------------------------------
revoke insert, update, delete on all tables in schema public from anon;

revoke update on public.profiles from authenticated;
grant update (display_name, ui_locale) on public.profiles to authenticated;

revoke update on public.ratings from authenticated;
grant update (stars, review) on public.ratings to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke update on public.chat_messages from authenticated;
grant update (pinned, hidden) on public.chat_messages to authenticated;

revoke update on public.feedback from authenticated;
grant update (state) on public.feedback to authenticated;

revoke update on public.reports from authenticated;
grant update (status, resolution_note, resolved_by, resolved_at) on public.reports to authenticated;

revoke update, delete on public.product_feedback from authenticated;
revoke insert, update, delete on public.admin_ranks from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke update, delete on public.content_versions from authenticated;
revoke delete on public.content_items from authenticated;

revoke execute on function public.become_content_creator() from public, anon;
grant execute on function public.become_content_creator() to authenticated;
