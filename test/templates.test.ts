import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quickStartTemplate } from "../src/core/templates.js";
import { validateProjectData } from "../src/core/validation.js";

function tempPath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), "tpl-test-")), name);
}

describe("quickStartTemplate", () => {
  it("creates a valid blank project", () => {
    const path = tempPath("blank.json");
    const result = quickStartTemplate({
      targetPath: path,
      name: "blank",
      genre: "blank",
    });
    expect(result.objects).toEqual([]);
    const project = JSON.parse(readFileSync(path, "utf-8"));
    const validation = validateProjectData(project);
    expect(validation.valid).toBe(true);
  });

  it("creates a valid platformer with Player+Ground", () => {
    const path = tempPath("platformer.json");
    const result = quickStartTemplate({
      targetPath: path,
      name: "test platformer",
      genre: "platformer",
    });
    expect(result.objects).toEqual(["Player", "Ground"]);
    expect(result.scene).toBe("Level1");
    const project = JSON.parse(readFileSync(path, "utf-8"));
    expect(validateProjectData(project).valid).toBe(true);
    const layout = project.layouts[0];
    expect(layout.objects).toHaveLength(2);
    expect(layout.objects[0].behaviors[0].type).toBe(
      "PlatformBehavior::PlatformerObjectBehavior",
    );
  });

  it("creates a valid topdown with TopDown behavior", () => {
    const path = tempPath("topdown.json");
    quickStartTemplate({
      targetPath: path,
      name: "test topdown",
      genre: "topdown",
    });
    const project = JSON.parse(readFileSync(path, "utf-8"));
    expect(validateProjectData(project).valid).toBe(true);
    expect(project.layouts[0].objects[0].behaviors[0].type).toBe(
      "TopDownMovementBehavior::TopDownMovementBehavior",
    );
  });

  it("creates a valid shmup with DestroyOutside", () => {
    const path = tempPath("shmup.json");
    quickStartTemplate({
      targetPath: path,
      name: "test shmup",
      genre: "shmup",
    });
    const project = JSON.parse(readFileSync(path, "utf-8"));
    expect(validateProjectData(project).valid).toBe(true);
    const bullet = project.layouts[0].objects.find(
      (o: { name: string }) => o.name === "Bullet",
    );
    expect(bullet.behaviors[0].type).toBe(
      "DestroyOutsideBehavior::DestroyOutside",
    );
  });

  it("refuses to overwrite without explicit opt-in", () => {
    const path = tempPath("noclobber.json");
    writeFileSync(path, "{}", "utf-8");
    expect(() =>
      quickStartTemplate({
        targetPath: path,
        name: "x",
        genre: "blank",
      }),
    ).toThrow(/Refusing to overwrite/);
  });

  it("overwrites when overwrite:true is passed", () => {
    const path = tempPath("clobber.json");
    writeFileSync(path, "{}", "utf-8");
    const result = quickStartTemplate({
      targetPath: path,
      name: "ok",
      genre: "blank",
      overwrite: true,
    });
    expect(result.bytesWritten).toBeGreaterThan(0);
  });
});
