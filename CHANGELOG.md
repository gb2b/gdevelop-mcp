# Changelog

All notable changes to this project are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [0.17.1] — 2026-05-20

### Supply chain hardening

- **Switched to pnpm 11**. `package-lock.json` removed, `pnpm-lock.yaml`
  committed. `packageManager: "pnpm@11.1.2"` pins the version. All docs
  and scripts updated to use `pnpm`.
- **Lifecycle-script allow-list**: pnpm 11 blocks postinstall scripts by
  default. The only packages allowed to run them are declared explicitly
  in `package.json#pnpm.onlyBuiltDependencies` (`@napi-rs/canvas`,
  `esbuild`, `puppeteer`). Transitive rogue postinstalls cannot run.
- **CI installs with `--ignore-scripts --frozen-lockfile`** — install is
  fully deterministic and zero-trust; build/tests run separately.
- **CI runs `pnpm audit --audit-level=high --prod`** on every PR. Fails
  on any high/critical vulnerability in production deps.
- **Dependabot 7-day cooldown** (`semver-patch: 3d`, `semver-minor: 7d`,
  `semver-major: 14d`). GH Actions get 14 days. Most supply-chain attacks
  are detected within hours/days — this keeps us out of the canary zone.
- **New rule** `.claude/rules/supply-chain.md` documents the three-layer
  defense (allow-list + cooldown + audit gate) and the incident response
  playbook.
- **Coverage** activated: `pnpm test:coverage` runs in CI (non-blocking).
- Removed `gdcore-tools` from direct dependencies — already an
  implicit/transitive dep of `gdexporter`, only used for `preview_scene`.

### Internal

- Top-level `pnpm` config in `package.json` lists trusted build-script
  packages.
- `.npmrc` enforces `prefer-frozen-lockfile`, `audit-level=high`,
  `ignore-dep-scripts=true`.

## [0.17.0] — 2026-05-20

### Architecture / refactor

- **Split `src/index.ts`** (1342 → 42 lines) into one `src/tools/*.ts`
  file per family: install, discovery, extensions, catalog, editing,
  safety, assets, examples, github, preview. Each exposes a
  `register*Tools(server)` function. The entry point is now a thin
  wiring file.
- **Path traversal protection**: new `src/core/path-safety.ts` (`validateProjectPath`,
  `validateChildPath`). Applied to every tool handler that accepts a
  project path or extension filename.
- **Removed `STATIC_INSTRUCTIONS`** hardcoded array (~25 entries).
  The C++/JS dynamic parsers cover everything it had, with descriptions
  sourced directly from the GDevelop repo. Catalog source field is now
  `"dynamic-js" | "dynamic-cpp"` (no more `"static"`).

### Tooling (.claude)

- New rule `file-size.md`: src/\*.ts ≤ 500, src/index.ts ≤ 200, tests ≤ 600.
- New rule `maintenance.md`: README/CHANGELOG sync discipline.
- New skill `update-readme/SKILL.md`: checklist on adding/renaming/
  removing a tool.
- New skill `audit-repo/SKILL.md`: quick-audit playbook.
- New agent `repo-reviewer.md`: deeper structural audit.
- New hook `check-file-size.sh`: warns when src/test files exceed limits.
- Updated `code-style.md` to reference the new size rule.
- Updated `CLAUDE.md` to point at the new rules/skills.

### Tests

- +22 tests across 3 new files: `path-safety.test.ts`, `search.test.ts`,
  `wiki.test.ts`. Total: 70 tests (was 48).

### CI / release

- New `.github/workflows/release.yml`: on tag `v*.*.*` push, builds and
  creates a GitHub Release with the matching CHANGELOG section as notes.

### Documentation

- README rewritten: new tool tables (30 tools across 9 families), explicit
  "Getting Started" walkthrough, comparison table with the built-in
  GDevelop AI, accurate architecture diagram, updated badge count.

## [0.16.2] — 2026-05-20

### Fixed

- **`list_variable_types`** missed `String` and `Structure`. Root cause:
  the enum body contains `// Primitive types` / `// Collection types`
  comments; our `split(",")` then `.split(/\s|=/)[0]` returned the `//`
  comment marker before the member name, failing the validator regex.
  Fix: strip C/C++ comments before splitting. Now returns 7 entries
  (Unknown, MixedTypes, String, Number, Boolean, Structure, Array).

