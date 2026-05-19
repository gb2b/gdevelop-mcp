---
name: release-version
description: Use when cutting a new gdevelop-mcp release. Bumps the version, finalizes CHANGELOG, tags the commit, and (optionally) pushes.
---

# Releasing a new version

This project follows [Semantic Versioning](https://semver.org/).
Patches (`0.10.0 → 0.10.1`) for bug fixes, minor (`0.10.0 → 0.11.0`) for
new tools/prompts, major when we break the public tool API.

## Checklist

- [ ] `main` is clean, `git status` shows no uncommitted changes.
- [ ] CI is green on the latest commit.
- [ ] `npm run check` passes locally (typecheck + lint + tests).
- [ ] Pick the new version. Use `npm version <patch|minor|major>` so it
      updates `package.json`, `package-lock.json`, and creates a tag in
      one go.
- [ ] In `src/index.ts`, bump the `McpServer({ version: "X.Y.Z" })` so
      tools report the right version.
- [ ] Move "Unreleased" content in `CHANGELOG.md` under a new
      `## [X.Y.Z] — YYYY-MM-DD` heading. Empty the "Unreleased" section.
- [ ] Update `README.md`'s tool/prompt counts if they changed.
- [ ] `npm run build` produces a clean `dist/`.
- [ ] Commit: `git commit -am "chore: release vX.Y.Z"`.
- [ ] Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"` (only if you didn't use
      `npm version`).
- [ ] `git push origin main --follow-tags`.
- [ ] (Optional) Create a GitHub release with the CHANGELOG entry as body.
- [ ] (Optional) Publish to npm: `npm publish --access public`. Make
      sure the `files` field in `package.json` only ships what users
      need (typically `dist/` and `data/`).

## Reference commands

```bash
# Bump to a new minor version
npm version minor --no-git-tag-version

# Then edit CHANGELOG.md and src/index.ts manually
$EDITOR CHANGELOG.md src/index.ts

# Validate
npm run check
npm run build

# Commit + tag
git add -A
git commit -m "chore: release v$(node -p \"require('./package.json').version\")"
git tag -a "v$(node -p \"require('./package.json').version\")" \
  -m "v$(node -p \"require('./package.json').version\")"

# Push
git push origin main --follow-tags
```

## What NOT to do

- Don't release with `npm test` failing.
- Don't release with new tools/prompts not documented in `README.md`.
- Don't force-push tags.
- Don't bump major for a backward-compatible addition (that's minor).
- Don't bump minor for a typo fix in a description (that's patch).
