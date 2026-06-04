import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type Status = "learning" | "done" | "skip";
export interface Entry { status: Status; label?: string; updatedAt: string }
export type Store = Record<string, Record<string, Entry>>; // slug -> nodeId -> entry

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function stateDir(): string {
  return process.env.ROADMAPSH_STATE_DIR
    ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "mcp-roadmapsh");
}
function statePath(): string { return join(stateDir(), "progress.json"); }

// Parse the local store, stripping prototype-polluting keys and tolerating a
// corrupt/empty file by resetting to an empty store.
function parseStore(text: string): Store {
  try {
    const obj = JSON.parse(text, (k, v) => (RESERVED_KEYS.has(k) ? undefined : v));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Store) : {};
  } catch { return {}; }
}

export function load(): Store {
  const p = statePath();
  if (!existsSync(p)) return {};
  try { return parseStore(readFileSync(p, "utf8")); } catch { return {}; }
}

export function save(store: Store): void {
  const p = statePath();
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true });
  // Atomic write: serialize to a temp file then rename over the target. A crash
  // mid-write (or a concurrent writer) can never leave a truncated progress.json.
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, p);
}

export function mark(slug: string, nodeId: string, status: Status, label?: string): Entry {
  if (RESERVED_KEYS.has(slug) || RESERVED_KEYS.has(nodeId)) {
    throw new Error(`Reserved key not allowed: ${RESERVED_KEYS.has(slug) ? slug : nodeId}`);
  }
  const store = load();
  if (!Object.prototype.hasOwnProperty.call(store, slug)) store[slug] = {};
  const entry: Entry = { status, label, updatedAt: new Date().toISOString() };
  store[slug][nodeId] = entry;
  save(store);
  return entry;
}

export function forRoadmap(slug: string): Record<string, Entry> {
  return load()[slug] ?? {};
}
