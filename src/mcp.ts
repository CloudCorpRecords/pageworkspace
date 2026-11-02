/**
 * pageworkspace MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./notion.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  search: z.object({
    query: z.string().optional(),
    page_size: z.number().optional(),
  }),
  list_users: z.object({}),
  get_page: z.object({ page_id: z.string() }),
  create_page: z.object({
    parent_id: z.string(),
    title: z.string(),
  }),
  update_page: z.object({
    page_id: z.string(),
    archived: z.boolean().optional(),
  }),
  get_database: z.object({ database_id: z.string() }),
  query_database: z.object({
    database_id: z.string(),
    page_size: z.number().optional(),
  }),
  create_database: z.object({
    parent_id: z.string(),
    title: z.string(),
    properties: z.record(z.unknown()).optional(),
  }),
  get_block: z.object({ block_id: z.string() }),
  get_block_children: z.object({
    block_id: z.string(),
    page_size: z.number().optional(),
  }),
  append_block_children: z.object({
    block_id: z.string(),
    children: z.array(z.record(z.unknown())),
  }),
  delete_block: z.object({ block_id: z.string() }),
};

export const TOOLS = [
  {
    name: "search",
    description: "Search Notion pages and databases by title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Optional search text matched against page and database titles; when omitted, recent items are returned." },
        page_size: { type: "number", description: "Optional maximum number of results to return in one page." },
      },
      required: [] as string[],
    },
  },
  {
    name: "list_users",
    description: "List all users in the Notion workspace.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_page",
    description: "Retrieve a Notion page by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { page_id: { type: "string", description: "The ID of the Notion page to retrieve." } },
      required: ["page_id"],
    },
  },
  {
    name: "create_page",
    description: "Create a new Notion page under a parent page with a title.",
    inputSchema: {
      type: "object" as const,
      properties: {
        parent_id: { type: "string", description: "The ID of the parent page under which to create the new page." },
        title: { type: "string", description: "The title text of the new page." },
      },
      required: ["parent_id", "title"],
    },
  },
  {
    name: "update_page",
    description: "Update a Notion page, for example to archive or restore it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page_id: { type: "string", description: "The ID of the Notion page to update." },
        archived: { type: "boolean", description: "Optional archived state to set: true archives the page, false restores it." },
      },
      required: ["page_id"],
    },
  },
  {
    name: "get_database",
    description: "Retrieve a Notion database by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { database_id: { type: "string", description: "The ID of the Notion database to retrieve." } },
      required: ["database_id"],
    },
  },
  {
    name: "query_database",
    description: "Query a Notion database and return its rows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        database_id: { type: "string", description: "The ID of the Notion database to query." },
        page_size: { type: "number", description: "Optional maximum number of rows to return in one page." },
      },
      required: ["database_id"],
    },
  },
  {
    name: "create_database",
    description: "Create a new Notion database under a parent page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        parent_id: { type: "string", description: "The ID of the parent page under which to create the new database." },
        title: { type: "string", description: "The title text of the new database." },
        properties: { type: "object", description: "Optional Notion property schema object defining the database columns; when omitted, a single Name title property is used." },
      },
      required: ["parent_id", "title"],
    },
  },
  {
    name: "get_block",
    description: "Retrieve a Notion block by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { block_id: { type: "string", description: "The ID of the Notion block to retrieve." } },
      required: ["block_id"],
    },
  },
  {
    name: "get_block_children",
    description: "List the child blocks of a Notion block or page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        block_id: { type: "string", description: "The ID of the block or page whose child blocks to list." },
        page_size: { type: "number", description: "Optional maximum number of child blocks to return in one page." },
      },
      required: ["block_id"],
    },
  },
  {
    name: "append_block_children",
    description: "Append child blocks to a Notion block or page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        block_id: { type: "string", description: "The ID of the block or page to append child blocks to." },
        children: { type: "array", items: { type: "object" }, description: "Array of Notion block objects to append as children, in order." },
      },
      required: ["block_id", "children"],
    },
  },
  {
    name: "delete_block",
    description: "Delete (archive) a Notion block by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { block_id: { type: "string", description: "The ID of the Notion block to delete (archive)." } },
      required: ["block_id"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }],
  };
}
function errorResult(err: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    }],
    isError: true,
  };
}

const server = new Server(
  { name: "pageworkspace", version: VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, apiBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
