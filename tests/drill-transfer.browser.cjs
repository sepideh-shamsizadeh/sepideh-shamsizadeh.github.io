const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const old = "https://sepideh-shamsizadeh.github.io";
const next = "https://sepideh.io";
const build = process.env.DRILL_BUILD_DIR || path.resolve(".vercel/output/static");
const oldBuild = process.env.DRILL_OLD_BUILD_DIR || build;
const legacy = {
  box: { cv0: 4 }, days: { "2026-11-27": 2 }, code: { pt0: "2026-11-27" }, skip: 0,
  lc: { py: { "two-sum": 2 }, cpp: {} }
};
const communication = {
  version: 1, minutes: [3, 3, 5, 4, 5], active: null,
  attempts: [{ questionId: "iou", category: "concept", day: "2026-11-27",
    ratings: { accuracy: 4, depth: 4, structure: 4, clarity: 4, concise: 4, english: 4 },
    answer: "private answer", notes: "private notes" }],
  lessons: { structured: "2026-11-27" }, sessions: [{ mode: "daily", day: "2026-11-27" }]
};

const aiCoach = { version: 1, attempts: [{
  id: "eval-1", questionId: "iou", topic: "cv", category: "concept", at: "2026-11-27T10:00:00.000Z",
  model: "gpt-5.4-mini-2026-03-17", rubric: 1, overall: 2.5, mock: false, reviewAt: "2026-11-28T10:00:00.000Z",
  scores: { accuracy: 2, depth: 3, structure: 2, clarity: 3, concise: 3, english: 2, reasoning: null, practical: 3 },
  answer: "private coach answer", feedback: "private coach feedback"
}] };

test("download on Pages and import on another origin while keeping private text on Pages", async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errors = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (![old, next].includes(url.origin)) return route.abort();
      const file = path.join(url.origin === old ? oldBuild : build,
        url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname);
      return await fs.stat(file).then(stat => stat.isFile(), () => false)
        ? route.fulfill({ path: file })
        : route.fulfill({ status: 404 });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      const url = new URL(response.url());
      if ([old, next].includes(url.origin) && response.status() >= 400) errors.push(url.pathname);
    });
    assert.equal((await page.goto(old + "/drill/")).status(), 200);
    await page.evaluate(({ legacy, communication, aiCoach }) => {
      localStorage.setItem("drill-v1", JSON.stringify(legacy));
      localStorage.setItem("drill-communication-v1", JSON.stringify(communication));
      localStorage.setItem("drill-ai-coach-v1", JSON.stringify(aiCoach));
      localStorage.setItem("theme", "light");
    }, { legacy, communication, aiCoach });
    await page.getByRole("link", { name: "Transfer progress" }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download progress" }).click();
    const download = await downloading;
    const exported = await fs.readFile(await download.path());
    assert.equal(exported.toString().includes("private"), false);

    assert.equal((await page.goto(next + "/drill/transfer/")).status(), 200);
    assert.equal(await page.evaluate(() => localStorage.getItem("drill-v1")), null);
    const picker = page.getByLabel("DRILL progress file");
    await picker.setInputFiles({ name: "drill-progress.json", mimeType: "application/json", buffer: exported });
    await page.getByText("1 flashcard ratings", { exact: false }).waitFor();
    assert.ok(await page.getByText("1 AI assessment scores", { exact: false }).isVisible());
    await page.getByRole("button", { name: "Import progress", exact: true }).click();
    await page.getByText("Progress imported.", { exact: false }).waitFor();
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await picker.setInputFiles({ name: "drill-progress.json", mimeType: "application/json", buffer: exported });
    await page.getByText("This progress is already on this site.").waitFor();
    await page.getByRole("link", { name: "Return to Daily Interview Drill" }).click();
    await page.locator("#cQ").filter({ hasText: /\S/ }).waitFor();
    assert.equal(await page.locator("#sKnown").innerText(), "1");
    await page.getByRole("link", { name: "Technical Communication", exact: true }).click();
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    assert.ok(await page.getByText("4.0 / 5", { exact: true }).first().isVisible());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("drill-communication-v1")).attempts.length), 1);
    await page.getByText("AI assessment history", { exact: true }).click();
    await page.getByText("AI scores by question", { exact: true }).click();
    assert.ok(await page.getByText("What is IoU? · latest 2.5 · best 2.5 · 1 attempt", { exact: false }).isVisible());
    assert.equal((await page.evaluate(() => JSON.stringify(localStorage))).includes("private"), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.goto(old + "/drill/");
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("drill-communication-v1"))), communication);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
