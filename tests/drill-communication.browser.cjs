const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stat } = require("node:fs/promises");
const { join } = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { categories, lessons } = require("../drill/communication/content.js");

const base = process.env.DRILL_BASE_URL || "http://localhost:4000";
const origin = new URL(base).origin;
const build = process.env.DRILL_BUILD_DIR;
const captures = process.env.DRILL_SCREENSHOT_DIR;
const key = "drill-communication-v1";
const pagePath = "/drill/communication/";
const desktop = { width: 1280, height: 900 };
const mobile = { width: 390, height: 844 };

async function run(viewport, theme, check, { missing, delay } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    // Initialize each origin once so reloads test persisted theme changes.
    await context.addInitScript(value => {
      if (!localStorage.getItem("theme")) localStorage.setItem("theme", value);
    }, theme);
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === missing) return route.fulfill({ status: 404 });
      if (url.pathname === "/drill/drill.js" && delay) await delay;
      if (!build) return route.continue();
      const path = join(build, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname);
      const file = await stat(path).catch(() => null);
      return file?.isFile() ? route.fulfill({ path }) : route.fulfill({ status: 404 });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [], assets = new Map();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && message.location().url.startsWith(origin) &&
          !message.location().url.includes(missing ?? "<none>")) errors.push(message.text());
    });
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.origin === origin && /\.(css|js)$/.test(url.pathname)) {
        assets.set(url.pathname, { status: response.status(), version: url.searchParams.get("v") });
      }
    });
    page.on("requestfailed", request => {
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname !== missing && /\.(css|js)$/.test(url.pathname)) errors.push(request.url());
    });
    await check(page, assets);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

async function rate(page, value) {
  const self = page.locator("#comm-self");
  if (!await self.evaluate(node => node.open)) await self.locator(":scope > summary").click();
  for (const select of await self.locator("select").all()) {
    await select.selectOption(String(value));
  }
  await page.locator("#comm-assessment button[type=submit]").click();
}

async function view(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function prompt(page) {
  const heading = page.locator("#comm-prompt").filter({ hasText: /\S/ });
  await heading.waitFor();
  return heading.innerText();
}

async function saved(page, storageKey = key) {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k)), storageKey);
}

async function contrast(locator, { boundary = false } = {}) {
  const [ratio, foreground, background, surface] = await locator.evaluate((element, checkBoundary) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    function luminosity(color) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      return rgb.reduce((result, channel, index) => {
        const value = channel / 255;
        return result + [0.2126, 0.7152, 0.0722][index] *
          (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      }, 0);
    }
    const style = getComputedStyle(element);
    let surface = element;
    while (surface && getComputedStyle(surface).backgroundColor === "rgba(0, 0, 0, 0)") surface = surface.parentElement;
    const background = surface ? getComputedStyle(surface).backgroundColor : style.getPropertyValue("--bg").trim();
    const colors = [luminosity(checkBoundary ? style.borderTopColor : style.color), luminosity(background)];
    return [(Math.max(...colors) + 0.05) / (Math.min(...colors) + 0.05), style.color, background, surface?.tagName];
  }, boundary);
  assert.ok(ratio >= (boundary ? 3 : 4.5), `Contrast ratio ${ratio.toFixed(2)} for ${locator} (${foreground} on ${background} from ${surface})`);
}

