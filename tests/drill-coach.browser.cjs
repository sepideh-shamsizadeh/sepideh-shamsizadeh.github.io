const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const build = process.env.DRILL_BUILD_DIR;
const site = "https://sepideh.io";
const backend = "https://coach.example";
const pagePath = "/drill/communication/";

for (const theme of ["dark", "light"]) {
  test(`coach mock UI works in ${theme} without persisting answer text or charging automatically`, async () => {
    assert.ok(build, "Set DRILL_BUILD_DIR to the built Jekyll site");
    const [{ handle }, { Ledger }] = await Promise.all([
      import("../backend/drill-coach/service.mjs"), import("../backend/drill-coach/ledger.mjs")
    ]);
    const db = new DatabaseSync(":memory:");
    const ledger = new Ledger((sql, ...args) => db.prepare(sql).all(...args), callback => {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = callback();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    });
    const env = { ALLOWED_ORIGIN: site, COACH_MODE: "mock", GOOGLE_CLIENT_ID: "mock-client",
      OWNER_GOOGLE_SUB: "123", DEDUPE_SECRET: "mock-test-secret-with-sufficient-length",
      OPENAI_MODEL: "gpt-5.4-mini-2026-03-17" };
    let calls = 0, now = Date.now();
    let outage = false;
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
    try {
      const context = await browser.newContext({ viewport: theme === "dark" ? { width: 1280, height: 900 } : { width: 390, height: 844 } });
      await context.addInitScript(value => localStorage.setItem("theme", value), theme);
      await context.route("**/*", async route => {
        const original = route.request();
        const url = new URL(original.url());
        if (url.origin === backend) {
          if (url.pathname.endsWith("/evaluations") && original.method() === "POST") {
            calls++;
            if (outage) return route.abort();
          }
          const request = new Request(url, { method: original.method(), headers: {
            ...await original.allHeaders(), Origin: site
          }, body: original.postData() || undefined });
          const response = await handle(request, env, ledger, {
            now: () => (now += 2500),
            verify: async credential => ({ sub: "123", nonce: credential })
          });
          return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers),
            body: (await response.text()) || undefined });
        }
        if (url.origin === "https://accounts.google.com" && url.pathname === "/gsi/client") {
          return route.fulfill({ contentType: "text/javascript", body: `
            window.google = {accounts:{id:{
              initialize(config){this.config=config},
              renderButton(el){
                const b=document.createElement("button");
                b.type="button"; b.textContent="Mock Google Sign-In";
                b.onclick=()=>this.config.callback({credential:this.config.nonce}); el.append(b);
              },
              disableAutoSelect(){}
            }}};
          ` });
        }
        if (url.origin !== site) return route.abort();
        const path = join(build, url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname);
        try {
          if (url.pathname === pagePath) {
            const html = (await fs.readFile(path, "utf8")).replace('data-coach-api=""', `data-coach-api="${backend}"`);
            return route.fulfill({ contentType: "text/html", body: html });
          }
          if ((await fs.stat(path)).isFile()) return route.fulfill({ path });
        } catch {
          return route.fulfill({ status: 404 });
        }
        return route.fulfill({ status: 404 });
      });

      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.goto(site + pagePath);
      const byButton = name => page.getByRole("button", { name, exact: true });
      const evaluation = () => byButton("Evaluate my answer");
      await page.getByText("AI Communication Coach", { exact: true }).click();
      await byButton("Set up Google Sign-In").click();
      await byButton("Mock Google Sign-In").click();
      await evaluation().waitFor();
      const input = page.getByLabel("Written answer (optional)");
      await input.fill("Original private answer with <markup>");
      assert.equal(calls, 0);
      await evaluation().click();
      await page.getByRole("heading", { name: "Mock result · 3.0 / 5" }).waitFor();
      await page.getByText("Recommended structure and improved answer", { exact: true }).click();
      assert.ok(await page.getByText("Start with a direct definition.", { exact: false }).isVisible());
      await byButton("Save scores").click();
      await byButton("Try again").click();
      await input.fill("Revised private answer with one concrete example");
      await evaluation().click();
      await byButton("Compare attempts").click();
      assert.ok(await page.getByText("Original private answer with <markup>", { exact: true }).isVisible());
      assert.ok(await page.getByText("Revised private answer with one concrete example", { exact: true }).isVisible());
      await byButton("Mark knowledge gap for review").click();
      const snapshot = await page.evaluate(() => JSON.stringify(localStorage));
      assert.ok(snapshot.includes("drill-ai-coach-v1"));
      assert.ok(!snapshot.includes("private answer") && !snapshot.includes("Start with a direct definition"));
      await byButton("Continue to follow-up").click();
      assert.equal(calls, 2);
      assert.ok(await page.getByLabel("How would you test whether that approach works?").isVisible());
      outage = true;
      const followUp = page.getByLabel("How would you test whether that approach works?");
      await followUp.fill("My answer despite the outage");
      await evaluation().click();
      await page.getByText("The coach is unreachable.", { exact: false }).waitFor();
      assert.equal(await followUp.inputValue(), "My answer despite the outage");
      outage = false;
      await byButton("Sign out").click();
      assert.equal(await followUp.count(), 0);
      await byButton("Daily practice").click();
      await byButton("Start 5-minute quick practice").click();
      assert.ok(await page.getByText("AI Communication Coach", { exact: true }).isVisible());
      assert.equal(calls, 3);
      await page.reload();
      await byButton("Progress").click();
      await page.getByText("AI assessment history", { exact: true }).click();
      assert.equal(await byButton("Delete saved AI score").count(), 2);
      await byButton("Delete saved AI score").first().click();
      assert.equal(await byButton("Delete saved AI score").count(), 1);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(pageErrors, []);
    } finally {
      await browser.close();
      db.close();
    }
  });
}
