(function (root) {
  const key = "drill-communication-v1";
  const scale = [
    "Major gaps. I need to revisit the basics.",
    "Partial. Important points were missing or unclear.",
    "Adequate. The main points came through.",
    "Strong. I explained the important points clearly.",
    "Interview-ready. The answer was precise and well supported."
  ];
  const skills = {
    accuracy: "Technical accuracy", depth: "Technical depth", structure: "Structure",
    clarity: "Clarity", concise: "Conciseness", english: "Professional English",
    reasoning: "Engineering reasoning"
  };
  const defaultMinutes = [3, 3, 5, 4, 5];
  const dailySteps = [
    { label: "Technical explanation", categories: ["concept", "plain"] },
    { label: "Engineering decision", categories: ["decision"] },
    { label: "Project presentation", categories: ["project"] },
    { label: "Follow-up question", followUp: true, categories: ["uncertainty", "debug", "comparison", "design", "research", "behavior"] },
    { label: "Review and improved answer", review: true }
  ];
  const empty = () => ({ version: 1, attempts: [], lessons: {}, sessions: [], minutes: [...defaultMinutes], active: null });
  const validMinutes = values => Array.isArray(values) && values.length === 5 &&
    values.every(value => Number.isInteger(value) && value > 0) &&
    values.reduce((sum, value) => sum + value, 0) === 20;

  function load(storage) {
    const raw = storage.getItem(key);
    if (raw === null) return empty();
    const state = JSON.parse(raw);
    if (state?.version !== 1 || !Array.isArray(state.attempts) ||
      !Array.isArray(state.sessions) || !state.lessons || !validMinutes(state.minutes)) {
      throw new Error("Unsupported communication progress");
    }
    return state;
  }

  function update(storage, change) {
    const state = load(storage);
    change(state);
    storage.setItem(key, JSON.stringify(state));
    return state;
  }

  function dayKey(date = new Date()) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map(value => String(value).padStart(2, "0")).join("-");
  }

  function daysBefore(date, count) {
    const day = new Date(date);
    day.setDate(day.getDate() - count);
    return dayKey(day);
  }

  const remaining = (end, now = Date.now()) => Math.max(0, Math.ceil((end - now) / 1000));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const score = attempt => mean(Object.values(attempt.ratings));
  const isWeak = attempt => attempt && score(attempt) < 3;
  const latestById = attempts => new Map(attempts.map(attempt => [attempt.questionId, attempt]));

  function selectQuestion(bank, attempts, options = {}) {
    const { topic, category, exclude = [], prioritize = false, random = Math.random } = options;
    const matches = bank.filter(q => (!topic || q.topic === topic) && (!category || category.includes(q.category)));
    let pool = matches.filter(q => !exclude.includes(q.id));
    if (!pool.length) pool = matches;
    const latest = latestById(attempts);
    if (prioritize) {
      const weak = pool.filter(q => isWeak(latest.get(q.id)));
      const fresh = pool.filter(q => !latest.has(q.id));
      if (weak.length) pool = weak;
      else if (fresh.length) pool = fresh;
    }
    return pool[Math.floor(random() * pool.length)] ?? null;
  }

  function sessionPlan(bank, attempts, mode, minutes, random = Math.random) {
    const templates = mode === "quick" ? [
      { label: "First answer" }, { label: "Second answer" }, dailySteps[4]
    ] : dailySteps;
    const budgets = mode === "quick" ? [2, 2, 1] : minutes;
    const steps = [];
    for (const [index, template] of templates.entries()) {
      const { label, categories, review } = template;
      if (review) {
        steps.push({ label, minutes: budgets[index], review: true });
        continue;
      }
      const used = steps.map(step => bank.find(q => q.id === step.questionId)?.category);
      const eligible = (categories ?? [...new Set(bank.map(q => q.category))])
        .filter(category => !used.includes(category));
      const previous = bank.find(q => q.id === steps.at(-1)?.questionId);
      const related = template.followUp && bank.find(q =>
        q.id === previous?.followUpId && eligible.includes(q.category));
      const question = related || selectQuestion(bank, attempts, {
        category: eligible, exclude: steps.map(step => step.questionId), prioritize: true, random
      });
      steps.push({ label, minutes: budgets[index], questionId: question.id });
    }
    return steps;
  }

  function assessment(question, fields, date = new Date()) {
    const ratings = {};
    for (const skill of Object.keys(skills)) {
      if (skill === "reasoning" && !question.reasoning) continue;
      const value = Number(fields[skill]);
      if (!Number.isInteger(value) || value < 1 || value > 5) return null;
      ratings[skill] = value;
    }
    return {
      questionId: question.id, category: question.category, day: dayKey(date),
      ratings, answer: String(fields.answer ?? "").trim(), notes: String(fields.notes ?? "").trim()
    };
  }

  function recordAttempt(state, attempt, session, date = new Date()) {
    if (session && (state.active?.id !== session.id || state.active.index !== session.index)) {
      throw new Error("Session changed");
    }
    state.attempts.push(session ? { ...attempt, sessionId: session.id } : attempt);
    if (!session) return;
    const active = state.active;
    if (active.index + 1 < active.steps.length) {
      active.index += 1;
      return;
    }
    state.sessions.push({ mode: active.mode, day: dayKey(date) });
    state.active = null;
  }

  function progress(state, date = new Date()) {
    const today = dayKey(date);
    const practiced = new Set(state.attempts.map(attempt => attempt.day));
    const latest = [...latestById(state.attempts).values()];
    const weak = latest.filter(isWeak).sort((a, b) => score(a) - score(b));
    const byCategory = {};
    for (const attempt of latest) {
      (byCategory[attempt.category] ??= []).push(score(attempt));
    }
    const weakCategories = Object.entries(byCategory).filter(([, values]) => mean(values) < 3)
      .map(([category, values]) => [category, mean(values)]).sort((a, b) => a[1] - b[1]);
    let streak = 0;
    let offset = practiced.has(today) ? 0 : 1;
    while (practiced.has(daysBefore(date, offset++))) streak += 1;
    const weekly = Array.from({ length: 7 }, (_, index) => {
      const day = daysBefore(date, 6 - index);
      const attempts = state.attempts.filter(attempt => attempt.day === day);
      return { day, attempts: attempts.length, average: mean(attempts.map(score)),
        sessions: state.sessions.filter(session => session.day === day).length };
    });
    return {
      completed: latest.length, attempts: state.attempts.length, average: mean(state.attempts.map(score)),
      bySkill: Object.fromEntries(Object.keys(skills).map(skill => [skill,
        mean(state.attempts.map(attempt => attempt.ratings[skill]).filter(value => value !== undefined))])),
      weak, weakCategories, lessons: Object.keys(state.lessons).length, streak, weekly,
      daily: state.sessions.filter(session => session.mode === "daily").length,
      quick: state.sessions.filter(session => session.mode === "quick").length,
      dailyToday: state.sessions.some(session => session.mode === "daily" && session.day === today)
    };
  }

  const model = { key, scale, skills, defaultMinutes, dailySteps, empty, validMinutes, load, update,
    dayKey, remaining, score, selectQuestion, sessionPlan, assessment, recordAttempt, progress };
  if (typeof document === "undefined" && typeof module === "object") module.exports = model;
  else root.DrillCommunicationModel = model;
})(globalThis);
