# gdevelop-mcp

[![CI](https://github.com/gb2b/gdevelop-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/gb2b/gdevelop-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](./package.json)
[![MCP](https://img.shields.io/badge/MCP-server-blue)](https://modelcontextprotocol.io)

An [MCP](https://modelcontextprotocol.io) server that gives any MCP-aware
LLM agent (Claude Code, Cursor, …) full agency over a
[GDevelop](https://gdevelop.io) project: introspect, search, edit, preview.

> **30 tools · 5 prompts · GitHub-canonical catalog · safe-by-default editing
> · runtime + static preview**

## Why

GDevelop ships a paid AI assistant built into the editor. This project is
the free, open-source alternative — and arguably a more powerful one, because
the agent reads **directly from the canonical `4ian/GDevelop` GitHub repo**,
not a curated snapshot.

What you can do with an agent that speaks gdevelop-mcp:

- **Build a game from a prompt.** "Adapt the official platformer example
  into a 3-level platformer with my own hero sprite." The agent will use
  `list_examples`, `read_github_source`, `search_assets`, `edit_project`
  and `preview_scene` end-to-end.
- **Inspect any GDevelop feature exhaustively.** ~1830 actions/conditions/
  expressions, 11 event types, 47+ extensions, 13 resource types, 5
  variable types — all extracted from the official source tree, not
  hand-curated.
- **Edit projects safely.** Every write goes through baseline validation,
  atomic write-to-temp + rename, timestamped backups, semantic diff.
  `undo_last_edit` is one tool call away.
- **Get a real preview** of any scene without leaving the agent loop —
  either a fast static render (`render_scene_static`, <1s) or a real-runtime
  capture in headless Chromium (`preview_scene`, ~10s).

### vs. GDevelop's built-in AI

|                       | Built-in AI (paid)           | gdevelop-mcp (this project)                                                          |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Cost                  | Subscription (Silver / Gold) | Free, open source                                                                    |
| Underlying model      | GDevelop's choice            | Whatever your MCP-compatible client supports                                         |
| Tool surface          | Edit-only, opinionated       | 30 composable tools (introspect, search, edit, preview, asset store, examples, wiki) |
| Asset store           | Yes, paid premium            | Yes, public CC0 + open-license packs                                                 |
| Examples              | Yes, official                | Yes, all 281 official MIT examples                                                   |
| Custom workflows      | Limited                      | Any agent prompt + tool chain                                                        |
| Where the truth lives | Editor's snapshot            | `4ian/GDevelop` GitHub repo at the version you choose                                |

## Install

```bash
git clone https://github.com/gb2b/gdevelop-mcp
cd gdevelop-mcp
pnpm install
pnpm build
```

> Requires Node 18+ and **pnpm 11+** (enabled via Corepack on modern Node).
> Puppeteer downloads Chromium (~170 MB) on first install.
> Supply-chain protections are on by default: lifecycle scripts are
> blocked except for the explicit allow-list (`@napi-rs/canvas`,
> `esbuild`, `puppeteer`); Dependabot waits 7 days before proposing new
> releases. See [`.claude/rules/supply-chain.md`](./.claude/rules/supply-chain.md)
> for the full policy.

Wire the MCP into your agent. For Claude Code, drop a `.mcp.json` in your
project (or your home) with:

```json
{
  "mcpServers": {
    "gdevelop": {
      "command": "node",
      "args": ["/absolute/path/to/gdevelop-mcp/dist/index.js"]
    }
  }
}
```

Restart your agent. Tools appear as `mcp__gdevelop__*`. Prompts appear as
slash-commands (e.g. `/gdevelop:add-hero`).

## Getting started

Before tools that need GDevelop's source can do anything useful, fetch the
canonical sources once:

```text
agent> sync_gdevelop_sources()
  → downloads ~900 files (~14 MB) into ~/.cache/gdevelop-mcp/
agent> gdevelop_overview()
  → returns a 1-2K-token architecture map: read it to know where to dig
agent> list_examples(query: "platformer")
  → discover what's available
agent> edit_project(path: "/path/to/game.json", operations: [...], dryRun: true)
  → preview a change
agent> preview_scene(projectPath: "/path/to/game.json")
  → screenshot the actual rendered game
```

## Tool reference

### Install & cache (5)

| Tool                      | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `gdevelop_install_info`   | Cache state + manifest + optional local desktop install info       |
| `sync_gdevelop_sources`   | Download / refresh canonical sources from `4ian/GDevelop`          |
| `check_cache_freshness`   | Compare cached ref against latest GDevelop release                 |
| `check_runtime_freshness` | Compare bundled gdcore-tools (used by `preview_scene`) against npm |
| `gdevelop_overview`       | Architectural map + tool-pointer map (read first to save tokens)   |

### Discovery (5)

| Tool                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `search_gdevelop_code` | Grep-style regex over the cache (path/ext filters, context lines) |
| `describe_feature`     | Fetch a GDevelop wiki page as markdown                            |
| `list_event_types`     | 11 built-in event types (Standard, ForEach, JsCode, …)            |
| `list_resource_types`  | 13 resource kinds (image, audio, font, …)                         |
| `list_variable_types`  | 5+ variable primitives                                            |

### Extensions (4)

| Tool                    | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `list_extensions`       | All extensions in the cache                                                  |
| `read_extension_source` | Raw .ts/.js/.cpp of any extension file                                       |
| `list_dynamic_catalog`  | Auto-parsed objects/behaviors with field types                               |
| `describe_extension`    | Bird's-eye view: actions + conditions + expressions + runtime files + README |

### Catalog (5)

| Tool                     | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `list_object_types`      | Curated object types                                           |
| `list_behavior_types`    | Curated behavior types                                         |
| `describe_object_schema` | Schema + content example for a type                            |
| `list_instructions`      | ~1830 actions/conditions/expressions parsed live from C++ + JS |
| `describe_instruction`   | All catalog entries matching a type (e.g. `SimulateJumpKey`)   |

### Templates (1)

| Tool                   | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `quick_start_template` | Scaffold a valid GDevelop project (blank/platformer/topdown/shmup) |

### Editing & safety (7)

| Tool                        | Purpose                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inspect_project`           | Compact human-readable project summary                                                                                                               |
| `validate_project`          | Structural + cross-reference validation                                                                                                              |
| `find_in_events`            | Regex grep over the events tree (refactoring audit)                                                                                                  |
| `list_project_dependencies` | Inventory of object/behavior/resource/instruction types used                                                                                         |
| `edit_project`              | Atomic batch ops: layouts, objects, instances, behaviors, **events**, **custom extensions**, **variables**, **groups**, **resources**, **externals** |
| `summarize_events`          | Per-type breakdown + max depth of a scene's events tree                                                                                              |
| `list_backups`              | Backup files for a project                                                                                                                           |
| `undo_last_edit`            | Restore most recent backup (reversible — itself backed up first)                                                                                     |
| `diff_projects`             | Semantic diff (added/removed/modified)                                                                                                               |

### Asset store (5)

| Tool                         | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `list_asset_packs`           | 129+ public packs (Kenney, Foliage, Space Shooter, …)   |
| `search_assets`              | 11k+ individual assets (sprites/tilemaps/audio/prefabs) |
| `get_asset_details`          | Ready-to-insert GDevelop object JSON                    |
| `list_asset_filters`         | Available tags & categories                             |
| `import_assets_into_project` | Download + insert one, several, or a whole pack         |

### Examples (3)

| Tool                   | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `list_examples`        | 281 official MIT-licensed example projects |
| `get_example_details`  | Metadata + GitHub source path              |
| `list_example_filters` | Available tags                             |

### GitHub fallback (1)

| Tool                 | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `read_github_source` | Fetch any file/dir from `4ian/GDevelop` or `GDevelopApp/GDevelop-examples` |

### Preview (2)

| Tool                  | Purpose                                 | Speed |
| --------------------- | --------------------------------------- | ----- |
| `render_scene_static` | Canvas-based static layout render       | <1s   |
| `preview_scene`       | Real runtime via gdexporter + puppeteer | ~10s  |

## Prompts (slash-commands)

| Prompt               | Use                                                                   |
| -------------------- | --------------------------------------------------------------------- |
| `start-from-example` | Bootstrap by learning from an official example                        |
| `add-hero`           | Find a CC0 hero sprite + wire the right movement behavior             |
| `debug-project`      | Diagnose a broken project (validate / inspect / diff against backups) |
| `browse-store`       | Curated asset search + import flow for a theme                        |
| `safe-edit-flow`     | Force inspect → dryRun → apply → verify                               |

## Safety design

Every edit goes through:

1. **Baseline validation** — refuses to edit a project that already has errors
2. **Atomic batch** — all ops succeed or none are applied
3. **Auto backup** — `<file>.bak-<timestamp>` created before writing
4. **Validation post-batch** — refuses to write an invalid result
5. **Atomic write** — tempfile + rename (crash-safe)
6. **Reversible** — `undo_last_edit` restores from any backup, itself backed up
7. **Path validation** — every project-path tool input is normalized + null-byte-checked

Combined with `dryRun: true` and `diff_projects`, you can preview, apply, and
audit every change. See [`.claude/rules/safety.md`](./.claude/rules/safety.md)
for the full contract.

## Architecture

```
~/.cache/gdevelop-mcp/
└── ref-v5.6.269/          # canonical sources, mirrored from 4ian/GDevelop
    ├── Core/              # C++ schemas + builtin extensions
    ├── Extensions/        # individual extensions (C++ + JS + TS)
    └── GDJS/              # JS runtime engine

src/
├── index.ts               # MCP server entry (~40 lines, thin)
├── prompts.ts             # MCP prompts (slash commands)
├── tools/                 # one file per tool family
│   ├── install.ts         # cache management
│   ├── discovery.ts       # search, wiki, event/resource/variable lists
│   ├── extensions.ts      # extension introspection
│   ├── catalog.ts         # objects, behaviors, instructions catalog
│   ├── editing.ts         # validate, edit, inspect, summarize
│   ├── safety.ts          # backups, undo, diff
│   ├── assets.ts          # public asset store
│   ├── examples.ts        # official example projects
│   ├── github.ts          # GitHub fallback
│   └── preview.ts         # runtime + static rendering
└── core/                  # business logic (one concern per file)

test/                      # vitest unit tests
.claude/                   # repo-level Claude Code configuration
```

## Limitations

- Static preview can't render full 3D, animations, behaviors, shaders, or
  custom effects. For that, use `preview_scene`.
- `gdexporter` (transitive dep, used only by `preview_scene`) is a third-party
  wrapper by a core GDevelop contributor and still beta. If it breaks on a
  new GDevelop version, file an issue.
- The asset store CDN used here is the **public** one — no auth, no premium,
  no private packs.
- Wiki integration scrapes the page — depends on the wiki keeping its
  current HTML structure.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Repo conventions live in
[`CLAUDE.md`](./CLAUDE.md) + [`.claude/`](./.claude/).

## License

MIT — see [`LICENSE`](./LICENSE).
