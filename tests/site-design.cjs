/* Whole-site layout and navigation acceptance checks against a Jekyll build. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TISHTAR_BASE_URL || 'http://127.0.0.1:4175';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}) });
  try {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) return route.continue();
      if (url.hostname === 'sepideh-shamsizadeh.github.io') return route.fulfill({response:await route.fetch({url:base + url.pathname + url.search})});
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const routes = ['/', '/portfolio/', '/tishtar/', '/story/', '/year-archive/', '/portfolio/portfolio-1/', '/portfolio/portfolio-2/', '/publications/', '/cv/', '/teaching/', '/talks/'];
    let header, footer;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      for (const path of routes) {
        assert.equal((await page.goto(base + path)).status(), 200, path);
        await page.locator('body.portfolio-site').waitFor();
        assert.equal(await page.locator('main#main').count(), 1, path);
        assert.equal(await page.locator('.site-header').count(), 1, path);
        assert.equal(await page.locator('.site-footer').count(), 1, path);
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({tag:el.tagName, cls:el.className, right:el.getBoundingClientRect().right})).slice(0,12));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at ${width}: ${JSON.stringify(overflow)}`);
        const typography = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
        assert.ok(typography.includes('Segoe UI'));
        const brand = await page.locator('.site-brand').getAttribute('href');
        assert.ok(brand.endsWith('/'));
        const nav = await page.locator('.site-links a').allTextContents();
        const foot = await page.locator('.site-footer').innerText();
        if (!header) { header = nav; footer = foot; }
        assert.deepEqual(nav, header);
        assert.equal(foot, footer);
        if (path !== '/' && !['/publications/', '/cv/', '/teaching/', '/talks/'].includes(path)) {
          assert.equal(await page.locator('.site-links [aria-current="page"]').count(), 1, path);
        }
        await page.locator('img').evaluateAll(images => Promise.all(images.map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })));
        assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(img => ['127.0.0.1', 'sepideh-shamsizadeh.github.io'].includes(new URL(img.src).hostname) && (!img.complete || !img.naturalWidth)).map(img => img.src)), [], `Broken images: ${path}`);
        if (width < 760) {
          await page.locator('.site-menu-toggle').click();
          assert.equal(await page.locator('.site-links').isVisible(), true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.site-links').isVisible(), false);
        }
      }
    }
    await page.goto(base + '/');
    await page.screenshot({path: '/tmp/portfolio-home-desktop.png', fullPage: true});
    await page.setViewportSize({width:390,height:1000});
    await page.goto(base + '/tishtar/');
    await page.screenshot({path:'/tmp/portfolio-tishtar-mobile.png', fullPage:true});
    assert.deepEqual(errors, []);
    console.log('PASS: 11 routes at 320/390/768/1440px; shared header/footer/type; active navigation; mobile menu; image loading; no overflow or JavaScript errors.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
