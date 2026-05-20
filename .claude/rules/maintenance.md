# Maintenance discipline

Whenever you add, rename, or remove a public MCP tool or prompt, the
following must be updated in the **same** change:

1. **`README.md`** — the tool table near "Tool reference". A new tool
   without a README entry is invisible to users.
2. **`CHANGELOG.md`** — under a new (or pending) version section with
   short, descriptive bullet under "Added" / "Changed" / "Removed" /
   "Fixed".
3. **`src/index.ts`** version string AND **`package.json`** version,
   incremented per semver:
   - **major** (`0.x.y` for now → bump only when explicitly approved)
   - **minor** for new tools, new prompts, new file formats accepted
   - **patch** for fixes, doc-only changes, schema relaxations
4. **`.claude/skills/release-version/SKILL.md`** — if your change affects
   the release flow.

## Skipping the checklist

The only valid reason to skip is "no user-visible surface changed"
(internal refactor, type cleanup, test-only addition). Even then, leave
a one-line note in CHANGELOG under "Changed (internal)" so future
debugging has context.

## When you finish a sprint of work

- Run `npm run check` (typecheck + lint + tests). Must be all green.
- Tag a new version: `git tag -a vX.Y.Z -m "vX.Y.Z"` and push with
  `--follow-tags`.
- The release workflow at `.github/workflows/release.yml` picks up
  the tag and creates a GitHub Release with the CHANGELOG extract.

If the version-bump step feels like friction, that's because the project
is changing fast — the friction is the feedback.
