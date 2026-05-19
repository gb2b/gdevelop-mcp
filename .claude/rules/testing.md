# Testing

Tests use **vitest** and live in `test/`. They run with `npm test`.

## What we test

Priority order:

1. **Safety invariants** — atomic edit, backup creation, dry-run does not
   modify, baseline-invalid refusal. These are non-negotiable.
2. **Validation logic** — the diagnostics emitted by `validation.ts`.
3. **Pure transformations** — `diff.ts`, catalog lookups, schema parsing.
4. **Integration** — `editProject` end-to-end with `validateProjectData`.

What we don't test in unit tests:
- Anything requiring a live GDevelop install (use the inspector for
  manual checks).
- Anything making network calls (use mocks or skip).
- Puppeteer-based preview (slow, system-dependent — manual or CI only).

## Conventions

- One `test/<topic>.test.ts` file per `src/core/<topic>.ts`.
- Use `describe`/`it` for grouping; keep test names declarative
  ("rejects missing properties", not "test 1").
- Fixtures in `test/fixtures.ts`. Always start from a minimal valid project
  and mutate; don't hand-write large JSONs inline.
- Temp files: `mkdtempSync(join(tmpdir(), "<test-name>-"))`. The test
  framework does not clean OS tmp; that's fine.
- No real network. If a test needs a fetch, mock `globalThis.fetch`.

## Anti-patterns

- **Don't test private implementation.** If a helper isn't exported, it's
  exercised indirectly through public API.
- **Don't share state between tests.** Each `it` block sets up its own
  fixtures.
- **Don't suppress failures.** If a test is flaky, fix the cause or remove
  it — never `.skip` forever without an issue link.

## Running

```bash
npm test           # CI-style: one shot, exits with status
npm run test:watch # dev: watches files, re-runs on save
```

Vitest auto-handles TypeScript via vite-node. No build step needed.

## Adding a test

See [`.claude/skills/add-test/SKILL.md`](../skills/add-test/SKILL.md).
