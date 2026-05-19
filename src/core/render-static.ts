import { createCanvas, loadImage, type SKRSContext2D, type Canvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";

type ResourceEntry = { name?: string; file?: string; kind?: string };

type GDColor = string | { r?: number; g?: number; b?: number };

type SpriteFrame = { image?: string; originPoint?: { x: number; y: number } };
type SpriteDirection = { sprites?: SpriteFrame[] };
type SpriteAnimation = { directions?: SpriteDirection[] };

type GDObject = {
  name: string;
  type: string;
  animations?: SpriteAnimation[];
  content?: Record<string, unknown>;
  texture?: string;
  rightFaceResourceName?: string;
  leftFaceResourceName?: string;
  topFaceResourceName?: string;
  bottomFaceResourceName?: string;
  frontFaceResourceName?: string;
  backFaceResourceName?: string;
  modelResourceName?: string;
  string?: string;
  font?: string;
  characterSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: GDColor;
  smoothed?: boolean;
};

type Instance = {
  name: string;
  x: number;
  y: number;
  angle?: number;
  customSize?: boolean;
  width?: number;
  height?: number;
  zOrder?: number;
  layer?: string;
};

type Project = {
  properties: { windowWidth: number; windowHeight: number };
  firstLayout: string;
  layouts: Array<{
    name: string;
    objects: GDObject[];
    instances: Instance[];
    layers: Array<{ name: string; visibility: boolean }>;
  }>;
  objects: GDObject[];
  resources: { resources: ResourceEntry[] };
};

export type RenderOptions = {
  projectPath: string;
  sceneName?: string;
  outputPath?: string;
  width?: number;
  height?: number;
  showLabels?: boolean;
  background?: string;
};

export type RenderStats = {
  outputPath: string;
  sizeBytes: number;
  width: number;
  height: number;
  scene: string;
  instancesRendered: number;
  instancesSkipped: number;
  byType: Record<string, number>;
  missingObjects: string[];
  missingResources: string[];
  notes: string[];
};

function parseColor(c: GDColor | undefined, fallback = "#000"): string {
  if (!c) return fallback;
  if (typeof c === "string") {
    const parts = c.split(";").map((n) => parseInt(n, 10));
    if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
      return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
    }
    return c;
  }
  if (typeof c === "object") {
    return `rgb(${c.r ?? 0}, ${c.g ?? 0}, ${c.b ?? 0})`;
  }
  return fallback;
}

function buildResourceMap(project: Project, projectDir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of project.resources.resources) {
    if (!r.name || !r.file) continue;
    const abs = isAbsolute(r.file) ? r.file : resolve(projectDir, r.file);
    map.set(r.name, abs);
  }
  return map;
}

function buildObjectMap(project: Project, sceneName: string): Map<string, GDObject> {
  const map = new Map<string, GDObject>();
  for (const o of project.objects) map.set(o.name, o);
  const layout = project.layouts.find((l) => l.name === sceneName);
  if (layout) for (const o of layout.objects) map.set(o.name, o);
  return map;
}

async function renderSprite(
  ctx: SKRSContext2D,
  inst: Instance,
  obj: GDObject,
  resources: Map<string, string>,
  stats: RenderStats,
): Promise<void> {
  const animations = obj.animations ?? [];
  if (!animations.length) {
    drawPlaceholder(ctx, inst, obj, "no animations");
    stats.notes.push(`${obj.name}: Sprite has no animations`);
    return;
  }

  const frame = animations[0]?.directions?.[0]?.sprites?.[0];
  if (!frame?.image) {
    drawPlaceholder(ctx, inst, obj, "no frame");
    return;
  }

  const imagePath = resources.get(frame.image);
  if (!imagePath || !existsSync(imagePath)) {
    drawPlaceholder(ctx, inst, obj, `missing: ${frame.image}`);
    stats.missingResources.push(frame.image);
    return;
  }

  try {
    const img = await loadImage(imagePath);
    const w = inst.customSize && inst.width ? inst.width : img.width;
    const h = inst.customSize && inst.height ? inst.height : img.height;
    ctx.save();
    ctx.translate(inst.x, inst.y);
    if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  } catch (err) {
    drawPlaceholder(ctx, inst, obj, `load error`);
    stats.notes.push(`${obj.name}: failed to load ${frame.image} — ${(err as Error).message}`);
  }
}