test("versioned assets initialize; every filter, practice controls and saved progress work on desktop", async () => {
  await run(desktop, "dark", async (page, assets) => {
    assert.equal((await page.goto(base + pagePath)).status(), 200);
    await prompt(page);
    assert.equal(await page.locator("#communication-view").getAttribute("aria-busy"), "false");
    for (const file of ["drill.css", "drill.js", "communication/communication.css", "communication/content.js",
      "communication/model.js", "communication/communication.js"]) {
      const path = "/drill/" + file;
      assert.equal(assets.get(path)?.status, 200, path);
      assert.ok(assets.get(path)?.version, path + " has a cache version");
    }

    for (const path of ["/assets/css/main.css", "/assets/css/site.css", "/assets/js/site.js"]) {
      assert.equal(assets.get(path)?.status, 200, path);
    }

    const category = page.getByLabel("Category", { exact: true });
    const topic = page.getByLabel("Topic", { exact: true });
    assert.equal(await category.locator("option").count(), Object.keys(categories).length + 1);
    for (const [id, [label]] of Object.entries(categories)) {
      await category.selectOption(id);
      await prompt(page);
      assert.ok((await page.locator("#comm-exercise .comm-kicker").innerText()).endsWith(label));
    }
    await category.selectOption("");
    const topics = await topic.locator("option").evaluateAll(options => options.slice(1).map(option => [option.value, option.textContent]));
    assert.deepEqual(topics.map(([id]) => id).sort(), ["cpp", "cv", "dl", "ml", "ops", "pl", "rl", "ros", "sd", "sen", "sp"]);
    for (const [id, label] of topics) {
      await topic.selectOption(id);
      await prompt(page);
      assert.ok((await page.locator("#comm-exercise .comm-kicker").innerText()).startsWith(label));
    }
    const previous = await prompt(page);
    await view(page, "Random practice");
    assert.notEqual(await prompt(page), previous);
    assert.equal(await category.inputValue(), "");
    assert.equal(await topic.inputValue(), "");
    await topic.selectOption("cv");
    await category.selectOption("plain");
    assert.match(await prompt(page), /bounding-box overlap/);
    await view(page, "Skip to next question");
    assert.match(await page.locator("#communication-status").innerText(), /only question/);
    assert.match(await prompt(page), /bounding-box overlap/);
    for (const locator of [page.locator('label[for="comm-category"]'), category, page.locator("#comm-prompt"),
      page.locator("#comm-self > summary"), page.locator('[aria-controls="comm-example"]')]) await contrast(locator);
    await contrast(category, { boundary: true });
    if (captures) await page.screenshot({ path: join(captures, "drill-v1.0.1-practice-dark.png"), fullPage: true });

    const hint = page.getByRole("button", { name: "Answer structure hint" });
    await hint.focus();
    await page.keyboard.press("Enter");
    assert.ok(await page.getByText("Problem → Analogy → Benefit", { exact: true }).isVisible());
    await hint.click();
    assert.equal(await page.locator("#comm-hint").isVisible(), false);
    await page.locator("#comm-time").selectOption("90");
    await page.clock.install();
    await view(page, "Start timer");
    await page.clock.runFor(1000);
    assert.equal(await page.locator("#comm-clock").textContent(), "01:29");
    await view(page, "Reset timer");
    assert.equal(await page.locator("#comm-clock").textContent(), "01:30");
    await view(page, "Start timer");
    await page.clock.fastForward(90_000);
    assert.equal(await page.locator("#comm-clock").textContent(), "00:00");
    assert.equal(await page.locator("#comm-example").isVisible(), false);
    await view(page, "Show example answer");
    assert.ok(await page.getByText("We need a consistent way", { exact: false }).isVisible());
    await page.getByText("Related DRILL flashcard", { exact: true }).click();
    assert.ok(await page.getByText("What is IoU?", { exact: true }).isVisible());
    await view(page, "Hide example answer");
    assert.equal(await page.locator("#comm-example").isVisible(), false);
    assert.equal(await page.locator("#comm-self").evaluate(node => node.open), false);
    await page.getByText("Optional self-assessment", { exact: true }).click();
    await page.getByText("Scoring scale", { exact: true }).click();
    assert.ok(await page.getByText(/Interview-ready/).isVisible());
    await page.getByRole("textbox", { name: "Written answer", exact: true }).fill("My <answer>");
    await page.getByLabel("Personal notes (optional)").fill("Practice the example");
    await rate(page, 2);
    assert.equal(await page.locator("#comm-example").isVisible(), false);
    await category.selectOption("");
    const beforeSkip = await prompt(page);
    await view(page, "Skip to next question");
    assert.notEqual(await prompt(page), beforeSkip);

    await page.getByRole("textbox", { name: "Written answer", exact: true }).fill("Private unrated response");
    await view(page, "Save and next question");
    const attempts = (await saved(page)).attempts;
    assert.ok(attempts.some(row => row.assessment === "skipped"));
    assert.ok(attempts.some(row => row.ratings.accuracy === 2));
    assert.deepEqual(attempts.at(-1).ratings, {});
    assert.equal(attempts.at(-1).assessment, "unassessed");

    await page.reload();
    await view(page, "Progress");
    await contrast(page.locator(".comm-table th").first());
    assert.ok(await page.getByText("Average self-assessment", { exact: true }).first().isVisible());
    assert.equal((await saved(page)).attempts[0].answer, undefined);
    assert.equal((await saved(page)).attempts[0].notes, undefined);
    await page.getByRole("button", { name: /Explain bounding-box overlap/ }).click();
    assert.match(await prompt(page), /bounding-box overlap/);
  });
});

