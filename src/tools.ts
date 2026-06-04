import { z } from "zod";
import {
  roadmapGraphUrl, folderGraphRawUrl, folderMetaRawUrl, folderContentDirPath,
  flatMdRawUrl, dataDir, ghRawUrl, DataType,
} from "./sources.js";
import { fetchJson, fetchText, ghListDir, cacheStats, NotFoundError } from "./fetcher.js";
import { toOutline, renderOutlineText, graphTitle, applyVars, RoadmapGraph } from "./format.js";
import * as progress from "./progress.js";

const slug = z.string().min(1).max(100)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be lowercase kebab-case")
  .describe("roadmap.sh slug, e.g. 'frontend'");

// Node ids from roadmap.sh graphs are short alphanumeric tokens. Bound them the
// same way as slugs so an unvalidated value can never influence a fetched path
// or become an arbitrary object key in the local progress store.
const nodeId = z.string().min(1).max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "must be an alphanumeric node id");

// On a 404 the slug almost certainly doesn't exist → point the caller at the
// matching list tool. Any other failure (network, rate-limit, 5xx) is surfaced
// as-is so the caller isn't misled into thinking the slug is wrong.
function withHint(e: unknown, listTool: string): Error {
  if (e instanceof NotFoundError) return new Error(`${e.message}. Use ${listTool} to discover valid slugs.`);
  return e instanceof Error ? e : new Error(String(e));
}

// Map a node id to its content markdown filename (e.g. "title@<id>.md" or "<id>.md").
const findTopicFile = (mdFiles: string[], id: string): string | undefined =>
  mdFiles.find((n) => n.endsWith(`@${id}.md`) || n === `${id}.md`);

async function listSlugs(type: DataType): Promise<string[]> {
  const entries = await ghListDir(dataDir(type));
  const out: string[] = [];
  for (const e of entries) {
    if (e.type === "dir") out.push(e.name);
    else if (e.name.endsWith(".md")) out.push(e.name.slice(0, -3));
  }
  return out.sort();
}

/* ---------- roadmaps ---------- */
export const DiagnoseInput = z.object({});
export async function diagnose() {
  const result: any = { roadmapSh: false, github: false, cache: cacheStats(), stateDir: progress.stateDir() };
  try {
    const g = await fetchJson<RoadmapGraph>(roadmapGraphUrl("frontend"), { noCache: true });
    result.roadmapSh = Array.isArray(g.nodes) && g.nodes.length > 0;
  } catch (e: any) { result.roadmapShError = e.message; }
  try {
    const r = await ghListDir(dataDir("roadmaps"), { noCache: true });
    result.github = r.length > 0; result.roadmapCount = r.length;
  } catch (e: any) { result.githubError = e.message; }
  return result;
}

export const ListRoadmapsInput = z.object({});
export async function listRoadmaps() {
  const slugs = await listSlugs("roadmaps");
  return { count: slugs.length, slugs };
}

export const GetRoadmapInput = z.object({ slug, format: z.enum(["raw", "outline"]).default("outline") });
export async function getRoadmap(a: z.infer<typeof GetRoadmapInput>) {
  let graph: RoadmapGraph;
  try { graph = await fetchJson<RoadmapGraph>(roadmapGraphUrl(a.slug)); }
  catch (e) { throw withHint(e, "roadmap_list"); }
  if (a.format === "raw") return { slug: a.slug, title: graphTitle(graph), graph };
  const o = toOutline(graph, a.slug);
  return { slug: a.slug, title: o.title, topicCount: o.topicCount, subtopicCount: o.subtopicCount, outline: renderOutlineText(o), items: o.items };
}

export const TopicInput = z.object({
  slug,
  nodeId: nodeId.optional().describe("Exact node id from the outline"),
  query: z.string().min(1).max(200).optional().describe("Topic title substring, used if nodeId is unknown"),
}).refine((v) => v.nodeId || v.query, { message: "Provide nodeId or query" });
export async function topic(a: z.infer<typeof TopicInput>) {
  const dirPath = folderContentDirPath("roadmaps", a.slug);
  let files;
  try { files = await ghListDir(dirPath); }
  catch (e) { throw withHint(e, "roadmap_list"); }
  const mdFiles = files.filter((f) => f.type === "file" && f.name.endsWith(".md")).map((f) => f.name);
  let match: string | undefined;
  if (a.nodeId) match = findTopicFile(mdFiles, a.nodeId);
  if (!match && a.query) {
    const q = a.query.toLowerCase().replace(/\s+/g, "-");
    match = mdFiles.find((n) => n.toLowerCase().includes(q));
  }
  if (!match) {
    return { slug: a.slug, matched: false, hint: "No matching topic. Pass an exact nodeId from roadmap_get(format=outline).", candidates: mdFiles.slice(0, 30) };
  }
  const content = applyVars(await fetchText(ghRawUrl(`${dirPath}/${match}`)));
  return { slug: a.slug, matched: true, file: match, content };
}