async function renderCube3D(
  ctx: SKRSContext2D,
  inst: Instance,
  obj: GDObject,
  resources: Map<string, string>,
  stats: RenderStats,
): Promise<void> {
  const w = inst.customSize && inst.width ? inst.width : 100;
  const h = inst.customSize && inst.height ? inst.height : 100;
  const frontRes = obj.frontFaceResourceName;
  const frontPath = frontRes ? resources.get(frontRes) : undefined;
  ctx.save();
  ctx.translate(inst.x, inst.y);
  if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
  if (frontPath && existsSync(frontPath)) {
    try {
      const img = await loadImage(frontPath);
      ctx.drawImage(img, 0, 0, w, h);
    } catch {
      drawWireframe(ctx, 0, 0, w, h, obj.name, "3D Cube");
    }
  } else {
    drawWireframe(ctx, 0, 0, w, h, obj.name, "3D Cube");
  }
  ctx.restore();
  void stats;
}

function renderModel3D(ctx: SKRSContext2D, inst: Instance, obj: GDObject): void {
  const w = inst.customSize && inst.width ? inst.width : 100;
  const h = inst.customSize && inst.height ? inst.height : 100;
  ctx.save();
  ctx.translate(inst.x, inst.y);
  if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
  drawWireframe(ctx, 0, 0, w, h, obj.name, "3D Model");
  ctx.restore();
}

