import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ghContentsUrl } from "./sources.js";

const DEFAULT_TTL_MS = Number(process.env.ROADMAPSH_CACHE_TTL_MS ?? 24 * 60 * 60 * 1000);
const TIMEOUT_MS = Number(process.env.ROADMAPSH_TIMEOUT_MS ?? 20_000);
const USER_AGENT = "mcp-roadmapsh/0.1.0 (+https://roadmap.sh)";

export function cacheDir(): string {
  return process.env.ROADMAPSH_CACHE_DIR
    ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "mcp-roadmapsh");
}

function ensureDir(d: string) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function cachePathFor(url: string): string {
  return join(cacheDir(), `${createHash("sha256").update(url).digest("hex")}.json`);
}

interface CacheEntry { url: string; fetchedAt: string; body: string }

function readCache(url: string, ttlMs: number): string | null {
  if (ttlMs <= 0) return null;
  const p = cachePathFor(url);
  if (!existsSync(p)) return null;
  try {
    const entry: CacheEntry = JSON.parse(readFileSync(p, "utf8"));
    if (Date.now() - new Date(entry.fetchedAt).getTime() > ttlMs) return null;
    return entry.body;
  } catch { return null; }
}

function writeCache(url: string, body: string) {
  try {
    ensureDir(cacheDir());
    const entry: CacheEntry = { url, fetchedAt: new Date().toISOString(), body };
    writeFileSync(cachePathFor(url), JSON.stringify(entry));
  } catch { /* cache is best-effort */ }
}

export interface FetchOpts { ttlMs?: number; noCache?: boolean }

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const ttl = opts.noCache ? 0 : (opts.ttlMs ?? DEFAULT_TTL_MS);
  const cached = readCache(url, ttl);
  if (cached !== null) return cached;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept": "application/vnd.github+json, text/plain, */*",
  };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com")) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (res.status === 404) throw new Error(`Not found (404): ${url}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    const body = await res.text();
    if (ttl > 0) writeCache(url, body);
    return body;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error(`Timeout after ${TIMEOUT_MS}ms: ${url}`);
    throw new Error(err?.message ?? String(err));
  } finally { clearTimeout(timer); }
}

export async function fetchJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try { return JSON.parse(text) as T; }
  catch { throw new Error(`Invalid JSON from ${url}`); }
}

export interface GhEntry { name: string; type: "file" | "dir" }
export async function ghListDir(path: string, opts: FetchOpts = {}): Promise<GhEntry[]> {
  const arr = await fetchJson<any[]>(ghContentsUrl(path), opts);
  if (!Array.isArray(arr)) throw new Error(`Expected a directory listing for ${path}`);
  return arr.map((e) => ({ name: e.name, type: e.type }));
}

export function cacheStats(): { dir: string; entries: number } {
  const dir = cacheDir();
  let entries = 0;
  try { if (existsSync(dir)) entries = readdirSync(dir).filter((f) => f.endsWith(".json")).length; } catch { /* ignore */ }
  return { dir, entries };
}
