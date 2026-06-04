# Changelog

All notable changes to **mcp-roadmapsh** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project adheres to
[Semantic Versioning](https://semver.org).

## [0.2.0] — 2026-06-04

### Security
- Attach the `GITHUB_TOKEN` only to requests whose hostname is exactly
  `api.github.com` (strict equality instead of `startsWith`), preventing the
  Bearer token from leaking to a look-alike host.
- Validate `ROADMAPSH_OWNER` / `ROADMAPSH_BRANCH` at startup against a strict
  pattern, blocking path/host injection into the GitHub URLs the server fetches.
- Bound `nodeId` and `query` tool inputs (regex + max length) like `slug`, and
  reject the reserved keys `__proto__` / `constructor` / `prototype` as progress
  node ids.
- Parse all untrusted JSON (remote responses and the local cache/state files)
  with a reviver that strips prototype-polluting keys.

### Fixed
- `slug` validation is now strictly lowercase — removed the case-insensitive
  flag that accepted capitalized slugs which never resolve.
- Empty or invalid `ROADMAPSH_CACHE_TTL_MS` / `ROADMAPSH_TIMEOUT_MS` no longer
  silently disable the cache or zero the request timeout (`Number("") === 0`).
- Validate the GitHub directory-listing shape before use, avoiding `TypeError`
  crashes when GitHub returns a rate-limit/error body.
- `progress.json` is written atomically (temp file + rename) so a crash or
  concurrent write can never leave it truncated.
- Non-`Error` throws no longer surface as `undefined` in tool error messages.

### Changed
- 404 responses throw a typed `NotFoundError`; the "Use `<tool>_list`" hint is
  shown only for genuine 404s, not for network/5xx failures.
- De-duplicated the topic-file resolution shared by `roadmap_topic` and
  `roadmap_export`.

> Note: publishing 0.2.0 requires `npm publish` (then `mcp-publisher publish`) —
> see CONTRIBUTING.md.

## [0.1.0] — 2026-06-04

- Initial release: 16 tools over official roadmap.sh / developer-roadmap data
  (roadmaps, best practices, interview questions, projects, videos, local
  progress tracking). Published on npm and the official MCP registry.
