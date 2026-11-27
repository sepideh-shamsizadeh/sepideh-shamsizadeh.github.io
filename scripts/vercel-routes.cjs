const { readFileSync, writeFileSync } = require("node:fs");

const output = ".vercel/output";
const aliases = JSON.parse(readFileSync(`${output}/static/redirects.json`, "utf8"));
const routes = [];
if (process.argv[2] === "preview") {
  routes.push({ src: "/.*", headers: { "X-Robots-Tag": "noindex, nofollow" }, continue: true });
}
for (const [path, destination] of Object.entries(aliases)) {
  const target = new URL(destination, "https://sepideh.io");
  if (target.protocol !== "https:") throw new Error("Invalid redirect target");
  const location = target.origin === "https://sepideh.io" ? target.pathname + target.search + target.hash : target.href;
  const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  routes.push({ src: `^${pattern.replace(/\/$/, "")}${path.endsWith("/") ? "/?" : ""}$`, status: 308, headers: { Location: location } });
}
routes.push({ src: "^/$", dest: "/index.html" });
routes.push({ src: "^/(.*)/$", dest: "/$1/index.html", check: true });
routes.push({ handle: "filesystem" });
routes.push({ src: "^/(.*)$", dest: "/$1/index.html", check: true });
routes.push({ src: "/.*", status: 404, dest: "/404.html" });
writeFileSync(`${output}/config.json`, JSON.stringify({ version: 3, routes }, null, 2));
