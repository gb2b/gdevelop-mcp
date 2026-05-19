---
name: debug-mcp
description: Use when the gdevelop-mcp server misbehaves — tools missing, prompts not exposed, JSON-RPC errors, or unexpected responses.
---

# Debugging the MCP server

## Symptoms → likely causes

| Symptom | Likely cause |
|---|---|
| Tool not visible in client | Server didn't restart, or stale `dist/`. Run `npm run build` and restart the client. |
| Tools list works but a call returns nothing | Handler threw without try/catch. Check it returns `textResult` or `errorResult`. |
| Random "unexpected token" parse errors on client side | A 3rd-party package wrote to stdout. Move its invocation to a subprocess with piped stdio. |
| `EADDRINUSE` on preview | Static server didn't release the port. Restart the MCP. |
| `Could not locate GDevelop install` | Set `GDEVELOP_PATH=/path/to/GDevelop\ 5.app`. |
| Typecheck fails after a refactor | Stale `dist/` causing self-imports. `rm -rf dist && npm run build`. |

## Smoke-test the server end-to-end

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node dist/index.js
```

You should see one JSON-RPC response per request, all parseable. If any
line is not valid JSON, something is polluting stdout — find the
`console.log` or move the offender to a subprocess.

## MCP Inspector

For an interactive UI:

```bash
npm run inspect
```

Opens a local web UI where you can call each tool manually and inspect the
exact JSON request/response.

## Logging without polluting stdout

`console.error(...)` writes to `stderr`, which the MCP transport ignores.
Safe for ad-hoc debugging — but remove or guard before committing.

## Common stdio mistakes

- A library calls `console.info`/`console.log`/`console.warn` — these all
  go to stdout. Either patch `console.*` for the duration of the call OR
  (preferred) spawn the library in a child process.
- A library writes raw to `process.stdout.write` — same fix.
- An async callback fires *after* a tool returns and logs something —
  hardest to spot. Always await everything before returning from a
  handler.

## Common test failures

- "ERR_MODULE_NOT_FOUND" for a `.js` import → ESM resolution. The build
  produces `.js` from `.ts`, but vitest works directly on `.ts` via
  vite-node. Use `.js` extensions in imports; vitest handles the rest.
- Filesystem races between tests → ensure each test uses its own
  `mkdtempSync` dir.
