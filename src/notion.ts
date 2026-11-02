/**
 * pageworkspace core: a 12-tool core subset of the Notion MCP server
 * surface, implemented clean-room against the public Notion REST API
 * (https://api.notion.com/v1, base overridable via NOTION_API_URL).
 *
 * Auth: NOTION_API_KEY, sent as `Authorization: Bearer`, with the
 * `Notion-Version: 2022-06-28` header on every request. A missing key
 * is an error naming the variable, matching the original's fail-fast
 * behaviour. All HTTP goes through an injected FetchFn so the wire
 * behaviour is fully testable offline.
 *
 * Note: the original Notion MCP server is a hosted remote server (OAuth
 * surface); this rebuild is a REST-compatible client for the same
 * upstream API and does not reproduce the hosted OAuth surface.
 */
import type {
  AppendBlockChildrenOptions,
  CreateDatabaseOptions,
  CreatePageOptions,
  DeleteBlockOptions,
  FetchFn,
  GetBlockChildrenOptions,
  GetBlockOptions,
  GetDatabaseOptions,
  GetPageOptions,
  QueryDatabaseOptions,
  SearchOptions,
  UpdatePageOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_API_BASE = "https://api.notion.com/v1";

export const NOTION_VERSION = "2022-06-28";

export function tokenFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.NOTION_API_KEY;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    throw new Error("NOTION_API_KEY environment variable is required");
  }
  return token;
}

export function apiBaseFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.NOTION_API_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

interface RequestSpec {
  method: string;
  path: string;
  body?: unknown;
}

async function notionRequest(
  fetchFn: FetchFn,
  token: string,
  base: string,
  spec: RequestSpec,
): Promise<unknown> {
  const res = await fetchFn(`${base}${spec.path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.message === "string") detail = parsed.message;
    } catch {
      // Keep the raw body as the detail.
    }
    throw new Error(`Notion API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Drop undefined values so request bodies carry only provided fields. */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const enc = encodeURIComponent;

export async function search(
  fetchFn: FetchFn, token: string, base: string, opts: SearchOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "POST",
    path: "/search",
    body: clean({ query: opts.query, page_size: opts.page_size }),
  });
}

export async function listUsers(
  fetchFn: FetchFn, token: string, base: string,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "GET",
    path: "/users",
  });
}

export async function getPage(
  fetchFn: FetchFn, token: string, base: string, opts: GetPageOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "GET",
    path: `/pages/${enc(opts.page_id)}`,
  });
}

export async function createPage(
  fetchFn: FetchFn, token: string, base: string, opts: CreatePageOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "POST",
    path: "/pages",
    body: {
      parent: { page_id: opts.parent_id },
      properties: {
        title: { title: [{ text: { content: opts.title } }] },
      },
    },
  });
}

export async function updatePage(
  fetchFn: FetchFn, token: string, base: string, opts: UpdatePageOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "PATCH",
    path: `/pages/${enc(opts.page_id)}`,
    body: clean({ archived: opts.archived }),
  });
}

export async function getDatabase(
  fetchFn: FetchFn, token: string, base: string, opts: GetDatabaseOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "GET",
    path: `/databases/${enc(opts.database_id)}`,
  });
}

export async function queryDatabase(
  fetchFn: FetchFn, token: string, base: string, opts: QueryDatabaseOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "POST",
    path: `/databases/${enc(opts.database_id)}/query`,
    body: clean({ page_size: opts.page_size }),
  });
}

export async function createDatabase(
  fetchFn: FetchFn, token: string, base: string, opts: CreateDatabaseOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "POST",
    path: "/databases",
    body: {
      parent: { page_id: opts.parent_id },
      title: [{ type: "text", text: { content: opts.title } }],
      properties: opts.properties ?? { Name: { title: {} } },
    },
  });
}

export async function getBlock(
  fetchFn: FetchFn, token: string, base: string, opts: GetBlockOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "GET",
    path: `/blocks/${enc(opts.block_id)}`,
  });
}

export async function getBlockChildren(
  fetchFn: FetchFn, token: string, base: string, opts: GetBlockChildrenOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "GET",
    path: `/blocks/${enc(opts.block_id)}/children${query({ page_size: opts.page_size })}`,
  });
}

export async function appendBlockChildren(
  fetchFn: FetchFn, token: string, base: string, opts: AppendBlockChildrenOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "PATCH",
    path: `/blocks/${enc(opts.block_id)}/children`,
    body: { children: opts.children },
  });
}

export async function deleteBlock(
  fetchFn: FetchFn, token: string, base: string, opts: DeleteBlockOptions,
): Promise<unknown> {
  return notionRequest(fetchFn, token, base, {
    method: "DELETE",
    path: `/blocks/${enc(opts.block_id)}`,
  });
}

/** Dispatch a tool call by name. Used by both the MCP server and the CLI. */
export async function callTool(
  fetchFn: FetchFn,
  token: string,
  base: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search":
      return search(fetchFn, token, base, args as unknown as SearchOptions);
    case "list_users":
      return listUsers(fetchFn, token, base);
    case "get_page":
      return getPage(fetchFn, token, base, args as unknown as GetPageOptions);
    case "create_page":
      return createPage(fetchFn, token, base, args as unknown as CreatePageOptions);
    case "update_page":
      return updatePage(fetchFn, token, base, args as unknown as UpdatePageOptions);
    case "get_database":
      return getDatabase(fetchFn, token, base, args as unknown as GetDatabaseOptions);
    case "query_database":
      return queryDatabase(fetchFn, token, base, args as unknown as QueryDatabaseOptions);
    case "create_database":
      return createDatabase(fetchFn, token, base, args as unknown as CreateDatabaseOptions);
    case "get_block":
      return getBlock(fetchFn, token, base, args as unknown as GetBlockOptions);
    case "get_block_children":
      return getBlockChildren(fetchFn, token, base, args as unknown as GetBlockChildrenOptions);
    case "append_block_children":
      return appendBlockChildren(fetchFn, token, base, args as unknown as AppendBlockChildrenOptions);
    case "delete_block":
      return deleteBlock(fetchFn, token, base, args as unknown as DeleteBlockOptions);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
