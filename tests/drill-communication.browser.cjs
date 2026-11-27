const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stat } = require("node:fs/promises");
const { join } = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const base = process.env.DRILL_BASE_URL || "http://localhost:4000";
const build = process.env.DRILL_BUILD_DIR;
const key = "drill-communication-v1";

async function run(viewport, check) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!build) return route.continue();
      const path = join(build, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname);
      const file = await stat(path).catch(() => null);
      return file?.isFile() ? route.fulfill({ path }) : route.fulfill({ status: 404 });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await check(page);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

async function rate(page, value) {
  for (const select of await page.locator("#comm-assessment fieldset select").all()) {
    await select.selectOption(String(value));
  }
  await page.locator("#comm-assessment button[type=submit]").click();
}

test("desktop practice protects answers, runs a timer, and preserves flashcard and coding progress", async () => {
  await run({ width: 1280, height: 800 }, async page => {
    assert.equal((await page.goto(`${base}/drill/`)).status(), 200);
    const legacy = { box: { ml0: 3 }, days: {}, code: { pt0: "2026-11-27" },
      lc: { py: { "two-sum": 2 }, cpp: {} }, skip: 0 };
    await page.evaluate(value => localStorage.setItem("drill-v1", JSON.stringify(value)), legacy);
    await page.reload();
    await page.locator("#cQ").filter({ hasText: /\S/ }).waitFor();
    assert.ok(await page.locator("#prob h3").textContent());
    await page.getByRole("link", { name: "Technical Communication", exact: true }).click();
    await page.locator("#comm-topic").selectOption("cv");
    await page.locator("#comm-category").selectOption("plain");
    assert.match(await page.locator("#comm-prompt").textContent(), /bounding-box overlap/);
    assert.equal(await page.getByText("We need a consistent way", { exact: false }).isVisible(), false);
    await page.locator("#comm-hint summary").focus();
    await page.keyboard.press("Enter");
    assert.ok(await page.getByText("Problem → Analogy → Benefit", { exact: true }).isVisible());
    await page.locator("#comm-time").selectOption("90");
    await page.clock.install();
    await page.getByRole("button", { name: "Start timer" }).click();
    await page.clock.runFor(1000);
    assert.equal(await page.locator("#comm-clock").textContent(), "01:29");
    await page.clock.fastForward(89_000);
    assert.equal(await page.locator("#comm-clock").textContent(), "00:00");
    assert.equal(await page.locator("#comm-example").evaluate(element => element.open), false);
    await page.locator("#comm-example > summary").click();
    assert.ok(await page.getByText("We need a consistent way", { exact: false }).isVisible());
    await page.getByLabel("Written answer (optional)").fill("My answer");
    await page.getByLabel("Personal notes and knowledge gaps (optional)").fill("Practice the example");
    await rate(page, 2);
    assert.equal(await page.locator("#comm-example").evaluate(element => element.open), false);
    await page.reload();
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    assert.ok(await page.getByRole("button", { name: /Explain bounding-box overlap/ }).isVisible());
    const saved = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
    assert.equal(saved.attempts[0].answer, "My answer");
    assert.equal(saved.attempts[0].notes, "Practice the example");
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("drill-v1"))), legacy);
    await page.getByRole("link", { name: "Daily Interview Drill", exact: true }).click();
    await page.locator("#cQ").filter({ hasText: /\S/ }).waitFor();
    assert.ok(await page.locator("#trkTot").textContent());
  });
});

test("mobile completes lessons and both session modes, resuming the active step after reload", async () => {
  await run({ width: 390, height: 844 }, async page => {
    assert.equal((await page.goto(`${base}/drill/communication/`)).status(), 200);
    await page.getByRole("button", { name: "Lessons", exact: true }).click();
    assert.equal(await page.locator(".comm-lesson").count(), 12);
    await page.getByText("Structured technical answers", { exact: true }).click();
    await page.getByRole("checkbox", { name: "Mark lesson complete" }).first().check();
    await page.getByRole("button", { name: "Daily practice", exact: true }).click();
    await page.getByLabel("Technical explanation (min)").fill("2");
    await page.getByRole("button", { name: "Start 20-minute session" }).click();
    assert.match(await page.locator("#communication-status").textContent(), /add up to 20/);
    await page.getByLabel("Engineering decision (min)").fill("4");
    await page.getByRole("button", { name: "Start 20-minute session" }).click();
    assert.match(await page.locator(".comm-current").textContent(), /Step 1 of 5.*2 min/);
    await rate(page, 2);
    await page.reload();
    await page.getByRole("button", { name: "Daily practice", exact: true }).click();
    assert.match(await page.locator(".comm-current").textContent(), /Step 2 of 5.*4 min/);
    for (let i = 0; i < 4; i++) await rate(page, 4);
    await page.getByRole("button", { name: "Start 5-minute quick practice" }).click();
    for (let i = 0; i < 3; i++) await rate(page, 4);
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    assert.ok(await page.getByText("Daily sessions · completed today", { exact: true }).isVisible());
    const saved = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key);
    assert.equal(Object.keys(saved.lessons).length, 1);
    assert.deepEqual(saved.sessions.map(session => session.mode), ["daily", "quick"]);
    assert.equal(saved.attempts.length, 8);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });
});
