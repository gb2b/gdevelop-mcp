import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findGDevelopInstall } from "../core/install.js";
import { listExtensions, readExtensionFile } from "../core/extensions.js";
import { buildDynamicCatalog } from "../core/catalog-dynamic.js";
import { describeExtension } from "../core/extension-describe.js";
import { textResult, errorResult } from "./shared.js";

export function registerExtensionsTools(server: McpServer): void {
  server.tool(
    "list_extensions",
    "List all GDevelop extensions visible in the synced cache. Each entry shows whether a JsExtension.js file exists (JS extension, full metadata available) and lists runtime source files.",
    {
      filter: z
        .string()
        .optional()
        .describe(
          "Optional case-insensitive substring filter on extension name",
        ),
    },
    async ({ filter }) => {
      try {
        const install = findGDevelopInstall();
        let extensions = listExtensions(install);
        if (filter) {
          const f = filter.toLowerCase();
          extensions = extensions.filter((e) =>
            e.name.toLowerCase().includes(f),
          );
        }
        return textResult({
          count: extensions.length,
          extensions: extensions.map((e) => ({
            name: e.name,
            hasJsExtension: e.hasJsExtension,
            runtimeFiles: e.runtimeFiles,
          })),
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "read_extension_source",
    "Read the raw source of a GDJS extension file (TypeScript runtime or JsExtension.js metadata). Use this to find exact property names, data types, and behavior of any object/behavior — including those not in the static catalog.",
    {
      extension: z
        .string()
        .describe(
          "Extension folder name, e.g. 'TextObject', 'PlatformBehavior'",
        ),
      file: z
        .string()
        .optional()
        .describe(
          "File name within the extension (e.g. 'textruntimeobject.ts'). If omitted, lists available files.",
        ),
    },
    async ({ extension, file }) => {
      try {
        const install = findGDevelopInstall();
        if (!file) {
          const extensions = listExtensions(install);
          const ext = extensions.find((e) => e.name === extension);
          if (!ext) {
            return errorResult(
              `Extension "${extension}" not found. Use list_extensions to see available extensions.`,
            );
          }
          return textResult({
            extension: ext.name,
            hasJsExtension: ext.hasJsExtension,
            files: ext.runtimeFiles,
            hint: "Call again with a 'file' parameter to read the source. For metadata (objects, actions, conditions, expressions), read JsExtension.js when available.",
          });
        }
        const source = readExtensionFile(install, extension, file);
        return textResult(source);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "list_dynamic_catalog",
    "Returns the catalog of objects/behaviors auto-discovered by parsing the TypeScript runtime sources. Wider coverage than the curated static catalog but less detail.",
    {
      extension: z.string().optional().describe("Filter by extension name"),
      kind: z.enum(["objects", "behaviors", "both"]).optional(),
    },
    async ({ extension, kind = "both" }) => {
      try {
        const install = findGDevelopInstall();
        const dyn = buildDynamicCatalog(install);
        const objects = extension
          ? (dyn.objectsByExtension[extension] ?? [])
          : dyn.allObjects;
        const behaviors = extension
          ? (dyn.behaviorsByExtension[extension] ?? [])
          : dyn.allBehaviors;
        return textResult({
          extensionsScanned: Object.keys(dyn.objectsByExtension).length,
          ...(kind !== "behaviors" && {
            objects,
            objectsCount: objects.length,
          }),
          ...(kind !== "objects" && {
            behaviors,
            behaviorsCount: behaviors.length,
          }),
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  server.tool(
    "describe_extension",
    "Aggregate everything the cache knows about a given GDevelop extension: file list, paths to Extension.cpp / JsExtension.js / README, counts and (optionally) full list of actions/conditions/expressions, runtime object/behavior file names, README excerpt. Token-efficient by default: pass `summaryOnly:true` for just counts+paths, or `include:[...]` to pick which kinds you actually need.",
    {
      name: z
        .string()
        .describe(
          "Extension folder name (e.g. 'PlatformBehavior', 'TextObject', 'Lighting').",
        ),
      summaryOnly: z
        .boolean()
        .optional()
        .describe(
          "If true, skip the action/condition/expression listings. Returns just counts + paths + files.",
        ),
      include: z
        .array(
          z.enum(["actions", "conditions", "expressions", "strExpressions"]),
        )
        .optional()
        .describe(
          "Restrict which instruction kinds to include in the response. Counts are always returned.",
        ),
    },
    async ({ name, summaryOnly, include }) => {
      try {
        const install = findGDevelopInstall();
        return textResult(
          describeExtension(install, name, { summaryOnly, include }),
        );
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );
}
