const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

// Spoken practice in Chrome with a fake microphone. Recording is public; transcription and spoken
// evaluation run against the in-process Worker logic in mock mode, so nothing reaches a real service.
const build = process.env.DRILL_BUILD_DIR;
const site = "https://sepideh.io";
const backend = "https://coach.example";
const pagePath = "/drill/communication/";
const shots = process.env.DRILL_SCREENSHOT_DIR;
const shoot = (page, name) => shots ? page.screenshot({ path: join(shots, name + ".png"), fullPage: true }) : null;
const fakeMedia = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];

// Counts microphone tracks that are still live, so the test can prove they are released.
const trackMicrophones = () => {
  window.__liveTracks = () => (window.__streams ?? []).flatMap(stream => stream.getTracks())
    .filter(track => track.readyState === "live").length;
  const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (original) navigator.mediaDevices.getUserMedia = async constraints => {
    const stream = await original(constraints);
    (window.__streams ??= []).push(stream);
    return stream;
  };
};

async function harness(t, { theme = "light", viewport = { width: 1280, height: 900 }, init = [], env: extra = {}, mock } = {}) {
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
  const env = { ALLOWED_ORIGIN: site, COACH_MODE: "mock", TRANSCRIPTION: "on", GOOGLE_CLIENT_ID: "mock-client",
    OWNER_GOOGLE_SUB: "123", DEDUPE_SECRET: "mock-test-secret-with-sufficient-length",
    OPENAI_MODEL: "gpt-5.4-mini-2026-03-17", ...extra };
  const uploads = [];
  let now = Date.now();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: fakeMedia });
  t.after(async () => {
    await browser.close();
    db.close();
  });
  const context = await browser.newContext({ viewport, permissions: ["microphone"] });
  await context.addInitScript(value => localStorage.setItem("theme", value), theme);
  await context.addInitScript(trackMicrophones);
  for (const script of init) await context.addInitScript(script);
  await context.route("**/*", async route => {
    const original = route.request();
    const url = new URL(original.url());
    if (url.origin === backend) {
      const headers = Object.fromEntries(Object.entries(await original.allHeaders())
        .filter(([name]) => name.toLowerCase() !== "origin"));
      const body = original.postDataBuffer() ?? undefined;
      if (url.pathname === "/v1/transcriptions" && original.method() === "POST") {
        uploads.push({ type: headers["content-type"], bytes: body?.length ?? 0, head: body?.subarray(0, 4).toString("hex") });
      }
      const request = new Request(url, { method: original.method(), headers: { ...headers, Origin: site }, body });
      const response = await handle(request, env, ledger, {
        now: () => (now += 2500), ...(mock ? { mock } : {}), verify: async credential => ({ sub: "123", nonce: credential })
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
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(site + pagePath);
  const byButton = name => page.getByRole("button", { name, exact: true });
  return { page, byButton, errors, uploads, db, env };
}

const selectMode = (page, label) => page.getByRole("radio", { name: label, exact: true }).check();

async function record(page, byButton, milliseconds = 1600, label = "Start recording") {
  await selectMode(page, "Spoken Answer");
  await byButton(label).click();
  await byButton("Stop recording").waitFor();
  await page.waitForTimeout(milliseconds);
  await byButton("Stop recording").click();
  await page.locator(".comm-recorder audio").waitFor();
}

for (const [theme, viewport] of [["light", { width: 1280, height: 900 }], ["dark", { width: 390, height: 844 }]]) {
  test(`public recording works without sign-in and stays in memory (${theme})`, async t => {
    const { page, byButton, errors, uploads } = await harness(t, { theme, viewport });
    const written = page.getByRole("textbox", { name: "Written answer", exact: true });
    await written.fill("Public written draft");
    await selectMode(page, "Spoken Answer");
    assert.equal(await written.isVisible(), false);
    const recorder = page.locator(".comm-recorder");
    await recorder.getByText("Up to 5 minutes.", { exact: false }).waitFor();
    await byButton("Start recording").click();
    await byButton("Pause").waitFor();
    assert.match(await page.locator(".comm-recorder-time").innerText(), /^0:0\d \/ 5:00$/);
    await page.waitForTimeout(1200);
    await byButton("Pause").click();
    await byButton("Resume").waitFor();
    const paused = await page.locator(".comm-recorder-time").innerText();
    await page.waitForTimeout(1300);
    assert.equal(await page.locator(".comm-recorder-time").innerText(), paused, "the timer stops while paused");
    await byButton("Resume").click();
    await page.waitForTimeout(1200);
    await byButton("Stop recording").click();
    await page.locator(".comm-recorder audio").waitFor();
    // About 2.4 s recorded; the 1.3 s pause is excluded.
    assert.match(await page.locator(".comm-recorder-length").innerText(), /^Recorded 0:0[2-3]$/);
    assert.equal(await page.evaluate(() => window.__liveTracks()), 0, "microphone tracks are released");
    const playable = await page.locator(".comm-recorder audio").evaluate(audio =>
      new Promise(resolve => {
        if (audio.readyState >= 1) resolve(true);
        audio.onloadedmetadata = () => resolve(true);
        audio.onerror = () => resolve(false);
      }));
    assert.equal(playable, true);
    assert.ok(await byButton("Record again").isVisible());
    await shoot(page, `voice-recorder-${theme}`);
    await selectMode(page, "Written Answer");
    assert.equal(await written.inputValue(), "Public written draft");
    assert.equal(await recorder.isVisible(), false);
    await selectMode(page, "Spoken Answer");
    assert.ok(await recorder.locator("audio").isVisible());

    // Recording survives switching views and saves as unassessed spoken practice.
    await byButton("Lessons").click();
    await byButton("Practice").click();
    await page.locator(".comm-recorder audio").waitFor();
    assert.equal(await page.locator("#comm-self").evaluate(node => node.open), false);
    await byButton("Save and next question").click();
    await page.getByText("Practice saved.", { exact: true }).waitFor();
    assert.equal(await page.locator(".comm-recorder audio").count(), 0, "the next question starts without a recording");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("drill-communication-v1")));
    assert.equal(stored.attempts.at(-1).mode, "spoken");
    assert.equal(stored.attempts.at(-1).assessment, "unassessed");
    assert.deepEqual(stored.attempts.at(-1).ratings, {});
    assert.doesNotMatch(JSON.stringify(await page.evaluate(() => ({ ...localStorage }))), /blob:|audio\/|data:/);
    await byButton("Progress").click();
    await page.getByText("Spoken attempts", { exact: true }).waitFor();
    assert.ok(await page.getByText("Average self-assessment · spoken", { exact: true }).isVisible());

    // Delete works, and nothing was uploaded without the owner's explicit action.
    await byButton("Practice").click();
    await record(page, byButton);
    await byButton("Delete recording").click();
    await byButton("Start recording").waitFor();
    assert.equal(uploads.length, 0);
    assert.equal(await page.getByRole("button", { name: "Transcribe recording" }).count(), 0);
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
  });
}

test("recording stops automatically at the five-minute limit", async t => {
  // Run the page clock 100× faster so five minutes pass in about three seconds.
  const fast = () => {
    const real = performance.now.bind(performance);
    const start = real();
    performance.now = () => start + (real() - start) * 100;
  };
  const { page, byButton, errors } = await harness(t, { init: [fast] });
  await selectMode(page, "Spoken Answer");
  await byButton("Start recording").click();
  await page.getByText("Recording stopped at the 5-minute limit.", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(await page.locator(".comm-recorder-length").innerText(), "Recorded 5:00");
  assert.equal(await page.evaluate(() => window.__liveTracks()), 0);
  assert.deepEqual(errors, []);
});

test("unsupported browsers and blocked microphones keep written practice available", async t => {
  const { page, errors } = await harness(t, { init: [() => { delete window.MediaRecorder; }] });
  await selectMode(page, "Spoken Answer");
  await page.getByText("Recording is not available in this browser.", { exact: false }).waitFor();
  await selectMode(page, "Written Answer");
  assert.ok(await page.getByRole("textbox", { name: "Written answer", exact: true }).isVisible());
  const blocked = await harness(t, { init: [() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  }] });
  await selectMode(blocked.page, "Spoken Answer");
  await blocked.byButton("Start recording").click();
  await blocked.page.getByText("Microphone access was blocked.", { exact: false }).waitFor();
  assert.ok(await blocked.byButton("Start recording").isVisible());
  assert.deepEqual([...errors, ...blocked.errors], []);
});

test("owner transcribes, edits and evaluates a spoken answer without saving audio or text", async t => {
  const { mockOpenAI } = await import("../backend/drill-coach/evaluation.mjs");
  let calls = 0;
  let fail;
  const { page, byButton, errors, uploads, db } = await harness(t, { mock: evaluation => {
    if (++calls !== 1) return mockOpenAI(evaluation);
    return new Promise(resolve => {
      fail = () => resolve({ status: 200, envelope: {
        status: "incomplete", usage: { input_tokens: 100, output_tokens: 150 }
      } });
    });
  } });
  await record(page, byButton);
  await page.getByText("AI Communication Coach", { exact: true }).click();
  await page.getByText("No answer or recording leaves this site.", { exact: false }).waitFor();
  await byButton("Sign in to use AI feedback").click();
  await byButton("Mock Google Sign-In").click();
  assert.equal(await byButton("Evaluate written answer").count(), 0);
  await byButton("Evaluate spoken answer").click();
  const transcript = page.getByLabel("Transcript of your spoken answer");
  await transcript.waitFor();
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].type, /^audio\/webm/);
  assert.equal(uploads[0].head, "1a45dfa3", "the upload is the WebM recording itself");
  assert.match(await transcript.inputValue(), /mock transcript/);
  const metrics = await page.locator(".comm-coach-metrics").innerText();
  for (const label of ["Duration", "Speaking pace", "Pauses longer than 1 second", "Filler words (approximate)"]) {
    assert.ok(metrics.includes(label), label);
  }
  assert.ok(await page.getByText("Pronunciation, accent, confidence and intonation are not assessed.", { exact: false }).isVisible());
  // The transcript is already shown, so the same take cannot be sent again.
  assert.equal(await byButton("Transcribe recording").count(), 0);
  assert.ok(await byButton("Evaluate spoken answer").isDisabled());
  assert.ok(await byButton("Save and next question").isDisabled());
  while (!fail) await new Promise(resolve => setTimeout(resolve, 10));
  fail();
  await page.getByText("Evaluation failed. The feedback was incomplete.", { exact: false }).waitFor();
  assert.match(await page.locator(".comm-coach-status").innerText(), /Reference:/);
  const before = await page.locator(".comm-coach-metrics").innerText();
  await transcript.fill("");
  assert.ok(await byButton("Evaluate spoken answer").isDisabled());
  await transcript.fill("Private edited transcript about the IMU and the Kalman filter.");
  assert.equal(await page.locator(".comm-coach-metrics").innerText(), before);
  await selectMode(page, "Written Answer");
  assert.equal(await transcript.isVisible(), false);
  assert.equal(await byButton("Evaluate spoken answer").count(), 0);
  await selectMode(page, "Spoken Answer");
  await byButton("Lessons").click();
  await byButton("Practice").click();
  await transcript.waitFor();
  assert.equal(await transcript.inputValue(), "Private edited transcript about the IMU and the Kalman filter.");
  assert.ok(await page.locator(".comm-recorder audio").isVisible());
  assert.equal(uploads.length, 1);
  await byButton("Evaluate spoken answer").click();
  await page.getByRole("heading", { name: "Mock score 3.0 out of 5" }).waitFor();
  await shoot(page, "voice-owner-spoken");
  assert.ok(await page.locator(".comm-coach-head").getByText("Spoken answer", { exact: true }).isVisible());
  await page.getByText("Evaluation complete. Scores saved.", { exact: true }).waitFor();

  // A written evaluation of the same question compares against the spoken one.
  await selectMode(page, "Written Answer");
  assert.ok(await byButton("Evaluate written answer").isDisabled());
  await page.getByRole("textbox", { name: "Written answer", exact: true }).fill("Private written answer");
  assert.match(await page.locator("#comm-answer-count").innerText(), /^22 /);
  await byButton("Evaluate written answer").click();
  await byButton("Compare attempts").click();
  assert.ok(await page.getByText("Earlier · spoken · 3.0", { exact: true }).isVisible());
  assert.ok(await page.getByText("Revised · written · 3.0", { exact: true }).isVisible());

  await page.getByText("Evaluation complete. Scores saved.", { exact: true }).waitFor();
  const storage = JSON.stringify(await page.evaluate(() => ({ ...localStorage })));
  assert.doesNotMatch(storage, /Private edited transcript|mock transcript|Private written answer|blob:/);
  const coach = await page.evaluate(() => JSON.parse(localStorage.getItem("drill-ai-coach-v1")).attempts);
  assert.deepEqual(coach.map(row => row.mode ?? "written"), ["spoken", "written"]);
  const ledger = JSON.stringify(db.prepare("SELECT * FROM transcriptions").all());
  assert.doesNotMatch(ledger, /transcript|IMU/i);

  assert.equal(uploads.length, 1);
  const costs = db.prepare("SELECT COUNT(*) AS calls, SUM(cost) AS micros FROM evaluations").get();
  assert.equal(costs.calls, 3);
  assert.equal(costs.micros, 7950);
  await selectMode(page, "Spoken Answer");
  assert.ok(await page.locator(".comm-coach-head").getByText("Spoken answer", { exact: true }).isVisible());
  assert.equal(await transcript.inputValue(), "Private edited transcript about the IMU and the Kalman filter.");

  // A new take discards the old transcript. Manual transcription leaves evaluation optional.
  await record(page, byButton, 1600, "Record again");
  assert.equal(await page.locator(".comm-coach-spoken").count(), 0);
  await byButton("Transcribe recording").click();
  await transcript.waitFor();
  assert.equal(uploads.length, 2);
  assert.equal(calls, 3);
  await byButton("Save and next question").click();
  assert.match(await page.locator("#communication-status").innerText(), /Practice saved/);

  await byButton("Progress").click();
  await page.getByText("AI assessment history", { exact: true }).click();
  assert.match(await page.locator(".comm-coach-history").innerText(), /Mock · Spoken · /);
  await page.getByText("AI Coach settings", { exact: true }).click();
  await page.getByText("Transcriptions today", { exact: true }).waitFor();
  assert.ok(await page.getByText("2 of 20", { exact: true }).isVisible());

  // Live scores (mock rows never count toward progress) are summarized separately by mode.
  await page.evaluate(() => {
    const scores = { accuracy: 2, depth: 3, structure: 2, clarity: 3, concise: 3, english: 2, reasoning: null, practical: 3 };
    const row = { questionId: "iou", topic: "cv", category: "concept", at: new Date().toISOString(),
      model: "gpt-5.4-mini-2026-03-17", rubric: 1, overall: 2.5, scores };
    window.DrillCoachProgress.save(localStorage, { ...row, id: "live-written" });
    window.DrillCoachProgress.save(localStorage, { ...row, id: "live-spoken", overall: 3.5, mode: "spoken",
      at: new Date(Date.now() - 60_000).toISOString() });
  });
  await byButton("Practice").click();
  await byButton("Progress").click();
  await page.getByText("AI assessment history", { exact: true }).click();
  assert.ok(await page.getByText("Written · 1 saved · average 2.5 / 5", { exact: true }).isVisible());
  assert.ok(await page.getByText("Spoken · 1 saved · average 3.5 / 5", { exact: true }).isVisible());
  await page.getByText("AI scores by question", { exact: true }).click();
  assert.ok(await page.getByText("What is IoU? · latest 2.5 · best 3.5 · 2 attempts (1 spoken)", { exact: true }).isVisible());
  assert.deepEqual(errors, []);
});

test("transcription can be switched off while recording and written evaluation stay available", async t => {
  const { page, byButton, errors, uploads } = await harness(t, { env: { TRANSCRIPTION: "off" } });
  await record(page, byButton);
  await page.getByText("AI Communication Coach", { exact: true }).click();
  await byButton("Sign in to use AI feedback").click();
  await byButton("Mock Google Sign-In").click();
  await byButton("Evaluate spoken answer").waitFor();
  assert.ok(await byButton("Evaluate spoken answer").isDisabled());
  assert.equal(await byButton("Transcribe recording").count(), 0);
  await selectMode(page, "Written Answer");
  await byButton("Evaluate written answer").waitFor();
  assert.equal(await page.locator(".comm-recorder audio").isVisible(), false);
  await selectMode(page, "Spoken Answer");
  assert.ok(await page.locator(".comm-recorder audio").isVisible());
  assert.equal(uploads.length, 0);
  assert.deepEqual(errors, []);
});