export const SearchInput = z.object({
  query: z.string().min(1).max(200),
  scope: z.enum(["roadmaps", "best-practices", "question-groups", "projects", "videos"]).default("roadmaps"),
});
export async function search(a: z.infer<typeof SearchInput>) {
  const slugs = await listSlugs(a.scope as DataType);
  const q = a.query.toLowerCase();
  const matches = slugs.filter((s) => s.includes(q) || s.replace(/-/g, " ").includes(q));
  return { scope: a.scope, query: a.query, count: matches.length, matches };
}

/* ---------- best practices ---------- */
export const ListBPInput = z.object({});
export async function listBestPractices() { const slugs = await listSlugs("best-practices"); return { count: slugs.length, slugs }; }

export const GetBPInput = z.object({ slug, format: z.enum(["raw", "outline"]).default("outline") });
export async function getBestPractice(a: z.infer<typeof GetBPInput>) {
  let graph: RoadmapGraph;
  try { graph = await fetchJson<RoadmapGraph>(folderGraphRawUrl("best-practices", a.slug)); }
  catch (e) { throw withHint(e, "best_practices_list"); }
  if (a.format === "raw") return { slug: a.slug, title: graphTitle(graph), graph };
  const o = toOutline(graph, a.slug);
  return { slug: a.slug, title: o.title, itemCount: o.items.length, outline: renderOutlineText(o), items: o.items };
}

/* ---------- questions ---------- */
export const ListQInput = z.object({});
export async function listQuestions() { const slugs = await listSlugs("question-groups"); return { count: slugs.length, slugs }; }

export const GetQInput = z.object({ slug });
export async function getQuestions(a: z.infer<typeof GetQInput>) {
  let md: string;
  try { md = await fetchText(folderMetaRawUrl("question-groups", a.slug)); }
  catch (e) { throw withHint(e, "questions_list"); }
  return { slug: a.slug, markdown: md };
}

/* ---------- projects & videos ---------- */
export const ListProjectsInput = z.object({});
export async function listProjects() { const slugs = await listSlugs("projects"); return { count: slugs.length, slugs }; }

export const GetProjectInput = z.object({ slug });
export async function getProject(a: z.infer<typeof GetProjectInput>) {
  let md: string;
  try { md = await fetchText(flatMdRawUrl("projects", a.slug)); }
  catch (e) { throw withHint(e, "projects_list"); }
  return { slug: a.slug, markdown: md };
}

export const ListVideosInput = z.object({});
export async function listVideos() { const slugs = await listSlugs("videos"); return { count: slugs.length, slugs }; }

/* ---------- progress ---------- */
const statusEnum = z.enum(["learning", "done", "skip"]);
export const MarkInput = z.object({ roadmap: slug, nodeId, status: statusEnum, label: z.string().max(300).optional() });
export async function progressMark(a: z.infer<typeof MarkInput>) {
  const entry = progress.mark(a.roadmap, a.nodeId, a.status, a.label);
  return { roadmap: a.roadmap, nodeId: a.nodeId, entry };
}

export const StatusInput = z.object({ roadmap: slug });
export async function progressStatus(a: z.infer<typeof StatusInput>) {
  const graph = await fetchJson<RoadmapGraph>(roadmapGraphUrl(a.roadmap));
  const o = toOutline(graph, a.roadmap);
  const topics = o.items.filter((i) => i.type === "topic" || i.type === "subtopic");
  const state = progress.forRoadmap(a.roadmap);
  const done = topics.filter((t) => state[t.id]?.status === "done").length;
  const learning = topics.filter((t) => state[t.id]?.status === "learning").length;
  const skip = topics.filter((t) => state[t.id]?.status === "skip").length;
  const total = topics.length;
  return { roadmap: a.roadmap, total, done, learning, skip, remaining: total - done - skip, percent: total ? Math.round((done / total) * 100) : 0 };
}

