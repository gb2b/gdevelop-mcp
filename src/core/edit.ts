import { readFileSync, writeFileSync, renameSync, copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { validateProjectData, type ValidationIssue } from "./validation.js";
import { findObjectType } from "./catalog-static.js";

const AddLayoutOp = z.object({
  op: z.literal("add_layout"),
  name: z.string().min(1),
  setAsFirst: z.boolean().optional(),
});

const AddObjectOp = z.object({
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

const AddInstanceOp = z.object({
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

const AttachBehaviorOp = z.object({
  op: z.literal("attach_behavior"),
  objectName: z.string().min(1),
  scope: z.enum(["scene", "global"]).optional().default("scene"),
  scene: z.string().optional(),
  type: z.string().min(1),
  name: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const EditOpSchema = z.discriminatedUnion("op", [
  AddLayoutOp,
  AddObjectOp,
  AddInstanceOp,
  AttachBehaviorOp,
]);
export type EditOp = z.infer<typeof EditOpSchema>;

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

function applyAddLayout(
  project: ProjectShape,
  op: z.infer<typeof AddLayoutOp>,
) {
  if (project.layouts.some((l) => l.name === op.name)) {
    throw new Error(`Layout "${op.name}" already exists.`);
  }
  project.layouts.push(defaultLayoutTemplate(op.name));
  if (op.setAsFirst || !project.firstLayout) {
    project.firstLayout = op.name;
  }
}

function applyAddObject(
  project: ProjectShape,
  op: z.infer<typeof AddObjectOp>,
) {
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

function applyAddInstance(
  project: ProjectShape,
  op: z.infer<typeof AddInstanceOp>,
) {
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

function applyAttachBehavior(
  project: ProjectShape,
  op: z.infer<typeof AttachBehaviorOp>,
) {
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

export type EditSummary = {
  layoutsAdded: string[];
  objectsAdded: Array<{
    scope: "scene" | "global";
    scene?: string;
    name: string;
    type: string;
  }>;
  instancesAdded: Array<{
    scene: string;
    objectName: string;
    x: number;
    y: number;
  }>;
  behaviorsAttached: Array<{ objectName: string; type: string; name: string }>;
};

export type EditResult = {
  applied: number;
  totalOps: number;
  dryRun: boolean;
  written: boolean;
  baseline: {
    valid: boolean;
    errors: number;
    warnings: number;
  };
  validation: {
    valid: boolean;
    issues: ValidationIssue[];
  };
  summary: EditSummary;
  backupPath?: string;
  failedAt?: { index: number; op: EditOp; error: string };
  refusedReason?: string;
};

function emptySummary(): EditSummary {
  return {
    layoutsAdded: [],
    objectsAdded: [],
    instancesAdded: [],
    behaviorsAttached: [],
  };
}

function recordOp(summary: EditSummary, op: EditOp): void {
  switch (op.op) {
    case "add_layout":
      summary.layoutsAdded.push(op.name);
      break;
    case "add_object":
      summary.objectsAdded.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        name: op.name,
        type: op.type,
      });
      break;
    case "add_instance":
      summary.instancesAdded.push({
        scene: op.scene,
        objectName: op.objectName,
        x: op.x,
        y: op.y,
      });
      break;
    case "attach_behavior":
      summary.behaviorsAttached.push({
        objectName: op.objectName,
        type: op.type,
        name: op.name ?? op.type.split("::").pop() ?? op.type,
      });
      break;
  }
}

export async function editProject(
  filePath: string,
  ops: EditOp[],
  options: {
    dryRun?: boolean;
    backup?: boolean;
    requireBaselineValid?: boolean;
  } = {},
): Promise<EditResult> {
  const dryRun = options.dryRun ?? false;
  const backup = options.backup ?? true;
  const requireBaselineValid = options.requireBaselineValid ?? true;

  const raw = readFileSync(filePath, "utf-8");
  const projectOriginal = JSON.parse(raw) as ProjectShape;

  const baselineValidation = validateProjectData(projectOriginal);
  const baseline = {
    valid: baselineValidation.valid,
    errors: baselineValidation.issues.filter((i) => i.severity === "error")
      .length,
    warnings: baselineValidation.issues.filter((i) => i.severity === "warning")
      .length,
  };

  if (!baselineValidation.valid && requireBaselineValid) {
    return {
      applied: 0,
      totalOps: ops.length,
      dryRun,
      written: false,
      baseline,
      validation: { valid: false, issues: baselineValidation.issues },
      summary: emptySummary(),
      refusedReason:
        "Baseline project is invalid — refusing to edit. Fix the existing errors first, or set requireBaselineValid=false to override.",
    };
  }

  const project = JSON.parse(raw) as ProjectShape;
  const summary = emptySummary();

  let appliedCount = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    try {
      switch (op.op) {
        case "add_layout":
          applyAddLayout(project, op);
          break;
        case "add_object":
          applyAddObject(project, op);
          break;
        case "add_instance":
          applyAddInstance(project, op);
          break;
        case "attach_behavior":
          applyAttachBehavior(project, op);
          break;
      }
      recordOp(summary, op);
      appliedCount++;
    } catch (err) {
      return {
        applied: appliedCount,
        totalOps: ops.length,
        dryRun,
        written: false,
        baseline,
        validation: { valid: false, issues: [] },
        summary,
        failedAt: { index: i, op, error: (err as Error).message },
      };
    }
  }

  const validation = validateProjectData(project);

  if (!validation.valid) {
    return {
      applied: appliedCount,
      totalOps: ops.length,
      dryRun,
      written: false,
      baseline,
      validation: { valid: false, issues: validation.issues },
      summary,
    };
  }

  if (dryRun) {
    return {
      applied: appliedCount,
      totalOps: ops.length,
      dryRun: true,
      written: false,
      baseline,
      validation: { valid: true, issues: validation.issues },
      summary,
    };
  }

  let backupPath: string | undefined;
  if (backup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${filePath}.bak-${stamp}`;
    copyFileSync(filePath, backupPath);
  }

  const tmpPath = `${filePath}.tmp-${randomUUID()}`;
  writeFileSync(tmpPath, JSON.stringify(project, null, 2), "utf-8");
  renameSync(tmpPath, filePath);

  return {
    applied: appliedCount,
    totalOps: ops.length,
    dryRun: false,
    written: true,
    baseline,
    validation: { valid: true, issues: validation.issues },
    summary,
    backupPath,
  };
}
