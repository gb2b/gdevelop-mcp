import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { GDevelopInstall } from "./install.js";

export type DynamicObjectInfo = {
  typeName: string;
  extension: string;
  source: string;
  contentFields?: Record<string, string>;
};

export type DynamicBehaviorInfo = {
  behaviorName: string;
  extension: string;
  source: string;
};

export type DynamicCatalog = {
  objectsByExtension: Record<string, DynamicObjectInfo[]>;
  behaviorsByExtension: Record<string, DynamicBehaviorInfo[]>;
  allObjects: DynamicObjectInfo[];
  allBehaviors: DynamicBehaviorInfo[];
};

let cachedCatalog: DynamicCatalog | null = null;

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function walkTsFiles(dir: string, depth = 0, max = 2): string[] {
  if (depth > max) return [];
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "tests" || entry.name === "benchmarks") continue;
        out.push(...walkTsFiles(p, depth + 1, max));
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name === "JsExtension.js")
      ) {
        out.push(p);
      }
    }
  } catch {
    // ignore
  }
  return out;
}

function extractContentFields(
  source: string,
): Record<string, string> | undefined {
  const match = source.match(
    /content\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*;?/,
  );
  if (!match) return undefined;
  const body = match[1];
  const fields: Record<string, string> = {};
  const fieldRe = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\??:\s*([^;\n]+);?/gm;
  for (const m of body.matchAll(fieldRe)) {
    const name = m[1];
    const type = m[2].trim();
    if (
      name === "content" ||
      type.startsWith("{") ||
      type.includes("=>") ||
      name === "Base"
    )
      continue;
    fields[name] = type;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}

function parseExtension(
  extensionName: string,
  files: string[],
): { objects: DynamicObjectInfo[]; behaviors: DynamicBehaviorInfo[] } {
  const objects: DynamicObjectInfo[] = [];
  const behaviors: DynamicBehaviorInfo[] = [];

  for (const file of files) {
    const src = readSafe(file);
    if (!src) continue;
    const baseName = file.split("/").pop() ?? "";

    if (baseName === "JsExtension.js") {
      const objRe = /\.addObject\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
      const behRe = /\.addBehavior\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
      for (const m of src.matchAll(objRe)) {
        objects.push({
          typeName: `${extensionName}::${m[1]}`,
          extension: extensionName,
          source: file,
        });
      }
      for (const m of src.matchAll(behRe)) {
        behaviors.push({
          behaviorName: `${extensionName}::${m[1]}`,
          extension: extensionName,
          source: file,
        });
      }
      continue;
    }

    if (/runtimeobject\.ts$/i.test(baseName)) {
      const fields = extractContentFields(src);
      objects.push({
        typeName: `${extensionName}::<runtime-object>`,
        extension: extensionName,
        source: file,
        contentFields: fields,
      });
    } else if (/runtimebehavior\.ts$/i.test(baseName)) {
      behaviors.push({
        behaviorName: `${extensionName}::<runtime-behavior>`,
        extension: extensionName,
        source: file,
      });
    }
  }

  return { objects, behaviors };
}

export function buildDynamicCatalog(install: GDevelopInstall): DynamicCatalog {
  if (cachedCatalog) return cachedCatalog;

  const objectsByExtension: Record<string, DynamicObjectInfo[]> = {};
  const behaviorsByExtension: Record<string, DynamicBehaviorInfo[]> = {};
  const allObjects: DynamicObjectInfo[] = [];
  const allBehaviors: DynamicBehaviorInfo[] = [];

  let extensionDirs: string[];
  try {
    extensionDirs = readdirSync(install.extensionsPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return {
      objectsByExtension,
      behaviorsByExtension,
      allObjects,
      allBehaviors,
    };
  }

  for (const ext of extensionDirs) {
    const dir = join(install.extensionsPath, ext);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const files = walkTsFiles(dir);
    const { objects, behaviors } = parseExtension(ext, files);
    if (objects.length) {
      objectsByExtension[ext] = objects;
      allObjects.push(...objects);
    }
    if (behaviors.length) {
      behaviorsByExtension[ext] = behaviors;
      allBehaviors.push(...behaviors);
    }
  }

  cachedCatalog = {
    objectsByExtension,
    behaviorsByExtension,
    allObjects,
    allBehaviors,
  };
  return cachedCatalog;
}

export function resetCatalogCache(): void {
  cachedCatalog = null;
}
