-- Platform defaults. Every value here is configuration that administration can
-- change from the dashboard later, never a constant in application code.
-- No commercial settings exist yet: subscriptions and payments belong to the final stage.

insert into public.platform_settings (key, value, description) values
  ('moderation.escalation_open_reports', '3',
   'Open error/violation/outdated reports on one item that move it to the moderation queue.'),
  ('lineage.derivation_notify_threshold', '10',
   'Published derivations of one item before its owner is notified.'),
  ('quality.community_trusted_min_ratings', '10',
   'Minimum ratings before content can carry the "Community Trusted" label.'),
  ('quality.community_trusted_min_average', '4',
   'Minimum average stars for the "Community Trusted" label.'),
  ('founding.window_open', 'true',
   'Whether new sign-ups can still receive the permanent Founding Member badge.')
on conflict (key) do nothing;

insert into public.feature_flags (key, mode) values
  ('registration', 'enabled'),
  ('publishing', 'enabled'),
  ('community_chat', 'enabled'),
  ('product_feedback', 'enabled'),
  ('maintenance_mode', 'disabled')
on conflict (key) do nothing;

-- The first release ships with one community chat room for founding members.
insert into public.chat_rooms (slug, title) values
  ('founders', 'LisanHub — Founders')
on conflict (slug) do nothing;
