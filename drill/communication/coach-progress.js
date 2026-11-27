(function (root) {
  const key = "drill-ai-coach-v1";
  const skills = {
    accuracy: "Technical accuracy", depth: "Technical depth", structure: "Structure",
    clarity: "Clarity", concise: "Conciseness", english: "Professional English",
    reasoning: "Engineering reasoning", practical: "Practical understanding"
  };
  const id = value => typeof value === "string" && /^[a-z0-9-]{1,100}$/.test(value);
  const date = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;

  function metadata(value) {
    if (!value || !id(value.id) || !id(value.questionId) || !id(value.topic) || !id(value.category) ||
        !date(value.at) || typeof value.model !== "string" || !/^gpt-[a-z0-9.-]{1,90}$/.test(value.model) ||
        value.rubric !== 1 || !value.scores || !Object.hasOwn(value, "overall") ||
        !Number.isFinite(value.overall) || value.overall < 1 || value.overall > 5) {
      throw new Error("Invalid coach metadata");
    }
    const scores = {};
    for (const skill of Object.keys(skills)) {
      const score = value.scores[skill];
      if (score === null) continue;
      if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("Invalid coach score");
      scores[skill] = score;
    }
    return {
      id: value.id, questionId: value.questionId, topic: value.topic, category: value.category,
      at: value.at, model: value.model, rubric: 1, overall: value.overall, scores: Object.fromEntries(
        Object.keys(skills).map(skill => [skill, scores[skill] ?? null])
      ),
      reviewAt: date(value.reviewAt) ? value.reviewAt : null, mock: value.mock === true
    };
  }

  function load(storage) {
    const stored = storage.getItem(key);
    if (stored === null) return [];
    const state = JSON.parse(stored);
    if (state?.version !== 1 || !Array.isArray(state.attempts)) throw new Error("Unsupported coach progress");
    return state.attempts.map(metadata);
  }
  const write = (storage, attempts) => storage.setItem(key, JSON.stringify({ version: 1, attempts }));
  function save(storage, value) {
    const row = metadata(value);
    const previous = load(storage);
    write(storage, [...previous.filter(item => item.id !== row.id), row]);
  }
  function remove(storage, id) {
    write(storage, load(storage).filter(item => item.id !== id));
  }

  const api = { key, skills, load, save, remove };
  if (typeof document === "undefined" && typeof module === "object") module.exports = api;
  else root.DrillCoachProgress = api;
})(globalThis);
