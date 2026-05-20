# File-size discipline

## Hard limits

- **TypeScript source files** under `src/` must stay **under 500 lines**.
- **Test files** under `test/` must stay **under 600 lines** (a bit more
  permissive since tests are linear).
- **The MCP server entry** (`src/index.ts`) must stay **under 200 lines** —
  it should only wire `register*Tools(server)` calls from `src/tools/*.ts`.

## Why

Files over 500 lines are reliably harder to:

- Locate code in (no headings, no chapters).
- Review (PR reviews start skimming after ~300 lines).
- Modify without merge conflicts.
- Test in isolation (more responsibilities packed together).

In this repo specifically: an oversized `src/index.ts` was the single
biggest source of friction during v0.10 → v0.16 work.

## What to do when a file approaches the limit

1. **Split by concern.** Each `src/core/<topic>.ts` should hold one
   concern. If two concerns are tangled, make a third file with the
   shared helper and have each domain file import it.
2. **Extract MCP tool registrations** into `src/tools/<family>.ts`. Each
   tool family exports a `register<Family>Tools(server, deps)` function.
3. **Never split a Zod schema across files** unless the same schema is
   genuinely reused elsewhere. Cohesion wins.
4. **Don't try to "compress" code** by removing whitespace or shortening
   names to dodge the limit. The limit is a signal that responsibilities
   need separating.

## How this is enforced

A PostToolUse hook (`.claude/hooks/check-file-size.sh`) runs after every
Edit/Write that touches `src/`. It surfaces a warning if any source file
exceeds the threshold. CI does **not** fail on this — it's a developer
signal, not a gate.

When the hook warns, plan a split before adding more code to the file.
