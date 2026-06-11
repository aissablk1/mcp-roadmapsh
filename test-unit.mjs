// Offline unit tests for the pure, deterministic functions (no network).
// The graph below is a fixture: a real-shaped roadmap.sh graph used as plain
// function input — NOT a mock of any service (project rule: no service mocks).
// Run after `npm run build`. Complements the network e2e suite in test-all.mjs.
import { toOutline, renderOutlineText, graphTitle } from "./dist/format.js";
import { toPlainText } from "./dist/tools.js";
import { VERSION } from "./dist/version.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name} ${detail}`); }
}

// --- Fixture: a minimal roadmap graph (React-Flow node shape), out of order. ---
const fixture = {
  title: { page: "Test Roadmap" },
  description: "A small roadmap for unit testing.",
  slug: "test",
  nodes: [
    { id: "n-sub", type: "subtopic", data: { label: "Sub Topic" }, position: { x: 10, y: 200 } },
    { id: "n-top", type: "topic", data: { label: "Main Topic" }, position: { x: 0, y: 100 } },
    { id: "n-sec", type: "title", data: { label: "Section" }, position: { x: 0, y: 0 } },
    { id: "n-noise", type: "button", data: { label: "Ignore me" }, position: { x: 0, y: 50 } },
    { id: "n-empty", type: "topic", data: { label: "   " }, position: { x: 0, y: 300 } },
  ],
};

// --- graphTitle ---
check("graphTitle reads nested page title", graphTitle(fixture) === "Test Roadmap");
check("graphTitle falls back to slug", graphTitle({ slug: "only-slug" }) === "only-slug");
check("graphTitle handles plain string title", graphTitle({ title: "Plain" }) === "Plain");

// --- toOutline ---
const o = toOutline(fixture, "test");
check("toOutline counts 1 topic", o.topicCount === 1, `topicCount=${o.topicCount}`);
check("toOutline counts 1 subtopic", o.subtopicCount === 1, `subtopicCount=${o.subtopicCount}`);
check("toOutline drops empty-label nodes", o.items.every((i) => i.label.trim().length > 0));
check("toOutline drops non-learn/section nodes", !o.items.some((i) => i.id === "n-noise"));
check("toOutline sorts by y then x", o.items.map((i) => i.id).join(",") === "n-sec,n-top,n-sub",
  o.items.map((i) => i.id).join(","));

// --- renderOutlineText ---
const text = renderOutlineText(o);
check("renderOutlineText includes title + slug", text.includes("Test Roadmap") && text.includes("(test)"));
check("renderOutlineText indents subtopic deeper than topic",
  text.includes("- Main Topic  [n-top]") && text.includes("  - Sub Topic  [n-sub]"));

// --- toPlainText ---
const md = "# Heading\n\nSome **bold** and *italic* and `code`.\n\n> a quote\n\n[link](https://x.io)\n\n![img](a.png)\n\n```\nkeep me\n```";
const plain = toPlainText(md);
check("toPlainText strips heading marks", !plain.includes("# "));
check("toPlainText strips bold/italic/code marks", !plain.includes("**") && !plain.includes("`"));
check("toPlainText keeps code block body", plain.includes("keep me"));
check("toPlainText removes images", !plain.includes("!["));
check("toPlainText keeps link text with url", plain.includes("link (https://x.io)"));

// --- version single-source ---
check("VERSION matches package.json", VERSION === pkg.version, `VERSION=${VERSION} pkg=${pkg.version}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
