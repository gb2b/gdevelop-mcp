import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  getAssetDetails,
  getAssetShortHeaders,
  type AssetShortHeader,
} from "./asset-store.js";

type ProjectShape = {
  resources: { resources: Array<Record<string, unknown>> };
  layouts: Array<{
    name: string;
    objects: Array<Record<string, unknown>>;
    instances: Array<Record<string, unknown>>;
  }>;
  objects: Array<Record<string, unknown>>;
};

type AssetResource = {
  url?: string;
  name?: string;
  file?: string;
  kind?: string;
};

function inferResourceKind(fileName: string): string {
  const ext = extname(fileName).toLowerCase().slice(1);
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
    return "image";
  if (["wav", "mp3", "ogg", "m4a"].includes(ext)) return "audio";
  if (ext === "json") return "json";
  if (["ttf", "otf"].includes(ext)) return "font";
  if (["mp4", "webm"].includes(ext)) return "video";
  return "unknown";
}

async function downloadTo(url: string, outPath: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  return buf.length;
}

export type SingleImportResult = {
  assetId: string;
  status: "imported" | "skipped" | "failed";
  reason?: string;
  objectName?: string;
  filesDownloaded?: number;
  instanceAdded?: boolean;
  instancePosition?: { x: number; y: number };
};

export type ImportBatchResult = {
  projectPath: string;
  scope: "scene" | "global";
  scene?: string;
  totalRequested: number;
  totalImported: number;
  totalSkipped: number;
  totalFailed: number;
  backupPath?: string;
  results: SingleImportResult[];
};

export type ImportOptions = {
  assetIds?: string[];
  packTag?: string;
  scope?: "scene" | "global";
  scene?: string;
  placeAt?: { x: number; y: number };
  placementSpacing?: { x: number; y: number };
  perRow?: number;
  backup?: boolean;
};

async function resolveAssetIds(opts: ImportOptions): Promise<string[]> {
  const ids: string[] = [];
  if (opts.assetIds?.length) {
    ids.push(...opts.assetIds);
  }
  if (opts.packTag) {
    const headers = await getAssetShortHeaders();
    const tag = opts.packTag.toLowerCase();
    const matches = headers.filter((h: AssetShortHeader) =>
      h.tags.some((t) => t.toLowerCase() === tag),
    );
    for (const h of matches) {
      if (!ids.includes(h.id)) ids.push(h.id);
    }
  }
  if (ids.length === 0) {
    throw new Error(
      "Provide either assetIds (non-empty array) or packTag matching a known tag.",
    );
  }
  return ids;
}

