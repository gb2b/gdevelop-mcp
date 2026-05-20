import { ProjectSchema, type Project } from "./schema.js";
import { OBJECT_TYPES, BEHAVIOR_TYPES } from "./catalog-static.js";
import { validateObjectContent } from "./object-content-schemas.js";

export type ValidationIssue = {
  severity: "error" | "warning";
  path: string;
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  project?: Project;
  issues: ValidationIssue[];
};

export function validateProjectData(raw: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        severity: "error",
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      });
    }
    return { valid: false, issues };
  }

  const project = parsed.data;
  const knownObjectTypes = new Set(OBJECT_TYPES.map((o) => o.type));
  const knownBehaviorTypes = new Set(BEHAVIOR_TYPES.map((b) => b.type));
  const declaredResourceNames = new Set(
    project.resources.resources
      .map((r) =>
        typeof r === "object" && r ? (r as { name?: string }).name : undefined,
      )
      .filter((n): n is string => typeof n === "string"),
  );

  const globalObjectNames = new Set(project.objects.map((o) => o.name));

  for (let li = 0; li < project.layouts.length; li++) {
    const layout = project.layouts[li];
    const layoutObjectNames = new Set(layout.objects.map((o) => o.name));

    for (let oi = 0; oi < layout.objects.length; oi++) {
      const obj = layout.objects[oi] as {
        type: string;
        name: string;
        behaviors?: unknown[];
      };
      const objPath = `layouts[${li}].objects[${oi}] (${obj.name})`;

      if (!knownObjectTypes.has(obj.type)) {
        issues.push({
          severity: "warning",
          path: objPath,
          code: "unknown_object_type",
          message: `Object type "${obj.type}" not in static catalog (may be valid but unchecked).`,
        });
      }

      const contentCheck = validateObjectContent(
        obj.type,
        obj as Record<string, unknown>,
      );
      if (!contentCheck.ok) {
        issues.push({
          severity: "error",
          path: objPath,
          code: "invalid_object_content",
          message: `Object "${obj.name}" (type ${obj.type}) has invalid content: ${contentCheck.messages.join("; ")}`,
        });
      }

      if (Array.isArray(obj.behaviors)) {
        for (let bi = 0; bi < obj.behaviors.length; bi++) {
          const beh = obj.behaviors[bi] as { type?: string };
          if (beh.type && !knownBehaviorTypes.has(beh.type)) {
            issues.push({
              severity: "warning",
              path: `${objPath}.behaviors[${bi}]`,
              code: "unknown_behavior_type",
              message: `Behavior type "${beh.type}" not in static catalog.`,
            });
          }
        }
      }
    }

    for (let ii = 0; ii < layout.instances.length; ii++) {
      const inst = layout.instances[ii] as { name: string };
      if (
        !layoutObjectNames.has(inst.name) &&
        !globalObjectNames.has(inst.name)
      ) {
        issues.push({
          severity: "error",
          path: `layouts[${li}].instances[${ii}]`,
          code: "missing_object_for_instance",
          message: `Instance references object "${inst.name}" but no such object exists in scene "${layout.name}" or globally.`,
        });
      }
    }
  }

  for (let gi = 0; gi < project.objects.length; gi++) {
    const obj = project.objects[gi] as { type: string; name: string };
    if (!knownObjectTypes.has(obj.type)) {
      issues.push({
        severity: "warning",
        path: `objects[${gi}] (${obj.name})`,
        code: "unknown_object_type",
        message: `Global object type "${obj.type}" not in static catalog.`,
      });
    }
    const globalCheck = validateObjectContent(
      obj.type,
      obj as Record<string, unknown>,
    );
    if (!globalCheck.ok) {
      issues.push({
        severity: "error",
        path: `objects[${gi}] (${obj.name})`,
        code: "invalid_object_content",
        message: `Global object "${obj.name}" (type ${obj.type}) has invalid content: ${globalCheck.messages.join("; ")}`,
      });
    }
  }

  if (
    project.firstLayout &&
    !project.layouts.some((l) => l.name === project.firstLayout)
  ) {
    issues.push({
      severity: "error",
      path: "firstLayout",
      code: "missing_first_layout",
      message: `firstLayout="${project.firstLayout}" but no such layout exists.`,
    });
  }

  void declaredResourceNames;

  const hasError = issues.some((i) => i.severity === "error");
  return { valid: !hasError, project, issues };
}
