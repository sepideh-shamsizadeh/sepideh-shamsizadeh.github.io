import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger, MAX_CHALLENGES, MONTHLY_CAP } from "../backend/drill-coach/ledger.mjs";
import { handle } from "../backend/drill-coach/service.mjs";
import { DEFAULT_MODEL, buildEvaluation, feedbackFor, mockOpenAI } from "../backend/drill-coach/evaluation.mjs";
import { verifyGoogle } from "../backend/drill-coach/identity.mjs";
import progress from "../drill/communication/coach-progress.js";
import catalog from "../backend/drill-coach/catalog.json" with { type: "json" };

const origin = "https://sepideh.io";
const time = Date.parse("2026-11-27T11:00:00Z");
const base = { ALLOWED_ORIGIN: origin, COACH_MODE: "mock", GOOGLE_CLIENT_ID: "mock-client",
  OWNER_GOOGLE_SUB: "123456", DEDUPE_SECRET: "test-dedupe-secret-placeholder-long-enough", OPENAI_MODEL: DEFAULT_MODEL };
function setup() {
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
  let now = time;
  function send(path, method, { body, session, env = base, options = {}, site = origin } = {}) {
    return handle(new Request("https://coach.example" + path, {
      method, headers: { Origin: site, ...(body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: "Bearer " + session } : {}) }, body: body ? JSON.stringify(body) : undefined
    }), env, ledger, { now: () => now, ...options });
  }
  async function login(env = base) {
    const challenge = await send("/v1/auth/challenge", "POST", { env });
    const { nonce } = await challenge.json();
    const options = { verify: async () => ({ sub: env.OWNER_GOOGLE_SUB, nonce }) };
    const response = await send("/v1/auth/session", "POST", { env, body: { credential: "mock" }, options });
    assert.equal(response.status, 200);
    return { ...(await response.json()), options };
  }
  return { db, ledger, send, login, advance: ms => { now += ms; } };
}
const answer = (text = "I explain the idea with an example.") => ({
  questionId: "iou", answer: text, requestId: crypto.randomUUID()
});

test("owner-only authorization, nonce replay, logout, expiry and emergency mode", async () => {
  const { send, login, advance } = setup();
  const code = async response => [response.status, (await response.json()).error];
  assert.deepEqual(await code(await send("/v1/evaluations", "POST", { body: answer() })), [401, "session"]);
  assert.equal((await send("/v1/config", "GET", { site: "https://other.example" })).status, 403);
  assert.equal((await send("/v1/evaluations", "POST", { env: { ...base, COACH_MODE: "off" } })).status, 503);
  const { session, options } = await login();
  const other = { verify: async () => ({ sub: "000", nonce: "irrelevant" }) };
  assert.deepEqual(await code(await send("/v1/auth/session", "POST", { body: { credential: "fake" }, options: other })), [403, "owner"]);
  // Replaying a consumed nonce is reported as a nonce failure, not as an expired session.
  assert.deepEqual(await code(await send("/v1/auth/session", "POST", { body: { credential: "fake" }, options })), [401, "nonce"]);
  const badToken = { verify: async () => ({ error: "audience" }) };
  const rejected = await send("/v1/auth/session", "POST", { body: { credential: "fake" }, options: badToken });
  assert.equal(rejected.status, 401);
  assert.deepEqual(await rejected.json(), { error: "google_token", reason: "audience" });
  const noKeys = { verify: async () => ({ error: "keys_unavailable" }) };
  assert.deepEqual(await code(await send("/v1/auth/session", "POST", { body: { credential: "fake" }, options: noKeys })), [503, "verifier"]);
  assert.equal((await send("/v1/usage", "GET", { session })).status, 200);
  assert.equal((await send("/v1/auth/session", "DELETE", { session })).status, 204);
  assert.deepEqual(await code(await send("/v1/usage", "GET", { session })), [401, "session"]);
  const fresh = await login();
  advance(30 * 60_000);
  assert.deepEqual(await code(await send("/v1/usage", "GET", { session: fresh.session })), [401, "session"]);
});

