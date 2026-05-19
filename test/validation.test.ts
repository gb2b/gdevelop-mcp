import { describe, it, expect } from "vitest";
import { validateProjectData } from "../src/core/validation.js";
import { minimalValidProject } from "./fixtures.js";

describe("validateProjectData", () => {
  it("accepts a minimal valid project", () => {
    const result = validateProjectData(minimalValidProject());
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("rejects missing properties", () => {
    const result = validateProjectData({});
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("flags missing firstLayout reference", () => {
    const project = minimalValidProject({ firstLayout: "Nonexistent" });
    const result = validateProjectData(project);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.code === "missing_first_layout"),
    ).toBe(true);
  });

  it("flags instance referencing missing object", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].instances = [
      { name: "Ghost", x: 0, y: 0 },
    ];
    const result = validateProjectData(project);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.code === "missing_object_for_instance"),
    ).toBe(true);
  });

  it("warns on unknown object type (does not fail)", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "Weird", type: "MyExt::UnknownType" },
    ];
    const result = validateProjectData(project);
    expect(result.valid).toBe(true);
    expect(
      result.issues.some(
        (i) => i.code === "unknown_object_type" && i.severity === "warning",
      ),
    ).toBe(true);
  });
});
