# Onboarding — gdevelop-mcp

Welcome. This document gets you from `git clone` to "I can ship a PR" in
under 30 minutes. Read it once, then skim the linked rules.

## What this project is

A Model Context Protocol (MCP) server that gives LLM agents (Claude
Code, Cursor, etc.) full agency over [GDevelop](https://gdevelop.io/)
projects: read structure, validate, edit events/objects/instances,
import assets, preview scenes.

It is the free open-source alternative to GDevelop's paid AI assistant.
Source of truth for GDevelop internals is the upstream
[4ian/GDevelop](https://github.com/4ian/GDevelop) repository, mirrored
into a local cache (`~/.cache/gdevelop-mcp/`).

## Prerequisites

- **Node 18+** (Node 22 recommended; matches `.nvmrc`).
- **pnpm 11.1.2** (pinned by `packageManager` in `package.json`). If you
  use Corepack: `corepack enable && corepack prepare pnpm@11.1.2`.
- **macOS / Linux**. Windows isn't tested.
- For preview features (optional): Chrome/Chromium for `puppeteer`.

## Bootstrap

```bash
git clone git@github.com:gb2b/gdevelop-mcp.git
cd gdevelop-mcp
pnpm install --frozen-lockfile
pnpm build
pnpm check         # typecheck + lint + tests
```

If `pnpm install` complains about unapproved postinstall scripts, run
`pnpm approve-builds` — the allow-list is in `package.json` under
`pnpm.onlyBuiltDependencies` (`@napi-rs/canvas`, `esbuild`, `puppeteer`).
Don't add packages here without reviewing them; see
[`.claude/rules/supply-chain.md`](.claude/rules/supply-chain.md).

## Project layout

```
src/
├── index.ts               # MCP server entry — keep < 200 lines
├── prompts.ts             # workflow prompts (create-platformer, etc.)
├── tools/                 # one file per tool family
│   ├── editing.ts         # edit_project, inspect_project, diff_projects, …
│   ├── catalog.ts         # list/describe_instruction, list_object_types, …
│   ├── discovery.ts       # gdevelop_overview, describe_feature, …
│   ├── extensions.ts      # list/describe_extension, read_extension_source
│   ├── safety.ts          # list_backups, validate_project
│   ├── assets.ts          # search_assets, import_assets_into_project, …
│   ├── examples.ts        # list_examples, get_example_details
│   ├── github.ts          # read_github_source
│   ├── preview.ts         # preview_scene, render_scene_static
│   ├── install.ts         # sync_gdevelop_sources, check_cache_freshness, …
│   └── templates.ts       # quick_start_template
└── core/                  # business logic — no MCP types here
    ├── edit.ts            # main editProject orchestrator
    ├── edit-add-ops.ts    # add_layout/object/instance, attach_behavior
    ├── edit-remove-rename.ts # remove_*, rename_object, set_object_property
    ├── edit-misc-ops.ts   # variables, groups, resources, externals
    ├── edit-summary.ts    # EditSummary type + recordOp
    ├── catalog-parsers.ts # C++/JS source parser (receivers + parameters)
    ├── catalog-actions.ts # InstructionSpec catalog
    ├── object-content-schemas.ts # zod schemas for built-in object content
    ├── validation.ts      # validateProjectData
    ├── events.ts          # add/remove/move event ops
    ├── efe.ts             # events-functions-extensions ops
    ├── templates.ts       # quickStartTemplate (4 genres)
    ├── github.ts          # cache + GitHub mirror
    ├── path-safety.ts     # validateProjectPath / validateChildPath
    └── …
test/                      # vitest, mirrors src/ structure
.claude/                   # rules, hooks, agents for Claude Code users
```

### File-size discipline

- `src/index.ts` ≤ 200 lines (thin wiring)
- Every other `src/**/*.ts` ≤ 500 lines (split if it grows)
- Tests ≤ 600 lines

If a file is creeping toward the limit, extract a helper into a sibling
module. See [`.claude/rules/file-size.md`](.claude/rules/file-size.md).

## Day-to-day commands

```bash
pnpm dev                 # run server in dev mode (tsx)
pnpm build               # tsc → dist/
pnpm typecheck           # tsc --noEmit
pnpm test                # vitest run
pnpm test:watch          # vitest in watch mode
pnpm test:coverage       # vitest + v8 coverage (HTML in coverage/index.html)
pnpm lint                # eslint
pnpm format              # prettier write
pnpm check               # typecheck + lint + tests (run before commit)
pnpm audit:supply-chain  # pnpm audit --audit-level=high --prod
pnpm inspect             # MCP Inspector (interactive tool browser)
```

The opt-in integration test (`test/integration.test.ts`) requires a
populated cache. Run `pnpm dev` once and trigger
`sync_gdevelop_sources` through the MCP Inspector, then:

```bash
GDEVELOP_MCP_INTEGRATION=1 pnpm test
```

## Architecture rules (do not bend)

These are codified in [`.claude/rules/`](.claude/rules/); skim them
before your first PR.

1. **GitHub is the source of truth.** Parsers read from
   `~/.cache/gdevelop-mcp/ref-<tag>/`. The only allowed use of
   `gdcore-tools` is via `gdexporter` for the runtime preview.
2. **Stdio safety.** MCP transport owns `stdout`. Never `console.log`
   from runtime code — use `src/core/logger.ts`, which writes to
   `stderr` only.
3. **Path safety.** All user-supplied paths go through
   `validateProjectPath` (or `validateChildPath`). Null-byte + traversal
   checked.
4. **Atomic writes.** Use write-to-temp + rename, with a timestamped
   `.bak-<ts>.json` next to the project for every edit (unless
   `backup: false`).
5. **Subprocess safety.** Use `execFile` / `spawn` with arg arrays —
   never assemble a shell string. A repo hook warns if a banned pattern
   slips into the diff.
6. **Supply chain.** New deps need: justification, audit pass, and a
   review of `pnpm.onlyBuiltDependencies` if they have postinstall
   scripts. Dependabot enforces a 7-day cooldown — see
   [`.github/dependabot.yml`](.github/dependabot.yml).
7. **README / CHANGELOG sync.** Any new tool, prompt, or breaking
   change → update both before merging. See
   [`.claude/rules/maintenance.md`](.claude/rules/maintenance.md).

## Adding a new tool

1. Decide which `src/tools/<family>.ts` file it belongs to (or create
   one if it's a new family).
2. Implement the business logic in `src/core/<topic>.ts` (no MCP types
   here — keep core pure).
3. Wrap it in `src/tools/<family>.ts`: declare a zod input schema,
   wire validation, return `textResult(...)`. Use `errorResult` for
   user-facing errors.
4. Register it in `src/index.ts` (one line: `registerXTools(server)`).
5. Add tests in `test/<topic>.test.ts`.
6. Update `test/mcp-smoke.test.ts` — add the tool name to the expected
   list.
7. Bump version + CHANGELOG entry. See
   [`.claude/skills/release-version/SKILL.md`](.claude/skills/release-version/SKILL.md).

## Adding a new `edit_project` op

1. Add schema + apply function to `src/core/edit-misc-ops.ts` (or
   another `edit-*-ops.ts` if it fits a category).
2. Reference it in the `EditOpSchema` union in `src/core/edit.ts`.
3. Wire the apply function into the switch in `editProject(...)`.
4. Add the new summary field to `EditSummary` in `edit-summary.ts`,
   then a case in `recordOp(...)`.
5. Document the op in `src/tools/editing.ts` (in the `edit_project`
   tool description).
6. Add a test in `test/edit-*-ops.test.ts`.

## Cutting a release

See [`.claude/skills/release-version/SKILL.md`](.claude/skills/release-version/SKILL.md).
Tl;dr: bump `package.json` + `src/index.ts`, finalize CHANGELOG,
`git tag -a vX.Y.Z`, push with `--follow-tags`. The release workflow
auto-creates the GitHub Release.

## Where to get help

- For GDevelop internals: read the upstream wiki via
  `describe_feature(slug, ...)` from the MCP itself (meta!).
- For Claude Code conventions: [`.claude/rules/`](.claude/rules/).
- For supply-chain decisions:
  [`.claude/rules/supply-chain.md`](.claude/rules/supply-chain.md).

## What this codebase deliberately does NOT do

- No telemetry, no analytics, no phone-home.
- No fallback to a local GDevelop install for parsing — cache or
  bust. (`gdexporter` is the sole exception, for runtime preview.)
- No code that runs at import-time other than module registration.
- No `eval`, no dynamic `Function` construction.
- No production logging to stdout. (See rule #2.)

Welcome aboard.
