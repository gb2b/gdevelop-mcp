---
name: add-test
description: Use when adding tests for new or existing code in gdevelop-mcp. Tests use vitest, live in test/, and follow the safety-first priorities laid out in .claude/rules/testing.md.
---

# Adding a test

## Checklist

- [ ] Identify the module under test (`src/core/<topic>.ts`).
- [ ] Open or create `test/<topic>.test.ts`.
- [ ] Import from `../src/core/<topic>.js` (the `.js` extension is required
      for ESM).
- [ ] If you need a project fixture, use `minimalValidProject()` from
      `test/fixtures.ts` and mutate it; don't hand-write a large JSON.
- [ ] Cover at least: happy path + one error path.
- [ ] For tools that write files, use `mkdtempSync(join(tmpdir(), "..."))`
      to isolate fixtures. Each `it` block creates its own.
- [ ] Run `npm test`. All tests must pass.

## Template

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { thingUnderTest } from "../src/core/<topic>.js";
import { minimalValidProject } from "./fixtures.js";

describe("thingUnderTest", () => {
  it("does the happy path", () => {
    const result = thingUnderTest(minimalValidProject());
    expect(result).toBe(/* ... */);
  });

  it("returns an error on bad input", () => {
    expect(() => thingUnderTest(null as unknown as never)).toThrow();
  });
});
```

## Async tests

```ts
it("awaits things correctly", async () => {
  const r = await asyncThing();
  expect(r).toBeDefined();
});

it("rejects on bad input", async () => {
  await expect(asyncThing(/* bad */)).rejects.toThrow(/error message regex/);
});
```

## Filesystem tests

```ts
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let projectPath: string;
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "my-test-"));
  projectPath = join(dir, "game.json");
  writeFileSync(projectPath, JSON.stringify(minimalValidProject()), "utf-8");
});
```

## When NOT to add a test

- For thin glue (the tool handler in `src/index.ts`) — test the underlying
  function in `src/core/*` instead.
- For 3rd-party behavior (don't test that `fetch` works).
- For things that need a live GDevelop install or network (those are
  manual / CI-tier).

See [`.claude/rules/testing.md`](../../rules/testing.md) for full rules.