test("Google token validation verifies RS256, issuer, audience, expiry and signature", async () => {
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) };
  const { publicKey, privateKey } = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "unit-test", alg: "RS256" };
  // Behaves like Cloudflare Workers fetch, which throws on redirect "error".
  let fetches = 0;
  const fetcher = async (url, init) => {
    assert.ok(["follow", "manual"].includes(init.redirect), "Workers only support follow or manual redirects");
    fetches++;
    return Response.json({ keys: [jwk] });
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url");
  const seconds = time / 1000;
  const nonce = "A".repeat(43);
  async function token(changes = {}) {
    const claims = { iss: "https://accounts.google.com", aud: base.GOOGLE_CLIENT_ID,
      iat: seconds - 1, exp: seconds + 100, sub: base.OWNER_GOOGLE_SUB, nonce, ...changes };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const payload = header + "." + body;
    return payload + "." + Buffer.from(await crypto.subtle.sign(algorithm, privateKey, Buffer.from(payload))).toString("base64url");
  }
  const options = { client: base.GOOGLE_CLIENT_ID, now: time, fetcher };
  assert.deepEqual(await verifyGoogle(await token(), options), { sub: base.OWNER_GOOGLE_SUB, nonce });
  for (const [claims, reason] of [[{ aud: "other" }, "audience"], [{ azp: "other" }, "audience"], [{ exp: seconds }, "expired"],
    [{ iat: seconds + 3600 }, "not_yet_valid"], [{ iss: "https://example.org" }, "issuer"], [{ nonce: "bad" }, "nonce_format"],
    [{ sub: "not-digits" }, "subject"]]) {
    assert.deepEqual(await verifyGoogle(await token(claims), options), { error: reason });
  }
  assert.deepEqual(await verifyGoogle("not.a.jwt", options), { error: "format" });
  const valid = await token();
  const parts = valid.split(".");
  parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
  assert.deepEqual(await verifyGoogle(parts.join("."), options), { error: "signature" });
  // Unreachable keys are distinguished from invalid tokens.
  const down = { ...options, now: time + 7_200_000, fetcher: async () => new Response("", { status: 503 }) };
  assert.deepEqual(await verifyGoogle(await token({ exp: seconds + 9000 }), down), { error: "keys_unavailable" });
  // A key missing from the cache triggers exactly one refresh (Google key rotation).
  let rotated = false;
  const rotating = async (url, init) => {
    assert.equal(init.redirect, "manual");
    const keys = rotated ? [jwk] : [{ ...jwk, kid: "old-key" }];
    rotated = true;
    return Response.json({ keys }, { headers: { "Cache-Control": "max-age=3600" } });
  };
  const later = { client: base.GOOGLE_CLIENT_ID, now: time + 10_000_000, fetcher: rotating };
  const fresh = await token({ iat: (time + 10_000_000) / 1000 - 1, exp: (time + 10_000_000) / 1000 + 100 });
  // First call caches the pre-rotation key set; the token names a key it lacks, so it is rejected.
  assert.deepEqual(await verifyGoogle(fresh, later), { error: "unknown_key" });
  // Within the cache TTL, a token naming an uncached key forces one refresh, which finds the new key.
  assert.deepEqual(await verifyGoogle(fresh, later), { sub: base.OWNER_GOOGLE_SUB, nonce });
  assert.ok(fetches >= 1);
});

test("input limits, structured output, signed follow-up and no answer persistence", async () => {
  const { db, send, login, advance } = setup();
  const { session } = await login();
  for (const body of [answer(""), answer("😀".repeat(601)), { ...answer(), questionId: "__proto__" }, { ...answer(), prompt: "forged" }]) {
    assert.equal((await send("/v1/evaluations", "POST", { session, body })).status, 400);
  }
  const raw = "Unique personal answer";
  const result = await send("/v1/evaluations", "POST", { session, body: answer(raw) });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  const payload = await result.json();
  assert.equal(payload.feedback.overall, 3);
  assert.equal(payload.feedback.skills.reasoning.score, null);
  assert.equal(payload.usage.evaluationsToday, 1);
  assert.equal(payload.usage.estimatedDailyMicros, 3600);
  assert.equal(db.prepare("SELECT cost FROM evaluations").get().cost, 3600);
  const stored = JSON.stringify(db.prepare("SELECT * FROM evaluations").all());
  assert.ok(!stored.includes(raw) && !stored.includes(payload.feedback.followUp) && !stored.includes(session));
  advance(3000);
  assert.equal((await send("/v1/evaluations", "POST", { session,
    body: { ...answer(), followUp: payload.followUp + "x" } })).status, 400);
  assert.equal((await send("/v1/evaluations", "POST", { session,
    body: { ...answer(), followUp: payload.followUp } })).status, 200);
});

