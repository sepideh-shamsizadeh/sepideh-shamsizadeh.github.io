const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const model = require("../drill/communication/model.js");
const content = require("../drill/communication/content.js");

const source = fs.readFileSync(require.resolve("../drill/drill.js"), "utf8");
let bank;
vm.runInNewContext(source, {
  document: {
    getElementById: id => id === "communication" ? {
      dispatchEvent: ({ detail }) => { bank = content.questionBank(detail.cards, detail.topics); }
    } : null
  },
  CustomEvent: class { constructor(name, { detail }) { this.detail = detail; } }
});
const memory = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
};
const date = new Date(2026, 10, 27, 13);
const makeAttempt = (question, rating, day = date) => model.assessment(question,
  Object.fromEntries(Object.keys(model.skills).map(skill => [skill, rating])), day);

test("the shared flashcard bank feeds every exercise category and multiple versions of IoU", () => {
  assert.equal(new Set(bank.map(q => q.id)).size, bank.length);
  assert.deepEqual(new Set(bank.map(q => q.category)), new Set(Object.keys(content.categories)));
  assert.equal(bank.filter(q => q.source?.q === "What is IoU?").length, 2);
  assert.ok(bank.filter(q => q.source).length >= 14);
  assert.equal(content.lessons.length, 12);
});

test("selection filters, excludes the current prompt, handles empty matches and favors latest weak work", () => {
  assert.equal(model.selectQuestion(bank, [], { topic: "cv", category: ["plain"] }).id, "iou-plain");
  assert.equal(model.selectQuestion(bank, [], { topic: "missing" }), null);
  assert.notEqual(model.selectQuestion(bank, [], { exclude: [bank[0].id], random: () => 0 }).id, bank[0].id);
  const weak = makeAttempt(bank[1], 2);
  assert.equal(model.selectQuestion(bank, [weak], { prioritize: true, random: () => 0 }).id, weak.questionId);
  assert.notEqual(model.selectQuestion(bank, [weak, makeAttempt(bank[1], 5)], { prioritize: true, random: () => 0.1 }).id, weak.questionId);
});

test("daily and quick plans honor budgets, category variety, weak questions and a review step", () => {
  assert.equal(model.validMinutes([2, 4, 5, 4, 5]), true);
  assert.equal(model.validMinutes([2, 2, 5, 4, 5]), false);
  assert.equal(model.validMinutes([0, 6, 5, 4, 5]), false);
  for (const [mode, total, count] of [["daily", 20, 5], ["quick", 5, 3]]) {
    const plan = model.sessionPlan(bank, [makeAttempt(bank[1], 1)], mode, model.defaultMinutes, () => 0);
    assert.equal(plan.length, count);
    assert.equal(plan.reduce((sum, step) => sum + step.minutes, 0), total);
    assert.equal(plan[0].questionId, bank[1].id);
    assert.equal(plan.at(-1).review, true);
    assert.equal(new Set(plan.slice(0, -1).map(step => bank.find(q => q.id === step.questionId).category)).size, count - 1);
  }
});

test("daily follow-up builds on the project prompt even when a different topic is weak", () => {
  const drift = bank.find(q => q.id === "drift");
  const plan = model.sessionPlan(bank, [makeAttempt(drift, 1)], "daily", model.defaultMinutes, () => 0);
  const project = bank.find(q => q.id === plan[2].questionId);
  assert.equal(plan[3].questionId, project.followUpId);
});

test("countdown rounds up, follows wall-clock time and clamps expiry", () => {
  for (const duration of [60, 90, 120]) {
    const start = 100_000;
    const end = start + duration * 1000;
    assert.equal(model.remaining(end, start + 1), duration);
    assert.equal(model.remaining(end, end - 1), 1);
    assert.equal(model.remaining(end, end), 0);
    assert.equal(model.remaining(end, end + 8_000), 0);
  }
});

test("assessments validate 1–5, omit inapplicable reasoning and preserve optional notes and answers", () => {
  assert.equal(makeAttempt(bank[0], 0), null);
  assert.equal(makeAttempt(bank[0], 6), null);
  assert.equal(makeAttempt(bank[0], 2.5), null);
  assert.equal(model.assessment(bank[0], { accuracy: 5 }), null);
  assert.equal(makeAttempt(bank[0], 3).ratings.reasoning, undefined);
  const decision = bank.find(q => q.category === "decision");
  const ratings = makeAttempt(decision, 4).ratings;
  assert.equal(ratings.reasoning, 4);
  const saved = model.assessment(decision, { ...ratings, answer: " Some text ", notes: " Gap " }, date);
  assert.equal(saved.answer, "Some text");
  assert.equal(saved.notes, "Gap");
});

test("session advancement and progress persist without touching legacy data", () => {
  const storage = memory();
  const legacy = '{"box":{"ml0":3},"days":{"2026-11-27":1},"code":{"pt0":"2026-11-27"},"lc":{"py":{"two-sum":2},"cpp":{}}}';
  storage.setItem("drill-v1", legacy);
  const steps = model.sessionPlan(bank, [], "daily", model.defaultMinutes, () => 0);
  let state = model.update(storage, data => {
    data.lessons.structured = "2026-11-27";
    data.active = { id: "test", mode: "daily", index: 0, steps };
    model.recordAttempt(data, makeAttempt(bank[0], 4, new Date(2026, 10, 26)), null);
  });
  const staleSession = state.active;
  for (const step of steps) {
    const question = bank.find(q => q.id === step.questionId) ?? bank[0];
    state = model.update(storage, data => model.recordAttempt(data, makeAttempt(question, 2), state.active, date));
    assert.deepEqual(model.load(storage), state);
  }
  assert.equal(state.active, null);
  assert.throws(() => model.update(storage, data => model.recordAttempt(data, makeAttempt(bank[0], 5), staleSession)));
  const progress = model.progress(state, date);
  assert.equal(progress.dailyToday, true);
  assert.equal(progress.daily, 1);
  assert.equal(progress.attempts, 6);
  assert.equal(progress.completed, 4);
  assert.equal(progress.streak, 2);
  assert.equal(progress.lessons, 1);
  assert.equal(progress.weak.length, 4);
  assert.equal(progress.weakCategories.length, 4);
  assert.equal(progress.weekly.at(-1).attempts, 5);
  assert.equal(progress.weekly.at(-1).sessions, 1);
  assert.equal(progress.bySkill.reasoning, 2);
  assert.equal(storage.getItem("drill-v1"), legacy);
});

test("malformed or future storage is preserved on a failed write", () => {
  const storage = memory();
  for (const raw of ["broken", '{"version":2}']) {
    storage.setItem(model.key, raw);
    assert.throws(() => model.update(storage, () => {}));
    assert.equal(storage.getItem(model.key), raw);
  }
});
