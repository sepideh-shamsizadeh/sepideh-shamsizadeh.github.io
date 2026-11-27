const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const output = ".vercel/output";
const origin = "https://sepideh.io";
const read = path => readFileSync(`${output}/static/${path}`, "utf8");
const preview = process.argv[2] === "preview";

for (const route of ["", "drill/", "drill/communication/", "drill/transfer/", "tishtar/", "story/", "year-archive/"]) {
  const html = read(route + "index.html");
  assert.ok(html.includes(`rel="canonical" href="${origin}/${route}"`), route);
  assert.ok(html.includes('href="/assets/css/site.css"'), route);
  assert.equal(/name="robots" content="noindex, nofollow"/.test(html), preview, route);
}
for (const path of ["404.html", "cv/index.html", "files/Sepideh-Shamsizadeh-CV.pdf"]) {
  assert.ok(existsSync(`${output}/static/${path}`), path);
}
assert.match(read("robots.txt"), /^Sitemap: https:\/\/sepideh\.io\/sitemap.xml/m);
assert.match(read("sitemap.xml"), /<loc>https:\/\/sepideh\.io\/drill\/<\/loc>/);
assert.match(read("feed.xml"), /https:\/\/sepideh\.io/);
assert.equal(existsSync(`${output}/static/backend`), false);
// Production connects the AI Coach to its Worker; previews (not an allowed origin) stay disconnected.
const coachApi = read("drill/communication/index.html").match(/data-coach-api="([^"]*)"/)?.[1];
assert.equal(coachApi, preview ? "" : "https://drill-coach.sepideh-io.workers.dev");
const { version, routes } = JSON.parse(readFileSync(`${output}/config.json`, "utf8"));
assert.equal(version, 3);
assert.equal(routes.some(route => route.headers?.["X-Robots-Tag"]), preview);
assert.ok(routes.some(route => route.status === 308 && route.headers.Location === "/files/Sepideh-Shamsizadeh-CV.pdf"));
assert.ok(routes.some(route => route.status === 308 && route.headers.Location.startsWith("https://medium.com/")));
assert.ok(routes.some(route => route.src === "^/$" && route.dest === "/index.html"));
assert.equal(routes.at(-1).status, 404);
console.log(`Verified ${preview ? "preview" : "production"} routing and metadata.`);
