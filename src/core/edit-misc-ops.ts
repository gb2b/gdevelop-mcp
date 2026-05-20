/**
 * Miscellaneous edit ops: variables, object groups, resources, externals.
 *
 * Kept together because each is small (one schema + one apply function)
 * and they share helpers. See edit.ts for the top-level orchestrator.
 */
import { z } from "zod";

// ============================================================================
// Shared helpers
// ============================================================================

type ProjectShape = Record<string, unknown> & {
  variables?: unknown[];
  resources?: { resources: unknown[] } & Record<string, unknown>;
  layouts: Array<
    Record<string, unknown> & {
      name: string;
      objects: Array<Record<string, unknown> & { name: string }>;
      variables?: unknown[];
      objectsGroups?: unknown[];
    }
  >;
  objects: Array<Record<string, unknown> & { name: string }>;
  externalEvents: unknown[];
  externalLayouts: unknown[];
};

function findLayout(project: ProjectShape, sceneName: string) {
  const layout = project.layouts.find((l) => l.name === sceneName);
  if (!layout) throw new Error(`Scene "${sceneName}" not found.`);
  return layout;
}

function findObject(
  project: ProjectShape,
  objectName: string,
  scope: "scene" | "global",
  sceneName?: string,
) {
  if (scope === "global") {
    const obj = project.objects.find((o) => o.name === objectName);
    if (!obj) throw new Error(`Global object "${objectName}" not found.`);
    return obj;
  }
  if (!sceneName) throw new Error(`scene is required for scope="scene".`);
  const layout = findLayout(project, sceneName);
  const obj = layout.objects.find((o) => o.name === objectName);
  if (!obj)
    throw new Error(
      `Object "${objectName}" not found in scene "${sceneName}".`,
    );
  return obj;
}

// ============================================================================
// Variables
// ============================================================================

