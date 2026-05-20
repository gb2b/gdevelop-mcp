import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getExampleHeaders,
  getExampleFilters,
  searchExamplesIn,
  findExampleBySlugOrId,
} from "../core/examples.js";
import { textResult, errorResult } from "./shared.js";

export function registerExamplesTools(server: McpServer): void {
  server.tool(
    "list_examples",
    "List official GDevelop example projects (281+ MIT-licensed games: platformer, top-down RPG, 3D shooters, multiplayer, roguelike, etc.). Each result has a 'slug' you can use with get_example_details, or feed to read_github_source(repo='GDevelopApp/GDevelop-examples', path='examples/<slug>/...') to read the full project source.",
    {
      query: z
        .string()
        .optional()
        .describe("Free-text search in name, description and tags"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Required tags (case-insensitive substring match)"),
      license: z.string().optional(),
      difficulty: z
        .string()
        .optional()
        .describe("e.g. 'simple', 'normal', 'advanced'"),
      limit: z.number().int().positive().max(100).optional(),
    },
    async ({ query, tags, license, difficulty, limit = 30 }) => {
      try {
        const headers = await getExampleHeaders();
        const matches = searchExamplesIn(headers, {
          query,
          tags,
          license,
          difficulty,
          limit,
        });
        return textResult({
          totalIndexed: headers.length,
          matched: matches.length,
          examples: matches.map((e) => ({
            id: e.id,
            name: e.name,
            slug: e.slug,
            shortDescription: e.shortDescription,
            license: e.license,
            tags: e.tags,
            difficultyLevel: e.difficultyLevel,
            previewImageUrl: e.previewImageUrls[0],
          })),
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "get_example_details",
    "Get full metadata for an example project by slug or id (description, tags, license, preview, GitHub source path). To read the actual game.json or assets, follow up with read_github_source.",
    {
      slugOrId: z
        .string()
        .describe(
          "Example slug (e.g. 'platformer', '3d-car-coin-hunt') or id from list_examples",
        ),
    },
    async ({ slugOrId }) => {
      try {
        const headers = await getExampleHeaders();
        const example = findExampleBySlugOrId(headers, slugOrId);
        if (!example) {
          return errorResult(
            `Example "${slugOrId}" not found. Use list_examples to discover available slugs.`,
          );
        }
        return textResult({
          ...example,
          sourceRepo: "GDevelopApp/GDevelop-examples",
          sourcePath: `examples/${example.slug}`,
          hint: `Call read_github_source(repo='GDevelopApp/GDevelop-examples', path='examples/${example.slug}') to list files, or '.../examples/${example.slug}/game.json' to read the full project JSON.`,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_example_filters",
    "Return the available tags for example projects. Useful before calling list_examples to discover what filters are valid.",
    {},
    async () => {
      try {
        const filters = await getExampleFilters();
        return textResult(filters);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
