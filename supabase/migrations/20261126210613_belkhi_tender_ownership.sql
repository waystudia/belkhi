-- Real application records are separate from the intentionally public demo catalog.
create table public.belkhi_tenders (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 details jsonb not null check (jsonb_typeof(details) = 'object'),
 winner uuid,
 created_at timestamptz not null default now()
);
create table public.belkhi_tender_bids (
 tender_id uuid not null references public.belkhi_tenders(id) on delete cascade,
 performer_id uuid not null references auth.users(id),
 profile jsonb not null check (jsonb_typeof(profile) = 'object'),
 price bigint not null check (price > 0 and price <= 100000000000),
 period text not null check (length(period) between 1 and 100),
 terms text not null default '' check (length(terms) <= 1500),
 created_at timestamptz not null default now(),
 primary key (tender_id, performer_id)
);
alter table public.belkhi_tenders add constraint winner_is_tender_bid
 foreign key (id, winner) references public.belkhi_tender_bids(tender_id, performer_id);
create index belkhi_tenders_owner_idx on public.belkhi_tenders(owner_id);
create index belkhi_tender_bids_performer_idx on public.belkhi_tender_bids(performer_id);
alter table public.belkhi_tenders enable row level security;
alter table public.belkhi_tender_bids enable row level security;
revoke all on public.belkhi_tenders, public.belkhi_tender_bids from public, anon, authenticated;
grant select, insert on public.belkhi_tenders to authenticated;
grant update(winner) on public.belkhi_tenders to authenticated;
grant select, insert on public.belkhi_tender_bids to authenticated;
create policy tenders_unblocked on public.belkhi_tenders as restrictive for all to authenticated
 using (not exists(select 1 from public.belkhi_account_blocks where user_id=(select auth.uid())))
 with check (not exists(select 1 from public.belkhi_account_blocks where user_id=(select auth.uid())));
create policy tender_read on public.belkhi_tenders for select to authenticated using (true);
create policy tender_create on public.belkhi_tenders for insert to authenticated
 with check(owner_id=(select auth.uid()) and winner is null);
create policy tender_decide on public.belkhi_tenders for update to authenticated
 using(owner_id=(select auth.uid()) and winner is null)
 with check(owner_id=(select auth.uid()));
create policy bids_unblocked on public.belkhi_tender_bids as restrictive for all to authenticated
 using (not exists(select 1 from public.belkhi_account_blocks where user_id=(select auth.uid())))
 with check (not exists(select 1 from public.belkhi_account_blocks where user_id=(select auth.uid())));
-- A specialist can read only their own bid; all competing bids belong to the tender owner.
create policy bid_read on public.belkhi_tender_bids for select to authenticated
 using(performer_id=(select auth.uid()) or exists(
 select 1 from public.belkhi_tenders t where t.id=tender_id and t.owner_id=(select auth.uid())));
create policy bid_submit on public.belkhi_tender_bids for insert to authenticated
 with check(performer_id=(select auth.uid()) and exists(
 select 1 from public.belkhi_tenders t where t.id=tender_id and t.owner_id<>(select auth.uid()) and t.winner is null));
