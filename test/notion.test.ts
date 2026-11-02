import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  appendBlockChildren,
  createDatabase,
  createPage,
  deleteBlock,
  getBlock,
  getBlockChildren,
  getDatabase,
  getPage,
  listUsers,
  queryDatabase,
  search,
  tokenFromEnv,
  updatePage,
} from "../src/notion.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? JSON.stringify(step.payload),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://api.notion.com/v1";
const TOKEN = "test-key";

describe("pageworkspace core", () => {
  it("names the env var when the key is missing", () => {
    assert.throws(() => tokenFromEnv({}), /NOTION_API_KEY environment variable is required/);
    assert.equal(tokenFromEnv({ NOTION_API_KEY: " x " }), "x");
    assert.equal(apiBaseFromEnv({}), "https://api.notion.com/v1");
    assert.equal(apiBaseFromEnv({ NOTION_API_URL: "https://example.test/v1/" }), "https://example.test/v1");
  });

  it("search posts to /search with Bearer auth and Notion-Version, dropping undefined", async () => {
    const { fn, calls } = fakeFetch([{ match: "/search", payload: { results: [] } }]);
    await search(fn, TOKEN, BASE, { query: "roadmap", page_size: 5 });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.notion.com/v1/search");
    assert.equal(calls[0].headers.Authorization, "Bearer test-key");
    assert.equal(calls[0].headers["Notion-Version"], "2022-06-28");
    assert.equal(calls[0].headers["Content-Type"], "application/json");
    assert.deepEqual(calls[0].body, { query: "roadmap", page_size: 5 });
    await search(fn, TOKEN, BASE, {});
    assert.deepEqual(calls[1].body, {});
  });

  it("list_users gets /users", async () => {
    const { fn, calls } = fakeFetch([{ match: "/users", payload: { results: [{ id: "u1" }] } }]);
    const out = (await listUsers(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.notion.com/v1/users");
    assert.deepEqual(out.results, [{ id: "u1" }]);
  });

  it("get_page gets /pages/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/pages/p1", payload: { id: "p1" } }]);
    const out = (await getPage(fn, TOKEN, BASE, { page_id: "p1" })) as Record<string, unknown>;
    assert.equal(out.id, "p1");
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.notion.com/v1/pages/p1");
  });

  it("create_page posts the documented parent/properties shape", async () => {
    const { fn, calls } = fakeFetch([{ match: "/pages", payload: { id: "new" } }]);
    await createPage(fn, TOKEN, BASE, { parent_id: "parent1", title: "Hello" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.notion.com/v1/pages");
    assert.deepEqual(calls[0].body, {
      parent: { page_id: "parent1" },
      properties: { title: { title: [{ text: { content: "Hello" } }] } },
    });
  });

  it("update_page patches archived only when provided", async () => {
    const { fn, calls } = fakeFetch([{ match: "/pages/p1", payload: { id: "p1" } }]);
    await updatePage(fn, TOKEN, BASE, { page_id: "p1", archived: true });
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].body, { archived: true });
    await updatePage(fn, TOKEN, BASE, { page_id: "p1" });
    assert.deepEqual(calls[1].body, {});
  });

  it("get_database and query_database hit /databases paths", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/databases/d1/query", payload: { results: [1] } },
      { match: "/databases/d1", payload: { id: "d1" } },
    ]);
    const db = (await getDatabase(fn, TOKEN, BASE, { database_id: "d1" })) as Record<string, unknown>;
    assert.equal(db.id, "d1");
    assert.equal(calls[0].method, "GET");
    await queryDatabase(fn, TOKEN, BASE, { database_id: "d1", page_size: 3 });
    assert.equal(calls[1].method, "POST");
    assert.equal(calls[1].url, "https://api.notion.com/v1/databases/d1/query");
    assert.deepEqual(calls[1].body, { page_size: 3 });
  });

  it("create_database posts parent/title/properties with the default Name property", async () => {
    const { fn, calls } = fakeFetch([{ match: "/databases", payload: { id: "db" } }]);
    await createDatabase(fn, TOKEN, BASE, { parent_id: "p1", title: "Tasks" });
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      parent: { page_id: "p1" },
      title: [{ type: "text", text: { content: "Tasks" } }],
      properties: { Name: { title: {} } },
    });
    await createDatabase(fn, TOKEN, BASE, {
      parent_id: "p1", title: "T2", properties: { Name: { title: {} }, Done: { checkbox: {} } },
    });
    assert.deepEqual((calls[1].body as Record<string, unknown>).properties, {
      Name: { title: {} }, Done: { checkbox: {} },
    });
  });

  it("get_block gets /blocks/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/blocks/b1", payload: { id: "b1" } }]);
    await getBlock(fn, TOKEN, BASE, { block_id: "b1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/b1");
  });

  it("get_block_children appends page_size as a query param only when given", async () => {
    const { fn, calls } = fakeFetch([{ match: "/children", payload: { results: [] } }]);
    await getBlockChildren(fn, TOKEN, BASE, { block_id: "b1", page_size: 7 });
    assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/b1/children?page_size=7");
    await getBlockChildren(fn, TOKEN, BASE, { block_id: "b1" });
    assert.equal(calls[1].url, "https://api.notion.com/v1/blocks/b1/children");
  });

  it("append_block_children patches children through", async () => {
    const children = [{ object: "block", type: "paragraph", paragraph: { rich_text: [] } }];
    const { fn, calls } = fakeFetch([{ match: "/children", payload: { results: children } }]);
    await appendBlockChildren(fn, TOKEN, BASE, { block_id: "b1", children });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/b1/children");
    assert.deepEqual(calls[0].body, { children });
  });

  it("delete_block issues a DELETE", async () => {
    const { fn, calls } = fakeFetch([{ match: "/blocks/b1", payload: { id: "b1", archived: true } }]);
    await deleteBlock(fn, TOKEN, BASE, { block_id: "b1" });
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "https://api.notion.com/v1/blocks/b1");
  });

  it("surfaces upstream error status and message", async () => {
    const { fn } = fakeFetch([{ match: "/search", payload: { message: "unauthorized" }, status: 401 }]);
    await assert.rejects(() => search(fn, TOKEN, BASE, {}), /Notion API error 401: unauthorized/);
  });

  it("returns {status} for an empty successful body", async () => {
    const { fn } = fakeFetch([{ match: "/blocks/b1", payload: null, rawText: "", status: 200 }]);
    const out = (await deleteBlock(fn, TOKEN, BASE, { block_id: "b1" })) as Record<string, unknown>;
    assert.deepEqual(out, { status: 200 });
  });
});
