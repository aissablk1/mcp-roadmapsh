// Turns a roadmap.sh graph (React-Flow style nodes/edges) into a readable outline.
export interface GraphNode { id: string; type?: string; data?: { label?: string; [k: string]: any }; position?: { x?: number; y?: number }; [k: string]: any }
export interface RoadmapGraph { title?: any; description?: string; slug?: string; nodes?: GraphNode[]; edges?: any[]; [k: string]: any }

const LEARN_TYPES = new Set(["topic", "subtopic"]);
const SECTION_TYPES = new Set(["title", "section"]);

// roadmap.sh embeds template tokens (e.g. "@currentYear@") in titles, descriptions
// and topic markdown; the site substitutes them at render time. We do the same so
// consumers never see raw placeholders. The year is resolved dynamically.
export function applyVars(s: string): string {
  if (!s) return s;
  return s.replace(/@currentYear@/g, String(new Date().getFullYear()));
}

export function graphTitle(graph: RoadmapGraph): string {
  const t = graph.title;
  if (typeof t === "string") return applyVars(t);
  if (t && typeof t === "object") return applyVars(t.page ?? t.card ?? graph.slug ?? "");
  return graph.slug ?? "";
}

export interface OutlineItem { id: string; type: string; label: string; y: number; x: number }
export interface Outline { slug: string; title: string; description?: string; topicCount: number; subtopicCount: number; items: OutlineItem[] }

function nodeLabel(n: GraphNode): string {
  const l = n.data?.label ?? (n as any).label ?? "";
  return String(l).replace(/\s+/g, " ").trim();
}

export function toOutline(graph: RoadmapGraph, slug: string): Outline {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const items: OutlineItem[] = [];
  for (const n of nodes) {
    const type = n.type ?? "";
    if (!LEARN_TYPES.has(type) && !SECTION_TYPES.has(type)) continue;
    const label = nodeLabel(n);
    if (!label) continue;
    items.push({ id: n.id, type, label, y: n.position?.y ?? 0, x: n.position?.x ?? 0 });
  }
  items.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return {
    slug,
    title: graphTitle(graph),
    description: graph.description ? applyVars(graph.description) : graph.description,
    topicCount: items.filter((i) => i.type === "topic").length,
    subtopicCount: items.filter((i) => i.type === "subtopic").length,
    items,
  };
}

export function renderOutlineText(o: Outline): string {
  const lines: string[] = [`# ${o.title} (${o.slug})`];
  if (o.description) lines.push("", o.description);
  lines.push("", `Topics: ${o.topicCount} · Subtopics: ${o.subtopicCount}`, "");
  for (const it of o.items) {
    const indent = it.type === "subtopic" ? "  - " : it.type === "topic" ? "- " : "## ";
    lines.push(`${indent}${it.label}  [${it.id}]`);
  }
  return applyVars(lines.join("\n"));
}
