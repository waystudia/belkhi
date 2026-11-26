begin;

-- Administrative projections are service-role-only. The Edge Function verifies the
-- current user and app_metadata owner role before calling them. Application RLS
-- and the customer's exclusive access to competing bids remain unchanged.
grant usage on schema belkhi_private to service_role;
grant select on public.belkhi_tenders to service_role;
grant select (tender_id, performer_id) on public.belkhi_tender_bids to service_role;
grant select (user_id) on public.belkhi_identities to service_role;

create function belkhi_private.admin_account_rows()
returns table (
  id uuid, email text, phone text, display_name text, starting_mode text, owner boolean,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed_at timestamptz,
  blocked_at timestamptz, customer_enabled boolean, worker_enabled boolean
)
language sql stable security invoker set search_path = ''
as $$
  with account_flags as (
    select u.id, u.email::text, u.phone::text,
      u.raw_user_meta_data->>'display_name' as display_name,
      u.raw_user_meta_data->>'belkhi_starting_mode' as starting_mode,
      coalesce(u.raw_app_meta_data->>'belkhi_role' = 'owner', false) as owner,
      u.created_at, u.last_sign_in_at, u.confirmed_at, b.blocked_at,
      coalesce(u.raw_user_meta_data->>'belkhi_starting_mode' = 'customer', false)
        or coalesce(u.raw_user_meta_data->>'belkhi_customer_enabled' = 'true', false)
        or exists(select 1 from public.belkhi_tenders t where t.owner_id = u.id) as customer_enabled,
      coalesce(u.raw_user_meta_data->>'belkhi_starting_mode' = 'worker', false)
        or coalesce(u.raw_user_meta_data->>'belkhi_worker_enabled' = 'true', false)
        or exists(select 1 from public.belkhi_tender_bids bid where bid.performer_id = u.id) as worker_enabled,
      coalesce(u.raw_user_meta_data->>'belkhi_registration' = 'email-first-v1', false)
        or exists(select 1 from public.belkhi_identities i where i.user_id = u.id) as registered
    from auth.users u
    left join public.belkhi_account_blocks b on b.user_id = u.id
  )
  select id, email, phone, display_name, starting_mode, owner, created_at,
    last_sign_in_at, confirmed_at, blocked_at, customer_enabled, worker_enabled
  from account_flags
  where owner or registered or customer_enabled or worker_enabled;
$$;
revoke execute on function belkhi_private.admin_account_rows() from public, anon, authenticated;
grant execute on function belkhi_private.admin_account_rows() to service_role;

create function public.belkhi_admin_accounts(
  account_id uuid, search_text text, account_status text, start_at integer,
  role_filter text default 'all'
)
returns table (
  id uuid, email text, phone text, display_name text, starting_mode text, owner boolean,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed_at timestamptz,
  blocked_at timestamptz, customer_enabled boolean, worker_enabled boolean
)
language sql stable security invoker set search_path = ''
as $$
  select a.* from belkhi_private.admin_account_rows() a
  where (account_id is null or a.id = account_id)
    and (search_text = '' or position(lower(search_text) in lower(concat_ws(' ',
      a.email, a.phone, a.id, a.display_name))) > 0)
    and (account_status = ''
      or (account_status = 'blocked' and a.blocked_at is not null)
      or (account_status = 'active' and a.blocked_at is null))
    and (role_filter = 'all'
      or (role_filter = 'customers' and a.customer_enabled)
      or (role_filter = 'specialists' and a.worker_enabled)
      or (role_filter = 'admins' and a.owner))
  order by a.created_at desc, a.id desc
  limit 31 offset greatest(start_at, 0);
$$;
revoke execute on function public.belkhi_admin_accounts(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.belkhi_admin_accounts(uuid, text, text, integer, text) to service_role;

create function public.belkhi_admin_overview()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'accounts', (select jsonb_build_object(
      'total', count(*), 'customers', count(*) filter(where customer_enabled),
      'specialists', count(*) filter(where worker_enabled),
      'admins', count(*) filter(where owner), 'blocked', count(*) filter(where blocked_at is not null)
    ) from belkhi_private.admin_account_rows()),
    'tenders', (select jsonb_build_object(
      'total', count(*), 'open', count(*) filter(where winner is null),
      'in_progress', count(*) filter(where winner is not null)
    ) from public.belkhi_tenders),
    'bids', (select jsonb_build_object('total', count(*)) from public.belkhi_tender_bids)
  );
$$;
revoke execute on function public.belkhi_admin_overview() from public, anon, authenticated;
grant execute on function public.belkhi_admin_overview() to service_role;

create function public.belkhi_admin_tenders(
  search_text text, tender_status text, customer_id uuid, start_at integer
)
returns table (
  id uuid, owner_id uuid, created_at timestamptz, status text,
  title text, kind text, district text, budget numeric, period text, bid_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  select t.id, t.owner_id, t.created_at,
    case when t.winner is null then 'open' else 'in_progress' end,
    coalesce(nullif(t.details->>'title', ''), t.details->>'kind', 'Без названия'),
    t.details->>'kind', t.details->>'district',
    case when jsonb_typeof(t.details->'budget') = 'number' then (t.details->>'budget')::numeric else null end,
    t.details->>'period',
    (select count(*) from public.belkhi_tender_bids b where b.tender_id = t.id)
  from public.belkhi_tenders t
  where (customer_id is null or t.owner_id = customer_id)
    and (tender_status = '' or (tender_status = 'open' and t.winner is null)
      or (tender_status = 'in_progress' and t.winner is not null))
    and (search_text = '' or position(lower(search_text) in lower(concat_ws(' ',
      t.id, t.details->>'title', t.details->>'kind', t.details->>'district', t.details->>'description'))) > 0)
  order by t.created_at desc, t.id desc
  limit 31 offset greatest(start_at, 0);
$$;
revoke execute on function public.belkhi_admin_tenders(text, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.belkhi_admin_tenders(text, text, uuid, integer) to service_role;

create function public.belkhi_admin_tender(tender_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'owner_id', t.owner_id, 'created_at', t.created_at,
    'status', case when t.winner is null then 'open' else 'in_progress' end,
    'details', coalesce((select jsonb_object_agg(field.key, field.value)
      from jsonb_each(t.details) field
      where field.key = any(array['title','kind','subtype','district','description','budget','period',
        'params','start','startDate','locationNote','photo','parentId'])), '{}'::jsonb),
    'bid_count', (select count(*) from public.belkhi_tender_bids b where b.tender_id = t.id),
    'files', coalesce((select jsonb_agg(jsonb_build_object(
      'name', item.file->>'name', 'type', item.file->>'type',
      'size', case when jsonb_typeof(item.file->'base64') = 'string' then greatest(
        octet_length(item.file->>'base64') / 4 * 3
          - case when right(item.file->>'base64', 2) = '==' then 2
                 when right(item.file->>'base64', 1) = '=' then 1 else 0 end, 0) else null end
      ) order by item.position)
      from jsonb_array_elements(case when jsonb_typeof(t.details->'files') = 'array'
        then t.details->'files' else '[]'::jsonb end) with ordinality item(file, position)), '[]'::jsonb)
  )
  from public.belkhi_tenders t where t.id = tender_id;
$$;
revoke execute on function public.belkhi_admin_tender(uuid) from public, anon, authenticated;
grant execute on function public.belkhi_admin_tender(uuid) to service_role;

commit;
