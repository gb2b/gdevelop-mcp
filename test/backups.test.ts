import { describe, it, expect, beforeEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listBackups, restoreBackup } from "../src/core/backups.js";

function makeTempProject(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "backup-test-"));
  const path = join(dir, "game.json");
  writeFileSync(path, JSON.stringify({ version: "1" }), "utf-8");
  return { dir, path };
}

describe("listBackups", () => {
  let projectPath: string;
  let dir: string;

  beforeEach(() => {
    const t = makeTempProject();
    projectPath = t.path;
    dir = t.dir;
  });

  it("returns an empty list when no backups exist", () => {
    expect(listBackups(projectPath)).toEqual([]);
  });

  it("finds backups and sorts by descending timestamp", () => {
    copyFileSync(projectPath, `${projectPath}.bak-2025-01-01T00-00-00-000Z`);
    copyFileSync(projectPath, `${projectPath}.bak-2026-01-01T00-00-00-000Z`);
    copyFileSync(projectPath, `${projectPath}.bak-2024-01-01T00-00-00-000Z`);
    const backups = listBackups(projectPath);
    expect(backups).toHaveLength(3);
    expect(backups[0].fileName).toContain("2026");
    expect(backups[2].fileName).toContain("2024");
  });

  it("ignores unrelated files in the same directory", () => {
    writeFileSync(join(dir, "other.json"), "{}");
    writeFileSync(join(dir, "game.json.notbackup"), "x");
    copyFileSync(projectPath, `${projectPath}.bak-2026-01-01T00-00-00-000Z`);
    const backups = listBackups(projectPath);
    expect(backups).toHaveLength(1);
  });
});

describe("restoreBackup", () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject().path;
  });

  it("throws when no backups exist", () => {
    expect(() => restoreBackup(projectPath)).toThrow(/No backups found/);
  });

  it("restores the most recent backup and creates a pre-restore safety bak", () => {
    const backupContent = JSON.stringify({ version: "old" });
    const backupPath = `${projectPath}.bak-2026-01-01T00-00-00-000Z`;
    writeFileSync(backupPath, backupContent, "utf-8");

    const newContent = JSON.stringify({ version: "current" });
    writeFileSync(projectPath, newContent, "utf-8");

    const result = restoreBackup(projectPath);
    expect(result.restored).toBe(backupPath);
    expect(existsSync(result.rolledOverTo)).toBe(true);
    expect(readFileSync(projectPath, "utf-8")).toBe(backupContent);
    expect(readFileSync(result.rolledOverTo, "utf-8")).toBe(newContent);
  });

  it("restores a specific backup by file name", () => {
    const old1 = `${projectPath}.bak-2024-01-01T00-00-00-000Z`;
    const old2 = `${projectPath}.bak-2026-01-01T00-00-00-000Z`;
    writeFileSync(old1, JSON.stringify({ pick: "me" }), "utf-8");
    writeFileSync(old2, JSON.stringify({ pick: "newer" }), "utf-8");

    const result = restoreBackup(projectPath, old1);
    expect(result.restored).toBe(old1);
    expect(JSON.parse(readFileSync(projectPath, "utf-8")).pick).toBe("me");
  });

  it("throws when the requested backup does not exist", () => {
    writeFileSync(`${projectPath}.bak-2026-01-01T00-00-00-000Z`, "{}", "utf-8");
    expect(() =>
      restoreBackup(projectPath, "/nope/this-does-not-exist"),
    ).toThrow(/not found/);
  });
});
