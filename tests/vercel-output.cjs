const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const output = ".vercel/output";
const origin = "https://sepideh.io";
const read = path => readFileSync(`${output}/static/${path}`, "utf8");
const preview = process.argv[2] === "preview";

for (const route of ["", "drill/", "drill/communication/", "drill/transfer/", "tishtar/", "story/", "projects/", "publications/", "year-archive/"]) {
  const html = read(route + "index.html");
  assert.ok(html.includes(`rel="canonical" href="${origin}/${route}"`), route);
  assert.ok(html.includes('href="/assets/css/site.css"'), route);
  assert.equal(/name="robots" content="noindex, nofollow"/.test(html), preview, route);
}
const home = read("index.html");
for (const [label, href] of [["About", "/story/"], ["All projects", "/projects/"], ["Publications", "/publications/"], ["Blog", "/blog/"],
  ["CV", "/files/Sepideh-Shamsizadeh-CV.pdf"], ["DRILL", "/drill/"], ["TISHTAR", "/tishtar/"],
  ["Playground", "https://playground.sepideh.io/"], ["MiniDL", "https://github.com/sepideh-shamsizadeh/deep-learning"]]) {
  assert.ok(home.includes('href="' + href + '"') && home.includes('>' + label + '</a>'), label);
}
assert.match(home, /<summary>Projects<\/summary>/);
assert.match(home, /aria-controls="primary-nav" aria-expanded="false"/);
const projects = read("projects/index.html");
assert.equal((projects.match(/class="post-card"/g) ?? []).length, 10);
assert.match(projects, /href="https:\/\/playground\.sepideh\.io\/"/);
assert.match(read("publications/index.html"), /10\.1109\/ICRA57147\.2024\.10610347/);
assert.match(read("blog/index.html"), /https:\/\/sepideh\.io\/year-archive\//);
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
const coop = routes.find(route => route.headers?.["Cross-Origin-Opener-Policy"]);
assert.equal(coop?.headers["Cross-Origin-Opener-Policy"], "same-origin-allow-popups");
assert.ok(new RegExp(coop.src).test("/drill/communication/"));
assert.ok(!new RegExp(coop.src).test("/drill/"));
assert.equal(routes.at(-1).status, 404);
console.log(`Verified ${preview ? "preview" : "production"} routing and metadata.`);
