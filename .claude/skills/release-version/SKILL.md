---
name: release-version
description: Use when cutting a new gdevelop-mcp release. Bumps the version, finalizes CHANGELOG, tags the commit, and (optionally) pushes/publishes.
---

# Releasing a new version

This project follows [Semantic Versioning](https://semver.org/).
Patches (`0.10.0 → 0.10.1`) for bug fixes, minor (`0.10.0 → 0.11.0`) for
new tools/prompts, major when we break the public tool API.

## Checklist

- [ ] `main` is clean, `git status` shows no uncommitted changes.
- [ ] CI is green on the latest commit.
- [ ] `pnpm check` passes locally (typecheck + lint + tests).
- [ ] `pnpm audit --audit-level=high --prod` passes (no high-severity
      vulnerabilities in production deps).
- [ ] Pick the new version. Edit `package.json` `"version"` AND
      `src/index.ts` `McpServer({ version: "X.Y.Z" })`. The two must match.
- [ ] Move pending content in `CHANGELOG.md` under a new
      `## [X.Y.Z] — YYYY-MM-DD` heading.
- [ ] Update `README.md`'s tool/prompt counts if they changed (see
      [`update-readme`](../update-readme/SKILL.md)).
- [ ] `pnpm build` produces a clean `dist/`.
- [ ] Commit: `git commit -am "chore: release vX.Y.Z"`.
- [ ] Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
- [ ] `git push origin main --follow-tags`. The GitHub Release workflow
      will pick the tag up and create the GitHub Release with the
      matching CHANGELOG section.
- [ ] (Optional) Publish to npm: see the npm Publish section below.

## Reference commands

```bash
# After editing files manually:
pnpm check
pnpm build

# Commit + tag
git add -A
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag -a "v$(node -p "require('./package.json').version")" \
  -m "v$(node -p "require('./package.json').version")"

# Push (release workflow runs)
git push origin main --follow-tags
```

## npm Publish (optional)

We publish so users can `npx gdevelop-mcp` instead of cloning.

### One-time setup

1. Create an npm account, enable 2FA.
2. Create an npm automation token (Settings → Access Tokens →
   Granular → "Publish + auth-only", expires 1 year).
3. Add it as `NPM_TOKEN` in the GitHub repo's Settings → Secrets.
4. Verify `package.json` is publish-ready:
   - `"name": "gdevelop-mcp"` — confirm the name is free on npmjs.com
   - `"version"` matches the tag we're about to push
   - `"main"` and `"bin"` point to files under `dist/`
   - `"files": ["dist", "data"]` — minimal — no test, no .claude, no src
   - `"license": "MIT"` (or your choice)
   - `"repository"`, `"homepage"`, `"bugs"` filled

### Each release

```bash
# Dry-run to inspect what would be packed (catches secrets / stray files)
pnpm publish --dry-run --access public

# Real publish (interactive 2FA challenge)
pnpm publish --access public
```

Or automate via `.github/workflows/release.yml` — see the publish
section there.

## What NOT to do

- Don't release with `pnpm test` failing.
- Don't release with new tools/prompts not documented in `README.md`
  (use [`update-readme`](../update-readme/SKILL.md)).
- Don't force-push tags.
- Don't bump major for a backward-compatible addition (that's minor).
- Don't bump minor for a typo fix in a description (that's patch).
- Don't publish without running `--dry-run` first.
- Don't publish from a feature branch — always from `main` after merge.
