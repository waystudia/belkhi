const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:4182/';
const prefix = '#admin-preview';
const customerId = 'a1000000-0000-4000-8000-000000000002';
const adminId = 'a1000000-0000-4000-8000-000000000001';
const panels = ['overview','users','customers','specialists','tenders','objects','responses','moderation','journal','demo','settings'];

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  const errors = [], apiRequests = [];
  async function page(width) {
    const context = await browser.newContext({viewport: {width, height: 900}, serviceWorkers: 'block'});
    await context.route('https://*.supabase.co/**', route => {apiRequests.push(route.request().url()); return route.abort();});
    const result = await context.newPage();
    result.setDefaultTimeout(12000);
    result.on('pageerror', error => errors.push(error.message));
    return result;
  }
  async function ready(p) {
    // Fragment navigation dispatches hashchange asynchronously; allow its render task to start.
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await p.locator('.admin-workspace').waitFor();
    await p.waitForFunction(() => {
      const content = document.querySelector('#ad-content');
      return content && !content.querySelector('.ad-loading') && content.getAttribute('aria-busy') !== 'true';
    });
    assert.equal(await p.locator('#ad-content > .ad-error').count(), 0, 'section load error at ' + p.url());
  }
  async function visit(p, query, id = '') {
    await p.goto(base + prefix + (id ? '/' + id : '') + '?' + query);
    await ready(p);
  }
  async function noOverflow(p, label) {
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow: ' + label);
  }
  async function hash(p) {return new URL(p.url()).hash;}
  async function previewAPI(p, action, fields = {}) {
    return p.evaluate(async ({action, fields}) => (await import('./admin-preview-data.js')).createAdminPreviewAPI()(action, fields), {action, fields});
  }
  try {
    for (const width of [390, 1440]) {
      const p = await page(width);
      for (const panel of panels) {
        await visit(p, 'panel=' + panel);
        await noOverflow(p, panel + ':' + width);
      }
      for (const [panel, tabs] of Object.entries({
        users: ['all','active','blocked','admins'], customers: ['all','active','blocked'],
        specialists: ['all','active','blocked'], tenders: ['all','open','in_progress'],
        moderation: ['blocked','messages','policy'], journal: ['moderation','catalog'],
        settings: ['application','categories','access','security']
      })) {
        for (const tab of tabs) {
          await visit(p, 'panel=' + panel + '&tab=' + tab);
          await noOverflow(p, panel + '/' + tab + ':' + width);
        }
      }
      for (const section of ['Тендеры','Заказчики','Исполнители','Отклики','Журнал']) {
        await visit(p, 'panel=demo&section=' + encodeURIComponent(section));
        await noOverflow(p, 'demo/' + section + ':' + width);
      }
      const tenders = await previewAPI(p, 'tenders');
      assert.equal(tenders.length, 4);
      assert.ok(tenders.every(t => t.bid_count === 3));
      for (const tab of ['details','files','responses','history']) {
        await visit(p, 'panel=tenders&record=' + tenders[0].id + '&tab=' + tab);
        await noOverflow(p, 'tender/' + tab + ':' + width);
        assert.equal(await p.locator('[data-choose],[data-confirm]').count(), 0, 'admin must not choose a performer');
      }
      for (const tab of ['info','access','messages','activity']) {
        await visit(p, 'panel=users&tab=' + tab, customerId);
        await noOverflow(p, 'account/' + tab + ':' + width);
      }
      await visit(p, 'panel=users&tab=access', adminId);
      assert.equal(await p.locator('[data-ad-access-form]').count(), 0, 'admin account is protected');
      await visit(p, 'panel=overview');
      await p.screenshot({path: '/tmp/belkhi-admin-' + (width === 1440 ? 'desktop' : 'mobile') + '.png', fullPage: true});
      if (width === 390) {
        const menu = p.locator('.ad-mobile-menu');
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await p.locator('#ad-mobile-nav a[href*="panel=users"]').click();
        await ready(p);
        assert.equal(await p.locator('.ad-mobile-menu').getAttribute('aria-expanded'), 'false');
        assert.equal(await p.locator('#ad-mobile-nav').isHidden(), true);
      }
      const localKeys = await p.evaluate(() => Object.keys(localStorage));
      assert.deepEqual(localKeys, [], 'preview must not create auth/account localStorage data');
      await p.context().close();
    }

    const p = await page(390);
    await visit(p, 'panel=users&tab=access', customerId);
    const initial = await previewAPI(p, 'account', {id: customerId});
    assert.equal(initial.blocked_at, null);
    const initialLog = (await previewAPI(p, 'journal', {target: customerId})).length;
    const form = p.locator('[data-ad-access-form]');
    await form.locator('textarea').fill('x');
    await form.locator('button[type=submit]').click();
    assert.equal(await form.locator('textarea').evaluate(el => el.validity.tooShort || !el.checkValidity()), true);
    assert.equal((await previewAPI(p, 'journal', {target: customerId})).length, initialLog, 'invalid reason must not mutate state');
    await form.locator('textarea').fill('Проверка тестовой блокировки');
    await form.locator('button[type=submit]').click();
    await p.getByRole('button', {name: 'Восстановить доступ', exact: true}).waitFor();
    assert.ok((await previewAPI(p, 'account', {id: customerId})).blocked_at);
    await p.reload();await ready(p);
    await p.getByRole('button', {name: 'Восстановить доступ', exact: true}).waitFor();
    await p.locator('[data-ad-access-form] textarea').fill('Проверка тестового восстановления');
    await p.locator('[data-ad-access-form] button[type=submit]').click();
    await p.getByRole('button', {name: 'Заблокировать аккаунт', exact: true}).waitFor();
    assert.equal((await previewAPI(p, 'account', {id: customerId})).blocked_at, null);
    await visit(p, 'panel=users&tab=messages', customerId);
    assert.equal(await p.locator('.ad-message').count(), 0, 'messages must require an explicit reason');
    await p.locator('[data-ad-message-form] textarea').fill('Проверка демонстрационной переписки');
    await p.getByRole('button', {name: 'Открыть сообщения', exact: true}).click();
    await p.locator('.ad-message').first().waitFor();
    assert.equal(await p.locator('.ad-message').count(), 2);
    await p.locator('#ad-account-tab-activity').click();await ready(p);
    await p.locator('.ad-log-item').first().waitFor();
    assert.match(await p.locator('[data-ad-account-section]').textContent(), /Проверка демонстрационной переписки/);
    assert.equal((await previewAPI(p, 'journal', {target: customerId})).length, initialLog + 3);
    await p.locator('#ad-reset-preview').click();await ready(p);
    assert.equal((await previewAPI(p, 'journal', {target: customerId})).length, initialLog);
    assert.equal((await previewAPI(p, 'overview')).accounts.blocked, 1);

    // Account Back preserves the submitted URL, unsaved search draft, scroll and meaningful focus.
    await visit(p, 'panel=users');
    await p.locator('#ad-account-query').fill('example.invalid');
    await p.locator('[data-ad-account-search] button[type=submit]').click();await ready(p);
    assert.match(await hash(p), /q=example.invalid/);
    await p.locator('#ad-account-query').fill('Несохранённый поисковый запрос');
    const target = p.locator('#ad-account-' + customerId);
    await target.scrollIntoViewIfNeeded();await target.focus();
    const source = await p.evaluate(() => ({hash: location.hash, scroll: window.scrollY}));
    await target.click();await ready(p);
    await p.locator('#ad-account-tab-access').click();await ready(p);
    await p.locator('#ad-account-back').click();await ready(p);
    assert.equal(await hash(p), source.hash);
    assert.equal(await p.locator('#ad-account-query').inputValue(), 'Несохранённый поисковый запрос');
    assert.equal(await p.evaluate(() => document.activeElement?.id), 'ad-account-' + customerId);
    assert.ok(Math.abs(await p.evaluate(() => window.scrollY) - source.scroll) <= 2, 'visible Back restores account list scroll');
    await target.click();await ready(p);await p.goBack();await ready(p);
    assert.equal(await hash(p), source.hash);
    assert.equal(await p.locator('#ad-account-query').inputValue(), 'Несохранённый поисковый запрос');
    assert.equal(await p.evaluate(() => document.activeElement?.id), 'ad-account-' + customerId);

    // Tender Back also survives tab changes without returning to an intermediate tab.
    await visit(p, 'panel=tenders&tab=open');
    await p.locator('#ad-tender-search input').fill('Грозный');
    await p.locator('#ad-tender-search button').click();await ready(p);
    const tenderSource = await hash(p);
    const tenderLink = p.locator('[data-ad-detail]').first();
    await tenderLink.click();await ready(p);
    await p.locator('[data-ad-tab]').filter({hasText: 'Материалы'}).click();await ready(p);
    await p.locator('[data-ad-back]').click();await ready(p);
    assert.equal(await hash(p), tenderSource);
    assert.equal(await p.locator('#ad-tender-search input').inputValue(), 'Грозный');

    // Direct-entry fallback stays inside the preview and does not follow unsafe returnTo values.
    const direct = await page(390);
    await visit(direct, 'panel=users&tab=info&returnTo=' + encodeURIComponent('https://example.com/'), customerId);
    await direct.locator('#ad-account-back').click();await ready(direct);
    assert.equal(new URL(direct.url()).origin, new URL(base).origin);
    assert.match(await hash(direct), /^#admin-preview\?panel=users/);
    await direct.context().close();
    assert.deepEqual(await p.evaluate(() => Object.keys(localStorage)), [], 'preview operations cannot create an authenticated session');
    await p.context().close();

    const narrow = await page(319);
    for (const panel of ['overview','users','tenders','settings']) {
      await visit(narrow, 'panel=' + panel);await noOverflow(narrow, panel + ':319');
    }
    await visit(narrow, 'panel=users&tab=access', customerId);await noOverflow(narrow, 'account/access:319');
    await narrow.context().close();
    assert.deepEqual(apiRequests, [], 'preview must never reach the live administrative API');
    assert.deepEqual(errors, [], 'no uncaught browser exceptions');
    console.log('PASS admin preview: 11 sections, all list/detail/settings/catalog tabs, 390/1440 and key 319 widths, mobile menu, reason validation, block/unblock persistence/reset, audited messages, protected admin, exact account+tender Back, safe direct-entry fallback, zero live API/auth storage changes');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exit(1);});
