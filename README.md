# mcp-roadmapsh

[![npm](https://img.shields.io/npm/v/mcp-roadmapsh.svg)](https://www.npmjs.com/package/mcp-roadmapsh)
[![Node](https://img.shields.io/node/v/mcp-roadmapsh.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

MCP server for [roadmap.sh](https://roadmap.sh) — developer roadmaps, best
practices, interview questions, project ideas, videos, and local progress
tracking. Built on the official `@modelcontextprotocol/sdk` (TypeScript / stdio).

All data comes from official, public sources — no scraping, no mock data:

- `https://roadmap.sh/{slug}.json` — rendered roadmap graphs
- `raw.githubusercontent.com/nilbuild/developer-roadmap` — topic markdown
- GitHub contents API — dynamic slug listings

## Prerequisite

[Node.js](https://nodejs.org) **20 or newer** (`node --version` to check). That is
the only requirement — `npx` (bundled with Node) handles the rest, no manual
clone or build needed.

## Quick start

### Claude Code (one command)

```bash
# Once published to npm:
claude mcp add roadmapsh -- npx -y mcp-roadmapsh

# Works today, straight from GitHub (npx builds it for you):
claude mcp add roadmapsh -- npx -y github:aissablk1/mcp-roadmapsh
```

### Any MCP client (JSON config)

```json
{
  "mcpServers": {
    "roadmapsh": { "command": "npx", "args": ["-y", "mcp-roadmapsh"] }
  }
}
```

Replace `mcp-roadmapsh` with `github:aissablk1/mcp-roadmapsh` to run the latest
GitHub version before the npm release.

### From source (contributors)

```bash
git clone https://github.com/aissablk1/mcp-roadmapsh.git
cd mcp-roadmapsh
npm install        # `prepare` builds dist/ automatically
npm test           # end-to-end test against real data
node dist/index.js # stdio MCP server
npm run inspect    # open the MCP Inspector
```

## Tools

| Tool | Purpose |
|------|---------|
| `roadmap_diagnose` | Connectivity + cache/state status |
| `roadmap_list` | List all roadmap slugs |
| `roadmap_get` | Roadmap graph by slug (`outline` or `raw`) |
| `roadmap_topic` | Topic markdown + links (by `nodeId` or `query`) |
| `roadmap_export` | Export a whole roadmap as markdown/text |
| `roadmap_search` | Search slugs by keyword within a scope |
| `best_practices_list` / `best_practices_get` | Best-practice guides |
| `questions_list` / `questions_get` | Interview question groups |
| `projects_list` / `project_get` | Practice project ideas |
| `videos_list` | Video resources |
| `progress_mark` | Mark a topic learning / done / skip (local) |
| `progress_status` | Completion percent for a roadmap |
| `progress_next` | Recommend the next topic to learn |

## Configuration (env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ROADMAPSH_CACHE_DIR` | `~/.cache/mcp-roadmapsh` | HTTP cache directory |
| `ROADMAPSH_CACHE_TTL_MS` | `86400000` (24 h) | Cache TTL |
| `ROADMAPSH_STATE_DIR` | `~/.local/state/mcp-roadmapsh` | Progress state |
| `ROADMAPSH_TIMEOUT_MS` | `20000` | HTTP timeout |
| `ROADMAPSH_OWNER` | `nilbuild` | GitHub owner of the developer-roadmap repo |
| `ROADMAPSH_BRANCH` | `master` | developer-roadmap branch |
| `GITHUB_TOKEN` | — | Optional, raises GitHub API rate limit |

## Publishing (maintainers)

```bash
npm publish                       # to npmjs.com (npm login required first)
npx -y @modelcontextprotocol/publisher publish   # to the official MCP registry (server.json)
```

The package ships `mcpName` and a `server.json` so it can be listed in the
official Model Context Protocol registry.

## License

MIT — Aïssa BELKOUSSA