test("concurrent distinct requests serialize, duplicate requests never make a second evaluation", async () => {
  const { send, login, advance } = setup();
  const { session } = await login();
  let sent = 0;
  const options = { mock: evaluation => { sent++; return mockOpenAI(evaluation); } };
  const first = answer("Candidate text");
  const result = await Promise.all([first, first, answer("Different answer")].map(body =>
    send("/v1/evaluations", "POST", { session, body, options })));
  assert.equal(result.filter(response => response.status === 200).length, 1);
  assert.equal(sent, 1);
  advance(3000);
  const recent = await send("/v1/evaluations", "POST", { session, body: first, options });
  assert.equal(recent.status, 409);
  assert.equal(sent, 1);
});

test("atomic monthly reservations, daily limits, Zurich dates and held-usage reconciliation", () => {
  const { ledger } = setup();
  const oneBeforeMidnight = Date.parse("2026-11-27T22:59:50Z");
  assert.equal(ledger.reserve("max", "max", oneBeforeMidnight, MONTHLY_CAP), "accepted");
  ledger.settle("max", null);
  assert.equal(ledger.totals(oneBeforeMidnight).reservedMonthlyMicros, MONTHLY_CAP);
  assert.equal(ledger.reserve("later", "later", oneBeforeMidnight + 3000, 1), "budget");
  ledger.settle("max", { cost: 100, input: 5, output: 4 });
  assert.equal(ledger.totals(oneBeforeMidnight).remainingMonthlyMicros, MONTHLY_CAP - 100);
  for (let i = 1; i < 10; i++) {
    const id = String(i);
    assert.equal(ledger.reserve(id, id, oneBeforeMidnight + 2000 + i * 700, 1), i === 1 ? "accepted" : "rate");
    if (i === 1) ledger.settle(id, { cost: 1, input: 0, output: 0 });
    if (i === 1) break;
  }
  const nextDay = Date.parse("2026-11-27T23:00:00Z");
  assert.equal(ledger.totals(nextDay).remainingToday, 10);
  for (let i = 0; i < 10; i++) {
    const id = "day-" + i;
    assert.equal(ledger.reserve(id, id, nextDay + i * 3000, 3), "accepted");
    ledger.settle(id, { cost: 2, input: 0, output: 0 });
  }
  assert.equal(ledger.reserve("over", "over", nextDay + 30_000, 1), "daily");
  assert.equal(ledger.totals(nextDay).estimatedMonthlyMicros, 121);
});

test("provider failure holds budget, malformed output settles usage and unexpected usage disables later requests", async () => {
  const { send, login, advance, ledger } = setup();
  const env = { ...base, COACH_MODE: "live", OPENAI_API_KEY: "mock-only" };
  const { session } = await login(env);
  const timeout = await send("/v1/evaluations", "POST", { env, session, body: answer("timeout"),
    options: { fetcher: async () => { throw new Error("test timeout"); } } });
  assert.equal(timeout.status, 504);
  assert.ok(ledger.totals(time).reservedMonthlyMicros > 0);
  advance(3000);
  const malformed = await send("/v1/evaluations", "POST", { env, session, body: answer("malformed"),
    options: { fetcher: async (url, request) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(request.redirect, "manual", "Workers reject redirect \"error\"");
      const payload = JSON.parse(request.body);
      assert.equal(payload.store, false);
      assert.equal(payload.tools, undefined);
      assert.equal(payload.max_output_tokens, 1500);
      return Response.json({ model: DEFAULT_MODEL, status: "incomplete", usage: { input_tokens: 32, output_tokens: 40 } });
    } } });
  assert.equal(malformed.status, 502);
  assert.equal(ledger.totals(time).inputTokensToday, 32);
  advance(3000);
  const over = await send("/v1/evaluations", "POST", { env, session, body: answer("over"),
    options: { fetcher: async () => Response.json({ usage: { input_tokens: 10, output_tokens: 1600 } }) } });
  assert.equal(over.status, 503);
  advance(3000);
  let called = false;
  const disabled = await send("/v1/evaluations", "POST", { env, session, body: answer("stays disabled"),
    options: { fetcher: async () => { called = true; } } });
  assert.equal(disabled.status, 503);
  assert.equal(called, false);
});

