import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ghContentsUrl } from "./sources.js";

// Parse a non-negative-integer env var, falling back when unset, empty, or
// non-numeric. Number("") === 0 would otherwise silently disable the cache or
// zero out the timeout.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const DEFAULT_TTL_MS = envInt("ROADMAPSH_CACHE_TTL_MS", 24 * 60 * 60 * 1000);
// A 0/invalid timeout would abort every request instantly, so force a sane floor.
const TIMEOUT_MS = envInt("ROADMAPSH_TIMEOUT_MS", 20_000) || 20_000;
const USER_AGENT = "mcp-roadmapsh/0.2.0 (+https://roadmap.sh)";

/** Thrown on HTTP 404 so callers can distinguish "no such slug" from a real
 *  network/server failure and tailor their guidance accordingly. */
export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found (404): ${url}`);
    this.name = "NotFoundError";
  }
}

// Reject prototype-polluting keys when parsing untrusted JSON (remote responses
// and the local cache/state files).
function safeJsonParse<T>(text: string): T {
  return JSON.parse(text, (key, value) =>
    key === "__proto__" || key === "constructor" || key === "prototype" ? undefined : value,
  ) as T;
}

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
    const entry = safeJsonParse<CacheEntry>(readFileSync(p, "utf8"));
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
  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      "Accept": "application/vnd.github+json, text/plain, */*",
    };
    // Attach the token ONLY to genuine api.github.com requests. A strict hostname
    // equality check (not startsWith) prevents leaking the Bearer token to a
    // look-alike host such as "https://api.github.com.attacker.example".
    if (process.env.GITHUB_TOKEN) {
      let host = "";
      try { host = new URL(url).hostname; } catch { /* malformed url → no token */ }
      if (host === "api.github.com") headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (res.status === 404) throw new NotFoundError(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    const body = await res.text();
    if (ttl > 0) writeCache(url, body);
    return body;
  } catch (err: any) {
    if (err instanceof NotFoundError) throw err;
    if (err?.name === "AbortError") throw new Error(`Timeout after ${TIMEOUT_MS}ms: ${url}`);
    throw new Error(err?.message ?? String(err));
  } finally { clearTimeout(timer); }
}

export async function fetchJson<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try { return safeJsonParse<T>(text); }
  catch { throw new Error(`Invalid JSON from ${url}`); }
}

export interface GhEntry { name: string; type: "file" | "dir" }
export async function ghListDir(path: string, opts: FetchOpts = {}): Promise<GhEntry[]> {
  const arr = await fetchJson<unknown>(ghContentsUrl(path), opts);
  // GitHub returns a JSON object (not an array) for rate-limit / error bodies even
  // with HTTP 200 in some proxies, so validate the shape before trusting it.
  if (!Array.isArray(arr)) throw new Error(`Expected a directory listing for ${path} (got ${typeof arr})`);
  const out: GhEntry[] = [];
  for (const e of arr) {
    if (e && typeof e === "object"
      && typeof (e as any).name === "string"
      && typeof (e as any).type === "string") {
      out.push({ name: (e as any).name, type: (e as any).type as "file" | "dir" });
    }
  }
  if (out.length === 0 && arr.length > 0) {
    throw new Error(`Unexpected directory listing shape for ${path}`);
  }
  return out;
}

export function cacheStats(): { dir: string; entries: number } {
  const dir = cacheDir();
  let entries = 0;
  try { if (existsSync(dir)) entries = readdirSync(dir).filter((f) => f.endsWith(".json")).length; } catch { /* ignore */ }
  return { dir, entries };
}
