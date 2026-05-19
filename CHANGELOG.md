# Changelog

All notable changes to this project are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

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
