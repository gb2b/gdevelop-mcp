import { readFileSync, writeFileSync, renameSync, copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { validateProjectData, type ValidationIssue } from "./validation.js";
import {
  AddLayoutOpSchema,
  AddObjectOpSchema,
  AddInstanceOpSchema,
  AttachBehaviorOpSchema,
  applyAddLayout,
  applyAddObject,
  applyAddInstance,
  applyAttachBehavior,
} from "./edit-add-ops.js";
import {
  AddEventOpSchema,
  RemoveEventOpSchema,
  MoveEventOpSchema,
  applyAddEvent,
  applyRemoveEvent,
  applyMoveEvent,
  type AddEventOp,
  type RemoveEventOp,
  type MoveEventOp,
} from "./events.js";
import {
  AddExtensionOpSchema,
  AddEventsBasedObjectOpSchema,
  AddEventsBasedBehaviorOpSchema,
  AddExtensionFunctionOpSchema,
  AddExtensionPropertyOpSchema,
  applyAddExtension,
  applyAddEventsBasedObject,
  applyAddEventsBasedBehavior,
  applyAddExtensionFunction,
  applyAddExtensionProperty,
} from "./efe.js";
import {
  RemoveLayoutOpSchema,
  RemoveObjectOpSchema,
  RemoveInstanceOpSchema,
  RenameObjectOpSchema,
  SetObjectPropertyOpSchema,
  applyRemoveLayout,
  applyRemoveObject,
  applyRemoveInstance,
  applyRenameObject,
  applySetObjectProperty,
} from "./edit-remove-rename.js";
import {
  SetVariableOpSchema,
  RemoveVariableOpSchema,
  AddObjectGroupOpSchema,
  AddObjectToGroupOpSchema,
  RemoveObjectGroupOpSchema,
  AddResourceOpSchema,
  AddExternalEventsOpSchema,
  AddExternalLayoutOpSchema,
  applySetVariable,
  applyRemoveVariable,
  applyAddObjectGroup,
  applyAddObjectToGroup,
  applyRemoveObjectGroup,
  applyAddResource,
  applyAddExternalEvents,
  applyAddExternalLayout,
} from "./edit-misc-ops.js";
import { emptySummary, recordOp, type EditSummary } from "./edit-summary.js";

export type { EditSummary };

export const EditOpSchema = z.discriminatedUnion("op", [
  AddLayoutOpSchema,
  AddObjectOpSchema,
  AddInstanceOpSchema,
  AttachBehaviorOpSchema,
  AddEventOpSchema,
  RemoveEventOpSchema,
  MoveEventOpSchema,
  AddExtensionOpSchema,
  AddEventsBasedObjectOpSchema,
  AddEventsBasedBehaviorOpSchema,
  AddExtensionFunctionOpSchema,
  AddExtensionPropertyOpSchema,
  RemoveLayoutOpSchema,
  RemoveObjectOpSchema,
  RemoveInstanceOpSchema,
  RenameObjectOpSchema,
  SetObjectPropertyOpSchema,
  SetVariableOpSchema,
  RemoveVariableOpSchema,
  AddObjectGroupOpSchema,
  AddObjectToGroupOpSchema,
  RemoveObjectGroupOpSchema,
  AddResourceOpSchema,
  AddExternalEventsOpSchema,
  AddExternalLayoutOpSchema,
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
        case "add_event":
          applyAddEvent(
            project as unknown as Parameters<typeof applyAddEvent>[0],
            op as AddEventOp,
          );
          break;
        case "remove_event":
          applyRemoveEvent(
            project as unknown as Parameters<typeof applyRemoveEvent>[0],
            op as RemoveEventOp,
          );
          break;
        case "move_event":
          applyMoveEvent(
            project as unknown as Parameters<typeof applyMoveEvent>[0],
            op as MoveEventOp,
          );
          break;
        case "add_extension":
          applyAddExtension(
            project as unknown as Parameters<typeof applyAddExtension>[0],
            op,
          );
          break;
        case "add_events_based_object":
          applyAddEventsBasedObject(
            project as unknown as Parameters<
              typeof applyAddEventsBasedObject
            >[0],
            op,
          );
          break;
        case "add_events_based_behavior":
          applyAddEventsBasedBehavior(
            project as unknown as Parameters<
              typeof applyAddEventsBasedBehavior
            >[0],
            op,
          );
          break;
        case "add_extension_function":
          applyAddExtensionFunction(
            project as unknown as Parameters<
              typeof applyAddExtensionFunction
            >[0],
            op,
          );
          break;
        case "add_extension_property":
          applyAddExtensionProperty(
            project as unknown as Parameters<
              typeof applyAddExtensionProperty
            >[0],
            op,
          );
          break;
        case "remove_layout":
          applyRemoveLayout(
            project as unknown as Parameters<typeof applyRemoveLayout>[0],
            op,
          );
          break;
        case "remove_object":
          applyRemoveObject(
            project as unknown as Parameters<typeof applyRemoveObject>[0],
            op,
          );
          break;
        case "remove_instance":
          applyRemoveInstance(
            project as unknown as Parameters<typeof applyRemoveInstance>[0],
            op,
          );
          break;
        case "rename_object":
          applyRenameObject(
            project as unknown as Parameters<typeof applyRenameObject>[0],
            op,
          );
          break;
        case "set_object_property":
          applySetObjectProperty(
            project as unknown as Parameters<typeof applySetObjectProperty>[0],
            op,
          );
          break;
        case "set_variable":
          applySetVariable(
            project as unknown as Parameters<typeof applySetVariable>[0],
            op,
          );
          break;
        case "remove_variable":
          applyRemoveVariable(
            project as unknown as Parameters<typeof applyRemoveVariable>[0],
            op,
          );
          break;
        case "add_object_group":
          applyAddObjectGroup(
            project as unknown as Parameters<typeof applyAddObjectGroup>[0],
            op,
          );
          break;
        case "add_object_to_group":
          applyAddObjectToGroup(
            project as unknown as Parameters<typeof applyAddObjectToGroup>[0],
            op,
          );
          break;
        case "remove_object_group":
          applyRemoveObjectGroup(
            project as unknown as Parameters<typeof applyRemoveObjectGroup>[0],
            op,
          );
          break;
        case "add_resource":
          applyAddResource(
            project as unknown as Parameters<typeof applyAddResource>[0],
            op,
          );
          break;
        case "add_external_events":
          applyAddExternalEvents(
            project as unknown as Parameters<typeof applyAddExternalEvents>[0],
            op,
          );
          break;
        case "add_external_layout":
          applyAddExternalLayout(
            project as unknown as Parameters<typeof applyAddExternalLayout>[0],
            op,
          );
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
