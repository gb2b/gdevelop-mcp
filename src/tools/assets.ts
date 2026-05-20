import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAssetPacks,
  getAssetShortHeaders,
  getAssetFilters,
  getAssetDetails,
  searchAssetsIn,
} from "../core/asset-store.js";
import { importAssetsIntoProject } from "../core/asset-import.js";
import { validateProjectPath } from "../core/path-safety.js";
import { textResult, errorResult } from "./shared.js";

export function registerAssetsTools(server: McpServer): void {
  server.tool(
    "list_asset_packs",
    "List asset packs available on the GDevelop public asset store (Foliage Pack, Space Shooter, etc.). Most packs are CC0 (public domain) but some are premium. Use list_asset_filters to discover available categories.",
    {
      category: z
        .string()
        .optional()
        .describe(
          "Optional category filter (e.g. 'prefab', 'interface', '2d-platformer')",
        ),
      license: z
        .string()
        .optional()
        .describe("Optional license filter, e.g. 'CC0 (public domain)'"),
      limit: z.number().int().positive().max(200).optional(),
    },
    async ({ category, license, limit = 50 }) => {
      try {
        let packs = await getAssetPacks();
        if (category) {
          packs = packs.filter((p) => p.categories.includes(category));
        }
        if (license) {
          packs = packs.filter((p) =>
            p.licenses.some((l) => l.name === license),
          );
        }
        return textResult({
          total: packs.length,
          returned: Math.min(packs.length, limit),
          packs: packs.slice(0, limit),
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "search_assets",
    "Search individual assets (sprites, tile maps, audio, prefabs) on the GDevelop public asset store. Returns short headers — use get_asset_details with the returned id for full content including the ready-to-insert GDevelop object JSON.",
    {
      query: z
        .string()
        .optional()
        .describe("Free-text search in name, description and tags"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Required tags (case-insensitive substring match)"),
      objectType: z
        .string()
        .optional()
        .describe(
          "Filter by object type: 'sprite', 'tiled', 'audio', 'particleEmitter', '9patch', 'tile-map', etc.",
        ),
      license: z
        .string()
        .optional()
        .describe("Filter by license, e.g. 'CC0 (public domain)'"),
      limit: z.number().int().positive().max(200).optional(),
    },
    async ({ query, tags, objectType, license, limit = 30 }) => {
      try {
        const headers = await getAssetShortHeaders();
        const matches = searchAssetsIn(headers, {
          query,
          tags,
          objectType,
          license,
          limit,
        });
        return textResult({
          totalIndexed: headers.length,
          matched: matches.length,
          assets: matches,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "get_asset_details",
    "Get full details for an asset by id, including the GDevelop object JSON ready to be inserted into a project (animations, sprites, collision masks, required extensions, resources to download).",
    {
      id: z
        .string()
        .describe("Asset id (hex string) as returned by search_assets"),
    },
    async ({ id }) => {
      try {
        const details = await getAssetDetails(id);
        return textResult(details);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_asset_filters",
    "Return the available tags and filter categories for the asset store. Useful before calling search_assets or list_asset_packs to discover what filters are valid.",
    {},
    async () => {
      try {
        const filters = await getAssetFilters();
        return textResult(filters);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "import_assets_into_project",
    `Download one or more assets from the GDevelop public store and insert them into a project as new objects.

Three resolution modes (use at least one):
- assetIds: explicit list of asset ids from search_assets
- packTag: import all assets whose tags include this string (e.g. "foliage pack") — resolved via assetShortHeaders
- Both: union of the two

For each asset:
1. Fetches full details (animations, resources)
2. Downloads resource files into <projectDir>/assets/<assetName>/
3. Registers each file in project.resources.resources[]
4. Adds the object to the scene (or globally)
5. Optionally places an instance — if placeAt is set, instances are laid out in a grid using placementSpacing (default {x:100, y:0}, perRow:8)
6. Per-asset failures are reported individually (status: imported/skipped/failed) — the batch continues

A single backup .bak-<timestamp> is created at the start. Project is written atomically at the end.`,
    {
      projectPath: z
        .string()
        .describe("Absolute path to the GDevelop .json project file"),
      assetIds: z
        .array(z.string())
        .optional()
        .describe("Explicit list of asset ids"),
      packTag: z
        .string()
        .optional()
        .describe(
          "Tag string (e.g. 'foliage pack') — imports all assets with this tag",
        ),
      scope: z.enum(["scene", "global"]).optional(),
      scene: z.string().optional().describe("Required if scope='scene'"),
      placeAt: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe(
          "Base position; if set, instances are placed in a grid starting from here",
        ),
      placementSpacing: z
        .object({ x: z.number(), y: z.number() })
        .optional()
        .describe(
          "X/Y spacing between consecutive instances (default {x:100, y:0})",
        ),
      perRow: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("How many instances per row before wrapping (default 8)"),
      backup: z.boolean().optional(),
    },
    async ({
      projectPath,
      assetIds,
      packTag,
      scope,
      scene,
      placeAt,
      placementSpacing,
      perRow,
      backup,
    }) => {
      try {
        const safePath = validateProjectPath(projectPath);
        const result = await importAssetsIntoProject(safePath, {
          assetIds,
          packTag,
          scope,
          scene,
          placeAt,
          placementSpacing,
          perRow,
          backup,
        });
        return textResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
