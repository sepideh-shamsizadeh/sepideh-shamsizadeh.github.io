import catalog from "./catalog.json" with { type: "json" };
import { MAX_ANSWER_BYTES, MAX_TRANSCRIPT_BYTES, buildEvaluation, feedbackFor, mockOpenAI, requestOpenAI, usageFor } from "./evaluation.mjs";
import { digest, keyed, openFollowUp, randomToken, sealFollowUp, verifyGoogle } from "./identity.mjs";
import {
  MAX_AUDIO_SECONDS, RESERVE_NEURONS, audioType, mockTranscription, neuronsFor, readAudio, speechMetrics,
  transcribe, vocabulary
} from "./transcription.mjs";

const encoder = new TextEncoder();
const methods = "GET, POST, DELETE, OPTIONS";
const routes = {
  "GET /v1/config": true,
  "POST /v1/auth/challenge": true,
  "POST /v1/auth/session": true,
  "DELETE /v1/auth/session": true,
  "GET /v1/usage": true,
  "POST /v1/evaluations": true,
  "POST /v1/transcriptions": true
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sample = 64 * 1024;

export function reply(status, body, origin) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = methods;
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  if (status === 204) return new Response(null, { status, headers });
  return Response.json(body, { status, headers });
}

async function json(request, max = 8192) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get("Content-Type") ?? "") ||
    Number(request.headers.get("Content-Length")) > max || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "", bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > max) {
        reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    const value = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return origin && origin === env.ALLOWED_ORIGIN ? origin : null;
}

export function isAdmin(request) {
  return new URL(request.url).pathname.startsWith("/v1/admin/");
}

const adminRoutes = { "GET /v1/admin/status": true, "POST /v1/admin/recover": true };
export const RECOVERY_CONFIRMATION = "RECONCILED-WITH-OPENAI-USAGE";
const MAX_REPORTED_MICROS = 100_000_000;

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

// Administrative recovery runs only in COACH_MODE=maintenance, from the command line.
// No CORS headers are sent, so no web page can call these routes. Access requires all of:
// Cloudflare account access (to deploy maintenance mode and set the secret), the
// ADMIN_RECOVERY_SECRET bearer token, and an explicit reconciliation with OpenAI's reported spend.
async function admin(request, env, ledger, options) {
  const error = (status, code) => reply(status, { error: code });
  const route = request.method + " " + new URL(request.url).pathname;
  const expected = env.ADMIN_RECOVERY_SECRET;
  if (env.COACH_MODE !== "maintenance" || !Object.hasOwn(adminRoutes, route) ||
    typeof expected !== "string" || expected.length < 32 ||
    typeof env.DEDUPE_SECRET !== "string" || env.DEDUPE_SECRET.length < 32) return error(404, "not_found");
  const now = (options.now ?? Date.now)();
  if (!ledger.authenticateRate(await keyed("admin:" + Math.floor(now / 60_000), env.DEDUPE_SECRET), now, 5)) {
    return error(429, "rate");
  }
  const provided = request.headers.get("Authorization")?.match(/^Bearer (\S{32,512})$/)?.[1];
  if (!provided || !constantTimeEqual(await digest(provided), await digest(expected))) return error(401, "auth");
  if (route === "GET /v1/admin/status") return reply(200, ledger.status(now));

  const fields = await json(request);
  if (!fields || Object.keys(fields).sort().join() !== "confirm,month,reportedSpendMicros,requestId" ||
    fields.confirm !== RECOVERY_CONFIRMATION || typeof fields.month !== "string" || !/^\d{4}-\d{2}$/.test(fields.month) ||
    !Number.isSafeInteger(fields.reportedSpendMicros) || fields.reportedSpendMicros < 0 ||
    fields.reportedSpendMicros > MAX_REPORTED_MICROS || typeof fields.requestId !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(fields.requestId)) return error(400, "invalid");
  const result = ledger.recover(fields.requestId.toLowerCase(), now, fields.month, fields.reportedSpendMicros);
  if (result.error) return error(409, result.error);
  return reply(200, result);
}

