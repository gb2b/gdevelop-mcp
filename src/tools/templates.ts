import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { quickStartTemplate } from "../core/templates.js";
import { textResult, errorResult } from "./shared.js";

export function registerTemplatesTools(server: McpServer): void {
  server.tool(
    "quick_start_template",
    `Create a minimal but valid GDevelop project at a given path. Four genres:
- "blank" — single empty scene, no objects
- "platformer" — Player (Sprite + PlatformerObjectBehavior) + Ground (Sprite + PlatformBehavior), one instance each
- "topdown" — Player (Sprite + TopDownMovementBehavior), one instance
- "shmup" — Player + Bullet (Sprite + DestroyOutsideBehavior)

The generated project passes validate_project. Use as a baseline to iterate from, instead of writing a full game.json by hand. Refuses to overwrite an existing file unless overwrite:true.`,
    {
      targetPath: z
        .string()
        .describe("Absolute path to write the .json (e.g. /path/to/game.json)"),
      name: z.string().describe("Project name (project.properties.name)"),
      genre: z.enum(["blank", "platformer", "topdown", "shmup"]),
      windowWidth: z.number().int().positive().max(7680).optional(),
      windowHeight: z.number().int().positive().max(4320).optional(),
      overwrite: z.boolean().optional(),
    },
    async ({
      targetPath,
      name,
      genre,
      windowWidth,
      windowHeight,
      overwrite,
    }) => {
      try {
        const result = quickStartTemplate({
          targetPath,
          name,
          genre,
          windowWidth,
          windowHeight,
          overwrite,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
