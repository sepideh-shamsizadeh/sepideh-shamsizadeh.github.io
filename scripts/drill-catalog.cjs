const { readFileSync, writeFileSync } = require("node:fs");
const vm = require("node:vm");
const content = require("../drill/communication/content.js");

const mount = {};
vm.runInNewContext(readFileSync("drill/drill.js", "utf8"), {
  document: { getElementById: id => id === "communication" ? mount : null }
});
const data = mount.questionBank;
const catalog = Object.fromEntries(content.questionBank(data.cards, data.topics).map(
  ({ id, category, prompt, example, reasoning }) => [
    id, { category, prompt, example, reasoning, structure: content.categories[category][1] }
  ]
));
const path = "backend/drill-coach/catalog.json";
const result = JSON.stringify(catalog, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== result) throw new Error("Run node scripts/drill-catalog.cjs after changing the DRILL bank.");
} else {
  writeFileSync(path, result);
}
