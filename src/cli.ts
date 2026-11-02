#!/usr/bin/env node
/**
 * pageworkspace CLI.
 *   pageworkspace <tool-name> '<json args>'
 *   pageworkspace mcp
 * Requires NOTION_API_KEY. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./notion.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "search", "list_users", "get_page", "create_page", "update_page",
  "get_database", "query_database", "create_database", "get_block",
  "get_block_children", "append_block_children", "delete_block",
];

function usage(): never {
  console.error(`Usage:
  pageworkspace <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  pageworkspace mcp
  pageworkspace --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, tokenFromEnv(), apiBaseFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
