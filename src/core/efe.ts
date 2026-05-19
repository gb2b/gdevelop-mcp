import { z } from "zod";

// ============================================================================
// SCHEMAS for events functions extensions (custom objects / behaviors / functions)
// ============================================================================

const ParameterSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    optional: z.boolean().optional(),
    defaultValue: z.string().optional(),
    longDescription: z.string().optional(),
    supplementaryInformation: z.string().optional(),
    codeOnly: z.boolean().optional(),
  })
  .passthrough();

const PropertyDescriptorSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    label: z.string().optional(),
    description: z.string().optional(),
    value: z.string().optional(),
    group: z.string().optional(),
    hidden: z.boolean().optional(),
  })
  .passthrough();

// ============================================================================
// EFE EDIT OPERATIONS
// ============================================================================

export const AddExtensionOpSchema = z.object({
  op: z.literal("add_extension"),
  name: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, {
      message: "Extension name must be a valid identifier",
    }),
  fullName: z.string().optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
});

export const AddEventsBasedObjectOpSchema = z.object({
  op: z.literal("add_events_based_object"),
  extension: z.string(),
  name: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  fullName: z.string().optional(),
  description: z.string().optional(),
  defaultName: z.string().optional(),
  is3D: z.boolean().optional(),
});

export const AddEventsBasedBehaviorOpSchema = z.object({
  op: z.literal("add_events_based_behavior"),
  extension: z.string(),
  name: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  fullName: z.string().optional(),
  description: z.string().optional(),
  objectType: z.string().optional(),
});

export const AddExtensionFunctionOpSchema = z.object({
  op: z.literal("add_extension_function"),
  extension: z.string(),
  parent: z.enum(["extension", "object", "behavior"]).optional(),
  parentName: z.string().optional(),
  name: z
    .string()
    .min(1)
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  functionType: z
    .enum([
      "Action",
      "Condition",
      "Expression",
      "StringExpression",
      "ExpressionAndCondition",
      "StringExpressionAndCondition",
      "ActionWithOperator",
    ])
    .optional(),
  fullName: z.string().optional(),
  description: z.string().optional(),
  sentence: z.string().optional(),
  group: z.string().optional(),
  parameters: z.array(ParameterSchema).optional(),
  events: z.array(z.unknown()).optional(),
});

export const AddExtensionPropertyOpSchema = z.object({
  op: z.literal("add_extension_property"),
  extension: z.string(),
  parent: z.enum(["object", "behavior"]),
  parentName: z.string(),
  property: PropertyDescriptorSchema,
});

export type AddExtensionOp = z.infer<typeof AddExtensionOpSchema>;
export type AddEventsBasedObjectOp = z.infer<
  typeof AddEventsBasedObjectOpSchema
>;
export type AddEventsBasedBehaviorOp = z.infer<
  typeof AddEventsBasedBehaviorOpSchema
>;
export type AddExtensionFunctionOp = z.infer<
  typeof AddExtensionFunctionOpSchema
>;
export type AddExtensionPropertyOp = z.infer<
  typeof AddExtensionPropertyOpSchema
>;

// ============================================================================
// APPLY HELPERS
// ============================================================================

type ProjectShape = {
  eventsFunctionsExtensions: Array<Record<string, unknown>>;
};

function findExtension(
  project: ProjectShape,
  name: string,
): Record<string, unknown> {
  const ext = project.eventsFunctionsExtensions.find((e) => e["name"] === name);
  if (!ext) throw new Error(`Extension "${name}" not found`);
  return ext;
}

function findChildByName(
  list: Array<Record<string, unknown>>,
  name: string,
  label: string,
): Record<string, unknown> {
  const item = list.find((i) => i["name"] === name);
  if (!item) throw new Error(`${label} "${name}" not found`);
  return item;
}

export function applyAddExtension(
  project: ProjectShape,
  op: AddExtensionOp,
): void {
  if (project.eventsFunctionsExtensions.some((e) => e["name"] === op.name)) {
    throw new Error(`Extension "${op.name}" already exists`);
  }
  project.eventsFunctionsExtensions.push({
    name: op.name,
    fullName: op.fullName ?? op.name,
    shortDescription: op.shortDescription ?? "",
    description: op.description ?? "",
    version: op.version ?? "1.0.0",
    author: op.author ?? "",
    authorIds: [],
    category: op.category ?? "",
    tags: op.tags ?? "",
    helpPath: "",
    iconUrl: "",
    previewIconUrl: "",
    dependencies: [],
    globalVariables: [],
    sceneVariables: [],
    eventsFunctions: [],
    eventsBasedBehaviors: [],
    eventsBasedObjects: [],
  });
}

