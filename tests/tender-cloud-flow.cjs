const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:4182/';
(async()=>{
 const browser=await chromium.launch();
 const owner='b3e10000-0000-4000-8000-000000000001',worker='b3e10000-0000-4000-8000-000000000003';
 const tid='b3e20000-0000-4000-8000-000000000001';
 let rows=[],bids=[];const errors=[];
 async function page(id){
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:900}});
  await ctx.addInitScript(({id})=>{
   localStorage.setItem('belkhi-auth-session',JSON.stringify({access_token:'mock-'+id,refresh_token:'mock-refresh',expires_at:Date.now()/1000+3600}));
   localStorage.setItem('belkhi-specialist-v1/'+id,JSON.stringify({id,name:'Тестовый специалист',type:'Частный мастер',skills:[],city:'Грозный',areas:'Грозный',about:'Тест',years:5}));
  },{id});
  await ctx.route('https://*.supabase.co/**',async route=>{
   const req=route.request(),u=new URL(req.url()),body=req.postDataJSON();
   let data=[];
   if(u.pathname==='/auth/v1/user')data={id,email:'test@example.invalid',user_metadata:{belkhi_starting_mode:id===owner?'customer':'worker',belkhi_worker_enabled:true}};
   else if(u.pathname==='/rest/v1/belkhi_tenders'){
    if(req.method()==='POST'){rows.push({...body,created_at:new Date().toISOString(),winner:null});data=null;}
    else if(req.method()==='PATCH'){assert.equal(id,owner);rows[0].winner=body.winner;data=[rows[0]];}
    else data=rows;
   }else if(u.pathname==='/rest/v1/belkhi_tender_bids'){
    if(req.method()==='POST'){assert.equal(body.performer_id,id);bids.push(body);data=null;}
    else data=id===owner?bids:bids.filter(b=>b.performer_id===id);
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'#market');await p.locator('h1').waitFor();return p;
 }
 try{
  const a=await page(owner);
  await a.evaluate(async({tid})=>{
   const cloud=await import('./tender-cloud.js');
   await cloud.publishTender({id:tid,title:'Проверка облачного тендера',kind:'Фундамент',district:'Грозный',description:'Работы по проекту',budget:400000,period:'До 2 недель',files:[{bytes:new Uint8Array([1,2,3]).buffer,name:'plan.bin',type:'application/octet-stream'}]});
  },{tid});
  await a.goto(base+'#offers/'+tid);await a.getByText('Таких откликов пока нет.',{exact:true}).waitFor();
  assert.equal(await a.locator('.offer-row').count(),0,'no fake bids on real tender');
  const b=await page(worker);
  await b.locator('a[href="#apply/'+tid+'"]').first().waitFor();
  await b.goto(base+'#offers/'+tid);await b.getByRole('heading',{name:'Доступ ограничен'}).waitFor();
  await b.goto(base+'#apply/'+tid);await b.locator('#bid-price').fill('350000');
  await b.locator('#bid-period').fill('До 2 недель');
  await b.locator('#bid-comment').fill('Работы и инструмент');await b.locator('#bid-form button[type=submit]').click();
  await b.waitForURL(/#sent\//);await b.getByRole('heading',{name:'Отклик отправлен'}).waitFor();
  assert.equal(bids.length,1);
  await a.reload();await a.locator('.offer-row').waitFor();
  assert.equal(await a.locator('.offer-row').count(),1);
  await a.locator('.offer-row a').click();await a.locator('.bid-details summary').click();await a.locator('[data-choose]').click();await a.locator('[data-confirm]').click();
  await a.waitForURL(/#project\//);assert.equal(rows[0].winner,worker);
  await b.reload();await b.getByRole('heading',{name:'Заказчик выбрал вас'}).waitFor();
  assert.deepEqual(errors,[]);console.log('PASS mocked cloud publish incl attachment, no fake bids, cross-account feed/sync, submit, compare, choose, worker decision');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
