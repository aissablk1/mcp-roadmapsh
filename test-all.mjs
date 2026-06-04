// End-to-end test against the REAL roadmap.sh + GitHub data (no mocks, per project rules).
// Spawns the built server over stdio via the MCP SDK client and exercises every tool.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "mcp-roadmapsh-"));
let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.error(`  FAIL ${name} ${detail}`); }
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, ROADMAPSH_STATE_DIR: join(tmp, "state"), ROADMAPSH_CACHE_DIR: join(tmp, "cache") },
});
const client = new Client({ name: "test-all", version: "0.0.0" }, { capabilities: {} });

async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(`${name} errored: ${r.content?.[0]?.text}`);
  return JSON.parse(r.content[0].text);
}

// Asserts a tool call fails (isError) and the message contains `substr`.
async function expectError(name, label, args, substr) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  check(label, r.isError === true && (!substr || text.includes(substr)), `isError=${r.isError} text=${text.slice(0, 100)}`);
}

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  check("listTools returns 16 tools", tools.length === 16, `got ${tools.length}`);

  const diag = await call("roadmap_diagnose");
  check("diagnose: roadmap.sh reachable", diag.roadmapSh === true, JSON.stringify(diag.roadmapShError ?? ""));
  check("diagnose: github reachable", diag.github === true, JSON.stringify(diag.githubError ?? ""));

  const list = await call("roadmap_list");
  check("roadmap_list has many slugs", list.count > 30, `count=${list.count}`);
  check("roadmap_list includes frontend", list.slugs.includes("frontend"));

  const fe = await call("roadmap_get", { slug: "frontend", format: "outline" });
  check("roadmap_get outline has topics", fe.topicCount > 0, `topicCount=${fe.topicCount}`);
  check("roadmap_get outline text non-empty", typeof fe.outline === "string" && fe.outline.length > 50);
  check("roadmap_get outline substitutes @currentYear@", !fe.outline.includes("@currentYear@"), "raw placeholder leaked");
  const firstTopic = fe.items.find((i) => i.type === "topic");
  check("roadmap_get has a topic node id", !!firstTopic);

  const topic = await call("roadmap_topic", { slug: "frontend", nodeId: firstTopic.id });
  check("roadmap_topic matched content", topic.matched === true, JSON.stringify(topic.hint ?? ""));
  check("roadmap_topic content non-empty", typeof topic.content === "string" && topic.content.length > 0);

  const raw = await call("roadmap_get", { slug: "frontend", format: "raw" });
  check("roadmap_get raw returns graph", Array.isArray(raw.graph?.nodes) && raw.graph.nodes.length > 0);

  const exp = await call("roadmap_export", { slug: "frontend", maxTopics: 3 });
  check("roadmap_export fetched topics", exp.fetched >= 1, `fetched=${exp.fetched}`);
  check("roadmap_export respects maxTopics cap", exp.topicsExported === 3 && exp.capped === true, `exported=${exp.topicsExported}`);
  check("roadmap_export markdown has headings", typeof exp.document === "string" && exp.document.includes("## "));
  const expTxt = await call("roadmap_export", { slug: "frontend", maxTopics: 2, format: "text" });
  check("roadmap_export text format strips markdown", expTxt.format === "text" && !expTxt.document.includes("## ") && expTxt.document.length > 20);
  const expStruct = await call("roadmap_export", { slug: "frontend", includeContent: false });
  check("roadmap_export structure-only", expStruct.includeContent === false && expStruct.document.length > 50);

  const srch = await call("roadmap_search", { query: "react", scope: "roadmaps" });
  check("roadmap_search finds react", srch.matches.includes("react"), JSON.stringify(srch.matches));

  const bp = await call("best_practices_list");
  check("best_practices_list non-empty", bp.count > 0, `count=${bp.count}`);
  const bpGet = await call("best_practices_get", { slug: bp.slugs[0], format: "outline" });
  check("best_practices_get returns items", bpGet.itemCount >= 0 && typeof bpGet.outline === "string");

  const q = await call("questions_list");
  check("questions_list non-empty", q.count > 0, `count=${q.count}`);
  const qGet = await call("questions_get", { slug: q.slugs.includes("javascript") ? "javascript" : q.slugs[0] });
  check("questions_get returns markdown", typeof qGet.markdown === "string" && qGet.markdown.length > 0);

  const proj = await call("projects_list");
  check("projects_list non-empty", proj.count > 0, `count=${proj.count}`);
  const projGet = await call("project_get", { slug: proj.slugs[0] });
  check("project_get returns markdown", typeof projGet.markdown === "string" && projGet.markdown.length > 0);

  const vids = await call("videos_list");
  check("videos_list responds", typeof vids.count === "number", `count=${vids.count}`);

  const marked = await call("progress_mark", { roadmap: "frontend", nodeId: firstTopic.id, status: "done", label: firstTopic.label });
  check("progress_mark stores done", marked.entry.status === "done");

  const status = await call("progress_status", { roadmap: "frontend" });
  check("progress_status counts the done topic", status.done >= 1, `done=${status.done}`);
  check("progress_status percent in range", status.percent >= 0 && status.percent <= 100);

  const next = await call("progress_next", { roadmap: "frontend" });
  check("progress_next returns a suggestion", next.done === true || !!next.next?.id);

  // --- Input validation & error-quality hardening (0.2.0) ---
  await expectError("roadmap_get", "rejects uppercase slug (no /i)", { slug: "Frontend" }, "Invalid arguments");
  await expectError("roadmap_get", "rejects path-traversal slug", { slug: "../secrets" }, "Invalid arguments");
  await expectError("roadmap_topic", "rejects non-alphanumeric nodeId", { slug: "frontend", nodeId: "../../etc" }, "Invalid arguments");
  await expectError("progress_mark", "rejects __proto__ nodeId", { roadmap: "frontend", nodeId: "__proto__", status: "done" }, "Reserved key");
  const nf = await client.callTool({ name: "roadmap_get", arguments: { slug: "definitely-not-a-real-roadmap-xyz" } });
  check("roadmap_get 404 suggests roadmap_list", nf.isError === true && (nf.content?.[0]?.text ?? "").includes("roadmap_list"), (nf.content?.[0]?.text ?? "").slice(0, 120));

  await client.close();
} catch (err) {
  fail++;
  console.error("FATAL:", err.message);
  try { await client.close(); } catch {}
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
