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
  const kind = attempt => attempt.assessment ?? "self";
  const score = attempt => !attempt ? null : attempt.ai?.overall ?? mean(Object.values(attempt.ratings));
  const ratedMean = attempts => mean(attempts.map(score).filter(value => value !== null));
  const isWeak = attempt => score(attempt) !== null && score(attempt) < 3;
  const latestById = attempts => new Map(attempts.map(attempt => [attempt.questionId, attempt]));

  function selectQuestion(bank, attempts, options = {}) {
    const { topic, category, exclude = [], prioritize = false, random = Math.random } = options;
    const matches = bank.filter(q => (!topic || q.topic === topic) && (!category || category.includes(q.category)));
    let pool = matches.filter(q => !exclude.includes(q.id));
    if (!pool.length) pool = matches;
    const latest = latestById(attempts.filter(attempt => kind(attempt) !== "skipped"));
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

  // `mode` is "spoken" when the attempt included a recording; written attempts keep the original shape.
  function assessment(question, fields, date = new Date(), mode = "written", options = {}) {
    const ratings = {};
    for (const skill of Object.keys(skills)) {
      if (skill === "reasoning" && !question.reasoning) continue;
      const value = Number(fields[skill]);
      if (!Number.isInteger(value) || value < 1 || value > 5) continue;
      ratings[skill] = value;
    }
    const expected = Object.keys(skills).length - (question.reasoning ? 0 : 1);
    const assessment = options.skip ? "skipped" : options.ai ? "ai" :
      Object.keys(ratings).length === expected ? "self" : "unassessed";
    if (!options.optional && assessment !== "self") return null;
    return {
      questionId: question.id, category: question.category, day: dayKey(date),
      ratings: assessment === "self" ? ratings : {},
      ...(assessment === "self" ? {} : { assessment }),
      ...(assessment === "ai" ? { ai: options.ai } : {}),
      answer: String(fields.answer ?? "").trim(), notes: String(fields.notes ?? "").trim(),
      ...(mode === "spoken" ? { mode: "spoken" } : {})
    };
  }

  function recordAttempt(state, attempt, session, date = new Date()) {
    if (session && (state.active?.id !== session.id || state.active.index !== session.index)) {
      throw new Error("Session changed");
    }
    const { questionId, category, day, ratings } = attempt;
    const metadata = { questionId, category, day, ratings,
      ...(attempt.assessment ? { assessment: attempt.assessment } : {}), ...(attempt.ai ? { ai: attempt.ai } : {}), ...(attempt.mode === "spoken" ? { mode: "spoken" } : {}) };
    state.attempts.push(session ? { ...metadata, sessionId: session.id } : metadata);
    if (!session) return;
    const active = state.active;
    if (active.index + 1 < active.steps.length) {
      active.index += 1;
      return;
    }
    state.sessions.push({ mode: active.mode, day: dayKey(date) });
    state.active = null;
  }

  function progress(state, date = new Date(), historicalAI = []) {
    const today = dayKey(date);
    const practice = state.attempts.filter(attempt => kind(attempt) !== "skipped");
    const practiced = new Set(practice.map(attempt => attempt.day));
    const self = practice.filter(attempt => kind(attempt) === "self");
    const latest = [...latestById(self).values()];
    const aiQuestions = new Set(historicalAI.map(entry => entry.questionId));
    const counts = { ai: 0, self: 0, unassessed: 0, skipped: 0 };
    for (const attempt of state.attempts) if (kind(attempt) === "ai") aiQuestions.add(attempt.questionId);
    for (const attempt of latestById(state.attempts).values()) {
      if (!aiQuestions.has(attempt.questionId)) counts[kind(attempt)] += 1;
    }
    counts.ai = aiQuestions.size;
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
      const attempts = practice.filter(attempt => attempt.day === day);
      return { day, attempts: attempts.length, average: ratedMean(attempts.filter(attempt => kind(attempt) === "self")),
        sessions: state.sessions.filter(session => session.day === day).length };
    });
    const spoken = practice.filter(attempt => attempt.mode === "spoken");
    return {
      completed: latestById(practice).size, attempts: state.attempts.length, counts, average: ratedMean(self),
      spoken: spoken.length, spokenAverage: ratedMean(self.filter(attempt => attempt.mode === "spoken")),
      writtenAverage: ratedMean(self.filter(attempt => attempt.mode !== "spoken")),
      bySkill: Object.fromEntries(Object.keys(skills).map(skill => [skill,
        mean(self.map(attempt => attempt.ratings[skill]).filter(value => value !== undefined))])),
      weak, weakCategories, lessons: Object.keys(state.lessons).length, streak, weekly,
      daily: state.sessions.filter(session => session.mode === "daily").length,
      quick: state.sessions.filter(session => session.mode === "quick").length,
      dailyToday: state.sessions.some(session => session.mode === "daily" && session.day === today)
    };
  }

  const model = { key, scale, skills, defaultMinutes, dailySteps, empty, validMinutes, load, update,
    dayKey, remaining, score, kind, selectQuestion, sessionPlan, assessment, recordAttempt, progress };
  if (typeof document === "undefined" && typeof module === "object") module.exports = model;
  else root.DrillCommunicationModel = model;
})(globalThis);
