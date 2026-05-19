# gdevelop-mcp

An [MCP](https://modelcontextprotocol.io) server for
[GDevelop](https://gdevelop.io) — gives any MCP-aware LLM agent
(Claude Code, Cursor, etc.) the ability to introspect, validate, edit,
preview, and enrich GDevelop projects.

> 24 tools · 5 prompts · safe-by-default editing · runtime + static preview

## Why

GDevelop has its own paid AI integration baked into the editor. This project
is a free, open-source alternative that you can plug into any MCP-compatible
agent and use to:

- **Inspect** a project (`inspect_project`, `validate_project`)
- **Discover** what's available locally (`list_extensions`,
  `list_dynamic_catalog`, `describe_object_schema`)
- **Edit** projects atomically (`edit_project` with `dryRun`, backups, and
  baseline validation)
- **Browse public assets** (11 616 CC0 sprites/audio/tilemaps via
  `search_assets`)
- **Browse example projects** (281 MIT games via `list_examples`)
- **Import assets** into your project (one, several, or a whole pack)
- **Preview**: a fast canvas-based static render (`render_scene_static`,
  <1s) **and** a real-runtime preview via gdexporter + puppeteer
  (`preview_scene`, ~10s)
- **Undo & diff** any edit via `list_backups`, `undo_last_edit`,
  `diff_projects`

All powered by a combination of:
- Your local GDevelop install (the TypeScript runtime sources shipped with the
  desktop app — auto-detected on macOS / Linux / Windows)
- GDevelop's public CDN for assets, examples, and filters
- GitHub for full-source fallback (`read_github_source`, repos:
  `4ian/GDevelop` and `GDevelopApp/GDevelop-examples`)

## Install

```bash
npm install
npm run build
```

> Requires Node 18+. Puppeteer downloads Chromium (~170 MB) on first install.

Then wire the MCP into your agent. For Claude Code, drop a `.mcp.json` in
your project (or your home) with:

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

Restart your agent. The tools appear as `mcp__gdevelop__*`. The prompts
appear as slash-commands (e.g. `/gdevelop:add-hero`).

## Tool reference

### Introspection

| Tool | Purpose |
|---|---|
| `gdevelop_install_info` | Which GDevelop install is detected |
| `list_extensions` | All extensions in your local GDJS install |
| `list_object_types` | Curated catalog of object types |
| `list_behavior_types` | Curated catalog of behavior types |
| `describe_object_schema` | Schema + content example for a type |
| `list_dynamic_catalog` | Auto-parsed catalog from your GDJS sources |
| `read_extension_source` | Raw TS/JS source of any extension file |
| `read_github_source` | Fetch any file from the GDevelop GitHub repos |

### Editing & safety

| Tool | Purpose |
|---|---|
| `inspect_project` | Compact summary of a project |
| `validate_project` | Structural + cross-reference validation |
| `edit_project` | Atomic batch ops (`add_layout`/`add_object`/`add_instance`/`attach_behavior`) |
| `list_backups` | List `.bak-*` files for a project |
| `undo_last_edit` | Restore the latest (or a specific) backup |
| `diff_projects` | Semantic diff between two projects |

### Assets

| Tool | Purpose |
|---|---|
| `list_asset_packs` | 129 official packs (Kenney, Foliage, etc.) |
| `list_asset_filters` | Available tags |
| `search_assets` | Search 11k+ public assets (CC0 by default) |
| `get_asset_details` | Full GDevelop-ready object JSON |
| `import_assets_into_project` | Download + insert one, several, or a whole pack |

### Examples

| Tool | Purpose |
|---|---|
| `list_examples` | 281 official MIT-licensed example projects |
| `list_example_filters` | Available tags |
| `get_example_details` | Metadata + GitHub source path |

### Preview

| Tool | Purpose | Speed |
|---|---|---|
| `render_scene_static` | Canvas-based static layout render | <1s |
| `preview_scene` | Real runtime via gdexporter + puppeteer | ~10s |

## Prompts (slash-commands)

| Prompt | Use |
|---|---|
| `start-from-example` | Bootstrap by learning from an official example |
| `add-hero` | Find a CC0 hero sprite + wire the right movement behavior |
| `debug-project` | Diagnose a broken project (validate / inspect / diff against backups) |
| `browse-store` | Curated asset search + import flow for a theme |
| `safe-edit-flow` | Enforce inspect → dryRun → apply → verify |

## Safety design

Every edit goes through:

1. **Baseline validation** — refuses to edit a project that already has errors
2. **Atomic batch** — all ops succeed or none are applied
3. **Auto backup** — `<file>.bak-<timestamp>` created before writing
4. **Validation post-batch** — refuses to write an invalid result
5. **Atomic write** — tempfile + rename (crash-safe)
6. **Reversible** — `undo_last_edit` restores from any backup, itself backed up

Combined with `dryRun: true` and `diff_projects`, you can preview, apply, and
audit every change.

## Project structure

```
src/
├── index.ts          # MCP server entry, tool registrations
├── prompts.ts        # MCP prompts
└── core/             # business logic (one concern per file)

test/                 # vitest tests
.claude/              # repo-level Claude Code configuration
CLAUDE.md             # entry point for agents
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`CLAUDE.md`](./CLAUDE.md) for more.

## Limitations

- Static preview can't render full 3D, animations, behaviors, shaders, or
  custom effects. For that, use `preview_scene` (which runs the real GDJS
  runtime in headless Chromium).
- `gdexporter` is a third-party wrapper (by a core GDevelop contributor) and
  is still beta. If it breaks on a new GDevelop version, file an issue.
- The asset store API used here is the public CDN — no auth, no premium
  assets, no private packs.

## License

MIT — see [`LICENSE`](./LICENSE).
