#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { z } from "zod";

import { findGDevelopInstall } from "./core/install.js";
import { listExtensions, readExtensionFile } from "./core/extensions.js";
import {
  OBJECT_TYPES,
  BEHAVIOR_TYPES,
  findObjectType,
} from "./core/catalog-static.js";
import { buildDynamicCatalog } from "./core/catalog-dynamic.js";
import { validateProjectData } from "./core/validation.js";
import { editProject, EditOpSchema } from "./core/edit.js";
import { listBackups, restoreBackup } from "./core/backups.js";
import { diffProjects } from "./core/diff.js";
import { importAssetsIntoProject } from "./core/asset-import.js";
import { registerPrompts } from "./prompts.js";
import { previewScene } from "./core/preview-runtime.js";
import { renderSceneStatic } from "./core/render-static.js";
import {
  buildInstructionCatalog,
  findInstructions,
  findInstructionByType,
} from "./core/catalog-actions.js";
import { summarizeEvents } from "./core/events.js";
import { getRuntimeInfo, checkRuntimeFreshness } from "./core/runtime-info.js";
import {
  syncRuntimeTypes,
  getCachedRuntimeSources,
  getBundledGdRef,
} from "./core/runtime-types-cache.js";
import { fetchGitHubPath } from "./core/github.js";
import {
  getAssetPacks,
  getAssetShortHeaders,
  getAssetFilters,
  getAssetDetails,
  searchAssetsIn,
} from "./core/asset-store.js";
import {
  getExampleHeaders,
  getExampleFilters,
  searchExamplesIn,
  findExampleBySlugOrId,
} from "./core/examples.js";

const server = new McpServer({
  name: "gdevelop-mcp",
  version: "0.13.0",
});

