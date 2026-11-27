const { test } = require("node:test");
const assert = require("node:assert/strict");
const transfer = require("../drill/transfer/transfer.js");
const model = require("../drill/communication/model.js");
const coachProgress = require("../drill/communication/coach-progress.js");

const day = "2026-11-27";
const ratings = { accuracy: 4, depth: 4, structure: 3, clarity: 4, concise: 3, english: 5 };
const attempt = { questionId: "iou", category: "concept", day, ratings };
const coach = { ...model.empty(), attempts: [attempt], lessons: { structured: day },
  sessions: [{ mode: "daily", day }] };
const legacy = { box: { cv0: 0 }, days: { [day]: 3 }, code: { pt0: day }, skip: 1,
  lc: { py: { "two-sum": 2 }, cpp: {} }, lcCat: "0", lcSkip: ["pytwo-sum"] };

function memory(data = {}) {
  const values = new Map(Object.entries(data));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test("transfer round trips existing DRILL metadata without moving private text or changing the source", () => {
  const raw = JSON.stringify({ ...coach, attempts: [{ ...attempt, answer: "private", notes: "notes" }],
    active: { id: "unfinished" } });
  const source = memory({ "drill-v1": JSON.stringify(legacy), [model.key]: raw, theme: "light" });
  const snapshot = transfer.snapshot(source);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.equal(JSON.stringify(snapshot).includes("notes"), false);
  assert.equal(snapshot.communication.active, null);
  const file = transfer.parse(JSON.stringify(snapshot));
  const destination = memory();
  transfer.apply(destination, transfer.plan(destination, file));
  assert.deepEqual(JSON.parse(destination.getItem("drill-v1")), legacy);
  assert.deepEqual(model.load(destination), coach);
  assert.equal(destination.getItem("theme"), "light");
  assert.equal(source.getItem(model.key), raw);
  assert.deepEqual(transfer.plan(destination, file), []);
});

test("conflicting ratings keep the destination by default and can prefer the file explicitly", () => {
  const current = memory({ "drill-v1": JSON.stringify({ ...legacy, box: { cv0: 4 } }), theme: "dark" });
  const file = { drill: legacy, theme: "light", communication: coach };
  transfer.apply(current, transfer.plan(current, file));
  assert.equal(JSON.parse(current.getItem("drill-v1")).box.cv0, 4);
  assert.equal(current.getItem("theme"), "dark");
  transfer.apply(current, transfer.plan(current, file, true));
  assert.equal(JSON.parse(current.getItem("drill-v1")).box.cv0, 0);
  assert.equal(current.getItem("theme"), "light");
});

test("same-day identical attempts retain multiplicity and repeat imports do not inflate totals", () => {
  const current = memory({ [model.key]: JSON.stringify(coach) });
  const file = { communication: { ...coach, attempts: [attempt, attempt] } };
  transfer.apply(current, transfer.plan(current, file));
  assert.equal(model.progress(model.load(current)).attempts, 2);
  assert.deepEqual(transfer.plan(current, file), []);
});

test("invalid dates, ratings, prototype keys and unsupported schema versions cannot be imported", () => {
  const parse = value => transfer.parse(JSON.stringify({ format: "drill-progress", version: 1, ...value }));
  assert.throws(() => parse({ version: 2, drill: legacy }));
  assert.throws(() => parse({ drill: { ...legacy, box: JSON.parse('{"__proto__":4}') } }));
  assert.throws(() => parse({ communication: { ...coach, attempts: [{ ...attempt, day: "2026-02-30" }] } }));
  assert.throws(() => parse({ communication: { ...coach, attempts: [{ ...attempt, ratings: { ...ratings, accuracy: 9 } }] } }));
});

test("a failed write rolls back earlier keys and stale previews do not overwrite browser data", () => {
  const current = memory();
  const changes = transfer.plan(current, { drill: legacy, theme: "light" });
  const set = current.setItem;
  current.setItem = (key, value) => {
    if (key === "theme") throw new Error("quota");
    set(key, value);
  };
  assert.throws(() => transfer.apply(current, changes), /could not save/);
  assert.equal(current.getItem("drill-v1"), null);
  set("theme", "dark");
  assert.throws(() => transfer.apply(current, changes), /changed after the preview/);
  assert.equal(current.getItem("theme"), "dark");
});

test("new assessments store metadata and leave existing saved text untouched", () => {
  const current = memory({ [model.key]: JSON.stringify({ ...coach, attempts: [{ ...attempt, answer: "legacy" }] }) });
  const data = model.update(current, state => model.recordAttempt(state, { ...attempt, answer: "new", notes: "new" }));
  assert.equal(data.attempts[0].answer, "legacy");
  assert.equal(data.attempts[1].answer, undefined);
  assert.equal(data.attempts[1].notes, undefined);
});

const coachKey = "drill-ai-coach-v1";
const coachRow = (id, overall, extra = {}) => ({
  id, questionId: "iou", topic: "cv", category: "concept", at: `2026-11-2${id.length}T10:00:00.000Z`,
  model: "gpt-5.4-mini-2026-03-17", rubric: 1, overall, mock: false, reviewAt: null,
  scores: { accuracy: 3, depth: 3, structure: 3, clarity: 3, concise: 3, english: 3, reasoning: null, practical: 3 },
  ...extra
});

test("AI Coach scores transfer as metadata only, merge by id and never carry answers or feedback", () => {
  const stored = { version: 1, attempts: [coachRow("a", 3, {
    answer: "private answer", feedback: { improvedAnswer: "private example" }, notes: "private notes", transcript: "private"
  })] };
  const source = memory({ [coachKey]: JSON.stringify(stored) });
  const snapshot = transfer.snapshot(source);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.deepEqual(Object.keys(snapshot.aiCoach.attempts[0]).sort(),
    ["at", "category", "id", "mock", "model", "overall", "questionId", "reviewAt", "rubric", "scores", "topic"]);
  const file = transfer.parse(JSON.stringify(snapshot));

  const destination = memory({ [coachKey]: JSON.stringify({ version: 1, attempts: [coachRow("a", 2), coachRow("bb", 4)] }) });
  transfer.apply(destination, transfer.plan(destination, file));
  const merged = () => JSON.parse(destination.getItem(coachKey)).attempts;
  assert.deepEqual(merged().map(row => [row.id, row.overall]), [["a", 2], ["bb", 4]]);
  assert.deepEqual(transfer.plan(destination, file), []);
  transfer.apply(destination, transfer.plan(destination, file, true));
  assert.deepEqual(merged().map(row => [row.id, row.overall]), [["a", 3], ["bb", 4]]);
  assert.deepEqual(transfer.plan(destination, file, true), []);

  const empty = memory();
  transfer.apply(empty, transfer.plan(empty, file));
  assert.equal(empty.getItem(coachKey).includes("private"), false);
  assert.deepEqual(coachProgress.byQuestion(coachProgress.load(empty)).map(entry => entry.latest), [3]);
});

test("invalid AI Coach rows or versions cannot be imported", () => {
  const parse = aiCoach => transfer.parse(JSON.stringify({ format: "drill-progress", version: 1, aiCoach }));
  assert.throws(() => parse({ version: 2, attempts: [] }));
  assert.throws(() => parse({ version: 1, attempts: [coachRow("a", 9)] }));
  assert.throws(() => parse({ version: 1, attempts: [coachRow("a", 3, { scores: { accuracy: 7 } })] }));
  assert.throws(() => parse({ version: 1, attempts: [coachRow("Bad Id", 3)] }));
  assert.throws(() => parse({ version: 1, attempts: [coachRow("a", 3, { model: "other-model" })] }));
  assert.equal(parse({ version: 1, attempts: [] }).aiCoach.attempts.length, 0);
});

test("spoken self-assessments and AI scores keep their mode through transfer, and written rows are unchanged", () => {
  const spokenAttempt = { ...attempt, mode: "spoken" };
  const spokenRow = coachRow("sp", 2.5, { mode: "spoken", transcript: "private transcript" });
  const source = memory({
    [model.key]: JSON.stringify({ ...coach, attempts: [attempt, spokenAttempt] }),
    [coachKey]: JSON.stringify({ version: 1, attempts: [coachRow("wr", 3), spokenRow] })
  });
  const snapshot = transfer.snapshot(source);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
  assert.deepEqual(snapshot.communication.attempts.map(row => row.mode), [undefined, "spoken"]);
  assert.deepEqual(snapshot.aiCoach.attempts.map(row => row.mode), [undefined, "spoken"]);
  const destination = memory();
  const file = transfer.parse(JSON.stringify(snapshot));
  transfer.apply(destination, transfer.plan(destination, file));
  assert.deepEqual(model.load(destination).attempts, [attempt, spokenAttempt]);
  assert.deepEqual(transfer.plan(destination, file), []);
  // A spoken and a written attempt with the same ratings are different history entries.
  const merged = memory({ [model.key]: JSON.stringify({ ...coach, attempts: [attempt] }) });
  transfer.apply(merged, transfer.plan(merged, file));
  assert.equal(model.load(merged).attempts.length, 2);
  assert.throws(() => transfer.parse(JSON.stringify({ format: "drill-progress", version: 1,
    communication: { ...coach, attempts: [{ ...attempt, mode: "video" }] } })));
  assert.throws(() => transfer.parse(JSON.stringify({ format: "drill-progress", version: 1,
    aiCoach: { version: 1, attempts: [coachRow("x", 3, { mode: "video" })] } })));
});