- **C++ extensions in `Core/GDCore/Extensions/Builtin/` subdirectories
  were not catalogued**. Big extensions like Sprite live in
  `Builtin/SpriteExtension/SpriteExtension.cpp` (subdir), and we only
  walked the flat layer. Fix: recursive walk of `Builtin/` — every
  `.cpp` inside a subdir is parsed with the subdir-derived extension
  name. Catalogue grows from 1768 to **1831** instructions; queries
  like `list_instructions(extension: "Sprite")` now return all
  Sprite actions/conditions/expressions.

## [0.16.1] — 2026-05-20

### Fixed

- **`list_event_types`** was missing `JsCodeEvent` (the inline-JS event).
  Root cause: GDJS-platform events live in `GDJS/GDJS/Events/Builtin/`
  which wasn't synced (the sync prefix only covered Core + GDJS/Runtime/),
  and the class regex required an API macro (`GD_CORE_API`) which the
  GDJS platform header doesn't use. Fixed both: added the prefix, relaxed
  the regex to accept any optional macro. Now returns 11 event types
  including `BuiltinCommonInstructions::JsCode`.

## [0.16.0] — 2026-05-20

### Fixed

- **`list_event_types`**: regex now matches `gd::BaseEvent` namespace.
  Returns 10 built-in event types (Async, Comment, Else, ForEach,
  ForEachChildVariable, Group, Link, Repeat, Standard, While) with the
  `BuiltinCommonInstructions::<Name>` JSON type and whether each can
  contain sub-events.

### Added

- **`describe_extension(name)`**: one-shot bird's-eye view of an
  extension — paths (Extension.cpp / JsExtension.js / README), file
  list, counts and full listings of actions/conditions/expressions/
  string-expressions, runtime object/behavior file names, README
  excerpt. Example: PlatformBehavior → 28 actions, 21 conditions,
  11 expressions, 2 runtime behaviors.
- **`describe_feature(page)`**: fetches a GDevelop wiki page
  (wiki.gdevelop.io) and returns its main-content area as markdown.
  Follows meta-refresh redirects, strips nav/sidebar/footer, capped at
  100KB.

## [0.15.0] — 2026-05-20

### Added

- **C++ Extension.cpp parser**: the instruction catalog now reads
  `Extensions/<Name>/Extension.cpp` and `Core/GDCore/Extensions/Builtin/*.cpp`
  in addition to `JsExtension.js`. Result: instruction count jumped from
  ~800 to **~1770** — covers all action/condition/expression definitions
  from C++ extensions (Sprite, PlatformBehavior, Physics, etc.). Each
  instruction now carries a `fullName` and `description` extracted from
  the `_(...)` i18n macros.
- **`gdevelop_overview`** tool: returns a concise architectural map of
  GDevelop (where to find what in the source tree + which MCP tool to use
  for each kind of question). Read this BEFORE deep-diving to save tokens.
- **`list_event_types`** tool: built-in event types (Standard, Comment,
  Group, ForEach, Repeat, While, Link, JsCode) parsed from
  `Core/GDCore/Events/Builtin/`.
- **`list_resource_types`** tool: 13 resource types (image, audio, font,
  video, json, spine, tilemap, tileset, …) parsed from
  `Core/GDCore/Project/`.
- **`list_variable_types`** tool: variable primitive types parsed from
  `Core/GDCore/Project/Variable.h` (with hardcoded fallback).

### Changed

- `InstructionSpec.source` is now `"static" | "dynamic-js" | "dynamic-cpp"`
  to distinguish the origin of each entry.
- `buildInstructionCatalog` walks both JS and C++ extension files.

## [0.14.0] — 2026-05-20

### Architecture pivot — GitHub as single source of truth

The parsing pipeline now reads exclusively from a local cache mirrored from
the canonical `4ian/GDevelop` GitHub repo. No more local-desktop fallback,
no more gdcore-tools-bundled fallback for parsing. The cache covers the
exhaustive parsing surface (Core C++ schemas, Core builtin extensions,
all Extensions/, GDJS/Runtime/, TypeScript types), 841 files / ~14 MB at
v5.6.269.

`gdcore-tools` is now used ONLY transitively via `gdexporter` for
`preview_scene` (runtime preview requires libGD.js WASM, no alternative).