function renderText(ctx: SKRSContext2D, inst: Instance, obj: GDObject): void {
  const c = (obj.content ?? obj) as Record<string, unknown>;
  const text = (c["text"] as string) ?? (c["string"] as string) ?? "";
  const size = (c["characterSize"] as number) ?? 30;
  const color = parseColor(c["color"] as GDColor);
  const bold = c["bold"] === true;
  const italic = c["italic"] === true;
  const fontFamily = (c["font"] as string) || "sans-serif";
  ctx.save();
  ctx.translate(inst.x, inst.y);
  if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.font = `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily}, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

async function renderTiledSprite(
  ctx: SKRSContext2D,
  inst: Instance,
  obj: GDObject,
  resources: Map<string, string>,
  stats: RenderStats,
): Promise<void> {
  const texture = ((obj.content as { texture?: string } | undefined)?.texture ?? obj.texture) as
    | string
    | undefined;
  if (!texture) {
    drawPlaceholder(ctx, inst, obj, "no texture");
    return;
  }
  const path = resources.get(texture);
  if (!path || !existsSync(path)) {
    drawPlaceholder(ctx, inst, obj, `missing: ${texture}`);
    stats.missingResources.push(texture);
    return;
  }
  try {
    const img = await loadImage(path);
    const w = inst.customSize && inst.width ? inst.width : img.width;
    const h = inst.customSize && inst.height ? inst.height : img.height;
    ctx.save();
    ctx.translate(inst.x, inst.y);
    if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
    const pattern = ctx.createPattern(img, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.restore();
  } catch (err) {
    drawPlaceholder(ctx, inst, obj, "load error");
    stats.notes.push(`${obj.name}: tiled sprite load error — ${(err as Error).message}`);
  }
}

function drawPlaceholder(
  ctx: SKRSContext2D,
  inst: Instance,
  obj: GDObject,
  hint: string,
): void {
  const w = inst.customSize && inst.width ? inst.width : 64;
  const h = inst.customSize && inst.height ? inst.height : 64;
  ctx.save();
  ctx.translate(inst.x, inst.y);
  if (inst.angle) ctx.rotate(((inst.angle ?? 0) * Math.PI) / 180);
  drawWireframe(ctx, 0, 0, w, h, obj.name, `${obj.type} (${hint})`);
  ctx.restore();
}

function drawWireframe(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  kind: string,
): void {
  ctx.strokeStyle = "rgba(0, 220, 220, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(0, 220, 220, 0.95)";
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(name, x + 4, y + 4);
  ctx.fillStyle = "rgba(0, 220, 220, 0.7)";
  ctx.font = "10px monospace";
  ctx.fillText(kind, x + 4, y + 18);
}

function drawLabel(ctx: SKRSContext2D, inst: Instance): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 0, 0.95)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.lineWidth = 3;
  ctx.font = "11px monospace";
  ctx.textBaseline = "bottom";
  const label = `${inst.name} (${Math.round(inst.x)}, ${Math.round(inst.y)})`;
  ctx.strokeText(label, inst.x + 2, inst.y - 2);
  ctx.fillText(label, inst.x + 2, inst.y - 2);
  ctx.restore();
}

export async function renderSceneStatic(opts: RenderOptions): Promise<RenderStats> {
  const project = JSON.parse(readFileSync(opts.projectPath, "utf-8")) as Project;
  const sceneName = opts.sceneName ?? project.firstLayout;
  const layout = project.layouts.find((l) => l.name === sceneName);
  if (!layout) {
    throw new Error(
      `Scene "${sceneName}" not found. Available: ${project.layouts.map((l) => l.name).join(", ")}`,
    );
  }

  const width = opts.width ?? project.properties.windowWidth ?? 1280;
  const height = opts.height ?? project.properties.windowHeight ?? 720;

  const canvas: Canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = opts.background ?? "#3a3a40";
  ctx.fillRect(0, 0, width, height);

  const projectDir = dirname(opts.projectPath);
  const resources = buildResourceMap(project, projectDir);
  const objects = buildObjectMap(project, sceneName);

  const stats: RenderStats = {
    outputPath: "",
    sizeBytes: 0,
    width,
    height,
    scene: sceneName,
    instancesRendered: 0,
    instancesSkipped: 0,
    byType: {},
    missingObjects: [],
    missingResources: [],
    notes: [],
  };

  const sortedInstances = [...layout.instances].sort(
    (a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0),
  );

  for (const inst of sortedInstances) {
    const obj = objects.get(inst.name);
    if (!obj) {
      stats.instancesSkipped++;
      stats.missingObjects.push(inst.name);
      continue;
    }

    stats.byType[obj.type] = (stats.byType[obj.type] ?? 0) + 1;

    try {
      switch (obj.type) {
        case "Sprite":
          await renderSprite(ctx, inst, obj, resources, stats);
          break;
        case "TextObject::Text":
          renderText(ctx, inst, obj);
          break;
        case "TiledSpriteObject::TiledSprite":
          await renderTiledSprite(ctx, inst, obj, resources, stats);
          break;
        case "Scene3D::Cube3DObject":
          await renderCube3D(ctx, inst, obj, resources, stats);
          break;
        case "Scene3D::Model3DObject":
          renderModel3D(ctx, inst, obj);
          break;
        default:
          drawPlaceholder(ctx, inst, obj, "unsupported type");
          stats.notes.push(`${obj.name}: type "${obj.type}" rendered as placeholder`);
      }
      stats.instancesRendered++;

      if (opts.showLabels) {
        drawLabel(ctx, inst);
      }
    } catch (err) {
      stats.instancesSkipped++;
      stats.notes.push(`${inst.name}: render error — ${(err as Error).message}`);
    }
  }

  const outputPath =
    opts.outputPath ?? join(tmpdir(), `gdevelop-scene-${sceneName.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}.png`);
  const buffer = await canvas.encode("png");
  writeFileSync(outputPath, buffer);

  stats.outputPath = outputPath;
  stats.sizeBytes = buffer.length;
  return stats;
}
