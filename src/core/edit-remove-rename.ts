/**
 * Removal / renaming / property-setting operations for edit_project.
 * Kept in a separate module so src/core/edit.ts stays under the 500-line
 * limit and these ops are testable in isolation.
 */
import { z } from "zod";

export const RemoveLayoutOpSchema = z.object({
  op: z.literal("remove_layout"),
  name: z.string().min(1),
});

export const RemoveObjectOpSchema = z.object({
  op: z.literal("remove_object"),
  name: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  /**
   * When true (default), also remove every instance of this object from
   * the same scene (scene-scope) or from all scenes (global-scope).
   * If false and instances exist, the op fails.
   */
  cascadeInstances: z.boolean().optional().default(true),
});

export const RemoveInstanceOpSchema = z.object({
  op: z.literal("remove_instance"),
  scene: z.string().min(1),
  index: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      "Index in layout.instances[]. Either index or persistentUuid must be provided.",
    ),
  persistentUuid: z.string().optional(),
});

export const RenameObjectOpSchema = z.object({
  op: z.literal("rename_object"),
  oldName: z.string().min(1),
  newName: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  /**
   * When true (default), also rename every instance that references the
   * old name, and every parameter inside events whose value exactly
   * matches the old name. False = rename only the declaration.
   */
  cascadeReferences: z.boolean().optional().default(true),
});

export const SetObjectPropertyOpSchema = z.object({
  op: z.literal("set_object_property"),
  objectName: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  /**
   * Either "content.<field>" or a top-level field name. Examples:
   *   "content.text"  → for TextObject::Text
   *   "tags"          → top-level
   * Dot-separated paths descend into nested objects.
   */
  path: z.string().min(1),
  value: z.unknown(),
});

export type RemoveLayoutOp = z.infer<typeof RemoveLayoutOpSchema>;
export type RemoveObjectOp = z.infer<typeof RemoveObjectOpSchema>;
export type RemoveInstanceOp = z.infer<typeof RemoveInstanceOpSchema>;
export type RenameObjectOp = z.infer<typeof RenameObjectOpSchema>;
export type SetObjectPropertyOp = z.infer<typeof SetObjectPropertyOpSchema>;

type LayoutShape = {
  name: string;
  objects: Array<Record<string, unknown> & { name: string }>;
  instances: Array<
    Record<string, unknown> & { name: string; persistentUuid?: string }
  >;
  events?: unknown[];
};

type ProjectShape = {
  firstLayout?: string;
  layouts: LayoutShape[];
  objects: Array<Record<string, unknown> & { name: string }>;
};

function findLayout(project: ProjectShape, name: string): LayoutShape {
  const layout = project.layouts.find((l) => l.name === name);
  if (!layout) throw new Error(`Layout "${name}" not found.`);
  return layout;
}

export function applyRemoveLayout(
  project: ProjectShape,
  op: RemoveLayoutOp,
): void {
  const idx = project.layouts.findIndex((l) => l.name === op.name);
  if (idx === -1) throw new Error(`Layout "${op.name}" not found.`);
  project.layouts.splice(idx, 1);
  if (project.firstLayout === op.name) {
    project.firstLayout = project.layouts[0]?.name ?? "";
  }
}

export function applyRemoveObject(
  project: ProjectShape,
  op: RemoveObjectOp,
): void {
  const scope = op.scope ?? "scene";
  if (scope === "global") {
    const idx = project.objects.findIndex((o) => o.name === op.name);
    if (idx === -1) {
      throw new Error(`Global object "${op.name}" not found.`);
    }
    if (op.cascadeInstances !== false) {
      for (const layout of project.layouts) {
        layout.instances = layout.instances.filter((i) => i.name !== op.name);
      }
    } else {
      const blockingScene = project.layouts.find((l) =>
        l.instances.some((i) => i.name === op.name),
      );
      if (blockingScene) {
        throw new Error(
          `Cannot remove global object "${op.name}" — instances exist in scene "${blockingScene.name}". Set cascadeInstances:true or remove instances first.`,
        );
      }
    }
    project.objects.splice(idx, 1);
    return;
  }

  if (!op.scene) {
    throw new Error(`remove_object scope="scene" requires a scene name.`);
  }
  const layout = findLayout(project, op.scene);
  const idx = layout.objects.findIndex((o) => o.name === op.name);
  if (idx === -1) {
    throw new Error(`Object "${op.name}" not found in scene "${op.scene}".`);
  }
  if (op.cascadeInstances !== false) {
    layout.instances = layout.instances.filter((i) => i.name !== op.name);
  } else if (layout.instances.some((i) => i.name === op.name)) {
    throw new Error(
      `Cannot remove object "${op.name}" — instances exist in scene "${op.scene}". Set cascadeInstances:true.`,
    );
  }
  layout.objects.splice(idx, 1);
}