### Added

- **`sync_gdevelop_sources`** tool: downloads the canonical source tree from
  GitHub. Idempotent, parallel (default 12), ~14s for ~14 MB. Stores a
  `manifest.json` with ref, sha, timestamps. Defaults to the latest
  GitHub release tag.
- **`check_cache_freshness`** tool: compares cached ref+sha against the
  latest release on GitHub. Cheap, self-throttled (1h TTL).
- **`search_gdevelop_code`** tool: grep-style regex search over the cache,
  with optional path/extension filters and context lines. Use to discover
  where features live before reading specific files. Concise output
  (file + line + matching text + optional context).

### Changed

- `gdevelop_install_info` now reports cache status, manifest details, and
  exposes the local desktop install only as informational data (not a
  parsing source).
- `findGDevelopInstall` resolves to the cache. Throws a clear error if
  no cache exists — guides toward `sync_gdevelop_sources`.

### Removed

- `sync_runtime_types` tool (replaced by `sync_gdevelop_sources`).
- `src/core/runtime-types-cache.ts` (replaced by `src/core/cache.ts`).
- Bundled gdcore-tools fallback path for parsing.

## [0.13.0] — 2026-05-19

### Added

- **`sync_runtime_types` tool**: downloads the GDevelop `.ts` runtime sources
  and `JsExtension.js` files directly from the official `4ian/GDevelop`
  GitHub repository at the matching version tag (auto-detected from
  gdcore-tools). Caches to `~/.cache/gdevelop-mcp/gdjs-types-<ref>/`.
  In bundled mode (no local desktop install), this cache becomes the
  source for the extensions scanner and dynamic catalog parser —
  restoring full per-object type extraction (e.g. `text: string`,
  `bold: boolean` for `TextObject::Text`).
- Auto-detection priority: local desktop > GitHub cache (when bundled) >
  raw gdcore-tools compiled JS (degraded fallback).

### Changed

