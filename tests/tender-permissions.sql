-- Entire fixture transaction rolls back. No emails, persistent accounts or production bids are created.
begin;
insert into auth.users(id) values
 ('b3e10000-0000-4000-8000-000000000001'),('b3e10000-0000-4000-8000-000000000002'),
 ('b3e10000-0000-4000-8000-000000000003'),('b3e10000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub','b3e10000-0000-4000-8000-000000000001',true);
insert into public.belkhi_tenders(id,owner_id,details) values
 ('b3e20000-0000-4000-8000-000000000001','b3e10000-0000-4000-8000-000000000001','{"title":"RLS transaction test"}');
do $$ begin
 begin
  insert into public.belkhi_tenders(id,owner_id,details) values
  ('b3e20000-0000-4000-8000-000000000002','b3e10000-0000-4000-8000-000000000002','{}');
  raise exception 'FAIL forged tender owner accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','b3e10000-0000-4000-8000-000000000003',true);
insert into public.belkhi_tender_bids(tender_id,performer_id,profile,price,period,terms) values
 ('b3e20000-0000-4000-8000-000000000001','b3e10000-0000-4000-8000-000000000003','{}',100,'1 месяц','test');
select set_config('request.jwt.claim.sub','b3e10000-0000-4000-8000-000000000004',true);
insert into public.belkhi_tender_bids(tender_id,performer_id,profile,price,period,terms) values
 ('b3e20000-0000-4000-8000-000000000001','b3e10000-0000-4000-8000-000000000004','{}',200,'2 месяца','test');
do $$ declare n integer; begin
 select count(*) into n from public.belkhi_tender_bids where tender_id='b3e20000-0000-4000-8000-000000000001';
 if n<>1 then raise exception 'FAIL competitor bids visible'; end if;
 update public.belkhi_tenders set winner='b3e10000-0000-4000-8000-000000000004' where id='b3e20000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL specialist can choose winner'; end if;
 begin
 insert into public.belkhi_tender_bids(tender_id,performer_id,profile,price,period) values
 ('b3e20000-0000-4000-8000-000000000001','b3e10000-0000-4000-8000-000000000002','{}',100,'test');
 raise exception 'FAIL forged performer accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','b3e10000-0000-4000-8000-000000000002',true);
do $$ declare n integer; begin
 select count(*) into n from public.belkhi_tender_bids where tender_id='b3e20000-0000-4000-8000-000000000001';
 if n<>0 then raise exception 'FAIL unrelated customer can see bids'; end if;
end $$;
select set_config('request.jwt.claim.sub','b3e10000-0000-4000-8000-000000000001',true);
do $$ declare n integer; begin
 select count(*) into n from public.belkhi_tender_bids where tender_id='b3e20000-0000-4000-8000-000000000001';
 if n<>2 then raise exception 'FAIL owner cannot compare all bids'; end if;
 update public.belkhi_tenders set winner='b3e10000-0000-4000-8000-000000000003' where id='b3e20000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;
 if n<>1 then raise exception 'FAIL owner cannot choose winner'; end if;
 update public.belkhi_tenders set winner='b3e10000-0000-4000-8000-000000000004' where id='b3e20000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'FAIL closed winner can be changed'; end if;
end $$;
set local role anon;
do $$ begin
 begin
 perform 1 from public.belkhi_tender_bids;
 raise exception 'FAIL anonymous bids readable';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: owner sees all, specialist sees own, other customer sees none, anonymous denied, forgery denied, winner owner-only and final' as result;
