# mcp-roadmapsh

MCP server for [roadmap.sh](https://roadmap.sh) — developer roadmaps, best
practices, interview questions, project ideas, videos, and local progress
tracking. Built on the official `@modelcontextprotocol/sdk` (TypeScript / stdio).

All data comes from official, public sources — no scraping, no mock data:

- `https://roadmap.sh/{slug}.json` — rendered roadmap graphs
- `raw.githubusercontent.com/nilbuild/developer-roadmap` — topic markdown
- GitHub contents API — dynamic slug listings

## Install & build

```bash
npm install
npm run build
```

## Run

```bash
node dist/index.js          # stdio MCP server
npm run inspect             # open the MCP Inspector
npm test                    # end-to-end test against real data
```

## Tools

| Tool | Purpose |
|------|---------|
| `roadmap_diagnose` | Connectivity + cache/state status |
| `roadmap_list` | List all roadmap slugs |
| `roadmap_get` | Roadmap graph by slug (`outline` or `raw`) |
| `roadmap_topic` | Topic markdown + links (by `nodeId` or `query`) |
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
| `ROADMAPSH_BRANCH` | `master` | developer-roadmap branch |
| `GITHUB_TOKEN` | — | Optional, raises GitHub API rate limit |

## Claude Code registration

```json
{
  "mcpServers": {
    "roadmapsh": { "command": "node", "args": ["/absolute/path/to/mcp-roadmapsh/dist/index.js"] }
  }
}
```

## License

MIT — Aïssa BELKOUSSA