export async function handle(request, env, ledger, options = {}) {
  if (isAdmin(request)) return admin(request, env, ledger, options);
  const origin = allowedOrigin(request, env);
  const respond = (status, body) => reply(status, body, origin);
  const error = (status, code) => respond(status, { error: code });
  if (!origin) return error(403, "origin");
  if (request.method === "OPTIONS") return respond(204);
  const route = request.method + " " + new URL(request.url).pathname;
  if (!Object.hasOwn(routes, route)) return error(404, "not_found");

  const mode = env.COACH_MODE;
  const ready = ["mock", "live"].includes(mode) && /^\d{1,64}$/.test(env.OWNER_GOOGLE_SUB ?? "") &&
    typeof env.GOOGLE_CLIENT_ID === "string" && Boolean(env.GOOGLE_CLIENT_ID) &&
    typeof env.DEDUPE_SECRET === "string" && env.DEDUPE_SECRET.length >= 32 &&
    (mode !== "live" || (typeof env.OPENAI_API_KEY === "string" && Boolean(env.OPENAI_API_KEY)));
  // Transcription has its own switch so voice can be paused while written evaluation stays on.
  const speech = ready && env.TRANSCRIPTION === "on" && (mode === "mock" || typeof env.AI?.run === "function");
  if (route === "GET /v1/config") return respond(200, {
    enabled: ready, mock: mode === "mock", googleClientId: ready ? env.GOOGLE_CLIENT_ID : null, transcription: speech
  });
  if (!ready) return error(503, "disabled");

  const now = (options.now ?? Date.now)();
  const owner = env.OWNER_GOOGLE_SUB;
  const secret = env.DEDUPE_SECRET;
  if (route.startsWith("POST /v1/auth/")) {
    const bucket = await keyed("login:" + Math.floor(now / 60_000) + ":" +
      (request.headers.get("CF-Connecting-IP") ?? "local"), secret);
    if (!ledger.authenticateRate(bucket, now)) return error(429, "rate");
    if (route.endsWith("/challenge")) {
      const nonce = randomToken();
      if (!ledger.challenge(await digest(nonce), now, now + 5 * 60_000)) return error(429, "rate");
      return respond(200, { nonce });
    }
    const fields = await json(request);
    if (!fields || typeof fields.credential !== "string" || fields.credential.length > 7000) return error(400, "invalid");
    const claims = await (options.verify ?? verifyGoogle)(fields.credential, { client: env.GOOGLE_CLIENT_ID, now });
    // Distinct, non-sensitive codes: the reason names the failed check, never a claim value or token.
    if (!claims || claims.error === "keys_unavailable") return error(503, "verifier");
    if (claims.error) return respond(401, { error: "google_token", reason: claims.error });
    if (claims.sub !== owner) return error(403, "owner");
    const session = randomToken();
    const expires = now + 30 * 60_000;
    if (!ledger.useChallenge(await digest(claims.nonce), now, await digest(session), owner, expires)) {
      return error(401, "nonce");
    }
    return respond(200, { session, expires });
  }

  const bearer = request.headers.get("Authorization")?.match(/^Bearer ([a-zA-Z0-9_-]{43})$/)?.[1];
  if (!bearer) return error(401, "session");
  const token = await digest(bearer);
  if (!ledger.session(token, owner, now)) return error(401, "session");
  if (route === "DELETE /v1/auth/session") {
    ledger.revoke(token);
    return respond(204);
  }
  if (route === "GET /v1/usage") return respond(200, { ...ledger.totals(now), mock: mode === "mock" });
  if (route === "POST /v1/transcriptions") return transcription(request, env, ledger, options, respond, speech);

  const fields = await json(request);
  if (!fields || typeof fields.answer !== "string" || typeof fields.questionId !== "string" ||
    typeof fields.requestId !== "string" || !uuid.test(fields.requestId) ||
    !Object.hasOwn(catalog, fields.questionId) || Object.keys(fields).some(key =>
      !["questionId", "requestId", "answer", "followUp", "mode"].includes(key)) ||
    ![undefined, "written", "spoken"].includes(fields.mode)) return error(400, "invalid");
  const answerMode = fields.mode ?? "written";
  const answer = fields.answer.trim();
  if (!answer || encoder.encode(answer).length > (answerMode === "spoken" ? MAX_TRANSCRIPT_BYTES : MAX_ANSWER_BYTES)) {
    return error(400, answerMode === "spoken" ? "transcript" : "answer");
  }
  const exercise = catalog[fields.questionId];
  let prompt = exercise.prompt;
  if (fields.followUp !== undefined) {
    prompt = await openFollowUp(fields.followUp, fields.questionId, now, secret);
    if (!prompt) return error(400, "follow_up");
  }
  const evaluation = buildEvaluation({ model: env.OPENAI_MODEL, exercise, prompt, answer, mode: answerMode });
  if (!evaluation) return error(503, "configuration");
  const fingerprint = await keyed(JSON.stringify([fields.questionId, prompt, answer, answerMode]), secret);
  const requestId = fields.requestId.toLowerCase();
  const decision = ledger.reserve(requestId, fingerprint, (options.now ?? Date.now)(), evaluation.reserveCost);
  if (decision !== "accepted") {
    const conflict = ["duplicate", "in_progress", "uncertain", "new_attempt"].includes(decision);
    return error(conflict ? 409 : decision === "disabled" ? 503 : 429, decision);
  }

  let result;
  try {
    result = mode === "mock" ? await (options.mock ?? mockOpenAI)(evaluation) :
      await requestOpenAI(evaluation, env.OPENAI_API_KEY, options.fetcher, requestId, options.providerSignal);
  } catch (failure) {
    ledger.settle(requestId, null);
    const timeout = ["TimeoutError", "AbortError"].includes(failure?.name);
    return respond(timeout ? 504 : 502, { error: timeout ? "timeout" : "provider_unconfirmed", requestId });
  }
  const usage = usageFor(result.envelope, evaluation);
  const ok = result.status >= 200 && result.status < 300;
  const feedback = ok ? feedbackFor(result.envelope, evaluation) : null;
  const providerError = result.envelope?.error?.code;
  // An explicit upstream rejection did not run inference. Gateway failures and missing
  // usage can hide a billable request, so keep their full reservation and quarantine the fingerprint.
  const rejected = [400, 401, 403, 404, 422, 429].includes(result.status) &&
    typeof result.envelope?.error?.type === "string";
  const accounting = usage ?? (rejected ? { cost: 0, input: 0, output: 0 } : null);
  ledger.settle(requestId, accounting, (options.now ?? Date.now)(), !feedback || !usage);
  if (usage?.exceeded) return error(503, "disabled");
  if (!feedback || !usage) {
    const truncated = result.envelope?.status === "incomplete" &&
      result.envelope.incomplete_details?.reason === "max_output_tokens";
    const code = providerError === "insufficient_quota" ? "credits" : result.status === 429 ? "provider_limit" :
      !accounting ? "provider_unconfirmed" : truncated ? "output_limit" : ok ? "feedback" : "provider";
    return respond(["credits", "provider_limit"].includes(code) ? 503 : 502, {
      error: code, requestId, providerStatus: result.status, providerId: result.providerId,
      retryWithNewId: Boolean(accounting)
    });
  }
  return respond(200, {
    id: requestId, rubric: 1, mode: answerMode, model: evaluation.model, mock: mode === "mock", feedback,
    followUp: await sealFollowUp(fields.questionId, feedback.followUp, now, secret),
    usage: ledger.totals((options.now ?? Date.now)())
  });
}

