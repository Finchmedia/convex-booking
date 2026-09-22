/** Check links, anchors and table rendering in the HTML from `npm run build`. */
import fs from "node:fs";
import path from "node:path";
const app = path.resolve(".next/server/app");
const pages = new Map();
function read(file) {
  const route = "/" + path.relative(app, file).replace(/\.html$/, "");
  const html = fs.readFileSync(file, "utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  pages.set(route, { html, ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])) });
}
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith(".html")) read(file);
  }
}
read(path.join(app, "docs.html"));
visit(path.join(app, "docs"));
const failures = new Set();
let checked = 0;
let tables = 0;
for (const [route, {html}] of pages) {
  const source = fs.readFileSync(path.join("app", route.slice(1), "page.mdx"), "utf8")
    .replace(/```[\s\S]*?```/g, "");
  const expectedTables = [...source.matchAll(/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/gm)].length;
  const renderedTables = [...html.matchAll(/<table\b/g)].length;
  tables += renderedTables;
  if (renderedTables !== expectedTables) {
    failures.add(`${route}: expected ${expectedTables} tables, rendered ${renderedTables}`);
  }
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = match[1];
    if (!href.startsWith("/docs") && !href.startsWith("#")) continue;
    const url = new URL(href, `https://docs.invalid${route}`);
    const target = pages.get(url.pathname.replace(/\/$/, ""));
    checked++;
    if (!target) failures.add(`${route}: missing documentation page ${href}`);
    else if (url.hash && !target.ids.has(decodeURIComponent(url.hash.slice(1)))) {
      failures.add(`${route}: missing section ${href}`);
    }
  }
}
for (const failure of failures) console.error(failure);
if (failures.size) process.exitCode = 1;
else console.log(`Verified ${checked} documentation links and ${tables} tables across ${pages.size} rendered pages.`);