export const NextInput = z.object({ roadmap: slug });
export async function progressNext(a: z.infer<typeof NextInput>) {
  const graph = await fetchJson<RoadmapGraph>(roadmapGraphUrl(a.roadmap));
  const o = toOutline(graph, a.roadmap);
  const state = progress.forRoadmap(a.roadmap);
  const next = o.items.find((i) => (i.type === "topic" || i.type === "subtopic") && !["done", "skip"].includes(state[i.id]?.status ?? ""));
  if (!next) return { roadmap: a.roadmap, done: true, message: "All topics are done or skipped." };
  return { roadmap: a.roadmap, done: false, next: { id: next.id, label: next.label, type: next.type }, hint: `Fetch detail with roadmap_topic(slug="${a.roadmap}", nodeId="${next.id}")` };
}

/* ---------- export ---------- */
// Bounded-concurrency map so a 120-topic roadmap doesn't open 120 sockets at once.
// `fn` must be infallible (handle its own errors) — a throw rejects the whole batch.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const worker = async () => { while (idx < items.length) { const i = idx++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return out;
}

// Strips common markdown syntax to plain text (LLM-friendly export, no external API).
function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```/g, "").trim())
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const ExportInput = z.object({
  slug,
  includeContent: z.boolean().default(true).describe("Fetch each topic's markdown; false returns structure only"),
  maxTopics: z.number().int().positive().optional().describe("Cap the number of topics fetched (default: all)"),
  format: z.enum(["markdown", "text"]).default("markdown").describe("Output format: markdown (default) or plain text for LLM ingestion"),
});
export async function exportRoadmap(a: z.infer<typeof ExportInput>) {
  const asFormat = (md: string) => (a.format === "text" ? toPlainText(md) : md);
  let graph: RoadmapGraph;
  try { graph = await fetchJson<RoadmapGraph>(roadmapGraphUrl(a.slug)); }
  catch (e) { throw withHint(e, "roadmap_list"); }
  const o = toOutline(graph, a.slug);
  const learnItems = o.items.filter((i) => i.type === "topic" || i.type === "subtopic");

  if (!a.includeContent) {
    return { slug: a.slug, title: o.title, includeContent: false, format: a.format, topicCount: o.topicCount, subtopicCount: o.subtopicCount, document: asFormat(renderOutlineText(o)) };
  }

  // One API listing call to map each nodeId to its content filename.
  const dirPath = folderContentDirPath("roadmaps", a.slug);
  let files;
  try { files = await ghListDir(dirPath); }
  catch (e) { throw withHint(e, "roadmap_list"); }
  const mdFiles = files.filter((f) => f.type === "file" && f.name.endsWith(".md")).map((f) => f.name);

  const capped = typeof a.maxTopics === "number" && a.maxTopics < learnItems.length;
  const targets = capped ? learnItems.slice(0, a.maxTopics) : learnItems;

  const sections = await mapPool(targets, 8, async (it) => {
    const file = findTopicFile(mdFiles, it.id);
    if (!file) return { it, ok: false, content: "" };
    try { return { it, ok: true, content: await fetchText(ghRawUrl(`${dirPath}/${file}`)) }; }
    catch { return { it, ok: false, content: "" }; }
  });

  const parts: string[] = [`# ${o.title}`, ""];
  if (o.description) parts.push(o.description, "");
  parts.push(`> Source: roadmap.sh/${a.slug} — ${targets.length}/${learnItems.length} topics${capped ? ` (capped at maxTopics=${a.maxTopics})` : ""}`, "");
  let fetched = 0, missing = 0;
  for (const s of sections) {
    parts.push(`${s.it.type === "subtopic" ? "###" : "##"} ${s.it.label}`, "");
    if (s.ok) { parts.push(s.content.trim(), ""); fetched++; }
    else { parts.push("_(no content available)_", ""); missing++; }
  }
  return { slug: a.slug, title: o.title, includeContent: true, format: a.format, topicsExported: targets.length, totalTopics: learnItems.length, fetched, missing, capped, document: asFormat(applyVars(parts.join("\n"))) };
}
