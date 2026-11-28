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
          // The browser already sends an origin header; replace it rather than merging two values.
          const headers = Object.fromEntries(Object.entries(await original.allHeaders())
            .filter(([name]) => name.toLowerCase() !== "origin"));
          const request = new Request(url, { method: original.method(), headers: { ...headers, Origin: site },
            body: original.postData() || undefined });
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
            const html = (await fs.readFile(path, "utf8")).replace(/data-coach-api="[^"]*"/, `data-coach-api="${backend}"`);
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
      const evaluation = () => byButton("Evaluate written answer");
      const coach = () => page.getByText("AI Communication Coach", { exact: true });
      const coachPanel = page.locator("[id=comm-coach]");
      const signIn = async () => {
        await byButton("Sign in to use AI feedback").click();
        await byButton("Mock Google Sign-In").click();
        await evaluation().waitFor();
      };
      // The practice view is about learning: no usage, cost, token or model details.
      const assertNoOperationalDetails = async () => {
        const text = await coachPanel.innerText();
        assert.doesNotMatch(text, /token|\$|gpt-|budget|Evaluations today|OpenAI balance|micros/i);
      };
      await coach().click();
      await page.getByText("Mock mode: sample feedback for testing.", { exact: false }).waitFor();
      assert.ok(await coachPanel.locator(".comm-coach-badge").isVisible());
      await signIn();
      const input = page.getByRole("textbox", { name: "Written answer", exact: true });
      assert.ok(await evaluation().isDisabled());
      await input.fill("é".repeat(1201));
      assert.ok(await evaluation().isDisabled());
      assert.match(await page.locator("#comm-answer-count").innerText(), /2,400-byte limit/);
      assert.equal(await byButton("Evaluate spoken answer").count(), 0);
      await input.fill("Original private answer with <markup>");
      assert.equal(calls, 0);
      await evaluation().click();
      await page.getByRole("heading", { name: "Mock score 3.0 out of 5" }).waitFor();
      assert.ok(await page.getByRole("heading", { name: "Improve next" }).isVisible());
      assert.ok([7, 8].includes(await coachPanel.locator(".comm-coach-skill").count()));
      await page.getByText("Improved example answer", { exact: true }).click();
      assert.ok(await page.getByText("Start with a direct definition.", { exact: false }).isVisible());
      await assertNoOperationalDetails();
      await page.getByText("Evaluation complete. Scores saved.", { exact: true }).waitFor();
      assert.equal(await page.locator("#comm-self").isVisible(), false);
      await byButton("Try again").click();
      await input.fill("Revised private answer with one concrete example");
      await evaluation().click();
      await byButton("Compare attempts").click();
      assert.ok(await page.getByText("Overall 3.0 → 3.0", { exact: true }).isVisible());
      assert.ok(await page.getByText("Original private answer with <markup>", { exact: true }).isVisible());
      assert.ok(await page.getByText("Revised private answer with one concrete example", { exact: true }).isVisible());
      await byButton("Review again tomorrow").click();
      await page.getByText("Marked for review tomorrow.", { exact: true }).waitFor();
      const snapshot = await page.evaluate(() => JSON.stringify(localStorage));
      assert.ok(snapshot.includes("drill-ai-coach-v1"));
      assert.ok(!snapshot.includes("private answer") && !snapshot.includes("Start with a direct definition"));
      await byButton("Answer the follow-up in writing").click();
      assert.equal(calls, 2);
      const followUp = page.getByLabel("How would you test whether that approach works?");
      assert.ok(await followUp.isVisible());
      outage = true;
      await followUp.fill("My answer despite the outage");
      await evaluation().click();
      await page.getByText("The coach is unreachable.", { exact: false }).waitFor();
      assert.equal(await followUp.inputValue(), "My answer despite the outage");
      outage = false;
      await byButton("Sign out").click();
      assert.equal(await followUp.count(), 0);
      await byButton("Daily practice").click();
      await byButton("Start 5-minute quick practice").click();
      assert.ok(await coach().isVisible());
      assert.equal(calls, 3);

      // Daily (quick) session: evaluate each answer step, then compare on the review step.
      await coach().click();
      await signIn();
      for (const text of ["First session answer", "Second session answer"]) {
        await evaluation().waitFor();
        await input.fill(text);
        await evaluation().click();
        await page.getByRole("heading", { name: "Mock score 3.0 out of 5" }).waitFor();
        await byButton("Save and next question").click();
      }
      await page.getByText("Earlier score in this session: 3.0 / 5.", { exact: false }).waitFor();
      await evaluation().waitFor();
      await input.fill("Revised session answer with a measurable result");
      await evaluation().click();
      await byButton("Compare attempts").click();
      assert.ok(await page.getByText("First session answer", { exact: true }).last().isVisible());
      assert.ok(await page.getByText("Revised session answer with a measurable result", { exact: true }).last().isVisible());
      assert.equal(calls, 6);
      await assertNoOperationalDetails();
      await byButton("Save and finish session").click();
      await page.getByText("Session complete.", { exact: false }).waitFor();
      const sessionStorage = await page.evaluate(() => JSON.stringify(localStorage));
      assert.ok(!sessionStorage.includes("session answer"));
      const practice = await page.evaluate(() => JSON.parse(localStorage.getItem("drill-communication-v1")));
      assert.equal(practice.attempts.length, 3);
      assert.ok(practice.attempts.every(row => row.assessment === "ai" && row.ai.overall === 3));

      // Usage lives in a collapsed, owner-only settings section in Progress (signed in only).
      await byButton("Progress").click();
      await page.getByText("AI Coach settings", { exact: true }).click();
      await page.getByText("5 of 10", { exact: true }).waitFor();
      assert.ok(await page.getByText("Estimated spend this month", { exact: true }).isVisible());

      // A live (non-mock) saved score appears in the question-level summary; reload signs out.
      await page.evaluate(() => window.DrillCoachProgress.save(localStorage, {
        id: "live-row", questionId: "iou", topic: "cv", category: "concept", at: new Date().toISOString(),
        model: "gpt-5.4-mini-2026-03-17", rubric: 1, overall: 2.5,
        scores: { accuracy: 2, depth: 3, structure: 2, clarity: 3, concise: 3, english: 2, reasoning: null, practical: 3 }
      }));
      await page.reload();
      await byButton("Progress").click();
      assert.equal(await page.getByText("AI Coach settings", { exact: true }).count(), 0);
      await page.getByText("AI assessment history", { exact: true }).click();
      await page.getByText("AI scores by question", { exact: true }).click();
      assert.ok(await page.getByText("What is IoU? · latest 2.5 · best 2.5 · 1 attempt", { exact: true }).isVisible());
      assert.equal(await byButton("Delete saved AI score").count(), 6);
      await byButton("Delete saved AI score").first().click();
      assert.equal(await byButton("Delete saved AI score").count(), 5);

      // Live mode shows the external-service privacy notice; a paused coach shows one simple message.
      env.COACH_MODE = "live";
      env.OPENAI_API_KEY = "mock-only-never-called";
      await byButton("Practice").click();
      await coach().click();
      await page.getByText("Evaluating sends your written answer to an external AI service (OpenAI).", { exact: false }).waitFor();
      env.COACH_MODE = "off";
      await page.reload();
      await coach().click();
      await page.getByText("AI evaluation is temporarily unavailable. Free Practice remains available.", { exact: true }).waitFor();
      assert.equal(await byButton("Sign in to use AI feedback").count(), 0);
      assert.equal(calls, 6);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(pageErrors, []);
    } finally {
      await browser.close();
      db.close();
    }
  });
}