test("schema rejects unknown or invalid scoring data and the model is allowlisted", () => {
  const exercise = catalog.iou;
  const input = { exercise, prompt: exercise.prompt, answer: "test" };
  assert.equal(buildEvaluation({ ...input, model: "unpriced" }), null);
  const evaluation = buildEvaluation({ ...input, model: DEFAULT_MODEL });
  const { envelope } = mockOpenAI(evaluation);
  const feedback = feedbackFor(envelope, evaluation);
  assert.equal(feedback.overall, 3);
  const data = JSON.parse(envelope.output[0].content[0].text);
  data.skills.accuracy.score = 6;
  envelope.output[0].content[0].text = JSON.stringify(data);
  assert.equal(feedbackFor(envelope, evaluation), null);
});

test("the coach history stores and removes only score metadata in a separate versioned key", () => {
  const values = new Map([["drill-communication-v1", "existing data"]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const row = { id: "test", questionId: "iou", category: "concept", topic: "cv",
    at: new Date(time).toISOString(), model: DEFAULT_MODEL, rubric: 1, overall: 3,
    scores: Object.fromEntries(Object.keys(progress.skills).map(skill => [skill, 3])),
    answer: "private answer", feedback: "private feedback" };
  progress.save(storage, row);
  progress.save(storage, row);
  assert.equal(progress.load(storage).length, 1);
  assert.ok(!values.get(progress.key).includes("private"));
  assert.equal(values.get("drill-communication-v1"), "existing data");
  progress.remove(storage, row.id);
  assert.deepEqual(progress.load(storage), []);
});

test("question-level AI scores summarize latest, best, attempts and review dates without mock rows", () => {
  const row = (id, questionId, overall, at, extra = {}) => ({ id, questionId, overall, at, reviewAt: null, mock: false, ...extra });
  const summary = progress.byQuestion([
    row("a", "iou", 2, "2026-11-20T10:00:00.000Z"),
    row("b", "iou", 4, "2026-11-21T10:00:00.000Z", { reviewAt: "2026-11-22T10:00:00.000Z" }),
    row("c", "iou", 3, "2026-11-23T10:00:00.000Z"),
    row("d", "iou-plain", 1.5, "2026-11-23T10:00:00.000Z"),
    row("e", "iou-plain", 5, "2026-11-24T10:00:00.000Z", { mock: true })
  ]);
  assert.deepEqual(summary, [
    { questionId: "iou-plain", attempts: 1, best: 1.5, reviewAt: null, latest: 1.5, latestAt: "2026-11-23T10:00:00.000Z" },
    { questionId: "iou", attempts: 3, best: 4, reviewAt: "2026-11-22T10:00:00.000Z", latest: 3, latestAt: "2026-11-23T10:00:00.000Z" }
  ]);
  assert.deepEqual(progress.byQuestion([]), []);
});

test("administrative recovery requires maintenance mode, the admin secret, rate limits and reconciliation", async () => {
  const { send, login, advance, ledger } = setup();
  const live = { ...base, COACH_MODE: "live", OPENAI_API_KEY: "mock-only" };
  const adminSecret = "admin-recovery-placeholder-secret-0123456789";
  const maintenance = { ...base, COACH_MODE: "maintenance", ADMIN_RECOVERY_SECRET: adminSecret };
  const { session } = await login(live);

  // Trip the latch: reported output exceeds the reserved bound.
  const over = await send("/v1/evaluations", "POST", { env: live, session, body: answer("trip"),
    options: { fetcher: async () => Response.json({ usage: { input_tokens: 10, output_tokens: 1600 } }) } });
  assert.equal(over.status, 503);
  assert.ok(ledger.latched());

  // Admin routes do not exist outside maintenance mode or without a configured secret.
  assert.equal((await send("/v1/admin/status", "GET", { env: { ...live, ADMIN_RECOVERY_SECRET: adminSecret }, session: adminSecret })).status, 404);
  assert.equal((await send("/v1/admin/status", "GET", { env: { ...maintenance, ADMIN_RECOVERY_SECRET: "short" }, session: adminSecret })).status, 404);

  // Maintenance mode disables the public coach entirely.
  const config = await (await send("/v1/config", "GET", { env: maintenance })).json();
  assert.equal(config.enabled, false);
  assert.equal((await send("/v1/evaluations", "POST", { env: maintenance, session, body: answer("blocked") })).status, 503);

  assert.equal((await send("/v1/admin/status", "GET", { env: maintenance })).status, 401);
  assert.equal((await send("/v1/admin/status", "GET", { env: maintenance, session: "x".repeat(40) })).status, 401);
  const status = await send("/v1/admin/status", "GET", { env: maintenance, session: adminSecret });
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("Access-Control-Allow-Origin"), null);
  const before = await status.json();
  assert.equal(before.latched, true);
  const ledgerMicros = before.totals.estimatedMonthlyMicros;

  const recover = body => send("/v1/admin/recover", "POST", { env: maintenance, session: adminSecret, body });
  const valid = { requestId: crypto.randomUUID(), month: "2026-11", reportedSpendMicros: ledgerMicros + 50_000,
    confirm: "RECONCILED-WITH-OPENAI-USAGE" };
  // Five admin requests per minute, counting failed attempts. Start a fresh window.
  advance(60_000);
  assert.equal((await recover({ ...valid, confirm: "yes" })).status, 400);
  assert.equal((await recover({ ...valid, extra: 1 })).status, 400);
  assert.equal((await recover({ ...valid, reportedSpendMicros: -1 })).status, 400);
  assert.equal((await recover({ ...valid, month: "2026-10" })).status, 409);
  const recovered = await recover(valid);
  assert.equal(recovered.status, 200);
  const result = await recovered.json();
  assert.equal(result.wasLatched, true);
  assert.equal(result.adjustmentMicros, 50_000);
  assert.equal(result.totals.estimatedMonthlyMicros, ledgerMicros + 50_000);
  assert.equal(ledger.latched(), null);
  assert.equal((await recover(valid)).status, 429);
  advance(60_000);
  assert.equal((await recover(valid)).status, 409);
  const after = await (await send("/v1/admin/status", "GET", { env: maintenance, session: adminSecret })).json();
  assert.equal(after.recoveries.length, 1);
  assert.equal(after.recoveries[0].reported, ledgerMicros + 50_000);

  // Back in live mode, evaluations resume and the reconciled spend counts against the budget.
  advance(3000);
  let called = false;
  const resumed = await send("/v1/evaluations", "POST", { env: live, session: (await login(live)).session, body: answer("resumed"),
    options: { fetcher: async (url, request) => {
      called = true;
      assert.equal(JSON.parse(request.body).service_tier, "default");
      return Response.json({ model: DEFAULT_MODEL, status: "incomplete", usage: { input_tokens: 5, output_tokens: 5 } });
    } } });
  assert.equal(called, true);
  assert.equal(resumed.status, 502);
});

test("recovery never lowers the ledger, refuses in-flight evaluations, and challenges are bounded", () => {
  const { ledger } = setup();
  assert.equal(ledger.reserve("a", "a", time, 5000), "accepted");
  assert.equal(ledger.recover("r1", time + 1000, "2026-11", 0).error, "busy");
  ledger.settle("a", { cost: 4000, input: 1, output: 1 }, time);
  const result = ledger.recover("r1", time + 1000, "2026-11", 1000);
  assert.equal(result.adjustmentMicros, 0);
  assert.equal(result.totals.estimatedMonthlyMicros, 4000);
  for (let i = 0; i < MAX_CHALLENGES; i++) assert.equal(ledger.challenge("n" + i, time, time + 300_000), true);
  assert.equal(ledger.challenge("overflow", time, time + 300_000), false);
  assert.equal(ledger.challenge("after-expiry", time + 300_000, time + 600_000), true);
});
