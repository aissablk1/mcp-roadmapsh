import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export type Status = "learning" | "done" | "skip";
export interface Entry { status: Status; label?: string; updatedAt: string }
export type Store = Record<string, Record<string, Entry>>; // slug -> nodeId -> entry

export function stateDir(): string {
  return process.env.ROADMAPSH_STATE_DIR
    ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "mcp-roadmapsh");
}
function statePath(): string { return join(stateDir(), "progress.json"); }

export function load(): Store {
  const p = statePath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")) as Store; } catch { return {}; }
}

export function save(store: Store): void {
  const p = statePath();
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(store, null, 2));
}

export function mark(slug: string, nodeId: string, status: Status, label?: string): Entry {
  const store = load();
  store[slug] ??= {};
  const entry: Entry = { status, label, updatedAt: new Date().toISOString() };
  store[slug][nodeId] = entry;
  save(store);
  return entry;
}

export function forRoadmap(slug: string): Record<string, Entry> {
  return load()[slug] ?? {};
}
