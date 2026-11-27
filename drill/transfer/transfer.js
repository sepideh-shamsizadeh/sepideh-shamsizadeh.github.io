(function (root) {
  const drillKey = "drill-v1";
  const communicationKey = "drill-communication-v1";
  const themeKey = "theme";
  const maxBytes = 2_000_000;
  const own = (object, key) => Object.hasOwn(object, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
  const identifier = value => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value) &&
    !["constructor", "prototype"].includes(value);
  const day = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const category = value => ["concept", "plain", "comparison", "decision", "project", "debug",
    "behavior", "uncertainty", "design", "research"].includes(value);
  const ratingNames = ["accuracy", "depth", "structure", "clarity", "concise", "english", "reasoning"];

  function requireValue(valid) {
    if (!valid) throw new Error("This file contains invalid or unsupported progress data.");
  }

  function map(value, validKey, validValue) {
    requireValue(record(value));
    const entries = Object.entries(value);
    requireValue(entries.every(([key, entry]) => validKey(key) && validValue(entry)));
    return Object.fromEntries(entries);
  }

  function drill(value) {
    requireValue(record(value));
    const result = {
      box: map(value.box ?? {}, identifier, v => integer(v, 0, 4)),
      days: map(value.days ?? {}, day, v => integer(v, 0, Number.MAX_SAFE_INTEGER)),
      code: map(value.code ?? {}, identifier, day),
      skip: value.skip ?? 0
    };
    requireValue(integer(result.skip, 0, Number.MAX_SAFE_INTEGER));
    if (value.lc !== undefined) {
      requireValue(record(value.lc));
      result.lc = {
        py: map(value.lc.py ?? {}, identifier, v => integer(v, 1, 2)),
        cpp: map(value.lc.cpp ?? {}, identifier, v => integer(v, 1, 2))
      };
    }
    if (value.lcCat !== undefined) {
      requireValue(value.lcCat === "auto" || /^(?:[0-9]|1[0-7])$/.test(value.lcCat));
      result.lcCat = String(value.lcCat);
    }
    if (value.lcSkip !== undefined) {
      requireValue(Array.isArray(value.lcSkip) && value.lcSkip.every(identifier));
      result.lcSkip = [...new Set(value.lcSkip)];
    }
    return result;
  }

  function attempt(value) {
    requireValue(record(value) && identifier(value.questionId) && category(value.category) && day(value.day));
    const ratings = map(value.ratings, key => ratingNames.includes(key), score => integer(score, 1, 5));
    requireValue(ratingNames.slice(0, 6).every(name => own(ratings, name)));
    const result = { questionId: value.questionId, category: value.category, day: value.day, ratings };
    if (value.sessionId !== undefined) {
      requireValue(identifier(value.sessionId));
      result.sessionId = value.sessionId;
    }
    return result;
  }

  function communication(value) {
    requireValue(record(value) && value.version === 1 && Array.isArray(value.attempts) && Array.isArray(value.sessions));
    requireValue(Array.isArray(value.minutes) && value.minutes.length === 5 &&
      value.minutes.every(v => integer(v, 1, 16)) && value.minutes.reduce((a, b) => a + b, 0) === 20);
    // Transfer completed work. An in-progress run remains resumable on its original browser origin.
    return {
      version: 1, attempts: value.attempts.map(attempt), lessons: map(value.lessons, identifier, day),
      sessions: value.sessions.map(session => {
        requireValue(record(session) && ["daily", "quick"].includes(session.mode) && day(session.day));
        return { mode: session.mode, day: session.day };
      }),
      minutes: [...value.minutes], active: null
    };
  }

  function theme(value) {
    requireValue(value === "dark" || value === "light");
    return value;
  }

  function snapshot(storage) {
    const result = { format: "drill-progress", version: 1 };
    const legacy = storage.getItem(drillKey);
    const coaching = storage.getItem(communicationKey);
    const preference = storage.getItem(themeKey);
    if (legacy !== null) result.drill = drill(JSON.parse(legacy));
    if (coaching !== null) result.communication = communication(JSON.parse(coaching));
    if (preference !== null) result.theme = theme(preference);
    return result;
  }

  function parse(text) {
    requireValue(new TextEncoder().encode(text).length <= maxBytes);
    const file = JSON.parse(text);
    requireValue(record(file) && file.format === "drill-progress" && file.version === 1);
    const result = {};
    if (own(file, "drill")) result.drill = drill(file.drill);
    if (own(file, "communication")) result.communication = communication(file.communication);
    if (own(file, "theme")) result.theme = theme(file.theme);
    requireValue(Object.keys(result).length > 0);
    return result;
  }

  // Keep multiplicity within each origin, but count matching metadata only once across origins.
  function mergeHistory(current, incoming, identify) {
    const counts = new Map();
    for (const entry of current) {
      const id = identify(entry);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const merged = [...current];
    for (const entry of incoming) {
      const id = identify(entry);
      const count = counts.get(id) ?? 0;
      if (count) counts.set(id, count - 1);
      else merged.push(entry);
    }
    return merged.sort((a, b) => a.day.localeCompare(b.day));
  }

  const identifyAttempt = value => JSON.stringify([
    value.questionId, value.category, value.day, value.sessionId ?? null,
    ratingNames.map(skill => value.ratings[skill] ?? null)
  ]);
  const identifySession = value => JSON.stringify([value.mode, value.day]);

  function maximum(current, incoming) {
    const result = { ...current };
    for (const [key, value] of Object.entries(incoming)) result[key] = Math.max(result[key] ?? 0, value);
    return result;
  }

  function plan(storage, incoming, preferSource = false) {
    const changes = [];
    function stage(key, getValue) {
      const before = storage.getItem(key);
      const after = getValue(before);
      if (after !== before) changes.push({ key, before, after });
    }
    if (incoming.drill) stage(drillKey, before => {
      const source = incoming.drill;
      if (before === null) return JSON.stringify(source);
      const raw = JSON.parse(before);
      const current = drill(raw);
      const preferred = (a, b) => preferSource ? { ...a, ...b } : { ...b, ...a };
      return JSON.stringify({
        ...raw, box: preferred(current.box, source.box), days: maximum(current.days, source.days),
        code: preferred(current.code, source.code), skip: preferSource ? source.skip : current.skip,
        ...(current.lc || source.lc ? { lc: {
          py: preferred(current.lc?.py, source.lc?.py), cpp: preferred(current.lc?.cpp, source.lc?.cpp)
        } } : {}),
        ...(current.lcCat !== undefined || source.lcCat !== undefined ? {
          lcCat: preferSource ? source.lcCat ?? current.lcCat : current.lcCat ?? source.lcCat
        } : {}),
        ...(current.lcSkip || source.lcSkip ? {
          lcSkip: [...new Set([...(current.lcSkip ?? []), ...(source.lcSkip ?? [])])]
        } : {})
      });
    });
    if (incoming.communication) stage(communicationKey, before => {
      const source = incoming.communication;
      if (before === null) return JSON.stringify(source);
      const raw = JSON.parse(before);
      const current = communication(raw);
      return JSON.stringify({
        ...raw,
        attempts: mergeHistory(raw.attempts, source.attempts, identifyAttempt),
        sessions: mergeHistory(current.sessions, source.sessions, identifySession),
        lessons: { ...source.lessons, ...current.lessons },
        minutes: preferSource ? source.minutes : current.minutes
      });
    });
    if (incoming.theme) stage(themeKey, before => before === null || preferSource ? incoming.theme : before);
    return changes;
  }

  function apply(storage, changes) {
    if (changes.some(({ key, before }) => storage.getItem(key) !== before)) {
      throw new Error("Progress changed after the preview. Select the file again before importing.");
    }
    const written = [];
    try {
      for (const change of changes) {
        storage.setItem(change.key, change.after);
        written.push(change);
      }
    } catch {
      for (const { key, before, after } of written.reverse()) {
        if (storage.getItem(key) !== after) continue;
        if (before === null) storage.removeItem(key);
        else storage.setItem(key, before);
      }
      throw new Error("The browser could not save the import. Keep your export file and try again.");
    }
  }

  const api = { snapshot, parse, plan, apply, maxBytes };
  if (typeof document === "undefined" && typeof module === "object") module.exports = api;
  else root.DrillTransfer = api;
})(globalThis);
