-- user_settings (feature 5, criterion 12; ARCHITECTURE_SPEC.md 4.1, 4.6 and 6.2).
-- One row per member, readable and writable only by that member. Allowed values are
-- mirrored by src/schemas/settings.ts and the inline script in index.html.

create type public.theme_pref as enum ('system', 'light', 'dark');
create type public.contrast_pref as enum ('system', 'on', 'off');

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme public.theme_pref not null default 'system',
  text_size text not null default 'default'
    check (text_size in ('default', 'large', 'larger', 'largest')),
  high_contrast public.contrast_pref not null default 'system',
  dyslexia_font boolean not null default false
);

-- Members read, insert and update their own row. No delete: it cascades with the account.
alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update on table public.user_settings to authenticated;

create policy "Members can read their own settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can insert their own settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Members can update their own settings"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
