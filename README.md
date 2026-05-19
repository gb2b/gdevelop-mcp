# gdevelop-mcp

MCP server that gives Claude (and any other MCP-compatible agent) introspection
into a local GDevelop install and validation for GDevelop project files.

## What it does

Twelve tools, all read-only:

### Local install introspection

| Tool | Purpose |
|---|---|
| `gdevelop_install_info` | Report which GDevelop install was detected |
| `list_extensions` | List all extensions present in your GDevelop install |
| `list_object_types` | List known object types (internal JSON identifiers) |
| `list_behavior_types` | List known behavior types |
| `describe_object_schema` | Show the content schema and an example for a type |
| `read_extension_source` | Read raw source of any GDJS extension file |
| `validate_project` | Parse and validate a `.json` GDevelop project |

### GitHub fallback

| Tool | Purpose |
|---|---|
| `read_github_source` | Fetch a file or list a directory from 4ian/GDevelop on GitHub |

### Asset store (public CDN, no auth required)

| Tool | Purpose |
|---|---|
| `list_asset_packs` | List 100+ asset packs (Foliage, Space Shooter, etc.) |
| `search_assets` | Search 11k+ sprites/audio/tilemaps by name, tag, type, license |
| `get_asset_details` | Get full asset JSON — ready to insert in a project |
| `list_asset_filters` | Discover available tags and categories |

### Example projects (public CDN + GitHub, MIT-licensed)

| Tool | Purpose |
|---|---|
| `list_examples` | Search the 281 official example games |
| `get_example_details` | Get metadata + GitHub source path for an example |
| `list_example_filters` | Discover available tags |

### Editing (atomic, validated, safe-by-default)

| Tool | Purpose |
|---|---|
| `inspect_project` | Compact human-readable summary of a project (scenes, objects with behaviors, counts). Use BEFORE and AFTER editing. |
| `edit_project` | Apply a batch of semantic operations (`add_layout`, `add_object`, `add_instance`, `attach_behavior`) atomically. Baseline validation, auto-backup, change summary, write-to-temp + rename. |
| `list_dynamic_catalog` | Auto-discovered catalog of objects/behaviors parsed from your local GDJS sources |

### Recommended flow

```
1. inspect_project(path)                    → see current state
2. edit_project(path, ops, dryRun:true)     → preview & validate
3. edit_project(path, ops, dryRun:false)    → apply (auto backup)
4. inspect_project(path)                    → confirm
```

Each `edit_project` call:
- **Refuses** to edit a project that already has errors (unless `requireBaselineValid: false`)
- **Creates** a timestamped `.bak-YYYY-MM-DD...` next to the file (unless `backup: false`)
- **Returns** a `summary` detailing exactly what changed
- **Writes atomically** (tempfile + rename) so a crash mid-write can't corrupt the project

### Undo, diff, and asset import

| Tool | Purpose |
|---|---|
| `list_backups` | List all `.bak-*` files for a project, sorted most recent first |
| `undo_last_edit` | Restore the most recent (or a specific) backup. The current file is itself backed up as `.bak-...-pre-restore`. |
| `diff_projects` | Semantic diff between two project files (layouts/objects/behaviors added/removed/modified) |
| `import_asset_into_project` | Download an asset from the public store and insert it into a project (downloads files, registers resources, adds object, optionally places an instance) |

### Prompts (slash commands in Claude Code)

| Prompt | Use |
|---|---|
| `start-from-example` | Learn from one of the 281 official examples and adapt patterns into your project |
| `add-hero` | Find a CC0 hero sprite + wire the right movement behavior (platformer or topdown) |
| `debug-project` | Diagnose a broken project (validate, inspect, diff against backups) |
| `browse-store` | Curated asset search + import flow for a given theme |
| `safe-edit-flow` | Forces the assistant to follow inspect → dryRun → apply → verify rigorously |

### Runtime preview (real rendering)

| Tool | Purpose |
|---|---|
| `preview_scene` | Export the project to HTML5 via gdexporter, serve it locally, run it in headless Chromium (puppeteer), capture a real-runtime PNG screenshot + console logs |

Pipeline:
```
project.json → gdexporter (subprocess, isolated stdio)
            → /tmp/.../build/index.html
            → static HTTP server on 127.0.0.1
            → puppeteer headless Chromium
            → screenshot + console logs
            → cleanup
```

First call: ~10-20s (Chromium cold start + GDevelop runtime load). Subsequent calls: ~5-8s.

For paid official courses (Make a 3D GTA Game, Make a Roguelike Game, etc.),
no public access exists — but you can find equivalent free examples covering
the same genres in `list_examples` (`3d-car-coin-hunt`, `3d-shark-frenzy`,
`platformer`, `top-down-rpg`, etc.) and the
[wiki.gdevelop.io](https://wiki.gdevelop.io/) written tutorials.

The MCP relies on the **TypeScript sources shipped with GDevelop desktop**
(`Contents/Resources/GDJS/Runtime-sources/Extensions/`). It auto-detects the
install on macOS / Linux / Windows. Override with the `GDEVELOP_PATH` env var.
Asset store data is fetched from `resources.gdevelop-app.com` and cached in
memory for one hour.

## Setup

```bash
cd gdevelop-mcp
npm install
npm run build
```

## Wire it to Claude Code

Add to `~/.claude/mcp.json` (or `.mcp.json` in your project):

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

Restart Claude Code. The tools appear under `mcp__gdevelop__*`.

## Dev

```bash
npm run dev        # run via tsx without building
npm run typecheck  # type-check only
npm run inspect    # open the MCP Inspector UI to test tools manually
```

## Limitations

- The static catalog covers the most common ~14 object types and ~12 behaviors.
  For exotic types use `read_extension_source` to inspect the raw GDJS source.
- Validation checks top-level project structure but not per-object content
  schemas (yet).
- Does not preview or run the game (out of scope for the v0.1 "schema" MCP —
  see roadmap in the parent discussion).
