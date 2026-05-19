---
name: add-mcp-tool
description: Use when adding a new tool to the gdevelop-mcp server. Walks through the file/test/registration changes required.
---

# Adding an MCP tool

Use this checklist whenever you want to expose new functionality as a tool.

## Checklist

- [ ] Decide where the **logic** lives in `src/core/`. Prefer extending an
      existing file when the concern is the same; otherwise create
      `src/core/<topic>.ts`.
- [ ] Implement the logic as a **named export**, fully typed. No side effects
      at module load.
- [ ] If the tool modifies a project file, follow `.claude/rules/safety.md`:
      baseline validate → operate in memory → validate result → backup →
      atomic write.
- [ ] Register the tool in `src/index.ts`:
      - Choose a `snake_case` name that's discoverable (verb_object).
      - Write a description that says **when to use this** and **how it
        relates to other tools** (mention `inspect_project`,
        `validate_project`, `dryRun`, etc. when relevant).
      - Define inputs with Zod — every field gets a `.describe()`.
      - The handler is a thin try/catch wrapper returning `textResult(...)`
        or `errorResult(...)`.
- [ ] Add a test file `test/<topic>.test.ts` (or extend an existing one):
      at minimum a happy path and one error path.
- [ ] Run `npm run typecheck && npm test`. Both must pass.
- [ ] Update `CHANGELOG.md` under a new (or current) version section.
- [ ] Update `README.md`'s tool table.
- [ ] If the new tool fits a recommended flow (inspect → edit → verify),
      consider also updating `src/prompts.ts` to mention it.

## Template

In `src/core/<topic>.ts`:

```ts
import { z } from "zod";

export type DoSomethingOptions = {
  // strongly-typed fields here
};

export type DoSomethingResult = {
  // serializable result
};

export async function doSomething(
  opts: DoSomethingOptions,
): Promise<DoSomethingResult> {
  // ... implementation
}
```

In `src/index.ts` (next to other tools of the same family):

```ts
server.tool(
  "do_something",
  "One-paragraph description: what it does, when to use it, how it relates to other tools.",
  {
    foo: z.string().describe("..."),
    bar: z.number().int().optional().describe("..."),
  },
  async ({ foo, bar }) => {
    try {
      const result = await doSomething({ foo, bar });
      return textResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);
```

In `test/<topic>.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { doSomething } from "../src/core/<topic>.js";

describe("doSomething", () => {
  it("does the happy path", async () => {
    const r = await doSomething({ /* ... */ });
    expect(r).toMatchObject({ /* ... */ });
  });

  it("rejects bad input", async () => {
    await expect(doSomething({ /* ... */ })).rejects.toThrow(/expected/);
  });
});
```

## Smoke-test via the MCP stdio

Once registered, you can test end-to-end without restarting Claude Code:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"do_something","arguments":{"foo":"bar"}}}' \
  | node dist/index.js
```
