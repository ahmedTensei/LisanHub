-- =============================================================================
-- LisanHub — moderation of published content from the administration area
-- (decision R17, 2026-09-18)
--
-- A moderator (or above) can take a published package or course off the
-- community with a written reason, and put it back. The reason is kept on the
-- item so its owner reads it in the editor; every change is in audit_log
-- through the existing trigger. Nothing is deleted: the package file and its
-- versions stay untouched, exactly like the plugin kill switch (decision R7).
-- =============================================================================

alter table public.content_items
  add column moderation_note text check (moderation_note is null or char_length(moderation_note) <= 500),
  add column moderated_at    timestamptz,
  add column moderated_by    uuid references public.profiles (id);

comment on column public.content_items.moderation_note is
  'Why moderation hid the item (decision R17); null once it is restored. Shown to the owner in the editor.';

create or replace function public.moderate_content_item(p_item uuid, p_hide boolean, p_note text)
returns public.content_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.content_items%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_moderator() then
    raise exception 'moderation only' using errcode = 'insufficient_privilege';
  end if;
  select * into v_item from public.content_items where id = p_item;
  if v_item.id is null then
    raise exception 'content not found' using errcode = 'no_data_found';
  end if;

  if p_hide then
    if v_item.status <> 'published' then
      raise exception 'only published content can be hidden' using errcode = 'check_violation';
    end if;
    if v_note is null then
      raise exception 'a reason is required to hide content' using errcode = 'check_violation';
    end if;
    update public.content_items
       set status = 'hidden', moderation_note = v_note, moderated_at = now(), moderated_by = auth.uid()
     where id = p_item;
    return 'hidden';
  end if;

  if v_item.status <> 'hidden' then
    raise exception 'only hidden content can be restored' using errcode = 'check_violation';
  end if;
  update public.content_items
     set status = 'published', moderation_note = null, moderated_at = now(), moderated_by = auth.uid()
   where id = p_item;
  return 'published';
end;
$$;
revoke execute on function public.moderate_content_item(uuid, boolean, text) from public, anon;
grant execute on function public.moderate_content_item(uuid, boolean, text) to authenticated;
