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
          {
            name: "Platformer",
            type: "PlatformBehavior::PlatformerObjectBehavior",
          },
        ],
      },
    ];
    const after = write(newProject);
    const diff = diffProjects(before, after);
    expect(diff.identical).toBe(false);
    expect(diff.layoutsModified).toHaveLength(1);
    expect(diff.layoutsModified[0].objectsAdded).toContain("Hero");
  });

  it("detects removed layouts and removed global objects", () => {
    const original = minimalValidProject() as Record<string, unknown>;
    (original.layouts as unknown[]).push({
      name: "Bonus",
      objects: [],
      instances: [],
      layers: [{ name: "", visibility: true }],
      events: [],
    });
    original.objects = [{ name: "GlobalThing", type: "Sprite" }];
    const before = write(original);
    const after = write(minimalValidProject());
    const diff = diffProjects(before, after);
    expect(diff.layoutsRemoved).toContain("Bonus");
    expect(diff.globalObjectsRemoved).toContain("GlobalThing");
  });

  it("detects an object type change as modification", () => {
    const original = minimalValidProject() as Record<string, unknown>;
    const layout = (original.layouts as Array<Record<string, unknown>>)[0];
    layout.objects = [{ name: "Hero", type: "Sprite", behaviors: [] }];
    const updated = JSON.parse(JSON.stringify(original)) as Record<
      string,
      unknown
    >;
    (updated.layouts as Array<Record<string, unknown>>)[0].objects = [
      { name: "Hero", type: "TextObject::Text", behaviors: [] },
    ];
    const before = write(original);
    const after = write(updated);
    const diff = diffProjects(before, after);
    expect(
      diff.layoutsModified[0].objectsModified[0].changes.join(","),
    ).toMatch(/type:/);
  });

  it("detects firstLayout change", () => {
    const before = write(minimalValidProject());
    const newProject = minimalValidProject({ firstLayout: "Other" }) as Record<
      string,
      unknown
    >;
    (newProject.layouts as unknown[]).push({
      name: "Other",
      objects: [],
      instances: [],
      layers: [{ name: "", visibility: true }],
      events: [],
    });
    const after = write(newProject);
    const diff = diffProjects(before, after);
    expect(diff.topLevelChanges.some((c) => c.includes("firstLayout"))).toBe(
      true,
    );
  });
});
