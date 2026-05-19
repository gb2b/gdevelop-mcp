# Examples

Runnable snippets to play with `gdevelop-mcp` outside an LLM agent.

## Prerequisites

```bash
npm install
npm run build
```

You need a local GDevelop install (auto-detected on macOS/Linux/Windows,
or override with `GDEVELOP_PATH`).

## Smoke-test via raw JSON-RPC

[`smoke-test.sh`](./smoke-test.sh) sends an `initialize` + `tools/list`
sequence to the server over stdio and prints the responses. Useful for
verifying the build is fine without launching a full agent.

```bash
./examples/smoke-test.sh
```

## Inspect a project

[`inspect-project.sh`](./inspect-project.sh) calls `inspect_project` on a
project file path you pass in:

```bash
./examples/inspect-project.sh /path/to/game.json
```

## Open the MCP Inspector UI

For interactive exploration of every tool/prompt:

```bash
npm run inspect
```

This launches `@modelcontextprotocol/inspector` and opens a browser UI
where you can fire tool calls manually with auto-completed argument
schemas.

## Wire into Claude Code

Drop a `.mcp.json` next to your project (or in your home directory):

```json
{
  "mcpServers": {
    "gdevelop": {
      "command": "node",
      "args": ["/absolute/path/to/gdevelop-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Code. The tools appear as `mcp__gdevelop__*` and the
prompts appear as slash-commands like `/gdevelop:add-hero`.
