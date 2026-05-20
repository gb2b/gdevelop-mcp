/**
 * Add ops for edit_project: add_layout, add_object, add_instance,
 * attach_behavior. Extracted from edit.ts to keep that file under the
 * 500-line limit (see .claude/rules/file-size.md).
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findObjectType } from "./catalog-static.js";

export const AddLayoutOpSchema = z.object({
  op: z.literal("add_layout"),
  name: z.string().min(1),
  setAsFirst: z.boolean().optional(),
});

export const AddObjectOpSchema = z.object({
  op: z.literal("add_object"),
  type: z
    .string()
    .min(1)
    .describe("Internal type, e.g. 'Sprite' or 'TextObject::Text'"),
  name: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  variables: z.array(z.unknown()).optional(),
  behaviors: z.array(z.unknown()).optional(),
  tags: z.string().optional(),
});

export const AddInstanceOpSchema = z.object({
  op: z.literal("add_instance"),
  scene: z.string().min(1),
  objectName: z.string().min(1),
  x: z.number(),
  y: z.number(),
  layer: z.string().optional().default(""),
  zOrder: z.number().int().optional().default(1),
  angle: z.number().optional().default(0),
  customSize: z.boolean().optional().default(false),
  width: z.number().optional().default(0),
  height: z.number().optional().default(0),
});

export const AttachBehaviorOpSchema = z.object({
  op: z.literal("attach_behavior"),
  objectName: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  type: z.string().min(1),
  name: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export type AddLayoutOp = z.infer<typeof AddLayoutOpSchema>;
export type AddObjectOp = z.infer<typeof AddObjectOpSchema>;
export type AddInstanceOp = z.infer<typeof AddInstanceOpSchema>;
export type AttachBehaviorOp = z.infer<typeof AttachBehaviorOpSchema>;

type ProjectShape = Record<string, unknown> & {
  firstLayout?: string;
  layouts: Array<
    Record<string, unknown> & {
      name: string;
      objects: unknown[];
      instances: unknown[];
    }
  >;
  objects: unknown[];
};

function defaultLayer() {
  return {
    ambientLightColorB: 32,
    ambientLightColorG: 32,
    ambientLightColorR: 32,
    camera3DFarPlaneDistance: 10000,
    camera3DFieldOfView: 45,
    camera3DNearPlaneDistance: 0.1,
    followBaseLayerCamera: false,
    isLightingLayer: false,
    isLocked: false,
    name: "",
    renderingType: "",
    visibility: true,
    cameras: [
      {
        defaultSize: true,
        defaultViewport: true,
        height: 0,
        viewportBottom: 1,
        viewportLeft: 0,
        viewportRight: 1,
        viewportTop: 0,
        width: 0,
      },
    ],
    effects: [],
  };
}

function defaultLayoutTemplate(name: string) {
  return {
    b: 209,
    disableInputWhenNotFocused: true,
    mangledName: name,
    name,
    r: 209,
    standardSortMethod: true,
    stopSoundsOnStartup: true,
    title: "",
    v: 209,
    uiSettings: {},
    variables: [],
    instances: [],
    objects: [],
    objectsFolderStructure: { folderName: "__ROOT" },
    events: [],
    layers: [defaultLayer()],
    behaviorsSharedData: [],
    usedResources: [],
  };
}

export function applyAddLayout(project: ProjectShape, op: AddLayoutOp): void {
  if (project.layouts.some((l) => l.name === op.name)) {
    throw new Error(`Layout "${op.name}" already exists.`);
  }
  project.layouts.push(defaultLayoutTemplate(op.name));
  if (op.setAsFirst || !project.firstLayout) {
    project.firstLayout = op.name;
  }
}

export function applyAddObject(project: ProjectShape, op: AddObjectOp): void {
  const scope = op.scope ?? "scene";
  const known = findObjectType(op.type);
  const defaultContent =
    (known?.contentExample as Record<string, unknown> | undefined) ?? {};

  const objectEntry: Record<string, unknown> = {
    name: op.name,
    type: op.type,
    tags: op.tags ?? "",
    variables: op.variables ?? [],
    behaviors: op.behaviors ?? [],
    effects: [],
    ...defaultContent,
    ...(op.content ?? {}),
  };

  if (scope === "global") {
    if (
      (project.objects as Array<{ name: string }>).some(
        (o) => o.name === op.name,
      )
    ) {
      throw new Error(`Global object "${op.name}" already exists.`);
    }
    project.objects.push(objectEntry);
  } else {
    if (!op.scene) {
      throw new Error(`add_object with scope="scene" requires a scene name.`);
    }
    const layout = project.layouts.find((l) => l.name === op.scene);
    if (!layout) throw new Error(`Layout "${op.scene}" not found.`);
    if (
      (layout.objects as Array<{ name: string }>).some(
        (o) => o.name === op.name,
      )
    ) {
      throw new Error(
        `Object "${op.name}" already exists in scene "${op.scene}".`,
      );
    }
    layout.objects.push(objectEntry);
  }
}

export function applyAddInstance(
  project: ProjectShape,
  op: AddInstanceOp,
): void {
  const layout = project.layouts.find((l) => l.name === op.scene);
  if (!layout) throw new Error(`Layout "${op.scene}" not found.`);
  const layoutObjects = layout.objects as Array<{ name: string }>;
  const globalObjects = project.objects as Array<{ name: string }>;
  if (
    !layoutObjects.some((o) => o.name === op.objectName) &&
    !globalObjects.some((o) => o.name === op.objectName)
  ) {
    throw new Error(
      `Object "${op.objectName}" not found in scene "${op.scene}" or globally.`,
    );
  }

  layout.instances.push({
    angle: op.angle ?? 0,
    customSize: op.customSize ?? false,
    height: op.height ?? 0,
    layer: op.layer ?? "",
    locked: false,
    name: op.objectName,
    persistentUuid: randomUUID(),
    width: op.width ?? 0,
    x: op.x,
    y: op.y,
    zOrder: op.zOrder ?? 1,
    numberProperties: [],
    stringProperties: [],
    initialVariables: [],
  });
}

export function applyAttachBehavior(
  project: ProjectShape,
  op: AttachBehaviorOp,
): void {
  const scope = op.scope ?? "scene";
  let target: Record<string, unknown> | undefined;

  if (scope === "global") {
    target = (project.objects as Record<string, unknown>[]).find(
      (o) => o["name"] === op.objectName,
    );
  } else {
    if (!op.scene)
      throw new Error(`attach_behavior scope="scene" requires a scene name.`);
    const layout = project.layouts.find((l) => l.name === op.scene);
    if (!layout) throw new Error(`Layout "${op.scene}" not found.`);
    target = (layout.objects as Record<string, unknown>[]).find(
      (o) => o["name"] === op.objectName,
    );
  }

  if (!target) {
    throw new Error(`Object "${op.objectName}" not found (scope=${scope}).`);
  }

  const behaviors =
    (target["behaviors"] as Array<Record<string, unknown>>) ?? [];
  const behaviorName = op.name ?? op.type.split("::").pop() ?? op.type;
  if (behaviors.some((b) => b["name"] === behaviorName)) {
    throw new Error(
      `Behavior "${behaviorName}" already attached to "${op.objectName}".`,
    );
  }

  behaviors.push({
    name: behaviorName,
    type: op.type,
    ...(op.properties ?? {}),
  });
  target["behaviors"] = behaviors;
}
