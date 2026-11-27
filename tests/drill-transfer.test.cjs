const { test } = require("node:test");
const assert = require("node:assert/strict");
const transfer = require("../drill/transfer/transfer.js");
const model = require("../drill/communication/model.js");

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
