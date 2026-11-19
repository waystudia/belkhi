const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:4182/';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ZkAAAAASUVORK5CYII=', 'base64');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  const errors = [];
  async function page(width=390) {
    const context = await browser.newContext({viewport:{width,height:width===319?617:900}});
    await context.addInitScript(() => sessionStorage.setItem('belkhi-demo-session','1'));
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on('pageerror', e => errors.push(e.message));
    return p;
  }
  async function choose(p,name,value) {
    const field=p.locator(`details[data-choice="${name}"]`);
    await field.locator('summary').click();
    await field.locator('label').filter({has: p.getByRole('radio',{name:value,exact:true})}).click();
  }
  async function next(p) { await p.locator('#tender-wizard-form button[type=submit]').click(); }
  async function start(p,kind,subtype) {
    await p.goto(base+'#new');
    await p.locator('#tw-title').fill('Тест: '+kind);
    await choose(p,'kind',kind);
    await choose(p,'subtype',subtype);
    await p.locator('#tw-description').fill('Нужна оценка работ по проекту. Исходные данные для специалиста.');
    await next(p);
  }
  async function noOverflow(p,label) {
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'overflow: '+label);
  }
  try {
    const categories=[
      ['Строительство дома','Коробка дома','houseArea','120'],
      ['Фундамент','Ленточный','length','44'],
      ['Кровля','Новая кровля','roofArea','180'],
      ['Электромонтаж','Разводка с нуля','sockets','24'],
      ['Отделочные работы','Штукатурка','surfaceArea','160']
    ];
    for (const [kind,subtype,key,value] of categories) {
      const p=await page();
      await start(p,kind,subtype);
      await p.locator(`[name="param:${key}"]`).fill(value);
      await p.locator('[data-tw-back]').click();
      assert.equal(await p.locator('#tw-title').inputValue(),'Тест: '+kind);
      await next(p);
      assert.equal(await p.locator(`[name="param:${key}"]`).inputValue(),value);
      await p.reload();
      assert.equal(await p.locator(`[name="param:${key}"]`).inputValue(),value);
      await p.context().close();
    }
    for (const [subtype,key,absent] of [['Плитный','slabThickness','length'],['Свайный','pileCount','slabThickness']]) {
      const p=await page(); await start(p,'Фундамент',subtype);
      await p.locator(`[name="param:${key}"]`).waitFor();
      assert.equal(await p.locator(`[name="param:${absent}"]`).count(),0);
      await p.context().close();
    }
    const p=await page(319);
    await p.goto(base+'#new'); await next(p);
    assert.match(await p.locator('#tw-error').textContent(),/название/);
    assert.equal(await p.locator('#tw-title').count(),1);
    await start(p,'Фундамент','Ленточный');
    await p.locator('[name="param:length"]').fill('-5'); await next(p);
    assert.match(await p.locator('#tw-error').textContent(),/положительное/);
    await p.locator('[name="param:length"]').fill('44');
    await p.locator('[name="param:width"]').fill('40');
    await next(p); await next(p);
    assert.match(await p.locator('#tw-error').textContent(),/город|район/);
    await p.locator('#tw-district').fill('Грозный');
    await p.locator('#tw-budget').fill('400000');
    await choose(p,'period','До 2 недель');
    await next(p);
    await p.locator('#tw-upload').setInputFiles({name:'project.png',mimeType:'image/png',buffer:png});
    assert.equal(await p.locator('.tw-file').count(),1);
    await p.locator('[data-tw-remove]').click();
    assert.equal(await p.locator('.tw-file').count(),0);
    await p.locator('#tw-upload').setInputFiles({name:'project.png',mimeType:'image/png',buffer:png});
    await next(p);
    assert.match(await p.locator('.tw-review-section').nth(1).textContent(),/44 пог. м/);
    await p.locator('.tw-review-section [data-tw-step="1"]').click();
    assert.equal(await p.locator('[name="param:width"]').inputValue(),'40');
    await p.locator('[name="param:width"]').fill('45');
    await next(p); await next(p); await next(p);
    assert.match(await p.locator('.tw-review-section').nth(1).textContent(),/45 см/);
    await noOverflow(p,'review319');
    await next(p);
    await p.waitForURL(/#offers\//);
    const publishedId = p.url().split('#offers/')[1].split('?')[0];
    await p.locator('.tender-parameters').waitFor();
    assert.match(await p.locator('.tender-parameters').textContent(),/44 пог. м/);
    await p.reload();
    assert.match(await p.locator('.tender-parameters').textContent(),/45 см/);
    await p.goto(base+'#worker');
    await p.locator('[data-demo-role=customer]').click();
    await p.waitForURL(/#customer$/);
    await p.locator('[data-demo-role=customer][aria-pressed=true]').waitFor();
    await p.locator('[data-demo-role=worker]').click();
    await p.waitForURL(/#worker$/);
    await p.locator('[data-demo-role=worker][aria-pressed=true]').waitFor();
    await p.goto(base+'#market');
    const publishedPost=p.locator('.feed-post').filter({has:p.getByRole('heading',{name:'Тест: Фундамент',exact:true})});
    await publishedPost.waitFor();
    await publishedPost.getByRole('link',{name:/Открыть тендер/}).click();
    await p.waitForURL(new RegExp('#apply/'+publishedId));
    await p.locator('.tender-parameters').waitFor();
    assert.match(await p.locator('.tender-parameters').textContent(),/44 пог. м/);
    assert.match(await p.locator('.tender-parameters').textContent(),/45 см/);
    await p.reload();
    await p.locator('.tender-parameters').waitFor();
    assert.match(await p.locator('.tender-parameters').textContent(),/45 см/);
    await noOverflow(p,'published specialist view319');
    await p.context().close();
    for (const width of [319,390,768,1440]) {
      const p=await page(width);
      await p.goto(base+'#market');
      await p.locator('.feed-tender-actions').first().waitFor();
      const actions=p.locator('.feed-tender-actions').first();
      await actions.getByRole('link',{name:/Открыть тендер/}).waitFor();
      await actions.getByRole('link',{name:'Откликнуться',exact:true}).waitFor();
      await noOverflow(p,'market'+width);
      await actions.getByRole('link',{name:'Откликнуться',exact:true}).click();
      await p.waitForURL(/respond=1/);
      await noOverflow(p,'response'+width);
      await start(p,'Кровля','Ремонт кровли');
      await noOverflow(p,'parameters'+width);
      await p.screenshot({path:'/tmp/belkhi-tender-parameters-'+width+'.png',fullPage:true});
      await p.context().close();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS five categories, foundation branches, validation, Back/edit/reload, file add/remove, review/publication, demo roles, own demo tender visible in specialist market/detail, feed actions and responsive widths319/390/768/1440');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
