# Module structure

```
src/
├── index.ts          # MCP server. Registers all tools inline.
├── prompts.ts        # MCP prompts (slash commands).
└── core/             # business logic — one concern per file
```

## What lives where

### `src/index.ts`

- Instantiates `McpServer` and `StdioServerTransport`
- Registers every tool with its Zod input schema and handler
- Each handler is a thin wrapper that calls into `src/core/*` and returns
  `textResult(...)` or `errorResult(...)`
- No business logic — if a handler needs more than ~30 lines of glue, the
  logic moves to `core/`

### `src/prompts.ts`

- Exports `registerPrompts(server)` which installs every MCP prompt
- Each prompt is purely text generation (returns
  `{ messages: [...] }`) — no side effects

### `src/core/*.ts`

- One file per concern (`edit.ts`, `validation.ts`, `diff.ts`,
  `asset-store.ts`, `preview-runtime.ts`, `render-static.ts`, etc.)
- Exports named functions (no default exports)
- May import from other `core/*` files (always `./xxx.js`)
- May NOT import from `src/index.ts` or `src/prompts.ts` (no upward
  imports)

### `src/core/schema.ts`

- Zod schemas describing the shape of a GDevelop project JSON
- Used by `validation.ts` and by tool input schemas where appropriate

### `test/*.test.ts`

- Mirrors `src/core/*` — one test file per concern
- Uses `test/fixtures.ts` for minimal valid projects

## Adding a module

1. Create `src/core/<topic>.ts`. Add named exports.
2. If it's reusable in tests, add a fixture / helper to `test/fixtures.ts`.
3. Add `test/<topic>.test.ts` with at least one happy-path and one
   error-path test.
4. Wire it into `src/index.ts` (or `src/prompts.ts`).

## What NOT to do

- Don't add a `src/utils/` dump for "miscellaneous" helpers. Each helper
  goes in the most relevant `core/*` file or its own file if it's reused
  across 3+ modules.
- Don't import from `dist/`. The build artifacts are an output, not an
  input.
- Don't shadow Node built-ins (`fs`, `path`, etc.) as local variable names.
