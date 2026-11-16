/* Browser acceptance tests for the Tishtar roadmap and the theme toggle.
   See docs/tishtar-maintenance.md for the temporary QA setup. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.TISHTAR_BASE_URL || "http://127.0.0.1:4175";
const browserOptions = { headless: true };
if (process.env.CHROME_PATH) browserOptions.executablePath = process.env.CHROME_PATH;

async function open(browser, path, options = {}) {
  const ctx = await browser.newContext(options);
  // Stay offline except for the local build.
  await ctx.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort()
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(base + path);
  assert.equal(response.status(), 200);
  return { ctx, page, errors };
}

// Robot centre y minus current badge top, in CSS pixels (negative = robot is above the badge).
function robotVsCurrent(page) {
  return page.evaluate(() => {
    const rm = document.querySelector(".rm");
    const row = rm.querySelectorAll(".rm-row")[Number(rm.dataset.current) - 1];
    const bot = rm.querySelector(".rm-bot").getBoundingClientRect();
    const badge = row.querySelector(".rm-badge").getBoundingClientRect();
    return { dy: bot.top + bot.height / 2 - badge.top, dx: Math.abs(bot.left + bot.width / 2 - (badge.left + badge.width / 2)) };
  });
}

(async () => {
  const browser = await chromium.launch(browserOptions);
  try {
    // 1. Desktop: the robot drives down and parks just above the current phase.
    {
      const { ctx, page, errors } = await open(browser, "/tishtar/", { viewport: { width: 1360, height: 900 } });
      const phases = await page.locator(".rm-row").count();
      assert.equal(phases, 7, "one row per phase");
      assert.equal(await page.locator(".rm-row--current").count(), 1);
      assert.ok((await page.locator(".q").count()) >= 40, "one mark per milestone");
      const start = await robotVsCurrent(page);
      assert.ok(start.dy < -60, "robot starts above the current phase");
      await page.locator(".rm").scrollIntoViewIfNeeded();
      await page.waitForSelector(".rm.is-arrived", { timeout: 8000 });
      const end = await robotVsCurrent(page);
      assert.ok(end.dy < 0 && end.dy > -40, "robot parks just above the current badge, got " + end.dy);
      assert.ok(end.dx < 2, "robot stays on the centre line");
      // Reached phases are fully visible; later phases are faded.
      const opacity = (sel) => page.locator(sel).first().evaluate((el) => +getComputedStyle(el).opacity);
      await page.waitForTimeout(600);
      assert.equal(await opacity(".rm-row--current"), 1);
      assert.ok((await opacity(".rm-row--future")) < 0.6, "future phases are faded");
      // Replay restarts the drive.
      await page.click(".tr-replay");
      await page.waitForTimeout(120);
      assert.ok((await robotVsCurrent(page)).dy < -60, "replay restarts from the top");
      await page.waitForSelector(".rm.is-arrived", { timeout: 8000 });
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 2. Reduced motion: the robot is placed at once.
    {
      const { ctx, page, errors } = await open(browser, "/tishtar/", { viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
      await page.waitForSelector(".rm.is-arrived", { timeout: 2000 });
      const end = await robotVsCurrent(page);
      assert.ok(end.dy < 0 && end.dy > -40);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 3. Mobile: single column on the left line, no page overflow.
    {
      const { ctx, page, errors } = await open(browser, "/tishtar/", { viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
      await page.locator(".rm").scrollIntoViewIfNeeded();
      await page.waitForSelector(".rm.is-arrived", { timeout: 8000 });
      assert.ok((await robotVsCurrent(page)).dx < 2);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, "no horizontal page scroll");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 4. No JavaScript: roadmap content is complete, robot hidden.
    {
      const { ctx, page } = await open(browser, "/tishtar/", { javaScriptEnabled: false });
      assert.equal(await page.locator(".rm-bot").isVisible(), false);
      assert.equal(await page.locator(".rm-row").count(), 7);
      assert.ok(await page.locator(".rm-row--current").isVisible());
      await ctx.close();
    }
    // 5. Theme toggle: dark by default (even with a light system setting), switches, remembers the choice.
    {
      const { ctx, page, errors } = await open(browser, "/", { colorScheme: "light" });
      const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark", "dark by default");
      const dark = await bg();
      await page.click(".theme-toggle");
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
      assert.notEqual(await bg(), dark, "background changes");
      await page.reload();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light", "choice persists");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    console.log("Tishtar roadmap and theme tests passed");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
