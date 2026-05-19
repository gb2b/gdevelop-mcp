import { readdirSync, statSync, copyFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomUUID } from "node:crypto";

export type BackupEntry = {
  path: string;
  fileName: string;
  size: number;
  createdAt: string;
};

const BACKUP_RE = /\.bak-(.+)$/;

export function listBackups(projectPath: string): BackupEntry[] {
  const dir = dirname(projectPath);
  const base = basename(projectPath);
  const prefix = `${base}.bak-`;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const backups: BackupEntry[] = [];
  for (const name of entries) {
    if (!name.startsWith(prefix)) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      const match = name.match(BACKUP_RE);
      const stamp = match?.[1] ?? "";
      backups.push({
        path: full,
        fileName: name,
        size: st.size,
        createdAt: stamp.replace(/-/g, ":").replace(/T/, "T"),
      });
    } catch {
      // ignore
    }
  }
  return backups.sort((a, b) => b.fileName.localeCompare(a.fileName));
}

export function restoreBackup(projectPath: string, backupPath?: string): {
  restored: string;
  rolledOverTo: string;
} {
  const backups = listBackups(projectPath);
  if (backups.length === 0) {
    throw new Error(`No backups found for ${projectPath}`);
  }

  const target = backupPath
    ? backups.find((b) => b.path === backupPath || b.fileName === backupPath)
    : backups[0];

  if (!target) {
    throw new Error(
      `Backup not found: ${backupPath}. Available: ${backups.map((b) => b.fileName).join(", ")}`,
    );
  }

  const safetyStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safetyBackup = `${projectPath}.bak-${safetyStamp}-pre-restore`;
  copyFileSync(projectPath, safetyBackup);

  const tmp = `${projectPath}.tmp-${randomUUID()}`;
  copyFileSync(target.path, tmp);
  renameSync(tmp, projectPath);

  return {
    restored: target.path,
    rolledOverTo: safetyBackup,
  };
}

void writeFileSync;
