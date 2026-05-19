# Safety rules

Any code that modifies a user's GDevelop project file MUST follow this
protocol. This is non-negotiable.

## The atomic edit contract

1. **Read the current file.** Parse the JSON. If it doesn't parse, refuse.
2. **Validate the baseline.** Run `validateProjectData`. If it reports errors
   (not warnings), refuse — unless the caller explicitly set
   `requireBaselineValid: false`. We never propagate an already-broken state.
3. **Operate in memory.** Apply ops on the parsed object, not on disk.
4. **Validate the result.** Run `validateProjectData` again. If invalid,
   refuse and return diagnostics.
5. **Backup before writing.** Copy the original to `<file>.bak-<timestamp>`.
6. **Write atomically.** `writeFileSync` to a `.tmp-<uuid>` sibling, then
   `renameSync` to the final path.
7. **Per-op failure handling.** If any op throws mid-batch, return
   `failedAt: {index, op, error}` and do **not** write.

`src/core/edit.ts::editProject` is the reference implementation. Mimic its
shape for any other write tool (`import_assets_into_project`,
`undo_last_edit`, future ones).

## What never to do

- **Don't write JSON in place** (no `writeFileSync(filePath, ...)` directly
  on the original). Always temp + rename.
- **Don't skip the backup** unless the caller explicitly opted out
  (`backup: false`), and even then warn in the return value.
- **Don't catch and swallow** validation errors. Surface them in the
  response.
- **Don't mutate the caller's arguments.** Operate on a deep clone if
  needed.
- **Don't trust user paths.** Validate they stay within an expected root
  before reading or writing.

## Default values

| Option | Default | Reason |
|---|---|---|
| `dryRun` | `false` | Caller must opt in to write, no — actually we default to write because dryRun is the safety dial, but require explicit `dryRun: true` to preview. |
| `backup` | `true` | Always safe. Caller can opt out. |
| `requireBaselineValid` | `true` | Don't propagate broken states. |

## Subprocess isolation

Any 3rd-party tool that writes to `stdout` (gdexporter, gdcore-tools, future
exporters/converters) MUST run in a child process with piped stdio. The MCP
transport occupies our process's `stdout` — pollution breaks the JSON-RPC
stream and the client silently disconnects. See
`src/core/preview-runtime.ts::runExport` for the canonical pattern.

## When in doubt

- Run `npm test` to verify the safety invariants still hold.
- Re-read this file. If something here doesn't apply, document why in the
  return value of the tool.