test("mobile lessons, light and dark themes, and both session modes respond and persist", async () => {
  await run(mobile, "light", async page => {
    await page.goto(base + pagePath);
    await view(page, "Progress");
    assert.ok(await page.getByText("No practice attempts yet").isVisible());
    assert.equal(await page.locator(".comm-table").count(), 0);
    await view(page, "Start practice");
    await prompt(page);
    await view(page, "Lessons");
    assert.equal(await page.locator(".comm-lesson").count(), 12);
    if (captures) await page.screenshot({ path: join(captures, "drill-v1.0.1-lessons-light-mobile.png") });
    for (const [index, [, title, objective, explanation, framework, weak, improved, exercises]] of lessons.entries()) {
      if (index === 0) await page.locator("[data-lesson='0']").click();
      else await view(page, "Next lesson");
      assert.ok(await page.getByRole("heading", { name: title, exact: true }).isVisible());
      for (const text of [objective, explanation, framework, weak, improved, ...exercises]) {
        assert.ok(await page.getByText(text, { exact: text !== objective }).isVisible(), text);
      }
      await contrast(page.getByRole("heading", { name: title, exact: true }));
    }
    await view(page, "Mark as completed");
    await view(page, "Mark as incomplete");
    assert.equal(Object.keys((await saved(page)).lessons).length, 0);
    await view(page, "Mark as completed");
    await view(page, "All lessons");
    assert.match(await page.locator("[data-lesson='11']").innerText(), /Review lesson/);
    assert.match(await page.locator("[data-lesson='0']").innerText(), /Continue lesson/);
    await page.locator("[data-lesson='0']").click();
    assert.ok(await page.getByRole("heading", { name: lessons[0][1], exact: true }).isVisible());

    await view(page, "Daily practice");
    assert.equal(await page.locator("#comm-settings").evaluate(element => element.open), false);
    assert.equal(await page.locator(".comm-plan li").count(), 5);
    await view(page, "Start daily practice");
    assert.match(await page.locator(".comm-current").innerText(), /Step 1 of 5.*3 min/);
    await page.getByText("End this session early", { exact: true }).click();
    await view(page, "End session");
    assert.equal((await saved(page)).active, null);
    await page.getByText("Customize session durations", { exact: true }).click();
    for (const selector of ["#comm-plan label", "#comm-plan input"]) await contrast(page.locator(selector).first());
    await page.getByLabel("Technical explanation (min)").fill("2");
    await view(page, "Start daily practice");
    assert.match(await page.locator("#communication-status").textContent(), /add up to 20/);
    await page.getByLabel("Engineering decision (min)").fill("4");
    await view(page, "Start daily practice");
    assert.match(await page.locator(".comm-current").textContent(), /Step 1 of 5.*2 min/);
    assert.ok(await page.getByText("4 steps after this one").isVisible());
    await rate(page, 2);
    await page.reload();
    await view(page, "Daily practice");
    assert.match(await page.locator(".comm-current").textContent(), /Step 2 of 5.*4 min/);
    assert.equal(await page.locator("progress").getAttribute("value"), "1");
    for (let i = 0; i < 4; i++) await rate(page, 4);
    await view(page, "Start 5-minute quick practice");
    for (let i = 0; i < 3; i++) await rate(page, 4);
    await view(page, "Progress");
    assert.ok(await page.getByText("Daily sessions · completed today", { exact: true }).isVisible());
    await contrast(page.locator(".comm-table th").first());
    await page.locator(".theme-toggle").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await contrast(page.locator(".comm-table th").first());
    if (captures) await page.screenshot({ path: join(captures, "drill-v1.0.1-progress-dark-mobile.png"), fullPage: true });
    const data = await saved(page);
    assert.equal(Object.keys(data.lessons).length, 1);
    assert.deepEqual(data.sessions.map(session => session.mode), ["daily", "quick"]);
    assert.equal(data.attempts.length, 8);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });
});