- `findGDevelopInstall` now resolves `gdcore-tools` via filesystem walk
  (works regardless of the package's exports map).
- `gdevelop_install_info` exposes `bundledGdRef`, `cachedTypeSourcesPath`,
  `typeSourcesPath` for clarity.

### Rationale

`gdcore-tools` is a side-project of a core GDevelop contributor; not
official infrastructure. By sourcing the parseable assets (`.ts`,
`JsExtension.js`) directly from `4ian/GDevelop`, we get the canonical,
versioned, up-to-date types — and we only rely on gdcore-tools indirectly
(via gdexporter, for the WASM runtime needed by `preview_scene`).

## [0.12.0] — 2026-05-19

### Added

- **Cross-platform runtime fallback** via `gdcore-tools` (now a direct
  dependency). If no local desktop GDevelop install is detected, the MCP
  transparently uses the runtime bundled in `node_modules/gdcore-tools/dist/Runtime/`.
  Works in CI, Docker, Linux AppImage, and any setup without a desktop
  install. Force with `GDEVELOP_USE_BUNDLED=true`.
- `check_runtime_freshness` tool — compares the locally bundled
  gdcore-tools version against the npm registry.
- `gdevelop_install_info` now reports `source` (local/bundled), runtime
  version, and whether TypeScript sources are available (affects only
  per-field type extraction in `list_dynamic_catalog`).

### Changed

- `GDevelopInstall` interface gains `source: "local" | "bundled"` and
  `gdjsRuntimeSourcesPath: string | null` (null when bundled).
- `catalog-dynamic` parser now also accepts compiled `.js` runtime files
  (bundled mode). Content-fields extraction is skipped on `.js` but the
  object/behavior name extraction remains.

## [0.11.0] — 2026-05-19

### Added

- **Events** (`add_event`, `remove_event`, `move_event`) as new ops of
  `edit_project`. Full Zod schemas for the 7 built-in event types
  (`Standard`, `Comment`, `Group`, `ForEach`, `Repeat`, `While`, `Link`,
  `JsCode`). Sub-events nesting via `parentPath`; positional inserts
  (`append`/`prepend`/index).
- **Custom events functions extensions** (`add_extension`,
  `add_events_based_object`, `add_events_based_behavior`,
  `add_extension_function`, `add_extension_property`) as new ops of
  `edit_project`. Enables creating reusable custom objects, custom
  behaviors, and free functions with their own parameters and events.
- **Instruction catalog** (`list_instructions`, `describe_instruction`).
  Combines a hand-curated static catalog of ~25 common built-ins with
  dynamic parsing of all `JsExtension.js` files in the local install.
- **Scene events summary** (`summarize_events`): per-type counts and max
  nesting depth without dumping the raw events JSON.
- Tests: `test/events.test.ts`, `test/efe.test.ts`,
  `test/catalog-actions.test.ts` (48 tests total, up from 35).

## [0.10.1] — 2026-05-19

### Changed

- Restructured `src/` into `src/core/` (one concern per file) with clearer
  module names (`install`, `extensions`, `catalog-static`, `catalog-dynamic`,
  `preview-runtime`, `render-static`, `schema`).

### Added

- Tooling: ESLint 10 (flat config), Prettier 3, `@vitest/coverage-v8`,
  `.editorconfig`, `.nvmrc` (Node 22). New scripts `lint`, `lint:fix`,
  `format`, `format:check`, `test:coverage`, `check`.
- GitHub: CI workflow (typecheck + lint + format-check + tests + build),
  Dependabot (weekly npm, monthly actions), bug + feature request issue
  templates, PR template.
- Docs: `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1),
  README badges (CI, license, Node, MCP), `examples/` with smoke-test and
  inspect-project scripts.
- `.claude/skills/release-version` for the release workflow.
- Test coverage extended from 19 to 35 tests: `test/backups.test.ts`,
  `test/asset-import.test.ts` (with mocked fetch), additional edge cases for
  `diff`.

### Dependencies

- zod 3.25 → 4.4
- TypeScript 5.9 → 6.0
- @types/node 22 → 25
- actions/checkout 4 → 6
- actions/setup-node 4 → 6

## [0.10.0] — 2026-05-19

### Added

- `render_scene_static` tool: fast canvas-based static scene preview via
  `@napi-rs/canvas`. Sub-second per scene, no Chromium, no gdexporter.
  Supports Sprite, TextObject, TiledSprite; placeholder wireframe for 3D and
  unknown types.

## [0.9.0] — 2026-05-19

### Added

- `preview_scene` tool: real-runtime preview pipeline using `gdexporter`
  (isolated subprocess) + a static HTTP server + `puppeteer` headless
  Chromium. Captures a PNG screenshot and console logs.

## [0.8.0] — 2026-05-19

### Changed

- `import_asset_into_project` renamed to `import_assets_into_project`.
  Accepts `assetIds[]` (multi-asset) and/or `packTag` (whole pack). Single
  backup per batch, per-asset status reporting.

## [0.7.0] — 2026-05-19

### Added

- 5 MCP prompts (`start-from-example`, `add-hero`, `debug-project`,
  `browse-store`, `safe-edit-flow`).

## [0.6.0] — 2026-05-19

### Added

- `list_backups`, `undo_last_edit`, `diff_projects` (semantic diff).
- `import_asset_into_project` for downloading and inserting public-store assets.

## [0.5.0] — 2026-05-19

### Added

- `inspect_project` tool (compact summary).
- Safeguards on `edit_project`: baseline validation, auto `.bak-<timestamp>`,
  change summary, atomic write-to-temp + rename.

## [0.4.0] — 2026-05-19

### Added

- `edit_project` tool with atomic batch operations (`add_layout`, `add_object`,
  `add_instance`, `attach_behavior`).
- `list_dynamic_catalog` tool: TypeScript runtime parsing of the local GDJS
  install for automatic object/behavior discovery.
- Advanced validation (cross-references, instance→object integrity).

## [0.3.0] — 2026-05-19

### Added

- Asset store integration: `list_asset_packs`, `search_assets`,
  `get_asset_details`, `list_asset_filters` against the public CDN.
- Example projects integration: `list_examples`, `get_example_details`,
  `list_example_filters` against the public CDN.

## [0.2.0] — 2026-05-19

### Added

- `read_github_source` for fetching code from `4ian/GDevelop` or
  `GDevelopApp/GDevelop-examples`.

## [0.1.0] — 2026-05-19

### Added

- Initial MCP server with 7 tools: install detection, extension listing,
  static catalog (objects/behaviors), schema description, raw extension source
  reader, and top-level project validation.
