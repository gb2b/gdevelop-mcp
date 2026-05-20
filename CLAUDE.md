# CLAUDE.md

Project memory for Claude Code (and other MCP-aware agents). Keep this file
small; it's loaded on every session.

## What this project is

An MCP server that gives agents read/write access to GDevelop projects, the
public asset store, official examples, and a runtime/static preview
pipeline. **24 tools + 5 prompts.**

Architectural details and tool list: see [`README.md`](./README.md).

## Project layout

```
src/
├── index.ts          # MCP server, registers tools
├── prompts.ts        # MCP prompts (slash commands)
└── core/             # business logic — one concern per file
test/                 # vitest unit tests
.claude/              # rules, skills, settings, hooks (this folder)
```

## Where to look

| If you want to…               | Read first                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Understand the safe edit flow | [`.claude/rules/safety.md`](./.claude/rules/safety.md)                               |
| Add a new MCP tool            | [`.claude/skills/add-mcp-tool/SKILL.md`](./.claude/skills/add-mcp-tool/SKILL.md)     |
| Add a new MCP prompt          | [`.claude/skills/add-mcp-prompt/SKILL.md`](./.claude/skills/add-mcp-prompt/SKILL.md) |
| Add or update tests           | [`.claude/skills/add-test/SKILL.md`](./.claude/skills/add-test/SKILL.md)             |
| Code style conventions        | [`.claude/rules/code-style.md`](./.claude/rules/code-style.md)                       |
| Module structure rules        | [`.claude/rules/module-structure.md`](./.claude/rules/module-structure.md)           |
| File-size limits + splitting  | [`.claude/rules/file-size.md`](./.claude/rules/file-size.md)                         |
| README/CHANGELOG sync rules   | [`.claude/rules/maintenance.md`](./.claude/rules/maintenance.md)                     |
| Test rules                    | [`.claude/rules/testing.md`](./.claude/rules/testing.md)                             |
| Update README after tool add  | [`.claude/skills/update-readme/SKILL.md`](./.claude/skills/update-readme/SKILL.md)   |
| Audit the repo health         | [`.claude/skills/audit-repo/SKILL.md`](./.claude/skills/audit-repo/SKILL.md)         |
| Debug the MCP server          | [`.claude/skills/debug-mcp/SKILL.md`](./.claude/skills/debug-mcp/SKILL.md)           |

## Hard rules

These override everything else:

1. **Never delete a project file without a backup.** All edits must go through
   `edit_project` (or honor the same atomic-write + backup contract).
2. **No shell-interpreting subprocess.** Use `execFile`/`spawn` from
   `node:child_process` with an argument array.
3. **Anything writing to stdout from a 3rd-party package** (gdexporter,
   gdcore-tools, etc.) MUST run in an isolated subprocess — the MCP transport
   uses our own stdout.
4. **Run `npm run typecheck && npm test` before claiming work is done.**
5. **Never commit to `main` without:** tests green, types green, README +
   CHANGELOG updated if user-visible.

## Quick commands

```bash
npm run build      # tsc → dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run dev        # run the MCP via tsx (no build needed)
npm run inspect    # MCP Inspector UI for manual tool testing
```
