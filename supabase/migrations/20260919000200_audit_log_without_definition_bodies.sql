-- Decision R13: Supabase holds accounts and metadata, never a plugin definition or a package.
-- Migration 20260919000100 moved the definitions into the file store and dropped the jsonb
-- columns, but write_audit_log() snapshots whole rows, so the audit trail still carried the
-- bodies written before that day (plugins.draft, plugin_versions.definition,
-- plugin_publish_requests.definition). Strip those keys from every historical snapshot;
-- what remains is the metadata the trail exists for (who, when, status, keys, hashes).
update public.audit_log
set before = before - 'draft' - 'definition',
    after = after - 'draft' - 'definition'
where target_table in ('plugins', 'plugin_versions', 'plugin_publish_requests')
  and (before ? 'draft' or before ? 'definition' or after ? 'draft' or after ? 'definition');
