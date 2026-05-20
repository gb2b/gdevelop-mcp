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
    expect(result.issues.some((i) => i.code === "missing_first_layout")).toBe(
      true,
    );
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

  it("flags Sprite missing required animations field", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "BrokenSprite", type: "Sprite" }, // missing `animations`
    ];
    const result = validateProjectData(project);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.code === "invalid_object_content" &&
          i.path.includes("BrokenSprite"),
      ),
    ).toBe(true);
  });

  it("accepts Sprite with valid empty animations array", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "OkSprite", type: "Sprite", animations: [] },
    ];
    const result = validateProjectData(project);
    expect(
      result.issues.filter((i) => i.code === "invalid_object_content"),
    ).toHaveLength(0);
  });

  it("flags TextObject without required `text` field", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "BrokenLabel", type: "TextObject::Text" }, // no text
    ];
    const result = validateProjectData(project);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.code === "invalid_object_content" && i.path.includes("BrokenLabel"),
      ),
    ).toBe(true);
  });

  it("accepts unknown object types silently (per-content check skipped)", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "Custom", type: "MyExt::MyEventsObject" }, // no schema registered
    ];
    const result = validateProjectData(project);
    expect(
      result.issues.filter((i) => i.code === "invalid_object_content"),
    ).toHaveLength(0);
  });

  it("supports the alternative `content.*` nested layout", () => {
    const project = minimalValidProject() as Record<string, unknown>;
    (project.layouts as Array<Record<string, unknown>>)[0].objects = [
      {
        name: "NestedSprite",
        type: "Sprite",
        content: { animations: [] },
      },
    ];
    const result = validateProjectData(project);
    expect(
      result.issues.filter((i) => i.code === "invalid_object_content"),
    ).toHaveLength(0);
  });
});
