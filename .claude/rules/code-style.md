# Code style

## TypeScript

- **Strict mode** (`strict: true`). No `any` unless interfacing with truly
  untyped data — and even then, narrow at the boundary with a Zod schema or
  an explicit type guard.
- **ESM only.** `"type": "module"`. Imports use `.js` extensions (compiled
  from `.ts`).
- **`type` over `interface`** unless extending. Discriminated unions over
  enums.
- **No default exports** in `src/core/`. Named exports only — they grep
  better and IDE-rename cleaner.
- **Top-level `await`** is fine (we're ESM + Node 18+).

## File-level

- One concern per file. If a file mixes 3+ responsibilities, split it.
- Order inside a file: imports → types → constants → public functions →
  private helpers.
- No comments explaining *what* the code does — names should do that. Only
  comment *why* when the reason isn't obvious from the code.

## Errors

- Throw `Error` with a useful message. The caller decides whether to surface
  or recover.
- In tool handlers (`server.tool(..., async (args) => ...)`), catch and
  return `errorResult(err.message)` rather than letting the throw cross the
  MCP boundary.

## Async

- Prefer `async/await` over `.then`.
- Use `Promise.all` for parallel work — except when the work is independent
  *and* you want per-item failure isolation; then loop with try/catch.

## Logging

- **NEVER `console.log` from runtime code.** The MCP transport owns
  `stdout`. Logging there breaks the JSON-RPC stream.
- For debugging during development, `console.error` writes to `stderr` and
  is safe — but remove it before committing unless guarded behind an env
  flag.

## Imports

```ts
// 1. Node built-ins (with node: prefix)
import { readFileSync } from "node:fs";

// 2. Third-party
import { z } from "zod";

// 3. Local — by depth, deepest first
import { findObjectType } from "./core/catalog-static.js";
import { editProject } from "./core/edit.js";
```

## Naming

- Files: kebab-case (`asset-import.ts`, `catalog-static.ts`).
- Types: PascalCase (`EditOp`, `ProjectShape`).
- Functions: camelCase (`importAssetsIntoProject`).
- Constants: UPPER_SNAKE_CASE when truly constant (`OBJECT_TYPES`),
  camelCase otherwise.
- MCP tool names: snake_case (`edit_project`, `inspect_project`).
- MCP prompt names: kebab-case (`add-hero`, `safe-edit-flow`).
