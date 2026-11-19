const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
 const base=process.argv[2]||'http://127.0.0.1:4182/';
 try{for(const width of[319,390,768,1440]){
 const context=await browser.newContext({viewport:{width,height:width<500?617:1000}});
 const p=await context.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(45000);
 await p.goto(base+'#new');await p.locator('#tw-title').fill('Ленточный фундамент под дом');
 async function choose(name,value){const f=p.locator(`[data-choice="${name}"]`);await f.locator('summary').click();await f.locator('label').filter({has:p.getByRole('radio',{name:value,exact:true})}).click();}
 await choose('kind','Фундамент');await choose('subtype','Ленточный');await p.locator('#tw-description').fill('Нужны опалубка, армирование и заливка.');
 await p.locator('.tw-footer .primary').click();
 for(const[key,example]of Object.entries({length:'42',width:'40',depth:'80',aboveGround:'40',rebar:'12',concrete:'М300'})){
 const input=p.locator(`[name="param:${key}"]`);assert.equal(await input.inputValue(),'');assert.equal(await input.getAttribute('placeholder'),example);
 }
 await p.screenshot({path:`/tmp/belkhi-compact-params-${width}.png`,fullPage:true});
 await p.locator('.tw-footer .primary').click();
 const budget=p.locator('#tw-budget');await budget.scrollIntoViewIfNeeded();
 const before=await budget.boundingBox();const period=p.locator('[data-choice=period]');await period.locator('summary').click();await period.locator('.tw-options').waitFor({state:'visible'});
 const after=await budget.boundingBox();assert.ok(Math.abs(before.y-after.y)<2,'Budget moved when dropdown opened '+width);assert.equal(before.height,after.height);
 const menu=await period.locator('.tw-options').boundingBox();assert.ok(menu.y>=60&&menu.y+menu.height<= (width<500 ? 617-120 : width<1000 ? 1000-120 : 1000-10),'Menu clipped by navigation '+JSON.stringify(menu));assert.ok(menu.x>=0&&menu.x+menu.width<=width+1,'Menu horizontal clipping');
 const option=await period.locator('.tw-options label').first().boundingBox();assert.ok(option.height<=44,'Oversized option '+option.height);
 await p.screenshot({path:`/tmp/belkhi-compact-open-${width}.png`});
 await p.keyboard.press('Escape');assert.equal(await period.getAttribute('open'),null);
 await choose('period','До 2 недель');
 const left=await budget.boundingBox(),right=await period.locator('summary').boundingBox();assert.ok(Math.abs(left.y-right.y)<2,'Paired fields not aligned');assert.equal(left.height,right.height);
 const search=p.locator('#tw-district');await search.scrollIntoViewIfNeeded();
 const geoBefore=await budget.boundingBox();await search.fill('Г');await p.locator('#tw-district-results').waitFor({state:'visible'});
 const geoAfter=await budget.boundingBox();assert.ok(Math.abs(geoBefore.y-geoAfter.y)<2,'Place suggestions moved budget');
 const placeMenu=await p.locator('#tw-district-results').boundingBox();assert.ok(placeMenu.x>=0&&placeMenu.x+placeMenu.width<=width+1);assert.ok(placeMenu.y>=60&&placeMenu.y+placeMenu.height<= (width<500?497:width<1000?880:990));
 await p.screenshot({path:`/tmp/belkhi-compact-place-${width}.png`});await p.keyboard.press('Escape');
 const geometry=await search.evaluate(el=>{let r=el.getBoundingClientRect(),i=el.previousElementSibling.getBoundingClientRect();return{left:r.left+parseFloat(getComputedStyle(el).paddingLeft),iconRight:i.right}});assert.ok(geometry.left>geometry.iconRight+3,'Search text overlaps icon');
 const buttons=await p.locator('.tw-footer button').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert.ok(Math.abs(buttons[0].width-buttons[1].width)<1);assert.equal(buttons[0].height,buttons[1].height);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await context.close();
 }console.log('PASS illustrative placeholders remain empty; dropdown geometry, paired fields, search icon and equal footer buttons at319/390/768/1440');}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
