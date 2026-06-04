# Contributing to mcp-roadmapsh

Thanks for your interest! This is a small, focused MCP server — contributions
that keep it lean and correct are very welcome.

## Prerequisites

- Node.js **≥ 20**
- npm (bundled with Node)

## Development loop

```bash
npm install          # installs deps; `prepare` builds dist/ automatically
npm run dev          # run from source via tsx (no build step)
npm run typecheck    # tsc --noEmit
npm run build        # emit dist/
npm test             # end-to-end test against REAL roadmap.sh + GitHub data
npm run inspect      # open the MCP Inspector against the built server
```

## Principles

- **Real data only** — there are no mocks. Tests spawn the built server over
  stdio and hit the live roadmap.sh and GitHub sources. Keep it that way.
- **No scraping** — only the documented official endpoints (see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).
- **Validate every input** — tool arguments are constrained with zod; new inputs
  that influence a fetched path or a stored key must be bounded (see `slug` /
  `nodeId` in `src/tools.ts`).
- **Keep it proportionate** — this server does not need a DI container, a plugin
  system, or an abstraction layer per source. Prefer the smallest correct change.

## Tests

Add a `check(...)` assertion in `test-all.mjs` for any new behavior. For negative
cases (validation, error quality), use the `expectError(...)` helper. Run
`npm test` and ensure **0 failed** before opening a PR.

## Commits

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Stage
files explicitly (no `git add -A`). Never commit code with failing tests.

## Releasing (maintainers)

1. Bump `version` in **both** `package.json` and `server.json` (and the npm
   package version inside `server.json` → `packages[0].version`).
2. Update `CHANGELOG.md`.
3. `npm test` → green.
4. `npm publish` (npm login required; 2FA set to "Authorization only" or use an
   automation token).
5. `mcp-publisher publish` to update the official MCP registry entry.