export function applyRemoveInstance(
  project: ProjectShape,
  op: RemoveInstanceOp,
): void {
  const layout = findLayout(project, op.scene);
  if (op.index !== undefined) {
    if (op.index >= layout.instances.length) {
      throw new Error(
        `Index ${op.index} out of range (${layout.instances.length} instances in scene "${op.scene}").`,
      );
    }
    layout.instances.splice(op.index, 1);
    return;
  }
  if (op.persistentUuid) {
    const before = layout.instances.length;
    layout.instances = layout.instances.filter(
      (i) => i.persistentUuid !== op.persistentUuid,
    );
    if (layout.instances.length === before) {
      throw new Error(
        `No instance with persistentUuid "${op.persistentUuid}" in scene "${op.scene}".`,
      );
    }
    return;
  }
  throw new Error(
    `remove_instance requires either 'index' or 'persistentUuid'.`,
  );
}

function renameInEvents(
  events: unknown[] | undefined,
  oldName: string,
  newName: string,
): number {
  if (!Array.isArray(events)) return 0;
  let renamed = 0;
  for (const event of events) {
    const e = event as Record<string, unknown>;
    for (const key of ["conditions", "actions"]) {
      const list = e[key];
      if (Array.isArray(list)) {
        for (const inst of list as Array<{ parameters?: string[] }>) {
          if (Array.isArray(inst.parameters)) {
            for (let i = 0; i < inst.parameters.length; i++) {
              if (inst.parameters[i] === oldName) {
                inst.parameters[i] = newName;
                renamed++;
              }
            }
          }
        }
      }
    }
    if (Array.isArray((e as { events?: unknown[] }).events)) {
      renamed += renameInEvents(
        (e as { events?: unknown[] }).events,
        oldName,
        newName,
      );
    }
  }
  return renamed;
}

export function applyRenameObject(
  project: ProjectShape,
  op: RenameObjectOp,
): { instancesRenamed: number; eventParamsRenamed: number } {
  const scope = op.scope ?? "scene";
  let target: Record<string, unknown> & { name: string };

  if (scope === "global") {
    const found = project.objects.find((o) => o.name === op.oldName);
    if (!found) {
      throw new Error(`Global object "${op.oldName}" not found.`);
    }
    if (project.objects.some((o) => o.name === op.newName)) {
      throw new Error(`Global object "${op.newName}" already exists.`);
    }
    target = found;
  } else {
    if (!op.scene) {
      throw new Error(`rename_object scope="scene" requires a scene name.`);
    }
    const layout = findLayout(project, op.scene);
    const found = layout.objects.find((o) => o.name === op.oldName);
    if (!found) {
      throw new Error(
        `Object "${op.oldName}" not found in scene "${op.scene}".`,
      );
    }
    if (layout.objects.some((o) => o.name === op.newName)) {
      throw new Error(
        `Object "${op.newName}" already exists in scene "${op.scene}".`,
      );
    }
    target = found;
  }

  target.name = op.newName;

  let instancesRenamed = 0;
  let eventParamsRenamed = 0;
  if (op.cascadeReferences !== false) {
    const scenesToScan =
      scope === "global"
        ? project.layouts
        : project.layouts.filter((l) => l.name === op.scene);
    for (const layout of scenesToScan) {
      for (const inst of layout.instances) {
        if (inst.name === op.oldName) {
          inst.name = op.newName;
          instancesRenamed++;
        }
      }
      eventParamsRenamed += renameInEvents(
        layout.events,
        op.oldName,
        op.newName,
      );
    }
  }

  return { instancesRenamed, eventParamsRenamed };
}

export function applySetObjectProperty(
  project: ProjectShape,
  op: SetObjectPropertyOp,
): void {
  const scope = op.scope ?? "scene";
  let target: Record<string, unknown> | undefined;

  if (scope === "global") {
    target = project.objects.find((o) => o.name === op.objectName);
  } else {
    if (!op.scene) {
      throw new Error(
        `set_object_property scope="scene" requires a scene name.`,
      );
    }
    const layout = findLayout(project, op.scene);
    target = layout.objects.find((o) => o.name === op.objectName);
  }

  if (!target) {
    throw new Error(`Object "${op.objectName}" not found (scope=${scope}).`);
  }

  const segments = op.path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const next = cursor[key];
    if (next === undefined || next === null) {
      const fresh: Record<string, unknown> = {};
      cursor[key] = fresh;
      cursor = fresh;
    } else if (typeof next === "object" && !Array.isArray(next)) {
      cursor = next as Record<string, unknown>;
    } else {
      throw new Error(
        `Path "${op.path}" hits a non-object value at "${key}" — refusing to overwrite.`,
      );
    }
  }
  cursor[segments[segments.length - 1]] = op.value;
}
