# Contributing to gdevelop-mcp

Thanks for considering a contribution! This project is a Model Context
Protocol server for [GDevelop](https://gdevelop.io). It exposes tools so an
LLM agent can introspect, validate, edit, preview, and enrich GDevelop
projects.

## Quick start

```bash
git clone <repo>
cd gdevelop-mcp
npm install
npm run build
npm test
```

You need a local GDevelop installation; the MCP auto-detects it. Override
with `GDEVELOP_PATH=/path/to/GDevelop\ 5.app` if needed.

## Project layout

```
src/
├── index.ts          # MCP server, tool & prompt registrations
├── prompts.ts        # MCP prompts (slash commands)
└── core/             # business logic, one concern per file
test/                 # vitest tests
.claude/              # repo-level Claude Code configuration
```

See [`CLAUDE.md`](./CLAUDE.md) for an architectural overview and the rules
agents should follow.

## Adding a tool

The fastest path is to follow the
[`.claude/skills/add-mcp-tool/SKILL.md`](./.claude/skills/add-mcp-tool/SKILL.md)
checklist. In short:

1. Implement the logic as a function in `src/core/<topic>.ts`.
2. Register the tool in `src/index.ts` with a Zod input schema and a clear
   description (including how it interacts with other tools).
3. Add a unit test in `test/`.
4. Run `npm run typecheck && npm test`.
5. Update `CHANGELOG.md` and `README.md`.

## Conventions

- **TypeScript strict mode.** No `any` unless interfacing with untyped data
  (and even then, narrow at the boundary).
- **One concern per file** under `src/core/`.
- **No global state** beyond explicit caches with TTLs.
- **Atomic writes** for any file modification (write-to-temp + rename, with a
  timestamped `.bak` backup).
- **Stdio cleanliness.** Anything that may write to `stdout` (gdexporter,
  3rd-party tools) MUST run in an isolated subprocess — the MCP transport
  shares `stdout`.
- **Subprocess spawning.** Prefer the package's own API. When a CLI must be
  invoked, use `execFile` or `spawn` from `node:child_process` with an
  argument array — never the shell-interpreting variant.

## Safety constraints

When writing code that touches user projects:

- Take a backup before any write.
- Validate the post-edit state. Refuse to write if validation fails.
- Default to `requireBaselineValid: true` so we don't propagate errors.

See [`.claude/rules/safety.md`](./.claude/rules/safety.md) for the full
checklist.

## Running tests

```bash
npm test           # one-shot
npm run test:watch # watch mode
```

Tests use vitest and live in `test/`. Each test file mirrors a `src/core/`
module.

## Reporting issues

Please include:

- GDevelop version (e.g. `5.6.268`)
- OS and Node version
- Minimal reproduction (a tiny `.json` project + the MCP tool call)
- Expected vs actual behavior
