// Live demo: drives the built server over stdio against the real roadmap.sh data.
// Run from the project root after `npm run build`:  node examples/demo.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "demo", version: "0.0.0" }, { capabilities: {} });

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${r.content?.[0]?.text}`);
  return JSON.parse(r.content[0].text);
};

await client.connect(transport);

const list = await call("roadmap_list");
console.log(`\n${list.count} roadmaps available. First few: ${list.slugs.slice(0, 8).join(", ")}\n`);

const fe = await call("roadmap_get", { slug: "frontend", format: "outline" });
console.log(`# ${fe.title} — ${fe.topicCount} topics, ${fe.subtopicCount} subtopics`);
console.log(fe.outline.split("\n").slice(0, 14).join("\n"));

const firstTopic = fe.items.find((i) => i.type === "topic");
const topic = await call("roadmap_topic", { slug: "frontend", nodeId: firstTopic.id });
console.log(`\n## Topic "${firstTopic.label}" (${topic.file}):\n`);
console.log(topic.content.slice(0, 400) + "…");

const next = await call("progress_next", { roadmap: "frontend" });
console.log(`\nNext to learn: ${next.next ? next.next.label : "(all done)"}\n`);

await client.close();
