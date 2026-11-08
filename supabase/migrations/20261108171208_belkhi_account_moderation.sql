begin;

create table public.belkhi_moderation_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid not null,
  target uuid not null,
  action text not null check (action in ('block_requested', 'unblock_requested', 'read_messages')),
  reason text not null check (char_length(btrim(reason)) between 3 and 500)
);
alter table public.belkhi_moderation_log enable row level security;
revoke all on public.belkhi_moderation_log from public, anon, authenticated, service_role;
grant select, insert on public.belkhi_moderation_log to service_role;

-- Auth is shared with SportPit. A block applies only inside Belkhi.
create table public.belkhi_account_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);
alter table public.belkhi_account_blocks enable row level security;
revoke all on public.belkhi_account_blocks from public, anon, authenticated, service_role;
grant select on public.belkhi_account_blocks to authenticated;
grant select, insert, delete on public.belkhi_account_blocks to service_role;
create policy own_account_block on public.belkhi_account_blocks
  for select to authenticated using ((select auth.uid()) = user_id);

-- Application correspondence is separate from authentication email and SMS.
create table public.belkhi_messages (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  sender_id uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  check (sender_id <> recipient_id)
);
alter table public.belkhi_messages enable row level security;
revoke all on public.belkhi_messages from public, anon, authenticated, service_role;
grant select, insert on public.belkhi_messages to service_role;
create index belkhi_messages_sender on public.belkhi_messages (sender_id, id desc);
create index belkhi_messages_recipient on public.belkhi_messages (recipient_id, id desc);

-- Only the moderation backend can query Auth accounts. Return an explicit projection.
create function public.belkhi_moderation_accounts(
  account_id uuid, search_text text, account_status text, start_at integer
)
returns table (
  id uuid, email text, phone text, display_name text, starting_mode text, owner boolean,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed_at timestamptz, blocked_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select u.id, u.email::text, u.phone::text, u.raw_user_meta_data->>'display_name',
         u.raw_user_meta_data->>'belkhi_starting_mode',
         coalesce(u.raw_app_meta_data->>'belkhi_role' = 'owner', false),
         u.created_at, u.last_sign_in_at, u.confirmed_at, b.blocked_at
  from auth.users u
  left join public.belkhi_account_blocks b on b.user_id = u.id
  where (account_id is null or u.id = account_id)
    and (u.raw_app_meta_data->>'belkhi_role' = 'owner' or
         u.raw_user_meta_data->>'belkhi_registration' = 'email-first-v1' or
         u.raw_user_meta_data->>'belkhi_starting_mode' in ('customer', 'worker'))
    and (search_text = '' or position(lower(search_text) in lower(concat_ws(' ',
         u.email, u.phone, u.id, u.raw_user_meta_data->>'display_name'))) > 0)
    and (account_status = '' or
         (account_status = 'blocked' and b.blocked_at is not null) or
         (account_status = 'active' and b.blocked_at is null))
  order by u.created_at desc, u.id desc
  limit 31 offset greatest(start_at, 0);
$$;
grant usage on schema auth to service_role;
grant select (id, email, phone, raw_user_meta_data, raw_app_meta_data, created_at,
  last_sign_in_at, confirmed_at) on auth.users to service_role;
revoke execute on function public.belkhi_moderation_accounts(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.belkhi_moderation_accounts(uuid, text, text, integer) to service_role;

commit;