test("startup waits for the bank and recovers the UI when a required script fails", async () => {
  let unblock;
  const delay = new Promise(resolve => { unblock = resolve; });
  await run(desktop, "dark", async page => {
    try {
      await page.goto(base + pagePath, { waitUntil: "commit" });
      await page.getByText("Loading the question bank…").waitFor();
      assert.equal(await page.getByRole("button", { name: "Practice", exact: true }).isEnabled(), false);
      assert.equal(await page.getByText(/No exercises match/).count(), 0);
    } finally {
      unblock();
    }
    await prompt(page);
    assert.equal(await page.getByRole("button", { name: "Practice", exact: true }).isEnabled(), true);
  }, { delay });
  await run(desktop, "dark", async page => {
    await page.goto(base + pagePath);
    assert.ok(await page.getByText("Technical Communication could not load its required files.").isVisible());
    assert.ok(await page.getByRole("link", { name: "Reload Technical Communication" }).isVisible());
    assert.equal(await page.getByRole("button", { name: "Practice", exact: true }).isEnabled(), false);
    assert.equal(await page.getByText(/No exercises match/).count(), 0);
  }, { missing: "/drill/drill.js" });
});

test("legacy flashcard, coding and LeetCode controls work without changing communication data", async () => {
  await run(desktop, "dark", async page => {
    assert.equal((await page.goto(base + "/drill/")).status(), 200);
    const legacy = { box: { ml0: 3 }, days: {}, code: { pt0: "2026-11-27" },
      lc: { py: { "two-sum": 2 }, cpp: {} }, skip: 0 };
    await page.evaluate(value => localStorage.setItem("drill-v1", JSON.stringify(value)), legacy);
    await page.reload();
    await page.locator("#cQ").filter({ hasText: /\S/ }).waitFor();
    await page.getByRole("link", { name: "Technical Communication", exact: true }).click();
    await prompt(page);
    await rate(page, 4);
    assert.deepEqual(await saved(page, "drill-v1"), legacy);
    await page.getByRole("link", { name: "Daily Interview Drill", exact: true }).click();
    await page.locator("#cQ").filter({ hasText: /\S/ }).waitFor();
    await page.locator("#acts [data-r=show]").click();
    assert.ok(await page.locator("#cA").isVisible());
    await page.locator("#acts [data-r='1']").click();
    assert.match(await page.locator("#sToday").innerText(), /^1 \/ 20$/);
    await page.locator("#pChips [data-k=pt]").click();
    const codingId = await page.locator("#pDone").getAttribute("data-id");
    const wasDone = Boolean(legacy.code[codingId]);
    await page.locator("#pDone").click();
    await page.locator("#pChips [data-k=lc-py]").click();
    const slug = await page.locator("#prob").getAttribute("data-slug");
    await page.locator("#pDone").click();
    await page.reload();
    const progress = await saved(page, "drill-v1");
    assert.equal(Boolean(progress.code[codingId]), !wasDone);
    assert.equal(progress.lc.py[slug], 2);
    assert.equal(progress.lc.py["two-sum"], 2);
    assert.equal((await saved(page)).attempts.length, 1);
    assert.match(await page.locator("#trkTot").innerText(), /^2 of /);
  });
});