export function applyAddEventsBasedObject(
  project: ProjectShape,
  op: AddEventsBasedObjectOp,
): void {
  const ext = findExtension(project, op.extension);
  const objects =
    (ext["eventsBasedObjects"] as Array<Record<string, unknown>>) ?? [];
  if (objects.some((o) => o["name"] === op.name)) {
    throw new Error(
      `Events-based object "${op.name}" already exists in extension "${op.extension}"`,
    );
  }
  objects.push({
    name: op.name,
    fullName: op.fullName ?? op.name,
    description: op.description ?? "",
    defaultName: op.defaultName ?? op.name,
    is3D: op.is3D ?? false,
    eventsFunctions: [],
    propertyDescriptors: [],
    objects: [],
    objectsFolderStructure: { folderName: "__ROOT" },
    layers: [
      {
        name: "",
        visibility: true,
        cameras: [],
        effects: [],
        isLightingLayer: false,
        followBaseLayerCamera: false,
        ambientLightColorR: 32,
        ambientLightColorG: 32,
        ambientLightColorB: 32,
        isLocked: false,
        renderingType: "",
      },
    ],
  });
  ext["eventsBasedObjects"] = objects;
}

export function applyAddEventsBasedBehavior(
  project: ProjectShape,
  op: AddEventsBasedBehaviorOp,
): void {
  const ext = findExtension(project, op.extension);
  const behaviors =
    (ext["eventsBasedBehaviors"] as Array<Record<string, unknown>>) ?? [];
  if (behaviors.some((b) => b["name"] === op.name)) {
    throw new Error(
      `Events-based behavior "${op.name}" already exists in extension "${op.extension}"`,
    );
  }
  behaviors.push({
    name: op.name,
    fullName: op.fullName ?? op.name,
    description: op.description ?? "",
    objectType: op.objectType ?? "",
    eventsFunctions: [],
    propertyDescriptors: [],
    sharedPropertyDescriptors: [],
  });
  ext["eventsBasedBehaviors"] = behaviors;
}

export function applyAddExtensionFunction(
  project: ProjectShape,
  op: AddExtensionFunctionOp,
): void {
  const ext = findExtension(project, op.extension);
  const parent = op.parent ?? "extension";
  let target: Array<Record<string, unknown>>;
  if (parent === "extension") {
    target = (ext["eventsFunctions"] as Array<Record<string, unknown>>) ?? [];
    ext["eventsFunctions"] = target;
  } else if (parent === "object") {
    if (!op.parentName)
      throw new Error('parentName is required when parent="object"');
    const ebo = findChildByName(
      (ext["eventsBasedObjects"] as Array<Record<string, unknown>>) ?? [],
      op.parentName,
      "Events-based object",
    );
    target = (ebo["eventsFunctions"] as Array<Record<string, unknown>>) ?? [];
    ebo["eventsFunctions"] = target;
  } else {
    if (!op.parentName)
      throw new Error('parentName is required when parent="behavior"');
    const ebb = findChildByName(
      (ext["eventsBasedBehaviors"] as Array<Record<string, unknown>>) ?? [],
      op.parentName,
      "Events-based behavior",
    );
    target = (ebb["eventsFunctions"] as Array<Record<string, unknown>>) ?? [];
    ebb["eventsFunctions"] = target;
  }
  if (target.some((f) => f["name"] === op.name)) {
    throw new Error(
      `Function "${op.name}" already exists in ${parent === "extension" ? op.extension : `${parent} ${op.parentName}`}`,
    );
  }
  target.push({
    name: op.name,
    fullName: op.fullName ?? op.name,
    description: op.description ?? "",
    sentence: op.sentence ?? "",
    functionType: op.functionType ?? "Action",
    group: op.group ?? "",
    parameters: op.parameters ?? [],
    events: op.events ?? [],
  });
}

export function applyAddExtensionProperty(
  project: ProjectShape,
  op: AddExtensionPropertyOp,
): void {
  const ext = findExtension(project, op.extension);
  let host: Record<string, unknown>;
  if (op.parent === "object") {
    host = findChildByName(
      (ext["eventsBasedObjects"] as Array<Record<string, unknown>>) ?? [],
      op.parentName,
      "Events-based object",
    );
  } else {
    host = findChildByName(
      (ext["eventsBasedBehaviors"] as Array<Record<string, unknown>>) ?? [],
      op.parentName,
      "Events-based behavior",
    );
  }
  const properties =
    (host["propertyDescriptors"] as Array<Record<string, unknown>>) ?? [];
  if (properties.some((p) => p["name"] === op.property.name)) {
    throw new Error(
      `Property "${op.property.name}" already exists on ${op.parent} "${op.parentName}"`,
    );
  }
  properties.push({ ...op.property });
  host["propertyDescriptors"] = properties;
}
