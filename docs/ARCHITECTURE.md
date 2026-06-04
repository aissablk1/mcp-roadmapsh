# Architecture — mcp-roadmapsh

A small, single-process MCP server (stdio transport) that exposes roadmap.sh data
to MCP clients. Layered, with acyclic dependencies and pure formatting isolated
for testability.

## Module map

```
index.ts      Tool registry + MCP dispatch (zod parse → handler → JSON response,
              error normalization). Entry point with the #!/usr/bin/env node shebang.
   │
tools.ts      The 16 tool handlers. Orchestrate: fetch → format → response.
              Owns input schemas (slug / nodeId / query validation).
   ├── sources.ts    Pure URL builders + validated env (owner/branch). No I/O.
   ├── fetcher.ts    HTTP (fetch) + disk cache (TTL) + GitHub dir listing.
   │                 Owns NotFoundError, timeout, token scoping, safe JSON parse.
   ├── format.ts     Graph → readable outline + @currentYear@ substitution. Pure.
   └── progress.ts   Local learning state (atomic JSON read/modify/write).
```

Dependency direction: `index → tools → {sources, fetcher, format, progress}`,
`fetcher → sources`. No cycles.

## Data sources (official, public — no scraping)

| Source | URL | Used by |
|--------|-----|---------|
| Rendered roadmap graph | `https://roadmap.sh/{slug}.json` | `roadmap_get`, `progress_*`, `roadmap_export` |
| Topic / guide markdown | `raw.githubusercontent.com/{owner}/developer-roadmap/{branch}/...` | `roadmap_topic`, `questions_get`, `project_get`, `roadmap_export` |
| Directory listings | `api.github.com/repos/{owner}/developer-roadmap/contents/...` | `*_list`, slug discovery |

`{owner}` and `{branch}` default to `nilbuild` / `master` and are overridable via
`ROADMAPSH_OWNER` / `ROADMAPSH_BRANCH` (validated at startup).

## Caching

`fetcher.ts` caches successful GET bodies on disk, keyed by `sha256(url)`, under
`ROADMAPSH_CACHE_DIR` (default XDG cache). TTL is `ROADMAPSH_CACHE_TTL_MS`
(default 24 h). Only successes are cached; the cache is best-effort (failures to
read/write never break a request). `noCache: true` bypasses it (used by
`roadmap_diagnose`).

## Error model

- HTTP 404 → typed `NotFoundError`. Handlers translate it into a "Use
  `<tool>_list` to discover valid slugs" hint — but **only** for 404s.
- Timeouts (`AbortController`) and non-OK responses → plain `Error` with the
  status/URL, surfaced to the MCP client unchanged so it can decide its next step.
- `index.ts` converts zod failures into `Invalid arguments: ...` and any other
  throw into a stable string (never `undefined`).

## Security model

- **Token scoping**: `GITHUB_TOKEN` is sent only when the request hostname is
  exactly `api.github.com` (strict equality).
- **Input bounds**: `slug`, `nodeId`, `query` are length- and pattern-constrained
  via zod; `slug` is strictly lowercase kebab-case.
- **Env validation**: `ROADMAPSH_OWNER` / `ROADMAPSH_BRANCH` are validated at load
  so they cannot inject path/host segments.
- **Prototype-pollution defense**: all untrusted JSON is parsed with a reviver
  that drops `__proto__` / `constructor` / `prototype`; the progress store also
  rejects those as node ids.
- **Atomic state writes**: `progress.json` is written via temp file + rename.

## Testing

`test-all.mjs` spawns the built server over stdio and exercises every tool
against live data (no mocks), plus negative cases for input validation and error
quality. Target: 0 failures before any release.