function textResult(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

server.tool(
  "gdevelop_install_info",
  "Returns metadata about the GDevelop runtime currently used: source ('local' = desktop install, 'bundled' = gdcore-tools npm fallback), paths, runtime version, and extensions count. Override detection with GDEVELOP_PATH or force bundled mode with GDEVELOP_USE_BUNDLED=true.",
  {},
  async () => {
    try {
      const install = findGDevelopInstall();
      const extensions = listExtensions(install);
      const runtime = getRuntimeInfo(install);
      const cachedSources = getCachedRuntimeSources();
      return textResult({
        source: install.source,
        appPath: install.appPath,
        extensionsPath: install.extensionsPath,
        extensionsCount: extensions.length,
        hasTypeScriptSources: install.gdjsRuntimeSourcesPath !== null,
        typeSourcesPath: install.gdjsRuntimeSourcesPath,
        bundledGdRef: getBundledGdRef(),
        cachedTypeSourcesPath: cachedSources,
        runtime,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "check_runtime_freshness",
  "Check whether the bundled gdcore-tools runtime is up to date against the npm registry. Useful for the end user (the maintainer's Dependabot handles the repo itself).",
  {},
  async () => {
    try {
      const report = await checkRuntimeFreshness();
      return textResult(report);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "sync_runtime_types",
  `Download GDevelop's TypeScript runtime sources matching the bundled gdcore-tools version into a local cache (~/.cache/gdevelop-mcp/gdjs-types-<ref>/). Required only in bundled mode to enable detailed per-object content-field typing in describe_object_schema and list_dynamic_catalog. Idempotent — uses jsDelivr CDN with fallback to GitHub raw. Once cached, install detection picks it up automatically.`,
  {
    ref: z
      .string()
      .optional()
      .describe(
        "Git ref (tag/branch/SHA). Defaults to the gdcore-tools-derived version (e.g. 'v5.6.269').",
      ),
    force: z
      .boolean()
      .optional()
      .describe("Re-download files even if already cached"),
    concurrency: z
      .number()
      .int()
      .positive()
      .max(32)
      .optional()
      .describe("Number of parallel downloads (default 12)"),
  },
  async ({ ref, force, concurrency }) => {
    try {
      const result = await syncRuntimeTypes({ ref, force, concurrency });
      return textResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "list_extensions",
  "List all GDevelop extensions installed locally by scanning the GDJS/Runtime-sources/Extensions directory. Each entry shows whether a JsExtension.js file exists (full metadata available) and lists runtime source files.",
  {
    filter: z
      .string()
      .optional()
      .describe("Optional case-insensitive substring filter on extension name"),
  },
  async ({ filter }) => {
    try {
      const install = findGDevelopInstall();
      let extensions = listExtensions(install);
      if (filter) {
        const f = filter.toLowerCase();
        extensions = extensions.filter((e) => e.name.toLowerCase().includes(f));
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
  "list_object_types",
  "List known GDevelop object types with their internal JSON identifiers. The 'type' field is what goes in the JSON 'type' property. Use describe_object_schema for content details.",
  {
    category: z
      .string()
      .optional()
      .describe("Optional category filter: general, text, ui, vfx"),
  },
  async ({ category }) => {
    let types = OBJECT_TYPES;
    if (category) {
      types = types.filter((t) => t.category === category);
    }
    return textResult({
      count: types.length,
      types: types.map((t) => ({
        type: t.type,
        displayName: t.displayName,
        category: t.category,
        extension: t.extension,
        description: t.description,
      })),
    });
  },
);

server.tool(
  "list_behavior_types",
  "List known GDevelop behavior types with their internal JSON identifiers and which objects they can be attached to.",
  {
    extension: z.string().optional().describe("Optional extension name filter"),
  },
  async ({ extension }) => {
    let types = BEHAVIOR_TYPES;
    if (extension) {
      types = types.filter((t) => t.extension === extension);
    }
    return textResult({
      count: types.length,
      behaviors: types,
    });
  },
);

server.tool(
  "describe_object_schema",
  "Returns the schema and content example for a GDevelop object type. First checks the curated static catalog (best precision), then falls back to the dynamic catalog parsed from your local GDJS install (broader coverage but less detail). Use BEFORE writing object JSON to avoid format errors.",
  {
    type: z
      .string()
      .describe(
        "Internal type identifier, e.g. 'Sprite' or 'TextObject::Text'",
      ),
  },
  async ({ type }) => {
    const info = findObjectType(type);
    if (info) return textResult({ found: true, source: "static", ...info });

    try {
      const install = findGDevelopInstall();
      const dyn = buildDynamicCatalog(install);

      const exactMatch = dyn.allObjects.find((o) => o.typeName === type);
      if (exactMatch) {
        return textResult({
          found: true,
          source: "dynamic",
          type,
          extension: exactMatch.extension,
          contentFields: exactMatch.contentFields,
          sourceFile: exactMatch.source,
          hint: "Dynamic match — fields parsed from runtime TS. Use read_extension_source for the full picture.",
        });
      }

      const ext = type.includes("::") ? type.split("::")[0] : type;
      const extMatches =
        dyn.objectsByExtension[ext] ?? dyn.objectsByExtension[`${ext}Object`];
      if (extMatches?.length) {
        return textResult({
          found: false,
          source: "dynamic-extension-only",
          type,
          extension: ext,
          knownTypesInExtension: extMatches.map((o) => o.typeName),
          hint: "Exact type not parsed but the extension exists. Read its source for details.",
        });
      }

      return textResult({
        found: false,
        type,
        hint: "Type not in static or dynamic catalog. Use list_extensions then read_extension_source.",
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "list_dynamic_catalog",
  "Returns the catalog of objects/behaviors auto-discovered by parsing the TypeScript runtime sources of your local GDevelop install. Wider coverage than the curated static catalog but less detail.",
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
        ...(kind !== "behaviors" && { objects, objectsCount: objects.length }),
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
  "read_extension_source",
  "Read the raw source of a GDJS extension file (TypeScript runtime or JsExtension.js metadata). Use this to find exact property names, data types, and behavior of any object/behavior — including those not in the static catalog.",
  {
    extension: z
      .string()
      .describe("Extension folder name, e.g. 'TextObject', 'PlatformBehavior'"),
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
  "validate_project",
  "Load a GDevelop project file (.json) and validate it. Checks: top-level structure (zod), known object/behavior types, instance→object references, firstLayout existence. Returns errors AND warnings separately.",
  {
    path: z
      .string()
      .describe("Absolute path to the GDevelop .json project file"),
  },
  async ({ path }) => {
    try {
      const raw = readFileSync(path, "utf-8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return textResult({
          valid: false,
          stage: "json-parse",
          error: (err as Error).message,
        });
      }

      const result = validateProjectData(parsed);
      const errors = result.issues.filter((i) => i.severity === "error");
      const warnings = result.issues.filter((i) => i.severity === "warning");

      if (!result.project) {
        return textResult({ valid: false, errors, warnings });
      }

      const project = result.project;
      return textResult({
        valid: result.valid,
        errors,
        warnings,
        summary: {
          name: project.properties.name,
          gdVersion: project.gdVersion,
          firstLayout: project.firstLayout,
          layoutsCount: project.layouts.length,
          globalObjectsCount: project.objects.length,
          resourcesCount: project.resources.resources.length,
          layouts: project.layouts.map((l) => ({
            name: l.name,
            objectsCount: l.objects.length,
            instancesCount: l.instances.length,
            eventsCount: l.events.length,
          })),
        },
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "edit_project",
  `Apply a batch of semantic edits to a GDevelop project atomically.

Each operation is one of:
- {op: "add_layout", name: string, setAsFirst?: bool}
- {op: "add_object", type: string, name: string, scope?: "scene"|"global", scene?: string, content?: object, behaviors?: array, tags?: string}
- {op: "add_instance", scene: string, objectName: string, x: number, y: number, layer?: string, zOrder?: number, angle?: number}
- {op: "attach_behavior", objectName: string, scope?: "scene"|"global", scene?: string, type: string, name?: string, properties?: object}

RECOMMENDED FLOW:
1. inspect_project(path) — see the current state
2. edit_project(path, ops, dryRun:true) — preview & validate without touching the file
3. edit_project(path, ops, dryRun:false) — apply with auto backup
4. inspect_project(path) or validate_project(path) — confirm

By default: baseline is validated first (refuses to edit a broken project), a timestamped .bak file is created before writing, and you get a 'summary' of what changed.`,
  {
    path: z
      .string()
      .describe("Absolute path to the GDevelop .json project file"),
    operations: z
      .array(EditOpSchema)
      .min(1)
      .describe("Ordered list of edit operations to apply atomically"),
    dryRun: z
      .boolean()
      .optional()
      .describe("If true, run validation only — do not modify the file."),
    backup: z
      .boolean()
      .optional()
      .describe(
        "If true (default), creates a .bak-<timestamp> file before writing.",
      ),
    requireBaselineValid: z
      .boolean()
      .optional()
      .describe(
        "If true (default), refuses to edit if the project has pre-existing errors. Set to false to override.",
      ),
  },
  async ({ path, operations, dryRun, backup, requireBaselineValid }) => {
    try {
      const result = await editProject(path, operations, {
        dryRun,
        backup,
        requireBaselineValid,
      });
      return textResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "inspect_project",
  "Returns a compact, human-readable summary of a GDevelop project: scenes, objects (with type and attached behaviors), instance counts, events counts, global objects, resources. Use this BEFORE editing to see the current state, and AFTER to verify your changes. Much more readable than dumping the raw JSON.",
  {
    path: z
      .string()
      .describe("Absolute path to the GDevelop .json project file"),
  },
  async ({ path }) => {
    try {
      const raw = readFileSync(path, "utf-8");
      const project = JSON.parse(raw) as {
        properties: {
          name: string;
          version: string;
          windowWidth: number;
          windowHeight: number;
        };
        gdVersion: { major: number; minor: number; build: number };
        firstLayout: string;
        layouts: Array<{
          name: string;
          objects: Array<{
            name: string;
            type: string;
            behaviors?: Array<{ name: string; type: string }>;
          }>;
          instances: unknown[];
          events: unknown[];
          layers: Array<{ name: string }>;
        }>;
        objects: Array<{ name: string; type: string }>;
        resources: { resources: Array<{ name?: string }> };
        eventsFunctionsExtensions: unknown[];
      };

      return textResult({
        name: project.properties.name,
        version: project.properties.version,
        resolution: `${project.properties.windowWidth}x${project.properties.windowHeight}`,
        gdVersion: `${project.gdVersion.major}.${project.gdVersion.minor}.${project.gdVersion.build}`,
        firstLayout: project.firstLayout,
        scenes: project.layouts.map((l) => ({
          name: l.name,
          objects: l.objects.map((o) => ({
            name: o.name,
            type: o.type,
            behaviors: (o.behaviors ?? []).map((b) => `${b.name} (${b.type})`),
          })),
          instances: l.instances.length,
          events: l.events.length,
          layers: l.layers.map((la) => la.name || "<base>"),
        })),
        globalObjects: project.objects.map((o) => ({
          name: o.name,
          type: o.type,
        })),
        resources: project.resources.resources.length,
        customExtensions: project.eventsFunctionsExtensions.length,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "read_github_source",
  "Fetch a file or list a directory from the official GDevelop GitHub repo (4ian/GDevelop). Useful as a fallback when the local install lacks something, or to inspect the C++ core (in /Extensions or /Core, which is NOT shipped with the desktop app). For a directory, returns its file list. For a file, returns the raw text (capped at 500KB).",
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
        packs = packs.filter((p) => p.licenses.some((l) => l.name === license));
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
      const backups = listBackups(path);
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
      const result = restoreBackup(path, backupPath);
      return textResult(result);
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "diff_projects",
  "Compute a semantic diff between two GDevelop project files. Useful to verify what changed after an edit (compare against a backup), or compare two versions. Returns layouts/objects/behaviors added/removed/modified, not a raw JSON diff.",
  {
    pathBefore: z.string().describe("Earlier version of the project"),
    pathAfter: z.string().describe("Newer version of the project"),
  },
  async ({ pathBefore, pathAfter }) => {
    try {
      const result = diffProjects(pathBefore, pathAfter);
      return textResult(result);
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
      const result = await importAssetsIntoProject(projectPath, {
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
        "How long to wait after page load before screenshot (default 3000ms, max 30000ms). Increase for slow-loading scenes or to capture later gameplay states.",
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
      const result = await previewScene({
        projectPath,
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
      const result = await renderSceneStatic({
        projectPath,
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

server.tool(
  "list_instructions",
  `List GDevelop instructions (actions, conditions, expressions). Combines a hand-curated static catalog of common built-in ones with dynamic parsing of JsExtension.js files in your local install. Useful to discover the type.value to use in add_event ops.`,
  {
    kind: z
      .enum(["action", "condition", "expression", "strExpression"])
      .optional(),
    extension: z
      .string()
      .optional()
      .describe(
        "Filter by extension name (e.g. 'PlatformBehavior', 'BuiltinKeyboard')",
      ),
    query: z
      .string()
      .optional()
      .describe(
        "Case-insensitive substring filter on type/fullName/description",
      ),
    limit: z.number().int().positive().max(500).optional(),
  },
  async ({ kind, extension, query, limit }) => {
    try {
      const install = findGDevelopInstall();
      const catalog = buildInstructionCatalog(install);
      const matches = findInstructions(catalog, {
        kind,
        extension,
        query,
        limit,
      });
      return textResult({
        totalIndexed: catalog.length,
        matched: matches.length,
        instructions: matches,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "describe_instruction",
  `Find every catalog entry matching an instruction type (e.g. 'SimulateJumpKey'). Returns extensions where this type is defined, kind (action/condition/expression), and source (static catalog vs parsed from JsExtension.js). For raw signature details, follow up with read_extension_source or read_github_source.`,
  {
    type: z
      .string()
      .describe("The instruction type, e.g. 'KeyPressed', 'SimulateJumpKey'"),
  },
  async ({ type }) => {
    try {
      const install = findGDevelopInstall();
      const catalog = buildInstructionCatalog(install);
      const matches = findInstructionByType(catalog, type);
      return textResult({
        type,
        found: matches.length > 0,
        matches,
        hint:
          matches.length === 0
            ? "Not in catalog. Try list_instructions with a query, or read_extension_source / read_github_source to inspect the source."
            : undefined,
      });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

server.tool(
  "summarize_events",
  `Summarize the events tree of a scene: total count, per-type breakdown, max nesting depth. Useful to inspect a scene's logic without dumping the full events JSON.`,
  {
    projectPath: z.string(),
    scene: z
      .string()
      .optional()
      .describe("Scene name. If omitted, uses firstLayout."),
  },
  async ({ projectPath, scene }) => {
    try {
      const raw = readFileSync(projectPath, "utf-8");
      const project = JSON.parse(raw) as {
        firstLayout: string;
        layouts: Array<{ name: string; events: unknown[] }>;
      };
      const sceneName = scene ?? project.firstLayout;
      const layout = project.layouts.find((l) => l.name === sceneName);
      if (!layout) {
        return errorResult(
          `Scene "${sceneName}" not found. Available: ${project.layouts.map((l) => l.name).join(", ")}`,
        );
      }
      const summary = summarizeEvents(layout.events ?? []);
      return textResult({ scene: sceneName, ...summary });
    } catch (err) {
      return errorResult((err as Error).message);
    }
  },
);

registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
