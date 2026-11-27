// Speech-to-text for spoken practice answers, using Cloudflare Workers AI on the Workers Free plan.
// On the Free plan, usage beyond the daily Neuron allocation fails with an error instead of being billed.
// There is no paid fallback. Audio and transcripts are processed in memory and never stored.
export const TRANSCRIBE_MODEL = "@cf/openai/whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;
// Published Workers AI price for whisper-large-v3-turbo: 46.63 Neurons per audio minute (verified 2026-11-27).
const NEURONS_PER_MINUTE = 46.63;
export const neuronsFor = seconds => Math.ceil(seconds / 60 * NEURONS_PER_MINUTE);
// MediaRecorder output carries no reliable duration before decoding (Chrome's WebM has none), so every
// request reserves the maximum recording length and settles with the duration Whisper reports.
export const RESERVE_NEURONS = neuronsFor(MAX_AUDIO_SECONDS);
const TIMEOUT_MS = 60_000;
const PAUSE_SECONDS = 1;

const containers = {
  webm: bytes => bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3,
  ogg: bytes => String.fromCharCode(...bytes.subarray(0, 4)) === "OggS",
  mp4: bytes => String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp"
};

// The declared type must be a recorder audio format, and the file's signature must match it.
export function audioType(header) {
  const match = /^audio\/(webm|ogg|mp4)(?:\s*;\s*codecs="?[a-z0-9.,\s-]{1,40}"?)?$/i.exec(header ?? "");
  return match ? match[1].toLowerCase() : null;
}

export async function readAudio(request, type) {
  const declared = Number(request.headers.get("Content-Length"));
  if (!request.body || declared > MAX_AUDIO_BYTES) return { error: "audio_size" };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_AUDIO_BYTES) {
        reader.cancel().catch(() => {});
        return { error: "audio_size" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "audio" };
  } finally {
    reader.releaseLock();
  }
  if (size < 64) return { error: "audio" };
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return containers[type](bytes) ? { bytes } : { error: "audio" };
}

// Server-side vocabulary for the question. Clients cannot supply prompt text to the model.
export function vocabulary(exercise) {
  const terms = Array.isArray(exercise.terms) ? exercise.terms.join(", ") : "";
  return terms ? "Technical interview answer. Vocabulary: " + terms + "." : undefined;
}

const fillerWords = new Set(["um", "uh", "er", "erm", "hmm", "mm", "uhm"]);
const fillerPairs = new Set(["you know", "i mean"]);
const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

// Timing metrics from the original recognition. Filler counts are approximate: recognition often omits
// hesitations. Nothing here measures pronunciation, accent, confidence or intonation.
export function speechMetrics(output) {
  const duration = output?.transcription_info?.duration;
  if (!Number.isFinite(duration) || duration < 0) return null;
  const words = (Array.isArray(output.segments) ? output.segments : [])
    .flatMap(segment => Array.isArray(segment?.words) ? segment.words : [])
    .filter(word => typeof word?.word === "string" && Number.isFinite(word.start) && Number.isFinite(word.end) &&
      /[\p{L}\p{N}]/u.test(word.word));
  const tokens = words.map(word => word.word.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, "").trim());
  let pauses = 0, longest = 0, fillers = 0;
  for (let i = 0; i < words.length; i++) {
    if (fillerWords.has(tokens[i])) fillers++;
    if (i && fillerPairs.has(tokens[i - 1] + " " + tokens[i])) fillers++;
    if (i) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > PAUSE_SECONDS) pauses++;
      longest = Math.max(longest, gap);
    }
  }
  const span = words.length ? Math.max(0, words.at(-1).end - words[0].start) : 0;
  return {
    duration: round(duration), words: words.length, speakingSeconds: round(span),
    wordsPerMinute: span >= 5 ? Math.round(words.length / span * 60) : null,
    pauses, longestPause: round(Math.max(0, longest)), fillers
  };
}

export async function transcribe(ai, bytes, contentType, prompt) {
  const input = { audio: { body: new Blob([bytes]).stream(), contentType }, language: "en", vad_filter: true };
  if (prompt) input.initial_prompt = prompt;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
  });
  try {
    return await Promise.race([ai.run(TRANSCRIBE_MODEL, input), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function mockTranscription(exercise) {
  const text = "Um, this is a mock transcript for interface testing. " + exercise.example;
  const words = text.split(/\s+/).map((word, index) => ({ word, start: index * 0.4 + (index > 5 ? 1.5 : 0), end: index * 0.4 + 0.3 + (index > 5 ? 1.5 : 0) }));
  return { text, transcription_info: { duration: words.at(-1).end + 0.5 }, segments: [{ words }] };
}
