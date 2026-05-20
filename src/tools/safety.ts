import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listBackups, restoreBackup } from "../core/backups.js";
import { diffProjects } from "../core/diff.js";
import { validateProjectPath } from "../core/path-safety.js";
import { textResult, errorResult } from "./shared.js";

export function registerSafetyTools(server: McpServer): void {
  server.tool(
    "list_backups",
    "List all backup files (.bak-<timestamp>) that exist for a given project, sorted most recent first.",
    {
      path: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
    },
    async ({ path }) => {
      try {
        const safePath = validateProjectPath(path);
        const backups = listBackups(safePath);
        return textResult({
          count: backups.length,
          backups: backups.map((b) => ({
            fileName: b.fileName,
            path: b.path,
            size: b.size,
          })),
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "undo_last_edit",
    "Restore the project from its most recent .bak file. Before restoring, the current file is itself backed up as .bak-<timestamp>-pre-restore so the operation is reversible.",
    {
      path: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
      backupPath: z
        .string()
        .optional()
        .describe(
          "Optional specific backup to restore (full path or filename). If omitted, restores the most recent backup.",
        ),
    },
    async ({ path, backupPath }) => {
      try {
        const safePath = validateProjectPath(path);
        const result = restoreBackup(safePath, backupPath);
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "diff_projects",
    "Compute a semantic diff between two GDevelop project files. Useful to verify what changed after an edit (compare against a backup) or to compare two versions. Returns layouts/objects/behaviors added/removed/modified — not a raw JSON diff.",
    {
      pathBefore: z.string().describe("Earlier version of the project"),
      pathAfter: z.string().describe("Newer version of the project"),
    },
    async ({ pathBefore, pathAfter }) => {
      try {
        const before = validateProjectPath(pathBefore);
        const after = validateProjectPath(pathAfter);
        const result = diffProjects(before, after);
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