export const SetVariableOpSchema = z.object({
  op: z.literal("set_variable"),
  scope: z.enum(["project", "scene", "object-scene", "object-global"]),
  scene: z.string().optional(),
  objectName: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["number", "string", "boolean"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});
export type SetVariableOp = z.infer<typeof SetVariableOpSchema>;

export const RemoveVariableOpSchema = z.object({
  op: z.literal("remove_variable"),
  scope: z.enum(["project", "scene", "object-scene", "object-global"]),
  scene: z.string().optional(),
  objectName: z.string().optional(),
  name: z.string().min(1),
});
export type RemoveVariableOp = z.infer<typeof RemoveVariableOpSchema>;

function getVariablesContainer(
  project: ProjectShape,
  scope: SetVariableOp["scope"],
  scene?: string,
  objectName?: string,
): unknown[] {
  if (scope === "project") {
    project.variables ??= [];
    return project.variables;
  }
  if (scope === "scene") {
    if (!scene) throw new Error(`scene is required for scope="scene".`);
    const layout = findLayout(project, scene);
    layout.variables ??= [];
    return layout.variables;
  }
  if (scope === "object-scene") {
    if (!objectName)
      throw new Error(`objectName is required for scope="object-scene".`);
    const obj = findObject(project, objectName, "scene", scene);
    obj.variables ??= [];
    return obj.variables as unknown[];
  }
  // object-global
  if (!objectName)
    throw new Error(`objectName is required for scope="object-global".`);
  const obj = findObject(project, objectName, "global");
  obj.variables ??= [];
  return obj.variables as unknown[];
}

function variableValueForType(
  type: "number" | "string" | "boolean",
  value: string | number | boolean,
): { type: string; value: string | boolean } {
  switch (type) {
    case "number":
      return { type: "number", value: String(Number(value)) };
    case "string":
      return { type: "string", value: String(value) };
    case "boolean":
      return { type: "boolean", value: Boolean(value) };
  }
}

export function applySetVariable(
  project: ProjectShape,
  op: SetVariableOp,
): void {
  const container = getVariablesContainer(
    project,
    op.scope,
    op.scene,
    op.objectName,
  ) as Array<Record<string, unknown> & { name: string }>;
  const existing = container.find((v) => v.name === op.name);
  const payload = variableValueForType(op.type, op.value);
  if (existing) {
    existing.type = payload.type;
    existing.value = payload.value;
  } else {
    container.push({ name: op.name, ...payload });
  }
}

export function applyRemoveVariable(
  project: ProjectShape,
  op: RemoveVariableOp,
): void {
  const container = getVariablesContainer(
    project,
    op.scope,
    op.scene,
    op.objectName,
  ) as Array<Record<string, unknown> & { name: string }>;
  const idx = container.findIndex((v) => v.name === op.name);
  if (idx < 0)
    throw new Error(`Variable "${op.name}" not found in ${op.scope} scope.`);
  container.splice(idx, 1);
}

// ============================================================================
// Object groups
// ============================================================================

type GroupShape = { name: string; objects: Array<{ name: string }> };

function getGroupsContainer(
  project: ProjectShape,
  scope: "scene" | "global",
  scene?: string,
): GroupShape[] {
  if (scope === "scene") {
    if (!scene) throw new Error(`scene is required for scope="scene".`);
    const layout = findLayout(project, scene);
    layout.objectsGroups ??= [];
    return layout.objectsGroups as GroupShape[];
  }
  // global
  const proj = project as ProjectShape & { objectsGroups?: GroupShape[] };
  proj.objectsGroups ??= [];
  return proj.objectsGroups;
}

export const AddObjectGroupOpSchema = z.object({
  op: z.literal("add_object_group"),
  scope: z.enum(["scene", "global"]).default("scene"),
  scene: z.string().optional(),
  name: z.string().min(1),
  objects: z.array(z.string()).default([]),
});
export type AddObjectGroupOp = z.infer<typeof AddObjectGroupOpSchema>;

export const AddObjectToGroupOpSchema = z.object({
  op: z.literal("add_object_to_group"),
  scope: z.enum(["scene", "global"]).default("scene"),
  scene: z.string().optional(),
  group: z.string().min(1),
  objectName: z.string().min(1),
});
export type AddObjectToGroupOp = z.infer<typeof AddObjectToGroupOpSchema>;

export const RemoveObjectGroupOpSchema = z.object({
  op: z.literal("remove_object_group"),
  scope: z.enum(["scene", "global"]).default("scene"),
  scene: z.string().optional(),
  name: z.string().min(1),
});
export type RemoveObjectGroupOp = z.infer<typeof RemoveObjectGroupOpSchema>;

export function applyAddObjectGroup(
  project: ProjectShape,
  op: AddObjectGroupOp,
): void {
  const scope = op.scope ?? "scene";
  const container = getGroupsContainer(project, scope, op.scene);
  if (container.some((g) => g.name === op.name))
    throw new Error(`Object group "${op.name}" already exists.`);
  const objects = op.objects ?? [];
  container.push({
    name: op.name,
    objects: objects.map((n) => ({ name: n })),
  });
}

export function applyAddObjectToGroup(
  project: ProjectShape,
  op: AddObjectToGroupOp,
): void {
  const scope = op.scope ?? "scene";
  const container = getGroupsContainer(project, scope, op.scene);
  const group = container.find((g) => g.name === op.group);
  if (!group) throw new Error(`Object group "${op.group}" not found.`);
  if (group.objects.some((o) => o.name === op.objectName)) return;
  group.objects.push({ name: op.objectName });
}

export function applyRemoveObjectGroup(
  project: ProjectShape,
  op: RemoveObjectGroupOp,
): void {
  const scope = op.scope ?? "scene";
  const container = getGroupsContainer(project, scope, op.scene);
  const idx = container.findIndex((g) => g.name === op.name);
  if (idx < 0) throw new Error(`Object group "${op.name}" not found.`);
  container.splice(idx, 1);
}

// ============================================================================
// Resources
// ============================================================================

const RESOURCE_KIND_TO_GD = {
  image: "image",
  audio: "audio",
  font: "font",
  json: "json",
  video: "video",
  bitmapFont: "bitmapFont",
  tilemap: "tilemap",
  tileset: "tileset",
  model3D: "model3D",
  atlas: "atlas",
  spine: "spine",
} as const;

export const AddResourceOpSchema = z.object({
  op: z.literal("add_resource"),
  name: z.string().min(1),
  file: z.string().min(1),
  kind: z.enum([
    "image",
    "audio",
    "font",
    "json",
    "video",
    "bitmapFont",
    "tilemap",
    "tileset",
    "model3D",
    "atlas",
    "spine",
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AddResourceOp = z.infer<typeof AddResourceOpSchema>;

export function applyAddResource(
  project: ProjectShape,
  op: AddResourceOp,
): void {
  project.resources ??= { resources: [] };
  const resources = project.resources.resources as Array<{ name: string }>;
  if (resources.some((r) => r.name === op.name))
    throw new Error(`Resource "${op.name}" already exists.`);
  resources.push({
    name: op.name,
    file: op.file,
    kind: RESOURCE_KIND_TO_GD[op.kind],
    metadata: op.metadata ? JSON.stringify(op.metadata) : "",
    userAdded: true,
  } as unknown as { name: string });
}

// ============================================================================
// External events & external layouts
// ============================================================================

export const AddExternalEventsOpSchema = z.object({
  op: z.literal("add_external_events"),
  name: z.string().min(1),
  associatedScene: z.string().optional(),
});
export type AddExternalEventsOp = z.infer<typeof AddExternalEventsOpSchema>;

export const AddExternalLayoutOpSchema = z.object({
  op: z.literal("add_external_layout"),
  name: z.string().min(1),
  associatedScene: z.string().optional(),
});
export type AddExternalLayoutOp = z.infer<typeof AddExternalLayoutOpSchema>;

export function applyAddExternalEvents(
  project: ProjectShape,
  op: AddExternalEventsOp,
): void {
  const list = project.externalEvents as Array<{ name: string }>;
  if (list.some((e) => e.name === op.name))
    throw new Error(`External events "${op.name}" already exists.`);
  list.push({
    name: op.name,
    associatedScene: op.associatedScene ?? "",
    events: [],
  } as unknown as { name: string });
}

export function applyAddExternalLayout(
  project: ProjectShape,
  op: AddExternalLayoutOp,
): void {
  const list = project.externalLayouts as Array<{ name: string }>;
  if (list.some((l) => l.name === op.name))
    throw new Error(`External layout "${op.name}" already exists.`);
  list.push({
    name: op.name,
    associatedScene: op.associatedScene ?? "",
    instances: [],
    editionSettings: {},
  } as unknown as { name: string });
}
