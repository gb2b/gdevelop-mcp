# Supply-chain safety rules

This repo lives downstream of npm/pnpm. Recent compromises in popular
packages (e.g. some TanStack ecosystem incidents, event-stream, ua-parser-js,
node-ipc) show that any transitive dependency can become a vector. We have
**three layers of defense** — keep all of them in place.

## Layer 1 — `pnpm` with strict build allow-list

We use **pnpm** (declared in `packageManager` + `engines`). pnpm 11+ blocks
postinstall scripts by default. The set of packages allowed to run
lifecycle scripts is explicit, declared in `package.json`:

```jsonc
"pnpm": {
  "onlyBuiltDependencies": [
    "@napi-rs/canvas",   // native binding download
    "esbuild",           // native binary
    "puppeteer"          // Chromium download
  ]
}
```

**Rule:** never add a package to `onlyBuiltDependencies` casually. The
question "does this need to run a script?" is the question "do I trust
this maintainer with arbitrary code execution at install time?" If you
don't know the maintainer's track record, the answer is no — find a
build-script-free alternative or pin to a known-safe version.

In CI we use `--ignore-scripts` for the install + we call build/tests
afterward in our own scripts. That keeps CI's `pnpm install` step
deterministic and zero-trust.

## Layer 2 — Dependabot **with 7-day cooldown**

Most supply-chain compromises are caught within hours-to-days by the
broader ecosystem. We don't need to be the canary. `.github/dependabot.yml`
ships with:

```yaml
cooldown:
  default-days: 7
  semver-major-days: 14
  semver-minor-days: 7
  semver-patch-days: 3
```

So Dependabot **only proposes a version once it's been on npm for that
many days**. Combined with the build allow-list, that's enough to filter
out the rapid-incident classes of attack.

**Rule:** if you need to bypass the cooldown (e.g. urgent security patch),
do it explicitly:
- Open a PR that pins the exact known-good version.
- In the PR body, explain why the cooldown is being skipped and link the
  CVE / advisory.
- Get a second pair of eyes before merging.

## Layer 3 — CI audit gate

CI runs `pnpm audit --audit-level=high --prod` on every PR. The job fails
on any `high` or `critical` vulnerability in **production** deps. Dev-only
vulnerabilities don't fail the build but show up in the log.

**Rule:** never merge with a failed audit. Either:
- Bump the affected package (preferred).
- Add a temporary `pnpm.overrides` pinning a patched transitive.
- Accept the risk (rarely justified) — only after writing the rationale
  in `CHANGELOG.md` under "Security".

## Bonus — manual hygiene

- **Lockfile is committed and authoritative.** Never edit `pnpm-lock.yaml`
  by hand. CI uses `--frozen-lockfile` to guarantee install determinism.
- **No `latest` tags in `package.json`.** Always pin a semver range
  (`^x.y.z`, not `*`).
- **No `git://` or `http://` dependencies.** Only the npm registry.
- **Before publishing**, run `pnpm publish --dry-run` and verify the
  packed file list matches what's in `files` in `package.json`. We don't
  want to leak `.env`-likes into the registry tarball.

## What to do when a supply-chain incident is reported

1. Don't panic. Most incidents affect transitive deps that we don't ship.
2. Run `pnpm why <package>` to see if and how the affected package is in
   our tree.
3. If the package is in `prod` deps: hot-patch via `pnpm.overrides`,
   ship a `0.x.y+1` patch release with a `Security` CHANGELOG entry.
4. If it's only in `dev` deps: bump the affected package on the next
   regular update; no emergency release needed.
5. Document the incident in `SECURITY.md` under a `## Incidents` section.
