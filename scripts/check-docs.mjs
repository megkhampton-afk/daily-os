import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const root = existsSync(join(project, "template/README.md")) ? join(project, "template") : project;
const files = ["README.md", ...readdirSync(join(root, "docs")).filter((file) => file.endsWith(".md")).map((file) => `docs/${file}`)];
let links = 0;
for (const file of files) {
  const text = readFileSync(join(root, file), "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const path = resolve(join(root, file, ".."), decodeURIComponent(target.split("#")[0]));
    assert.ok(existsSync(path), `Broken documentation link in ${file}: ${target}`);
    links++;
  }
}
assert.ok(readFileSync(join(root, "README.md"), "utf8").includes("Node.js 24"));
assert.ok(existsSync(join(root, "LICENSE")));
console.log(`Documentation checks passed (${files.length} guides, ${links} local links, license present).`);
