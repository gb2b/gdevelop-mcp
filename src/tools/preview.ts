import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { previewScene } from "../core/preview-runtime.js";
import { renderSceneStatic } from "../core/render-static.js";
import { validateProjectPath } from "../core/path-safety.js";
import { textResult, errorResult } from "./shared.js";

export function registerPreviewTools(server: McpServer): void {
  server.tool(
    "preview_scene",
    `Export a GDevelop scene to HTML5 (via gdexporter) and render it in a headless Chromium (via puppeteer) to capture a real-runtime screenshot.

What it does:
1. Optionally overrides firstLayout to render a specific scene (without touching your original file)
2. Runs gdexporter in an isolated subprocess (its stdout is captured, won't pollute the MCP protocol)
3. Serves the export on a local 127.0.0.1 random port
4. Launches puppeteer headless, waits durationMs for the game to initialize and run, then takes a screenshot
5. Captures console logs and page errors (truncated to last 50 lines)
6. Cleans up the temp export and browser, returns the screenshot path

Use this when you want to verify what the game actually looks like at runtime — animations, behaviors, anything that's not just static layout.

First call is slow (~10-20s, includes Chromium startup + GDevelop runtime load). Subsequent calls are faster (~5-8s).`,
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
      sceneName: z
        .string()
        .optional()
        .describe(
          "Scene to render (must exist in project.layouts). If omitted, uses firstLayout.",
        ),
      durationMs: z
        .number()
        .int()
        .positive()
        .max(30_000)
        .optional()
        .describe(
          "How long to wait after page load before screenshot (default 3000ms, max 30000ms).",
        ),
      width: z.number().int().positive().max(3840).optional(),
      height: z.number().int().positive().max(2160).optional(),
      screenshotPath: z
        .string()
        .optional()
        .describe(
          "Where to save the PNG. Defaults to /tmp/gdevelop-preview-<ts>.png",
        ),
      keepExport: z
        .boolean()
        .optional()
        .describe(
          "If true, do not delete the temp export directory (for debugging)",
        ),
    },
    async ({
      projectPath,
      sceneName,
      durationMs,
      width,
      height,
      screenshotPath,
      keepExport,
    }) => {
      try {
        const safePath = validateProjectPath(projectPath);
        const result = await previewScene({
          projectPath: safePath,
          sceneName,
          durationMs,
          width,
          height,
          screenshotPath,
          keepExport,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "render_scene_static",
    `Render a static preview of a scene WITHOUT running the game. Reads the project JSON, composes a PNG with sprites/texts placed at their instance positions. Sub-second per scene, no Chromium, no gdexporter.

What it renders:
- Sprite: first frame of first animation
- TextObject::Text: text with bold/italic/color/size
- TiledSpriteObject::TiledSprite: pattern fill with the texture
- Scene3D::Cube3DObject: front face texture if available, otherwise wireframe placeholder
- Scene3D::Model3DObject: wireframe placeholder (3D rendering not supported in static mode — use preview_scene for that)
- Other types: dashed cyan wireframe with object name

Limits: no animations beyond frame 0, no behaviors (positions are initial only), no effects, no real 3D. Use this to iterate fast on layout; use preview_scene when you need real runtime, animations, or 3D.`,
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
      sceneName: z
        .string()
        .optional()
        .describe("Scene to render (default: firstLayout)"),
      outputPath: z
        .string()
        .optional()
        .describe(
          "Where to save the PNG (default: /tmp/gdevelop-scene-<scene>-<ts>.png)",
        ),
      width: z.number().int().positive().max(3840).optional(),
      height: z.number().int().positive().max(2160).optional(),
      showLabels: z
        .boolean()
        .optional()
        .describe("Overlay instance names + coords (useful for debug)"),
      background: z
        .string()
        .optional()
        .describe("CSS color for the canvas background (default '#3a3a40')"),
    },
    async ({
      projectPath,
      sceneName,
      outputPath,
      width,
      height,
      showLabels,
      background,
    }) => {
      try {
        const safePath = validateProjectPath(projectPath);
        const result = await renderSceneStatic({
          projectPath: safePath,
          sceneName,
          outputPath,
          width,
          height,
          showLabels,
          background,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
