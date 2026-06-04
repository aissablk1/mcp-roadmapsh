#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as T from "./tools.js";

interface ToolDef { name: string; description: string; schema: ZodTypeAny; handler: (a: any) => any; readOnly: boolean }
const ro = (name: string, description: string, schema: ZodTypeAny, handler: (a: any) => any): ToolDef =>
  ({ name, description, schema, handler, readOnly: true });

const tools: ToolDef[] = [
  ro("roadmap_diagnose", "Check connectivity to roadmap.sh and GitHub, and report cache/state status.", T.DiagnoseInput, T.diagnose),
  ro("roadmap_list", "List all available roadmap slugs (role-based and skill-based).", T.ListRoadmapsInput, T.listRoadmaps),
  ro("roadmap_get", "Get a roadmap by slug. format=outline returns a readable topic plan with node ids; format=raw returns the full graph JSON.", T.GetRoadmapInput, T.getRoadmap),
  ro("roadmap_topic", "Get the markdown content and curated links for one topic of a roadmap (by nodeId from the outline, or by query).", T.TopicInput, T.topic),
  ro("roadmap_search", "Search roadmap.sh slugs by keyword within a scope (roadmaps, best-practices, question-groups, projects, videos).", T.SearchInput, T.search),
  ro("roadmap_export", "Export an entire roadmap as a single markdown document (all topics' content concatenated). includeContent=false returns structure only; maxTopics caps the count.", T.ExportInput, T.exportRoadmap),
  ro("best_practices_list", "List all best-practice slugs.", T.ListBPInput, T.listBestPractices),
  ro("best_practices_get", "Get a best-practice guide by slug (outline or raw graph).", T.GetBPInput, T.getBestPractice),
  ro("questions_list", "List all interview question-group slugs.", T.ListQInput, T.listQuestions),
  ro("questions_get", "Get the interview questions markdown for a question-group slug.", T.GetQInput, T.getQuestions),
  ro("projects_list", "List all practice-project slugs.", T.ListProjectsInput, T.listProjects),
  ro("project_get", "Get the markdown brief for one practice project by slug.", T.GetProjectInput, T.getProject),
  ro("videos_list", "List all video resource slugs.", T.ListVideosInput, T.listVideos),
  { name: "progress_mark", description: "Mark a roadmap topic as learning, done, or skip (stored locally).", schema: T.MarkInput, handler: T.progressMark, readOnly: false },
  ro("progress_status", "Get local progress for a roadmap: counts and completion percent.", T.StatusInput, T.progressStatus),
  ro("progress_next", "Recommend the next unlearned topic for a roadmap based on local progress.", T.NextInput, T.progressNext),
];

const server = new Server({ name: "mcp-roadmapsh", version: "0.2.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name, description: t.description,
    inputSchema: zodToJsonSchema(t.schema, { target: "jsonSchema7" }) as any,
    annotations: { readOnlyHint: t.readOnly, destructiveHint: false, idempotentHint: t.readOnly, openWorldHint: true },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  try {
    const parsed = tool.schema.parse(req.params.arguments ?? {});
    const result = await tool.handler(parsed);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result as any };
  } catch (err) {
    const msg = err instanceof z.ZodError
      ? `Invalid arguments: ${err.errors.map((e) => `${e.path.join(".")} ${e.message}`).join("; ")}`
      : String((err as any)?.message ?? err);
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
});

async function main() { await server.connect(new StdioServerTransport()); console.error("[mcp-roadmapsh] ready"); }
main().catch((e) => { console.error(e); process.exit(1); });
