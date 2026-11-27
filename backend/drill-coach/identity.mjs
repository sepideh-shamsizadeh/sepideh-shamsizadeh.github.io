const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hostname = "https://www.googleapis.com/oauth2/v3/certs";
let cache;

export function randomToken() {
  return base64(crypto.getRandomValues(new Uint8Array(32)));
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
}

export async function digest(value) {
  return base64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export async function keyed(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function verifyGoogle(token, { client, now, fetcher = fetch }) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || token.length > 7000) return null;
    const [head, body, signature] = parts;
    const header = JSON.parse(decoder.decode(decode(head)));
    const claims = JSON.parse(decoder.decode(decode(body)));
    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 100 ||
      !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) ||
      claims.aud !== client || (claims.azp !== undefined && claims.azp !== client) ||
      !Number.isInteger(claims.exp) || claims.exp <= now / 1000 ||
      !Number.isInteger(claims.iat) || claims.iat > now / 1000 + 60 ||
      (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now / 1000)) ||
      typeof claims.sub !== "string" || !/^\d{1,64}$/.test(claims.sub) ||
      typeof claims.nonce !== "string" || !/^[a-zA-Z0-9_-]{43}$/.test(claims.nonce)) return null;
    if (!cache || cache.expires <= now || cache.fetcher !== fetcher) {
      const response = await fetcher(hostname, { signal: AbortSignal.timeout(4000), redirect: "error" });
      if (!response.ok) return null;
      const body = await response.json();
      if (!Array.isArray(body.keys)) return null;
      const ttl = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] ?? 60);
      cache = { keys: body.keys, expires: now + Math.min(ttl, 3600) * 1000, fetcher };
    }
    const jwk = cache.keys.find(key => key.kid === header.kid && key.kty === "RSA" && key.alg === "RS256");
    if (!jwk) return null;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const valid = await crypto.subtle.verify(algorithm, key, decode(signature), encoder.encode(head + "." + body));
    return valid ? { sub: claims.sub, nonce: claims.nonce } : null;
  } catch {
    return null;
  }
}

export async function sealFollowUp(questionId, prompt, now, secret) {
  const body = base64(encoder.encode(JSON.stringify([questionId, prompt, now + 30 * 60_000])));
  return body + "." + await keyed("follow-up:" + body, secret);
}

export async function openFollowUp(reference, questionId, now, secret) {
  if (typeof reference !== "string" || reference.length > 3000) return null;
  try {
    const [body, signature, extra] = reference.split(".");
    if (extra !== undefined || !signature || !body) return null;
    const expected = await keyed("follow-up:" + body, secret);
    if (signature.length !== expected.length) return null;
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (difference) return null;
    const [id, text, expires] = JSON.parse(decoder.decode(decode(body)));
    return id === questionId && typeof text === "string" && text.length <= 450 && expires > now ? text : null;
  } catch {
    return null;
  }
}