// Owner-only speech-to-text. The recording is read into memory, checked, transcribed, and discarded.
// Only the request ID, a keyed fingerprint, the reported duration, and estimated Neurons are recorded.
async function transcription(request, env, ledger, options, respond, enabled) {
  const error = (status, code) => respond(status, { error: code });
  if (!enabled) return error(503, "transcription_disabled");
  const query = new URL(request.url).searchParams;
  const questionId = query.get("questionId"), requestId = query.get("requestId");
  if ([...query.keys()].some(key => !["questionId", "requestId"].includes(key)) ||
    !questionId || !Object.hasOwn(catalog, questionId) || !requestId || !uuid.test(requestId)) return error(400, "invalid");
  const type = audioType(request.headers.get("Content-Type"));
  if (!type) return error(415, "audio");
  const audio = await readAudio(request, type);
  if (audio.error) return error(audio.error === "audio_size" ? 413 : 400, audio.error);
  const { bytes } = audio;
  // Catches an accidental resubmission of the same recording without hashing the whole file.
  const edges = new Uint8Array(Math.min(bytes.length, 2 * sample));
  edges.set(bytes.subarray(0, Math.min(bytes.length, sample)));
  if (bytes.length > sample) edges.set(bytes.subarray(-Math.min(bytes.length - sample, sample)), sample);
  const edgeHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", edges))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
  const fingerprint = await keyed(JSON.stringify([questionId, bytes.length, edgeHash]), env.DEDUPE_SECRET);
  const id = requestId.toLowerCase();
  const now = options.now ?? Date.now;
  const decision = ledger.reserveTranscription(id, fingerprint, now(), RESERVE_NEURONS);
  if (decision !== "accepted") return error(decision === "duplicate" ? 409 : 429, decision);

  const exercise = catalog[questionId];
  let output;
  try {
    output = await (env.COACH_MODE === "mock" ? (options.transcriber ?? mockTranscription)(exercise) :
      (options.transcriber ?? transcribe)(env.AI, bytes, request.headers.get("Content-Type"), vocabulary(exercise)));
  } catch {
    // The call may have consumed Neurons, so the full reservation stays counted.
    ledger.settleTranscription(id, null);
    return error(502, "transcription");
  }
  const metrics = speechMetrics(output);
  if (!metrics) {
    ledger.settleTranscription(id, null);
    return error(502, "transcription");
  }
  ledger.settleTranscription(id, metrics.duration, neuronsFor(metrics.duration));
  if (metrics.duration > MAX_AUDIO_SECONDS + 0.5) return error(413, "audio_length");
  const text = typeof output.text === "string" ? output.text.trim() : "";
  if (!text) return error(422, "no_speech");
  return respond(200, { id, mock: env.COACH_MODE === "mock", text, metrics, usage: ledger.totals(now()) });
}
