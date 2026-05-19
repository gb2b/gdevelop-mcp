import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffProjects } from "../src/core/diff.js";
import { minimalValidProject } from "./fixtures.js";

function write(project: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "diff-test-"));
  const path = join(dir, "p.json");
  writeFileSync(path, JSON.stringify(project), "utf-8");
  return path;
}

describe("diffProjects", () => {
  it("returns identical:true for identical projects", () => {
    const before = write(minimalValidProject());
    const after = write(minimalValidProject());
    const diff = diffProjects(before, after);
    expect(diff.identical).toBe(true);
    expect(diff.layoutsAdded).toHaveLength(0);
  });

  it("detects added layouts", () => {
    const before = write(minimalValidProject());
    const newProject = minimalValidProject() as Record<string, unknown>;
    (newProject.layouts as unknown[]).push({
      name: "Level2",
      objects: [],
      instances: [],
      layers: [{ name: "", visibility: true }],
      events: [],
    });
    const after = write(newProject);
    const diff = diffProjects(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.layoutsAdded).toContain("Level2");
  });

  it("detects added objects and behavior changes per layout", () => {
    const before = write(minimalValidProject());
    const newProject = minimalValidProject() as Record<string, unknown>;
    const layout = (newProject.layouts as Array<Record<string, unknown>>)[0];
    layout.objects = [
      {
        name: "Hero",
        type: "Sprite",
        behaviors: [
          { name: "Platformer", type: "PlatformBehavior::PlatformerObjectBehavior" },
        ],
      },
    ];
    const after = write(newProject);
    const diff = diffProjects(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.layoutsModified).toHaveLength(1);
    expect(diff.layoutsModified[0].objectsAdded).toContain("Hero");
  });

  it("detects firstLayout change", () => {
    const before = write(minimalValidProject());
    const newProject = minimalValidProject({ firstLayout: "Other" }) as Record<string, unknown>;
    (newProject.layouts as unknown[]).push({
      name: "Other",
      objects: [],
      instances: [],
      layers: [{ name: "", visibility: true }],
      events: [],
    });
    const after = write(newProject);
    const diff = diffProjects(before, after);
    expect(diff.topLevelChanges.some((c) => c.includes("firstLayout"))).toBe(true);
  });
});
