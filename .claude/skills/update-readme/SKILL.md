---
name: update-readme
description: Use after adding, renaming, or removing an MCP tool or prompt. Ensures README, CHANGELOG, and version numbers stay in sync with the actual code surface. The hard rule from .claude/rules/maintenance.md.
---

# Keeping README & CHANGELOG in sync

If you changed the MCP tool surface, you MUST update:

## Checklist

- [ ] **README.md** — the tool table under the relevant section
      (Introspection / Editing / Assets / Examples / Preview / etc.).
      The description should be one short sentence.
- [ ] **CHANGELOG.md** — under a new (or pending) version section.
      Categorize:
      - **Added** — new tools, new prompts, new options
      - **Changed** — renames, output shape changes (breaking-ish)
      - **Removed** — deleted tools, deprecated options
      - **Fixed** — bugs squashed
      - **Internal** — refactors that don't change the surface (one-liner)
- [ ] **`package.json`** version → bump per semver
- [ ] **`src/index.ts`** `version: "X.Y.Z"` → match
- [ ] **MCP tool descriptions** in the registration call — be precise
      about WHEN to use this tool and HOW it interacts with siblings.

## What goes where

| Surface | README | CHANGELOG | tests required |
|---|---|---|---|
| New MCP tool | ✅ tool table | ✅ "Added" | ✅ matching test/<topic>.test.ts |
| New MCP prompt | ✅ prompts table | ✅ "Added" | optional (testing prompts is awkward) |
| New `edit_project` op | ❌ (inside tool description) | ✅ "Added" | ✅ test case |
| Tool description tweak | ❌ | ❌ | — |
| Internal refactor | ❌ | ✅ "Internal" | maintain existing tests |
| Bug fix in catalog parser | ❌ | ✅ "Fixed" | ideally add regression test |

## Quick template — CHANGELOG entry

```md
## [X.Y.Z] — YYYY-MM-DD

### Added

- **`tool_name`**: one sentence on what it does + when to use.
- ...

### Fixed

- `<area>`: root cause + visible effect.

### Internal

- Refactored X to Y.
```

## When to skip

If your change is truly invisible (a comment, a test refactor that doesn't
add coverage), no updates needed. Otherwise, the discipline applies.

## Verify before committing

```bash
npm run check         # tsc + lint + tests
npm run build         # ensures dist/ is buildable
grep -E "^server\.tool" -r src/tools src/index.ts | wc -l   # tool count
grep -c "^| \`" README.md   # number of pipe-table tool rows (rough)
```

If the tool count doesn't match the README pipe-table rows, something
needs updating.
