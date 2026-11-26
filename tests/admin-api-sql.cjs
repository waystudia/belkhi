const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;
   create table auth.users(id uuid primary key,email text,phone text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),last_sign_in_at timestamptz,confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  `);
  for(const name of ['20261108171208_belkhi_account_moderation.sql','20261108210446_belkhi_registration_identity.sql','20261126210613_belkhi_tender_ownership.sql','20261126212132_belkhi_admin_read_models.sql']){
   await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  }
  const ids=Array.from({length:6},(_,i)=>'b3e10000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  const [admin,dual,customer,specialist,unrelated,unfinished]=ids;
  const tid='b3e20000-0000-4000-8000-000000000001',second='b3e20000-0000-4000-8000-000000000002';
  for(const id of ids)await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query(`update auth.users set raw_app_meta_data='{"belkhi_role":"owner"}' where id=$1`,[admin]);
  await db.query(`update auth.users set raw_user_meta_data='{"belkhi_starting_mode":"customer","belkhi_worker_enabled":true,"display_name":"Dual fixture"}' where id=$1`,[dual]);
  await db.query(`update auth.users set raw_user_meta_data='{"belkhi_registration":"email-first-v1"}' where id=$1`,[unfinished]);
  await db.query('insert into public.belkhi_account_blocks(user_id) values($1)',[dual]);
  const details={title:'Roof fixture',kind:'Кровля',district:'Грозный',budget:300000,period:'1 месяц',params:{roofArea:'180'},files:[{name:'plan.pdf',type:'application/pdf',base64:'AQIDBA=='}],bids:[{secret:'MUST_NOT_LEAK'}],winner:'MUST_NOT_LEAK'};
  await db.query('insert into public.belkhi_tenders(id,owner_id,details) values($1,$2,$3),($4,$5,$6)',[tid,customer,details,second,dual,{title:'Foundation fixture',kind:'Фундамент',district:'Москва',budget:100000,period:'1 месяц'}]);
  for(const tender of [tid,second])await db.query('insert into public.belkhi_tender_bids(tender_id,performer_id,profile,price,period,terms) values($1,$2,$3,123456,$4,$5)',[tender,specialist,{name:'HIDDEN_BID_AUTHOR'},'1 месяц','HIDDEN_BID_CONTENT']);
  await db.query('update public.belkhi_tenders set winner=$1 where id=$2',[specialist,second]);

  await db.exec('set role service_role');
  const overview=(await db.query('select public.belkhi_admin_overview() as data')).rows[0].data;
  assert.deepEqual(overview,{accounts:{total:5,customers:2,specialists:2,admins:1,blocked:1},tenders:{total:2,open:1,in_progress:1},bids:{total:2}});
  async function accounts(role,search='',status='',start=0){return(await db.query(`select * from public.belkhi_admin_accounts(null,$1,$2,$3,$4)`,[search,status,start,role])).rows;}
  assert.deepEqual((await accounts('customers')).map(a=>a.id).sort(),[dual,customer].sort());
  assert.deepEqual((await accounts('specialists')).map(a=>a.id).sort(),[dual,specialist].sort());
  assert.deepEqual((await accounts('admins')).map(a=>a.id),[admin]);
  assert.equal((await accounts('all')).some(a=>a.id===unrelated),false);
  assert.deepEqual((await accounts('all','dual')).map(a=>a.id),[dual]);
  assert.deepEqual((await accounts('all','','blocked')).map(a=>a.id),[dual]);
  assert.equal((await accounts('all','','',30)).length,0);

  let tenders=(await db.query(`select * from public.belkhi_admin_tenders('','open',null,0)`)).rows;
  assert.equal(tenders.length,1);assert.equal(tenders[0].id,tid);assert.equal(Number(tenders[0].bid_count),1);
  assert.equal('winner' in tenders[0],false);assert.equal('performer_id' in tenders[0],false);assert.equal('terms' in tenders[0],false);
  assert.equal((await db.query(`select * from public.belkhi_admin_tenders('roof','',null,0)`)).rows.length,1);
  assert.equal((await db.query(`select * from public.belkhi_admin_tenders('','',$1,0)`,[dual])).rows[0].id,second);
  const detail=(await db.query('select public.belkhi_admin_tender($1) as data',[tid])).rows[0].data;
  assert.deepEqual(detail.files,[{name:'plan.pdf',type:'application/pdf',size:4}]);
  assert.equal(detail.bid_count,1);assert.equal(detail.status,'open');
  assert.equal('winner' in detail,false);assert.equal('bids' in detail,false);assert.equal('bids' in detail.details,false);assert.equal('files' in detail.details,false);assert.equal('winner' in detail.details,false);
  assert.ok(!JSON.stringify(detail).includes('MUST_NOT_LEAK'));assert.ok(!JSON.stringify(detail).includes('HIDDEN_BID'));
  assert.equal((await db.query('select public.belkhi_admin_tender($1) as data',['b3e20000-0000-4000-8000-000000000099'])).rows[0].data,null);

  await db.exec('reset role');
  for(let i=3;i<=35;i++)await db.query('insert into public.belkhi_tenders(id,owner_id,details) values($1,$2,$3)',['b3e20000-0000-4000-8000-'+String(i).padStart(12,'0'),customer,{title:'Pagination '+i}]);
  await db.exec('set role service_role');
  assert.equal((await db.query(`select * from public.belkhi_admin_tenders('','',null,0)`)).rows.length,31);
  assert.equal((await db.query(`select * from public.belkhi_admin_tenders('','',null,30)`)).rows.length,5);
  await db.exec('reset role');
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   for(const query of ["select public.belkhi_admin_overview()","select * from public.belkhi_admin_accounts(null,'','',0,'all')","select * from public.belkhi_admin_tenders('','',null,0)",`select public.belkhi_admin_tender('${tid}')`,`select * from belkhi_private.admin_account_rows()`]){
    await assert.rejects(()=>db.query(query),error=>error.code==='42501',role+' cannot call '+query);
   }
   await db.exec('reset role');
  }
  console.log('PASS local Postgres migration, aggregate counts, dual/inferred roles, account filters, tender filters/pagination, metadata-only detail, no bid disclosure and service_role-only RPC grants');
 }finally{await db.close()}
})().catch(error=>{console.error(error);process.exit(1)});
