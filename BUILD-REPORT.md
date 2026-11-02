# pageworkspace — BUILD REPORT

Original: notion (Notion hosted MCP server) → Rebuild: pageworkspace
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the Notion REST API (https://api.notion.com/v1, base
overridable via NOTION_API_URL), Authorization: Bearer NOTION_API_KEY
with `Notion-Version: 2022-06-28` on every request, all HTTP behind an
injectable FetchFn:
search (POST /search, undefined fields dropped), list_users
(GET /users), get_page (GET /pages/{id}), create_page (POST /pages with
the documented parent/title properties shape), update_page
(PATCH /pages/{id}, provided fields only), get_database
(GET /databases/{id}), query_database (POST /databases/{id}/query),
create_database (POST /databases, default `Name` title property when
`properties` is omitted), get_block (GET /blocks/{id}),
get_block_children (GET /blocks/{id}/children, page_size query param
only when given), append_block_children (PATCH /blocks/{id}/children),
delete_block (DELETE /blocks/{id}).

Omitted groups (fixture `_source` lists them): page property-item
endpoints, comments, file uploads, data sources (2025 API), synced
blocks/templates admin, search-by-data-source hosted tools, OAuth
public-integration flow.

Ground truth: schemas are docs-derived from the public Notion API
documentation. Fixture:
harness/fixtures/notion-tools-original.json (labelled core-subset).
The original is a hosted remote MCP server (OAuth surface); this
rebuild is a REST-compatible client for the same upstream API — the
hosted OAuth surface is not reproduced.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 14/14 pass (fake FetchFn; URL/method/Bearer +
  Notion-Version headers/body shaping for every tool, undefined-field
  dropping, default database property, upstream error surfacing,
  empty-body {status} handling, missing-key error).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env stdio check: tools/call search with NOTION_API_KEY unset
  returned isError "NOTION_API_KEY environment variable is required".
- server.json description 66 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/pageworkspace; full 19-file factory set
  present.

## Honest gaps
- No live Notion call was made — request/response behaviour is
  fake-fetch proven only.
- search sends only {query, page_size}; the API's filter/sort options
  are not exposed in this subset.
- create_page supports page parents only (database parents and rich
  page properties are outside the subset).
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- Hosted OAuth surface of the original remote server is not
  reproduced (see Scope).
