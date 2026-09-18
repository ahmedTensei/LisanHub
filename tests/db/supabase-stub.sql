-- Minimal stand-in for the parts of a Supabase database that migrations rely on,
-- so migrations and row level security can be tested in-process with PGlite.
-- This is NOT the real Supabase auth schema; integration against a real project
-- still happens with `npx supabase db reset`.
create schema if not exists auth;
create schema if not exists extensions;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Minimal stand-in for Supabase Storage (schema `storage`), enough to test the
-- bucket definitions and the object policies written by our migrations.
create schema if not exists storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null unique,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table storage.objects (
  id            uuid primary key default gen_random_uuid(),
  bucket_id     text references storage.buckets (id),
  name          text,
  owner_id      text,
  metadata      jsonb,
  path_tokens   text[] generated always as (string_to_array(name, '/')) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text), storage.filename(text) to anon, authenticated, service_role;