async function importSingleAsset(
  project: ProjectShape,
  assetId: string,
  projectDir: string,
  scope: "scene" | "global",
  scene: string | undefined,
  position: { x: number; y: number } | undefined,
  declaredResourceNames: Set<string>,
): Promise<SingleImportResult> {
  const asset = await getAssetDetails(assetId);
  if (!asset.objectAssets?.length) {
    return {
      assetId,
      status: "failed",
      reason: "Asset has no objectAssets",
    };
  }

  const objectAsset = asset.objectAssets[0];
  const baseObject = objectAsset.object as Record<string, unknown>;
  const desiredName = (baseObject.name as string) || asset.name;

  if (scope === "scene") {
    const layout = project.layouts.find((l) => l.name === scene);
    if (!layout) {
      return {
        assetId,
        status: "failed",
        reason: `Layout "${scene}" not found`,
      };
    }
    if (layout.objects.some((o) => o["name"] === desiredName)) {
      return {
        assetId,
        status: "skipped",
        reason: `Object "${desiredName}" already exists in scene`,
        objectName: desiredName,
      };
    }
  } else {
    if (project.objects.some((o) => o["name"] === desiredName)) {
      return {
        assetId,
        status: "skipped",
        reason: `Global object "${desiredName}" already exists`,
        objectName: desiredName,
      };
    }
  }

  const assetSubdir = join(
    projectDir,
    "assets",
    desiredName.replace(/[^a-zA-Z0-9_-]/g, "_"),
  );
  if (!existsSync(assetSubdir)) {
    mkdirSync(assetSubdir, { recursive: true });
  }

  const resources = (objectAsset.resources ?? []) as AssetResource[];
  let filesDownloaded = 0;

  for (const resource of resources) {
    const url = resource.url;
    if (!url) continue;
    const resourceName =
      resource.name ?? resource.file ?? basename(decodeURIComponent(url));
    const fileName = basename(decodeURIComponent(url));
    const outPath = join(assetSubdir, fileName);

    if (!existsSync(outPath)) {
      await downloadTo(url, outPath);
    }
    filesDownloaded++;

    const relativeFile = `assets/${basename(assetSubdir)}/${fileName}`;
    if (!declaredResourceNames.has(resourceName)) {
      project.resources.resources.push({
        alwaysLoaded: false,
        file: relativeFile,
        kind: resource.kind ?? inferResourceKind(fileName),
        metadata: "",
        name: resourceName,
        smoothed: true,
        userAdded: true,
      });
      declaredResourceNames.add(resourceName);
    }
  }

  const newObject: Record<string, unknown> = {
    ...baseObject,
    name: desiredName,
    tags: baseObject.tags ?? "",
    variables: baseObject.variables ?? [],
    effects: baseObject.effects ?? [],
    behaviors: baseObject.behaviors ?? [],
  };

  let instanceAdded = false;
  if (scope === "scene") {
    const layout = project.layouts.find((l) => l.name === scene)!;
    layout.objects.push(newObject);
    if (position) {
      layout.instances.push({
        angle: 0,
        customSize: false,
        height: 0,
        layer: "",
        locked: false,
        name: desiredName,
        persistentUuid: randomUUID(),
        width: 0,
        x: position.x,
        y: position.y,
        zOrder: 1,
        numberProperties: [],
        stringProperties: [],
        initialVariables: [],
      });
      instanceAdded = true;
    }
  } else {
    project.objects.push(newObject);
  }

  return {
    assetId,
    status: "imported",
    objectName: desiredName,
    filesDownloaded,
    instanceAdded,
    instancePosition: instanceAdded ? position : undefined,
  };
}

export async function importAssetsIntoProject(
  projectPath: string,
  options: ImportOptions,
): Promise<ImportBatchResult> {
  const scope = options.scope ?? "scene";
  const backup = options.backup ?? true;
  const spacing = options.placementSpacing ?? { x: 100, y: 0 };
  const perRow = options.perRow ?? 8;

  if (scope === "scene" && !options.scene) {
    throw new Error('scope="scene" requires a scene name');
  }

  const ids = await resolveAssetIds(options);

  const projectRaw = readFileSync(projectPath, "utf-8");
  const project = JSON.parse(projectRaw) as ProjectShape;
  const projectDir = dirname(projectPath);

  let backupPath: string | undefined;
  if (backup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${projectPath}.bak-${stamp}`;
    copyFileSync(projectPath, backupPath);
  }

  const declaredResourceNames = new Set(
    project.resources.resources
      .map((r) => r["name"])
      .filter((n): n is string => typeof n === "string"),
  );

  const results: SingleImportResult[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    let position: { x: number; y: number } | undefined;
    if (options.placeAt && scope === "scene") {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      position = {
        x: options.placeAt.x + col * spacing.x,
        y: options.placeAt.y + row * spacing.y,
      };
    }
    try {
      const result = await importSingleAsset(
        project,
        id,
        projectDir,
        scope,
        options.scene,
        position,
        declaredResourceNames,
      );
      results.push(result);
    } catch (err) {
      results.push({
        assetId: id,
        status: "failed",
        reason: (err as Error).message,
      });
    }
  }

  const tmpPath = `${projectPath}.tmp-${randomUUID()}`;
  writeFileSync(tmpPath, JSON.stringify(project, null, 2), "utf-8");
  renameSync(tmpPath, projectPath);

  const totalImported = results.filter((r) => r.status === "imported").length;
  const totalSkipped = results.filter((r) => r.status === "skipped").length;
  const totalFailed = results.filter((r) => r.status === "failed").length;

  return {
    projectPath,
    scope,
    scene: options.scene,
    totalRequested: ids.length,
    totalImported,
    totalSkipped,
    totalFailed,
    backupPath,
    results,
  };
}
