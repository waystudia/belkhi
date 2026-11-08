begin;

create schema if not exists belkhi_private;
revoke all on schema belkhi_private from public, anon, authenticated;
grant usage on schema belkhi_private to authenticated;

create function belkhi_private.valid_username(candidate text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9._]{3,30}$'
     and candidate ~ '[a-z0-9]'
     and candidate not in ('admin', 'belkhi', 'belhi', 'support', 'moderator',
                           'profstroy', 'brigada_kovaleva', 'alexandr_petrov', 'domstroy');
$$;
revoke execute on function belkhi_private.valid_username(text) from public, anon, authenticated;
grant execute on function belkhi_private.valid_username(text) to authenticated;

create table public.belkhi_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null check (birth_date between date '1900-01-01' and current_date),
  username text unique check (belkhi_private.valid_username(username))
);
alter table public.belkhi_identities enable row level security;
revoke all on public.belkhi_identities from public, anon, authenticated;
grant select, insert, update on public.belkhi_identities to authenticated;

create policy unblocked_account on public.belkhi_identities
  as restrictive for all to authenticated
  using (not exists (select 1 from public.belkhi_account_blocks where user_id = (select auth.uid())));

create policy own_identity_read on public.belkhi_identities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy own_identity_insert on public.belkhi_identities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy unfinished_identity_update on public.belkhi_identities
  for update to authenticated
  using ((select auth.uid()) = user_id and username is null)
  with check ((select auth.uid()) = user_id);

-- Availability exposes a boolean for public handles, never an account record or a date of birth.
create function belkhi_private.username_available(candidate text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(belkhi_private.valid_username(candidate), false)
     and not exists (select 1 from public.belkhi_identities where username = candidate);
$$;
revoke execute on function belkhi_private.username_available(text) from public, anon, authenticated;
grant execute on function belkhi_private.username_available(text) to authenticated;

create function public.belkhi_username_available(candidate text)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select belkhi_private.username_available(candidate);
$$;
revoke execute on function public.belkhi_username_available(text) from public, anon, authenticated;
grant execute on function public.belkhi_username_available(text) to authenticated;

commit;
