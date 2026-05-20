import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchGitHubPath } from "../core/github.js";
import { textResult, errorResult } from "./shared.js";

export function registerGithubTools(server: McpServer): void {
  server.tool(
    "read_github_source",
    "Fetch a file or list a directory from the official GDevelop GitHub repo (4ian/GDevelop or GDevelopApp/GDevelop-examples). Useful as a fallback when the local cache lacks something or to inspect the C++ core. For a directory, returns its file list. For a file, returns the raw text (capped at 500KB).",
    {
      path: z
        .string()
        .describe(
          "Repo-relative path. Examples: 'Extensions/PlatformBehavior' (C++ core ext), 'GDJS/Runtime/Extensions/TextObject', 'Core/GDCore/Project/Object.h', or 'examples/platformer/game.json' (when repo is GDevelopApp/GDevelop-examples)",
        ),
      ref: z
        .string()
        .optional()
        .describe("Branch, tag, or commit SHA. Defaults to 'master'."),
      repo: z
        .enum(["4ian/GDevelop", "GDevelopApp/GDevelop-examples"])
        .optional()
        .describe(
          "Which repo to fetch from. Defaults to '4ian/GDevelop'. Use 'GDevelopApp/GDevelop-examples' to access full example projects.",
        ),
    },
    async ({ path, ref, repo }) => {
      try {
        const result = await fetchGitHubPath(
          path,
          ref ?? "master",
          repo ?? "4ian/GDevelop",
        );
        if (result.kind === "directory") {
          return textResult({
            kind: "directory",
            path,
            ref: ref ?? "master",
            count: result.entries.length,
            entries: result.entries,
          });
        }
        return textResult({
          kind: "file",
          path,
          ref: ref ?? "master",
          size: result.size,
          truncated: result.truncated,
          content: result.content,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
