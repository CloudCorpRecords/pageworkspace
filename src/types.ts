/**
 * pageworkspace types.
 *
 * A core subset of the Notion MCP server surface: search, users, pages,
 * databases and blocks against the Notion REST API. HTTP access is
 * described by a minimal response surface so tests can inject a fake
 * fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface SearchOptions {
  query?: string;
  page_size?: number;
}

export interface ListUsersOptions {
  // No arguments.
  [key: string]: never;
}

export interface GetPageOptions {
  page_id: string;
}

export interface CreatePageOptions {
  parent_id: string;
  title: string;
}

export interface UpdatePageOptions {
  page_id: string;
  archived?: boolean;
}

export interface GetDatabaseOptions {
  database_id: string;
}

export interface QueryDatabaseOptions {
  database_id: string;
  page_size?: number;
}

export interface CreateDatabaseOptions {
  parent_id: string;
  title: string;
  properties?: Record<string, unknown>;
}

export interface GetBlockOptions {
  block_id: string;
}

export interface GetBlockChildrenOptions {
  block_id: string;
  page_size?: number;
}

export interface AppendBlockChildrenOptions {
  block_id: string;
  children: Array<Record<string, unknown>>;
}

export interface DeleteBlockOptions {
  block_id: string;
}
