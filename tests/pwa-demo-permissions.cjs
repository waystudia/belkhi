const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:4182/';
(async()=>{
 const browser=await chromium.launch();
 const errors=[];
 try{
 for(const width of [319,390,768,1440]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  // A failed catalog fetch must still provide complete, deterministic examples.
  await ctx.route('**/rest/v1/belkhi*',route=>route.abort());
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'#market');await p.locator('#demo-persona').waitFor();
  await p.locator('#demo-persona').selectOption('customer:maria');
  await p.locator('a[href="#offers/demo-0"]').first().click();
  await p.locator('.offer-row').first().waitFor();
  assert.equal(await p.locator('.offer-row').count(),3);
  assert.match(await p.locator('.tender-parameters').textContent(),/120/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'owner overflow '+width);
  await p.screenshot({path:'/tmp/belkhi-offers-'+width+'.png',fullPage:true});
  await p.goto(base+'#offers/demo-1');await p.getByRole('heading',{name:'Доступ ограничен'}).waitFor();
  assert.equal(await p.locator('.offer-row').count(),0);
  await p.goto(base+'#market');await p.locator('#demo-persona').selectOption('customer:ivan');
  await p.goto(base+'#offers/demo-1');await p.locator('.offer-row').first().waitFor();
  assert.equal(await p.locator('.offer-row').count(),3);
  await p.goto(base+'#market');await p.locator('#demo-persona').selectOption('worker:1');
  await p.goto(base+'#offers/demo-1');await p.getByRole('heading',{name:'Доступ ограничен'}).waitFor();
  await p.goto(base+'#profile/demo-1/0');await p.getByRole('heading',{name:'Доступ ограничен'}).waitFor();
  await p.goto(base+'#sent/demo-1');await p.getByRole('heading',{name:'Отклик отправлен'}).waitFor();
  assert.match(await p.locator('#screen').textContent(),/Ваше предложение/);
  assert.equal(await p.locator('.offer-row').count(),0);
  await p.goto(base+'#market');await p.locator('#demo-persona').selectOption('customer:musa');
  await p.goto(base+'#offers/demo-2');await p.locator('.offer-row').first().waitFor();
  await p.locator('.offer-row a').first().click();await p.locator('.bid-details summary').click();
  await p.locator('[data-choose]').click();await p.locator('[data-confirm]').click();
  await p.waitForURL(/#project\/demo-2/);await p.getByRole('heading',{name:'Мой объект',exact:true}).waitFor();
  await p.reload();await p.getByRole('heading',{name:'Мой объект',exact:true}).waitFor();
  await p.locator('#install-app').click();await p.locator('#install-help').waitFor({state:'visible'});
  await p.locator('#install-help button').click();
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'install overflow '+width);
  const manifest=await (await p.request.get(base+'manifest.webmanifest')).json();
  assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload();await p.waitForFunction(()=>navigator.serviceWorker.controller);
  const cached=await p.evaluate(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('belkhi-shell-')));return(await c.keys()).map(r=>r.url)});
  assert.ok(cached.every(url=>new URL(url).origin===locationOrigin(base)));
  await ctx.setOffline(true);await p.reload();await p.getByRole('heading',{name:'Нет подключения к интернету'}).waitFor();
  await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS owner/specialist/other customer, deep links, winner persistence, four widths, install help, manifest, service worker, offline fallback, public-only cache');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
function locationOrigin(url){return new URL(url).origin}
