# pageworkspace

Notion pages, databases and blocks as MCP tools, talking to the Notion
REST API. pageworkspace is a clean-room rebuild of the core surface of
the Notion MCP server, under a new name: the same tool names and wire
behaviour, fresh code, no copied branding. The original is a hosted
remote MCP server; this rebuild is a REST-compatible client for the
same upstream API — the hosted OAuth surface is not reproduced.

## Tools (core subset, 12)

`search`, `list_users`, `get_page`, `create_page`, `update_page`,
`get_database`, `query_database`, `create_database`, `get_block`,
`get_block_children`, `append_block_children`, `delete_block`.

Not in this subset: page property-item endpoints, comments, file
uploads, data sources (2025 API), synced blocks and template admin,
search-by-data-source hosted tools, and the OAuth public-integration
flow.

## Setup

Create an internal integration in Notion, share the target pages and
databases with it, and set its secret:

```bash
export NOTION_API_KEY=secret_...
```

Optionally override the API base with `NOTION_API_URL`
(default `https://api.notion.com/v1`). Without the key, every tool call
fails with an error naming the missing variable.

## CLI

```bash
npx @reneturcios/pageworkspace search '{"query":"roadmap"}'
npx @reneturcios/pageworkspace mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "pageworkspace": {
      "command": "npx",
      "args": ["-y", "@reneturcios/pageworkspace", "mcp"],
      "env": { "NOTION_API_KEY": "secret_..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e NOTION_API_KEY ghcr.io/cloudcorprecords/pageworkspace
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
