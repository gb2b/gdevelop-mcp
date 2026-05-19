import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  statSync,
  existsSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { join, dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require_ = createRequire(import.meta.url);

export type PreviewOptions = {
  projectPath: string;
  sceneName?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  screenshotPath?: string;
  keepExport?: boolean;
};

export type PreviewResult = {
  screenshotPath: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationMs: number;
  scene: string;
  exportDir: string;
  consoleLogs: string[];
  pageErrors: string[];
  resolvedFrom: "firstLayout" | "override";
};

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

async function startStaticServer(rootDir: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        let url = (req.url || "/").split("?")[0];
        if (url.endsWith("/")) url += "index.html";
        if (url.includes("..")) {
          res.writeHead(403).end("Forbidden");
          return;
        }
        const path = join(rootDir, url);
        if (!path.startsWith(rootDir)) {
          res.writeHead(403).end("Forbidden");
          return;
        }
        if (!existsSync(path) || !statSync(path).isFile()) {
          res.writeHead(404).end("Not found");
          return;
        }
        const data = await readFile(path);
        res.writeHead(200, {
          "Content-Type": mimeFor(extname(path)),
          "Cache-Control": "no-store",
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        });
        res.end(data);
      } catch (e) {
        res.writeHead(500).end((e as Error).message);
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve({ server, port: addr.port });
      } else {
        reject(new Error("Failed to determine server port"));
      }
    });
    server.on("error", reject);
  });
}

async function runExport(projectPath: string, outputDir: string): Promise<string> {
  const cliPath = require_.resolve("gdexporter/bin/cli.js");
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [cliPath, "--project", projectPath, "--out", outputDir],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `gdexporter exited with code ${code}.\nstderr (last 500 chars): ${stderr.slice(-500)}\nstdout (last 200 chars): ${stdout.slice(-200)}`,
          ),
        );
      }
    });
  });
}

function prepareProjectFile(
  projectPath: string,
  sceneName: string | undefined,
): { exportInput: string; tempFile?: string; resolvedScene: string; resolvedFrom: "firstLayout" | "override" } {
  const raw = readFileSync(projectPath, "utf-8");
  const project = JSON.parse(raw) as { firstLayout: string; layouts: Array<{ name: string }> };

  if (!sceneName || sceneName === project.firstLayout) {
    return {
      exportInput: projectPath,
      resolvedScene: project.firstLayout,
      resolvedFrom: "firstLayout",
    };
  }

  if (!project.layouts.some((l) => l.name === sceneName)) {
    throw new Error(
      `Scene "${sceneName}" not found. Available: ${project.layouts.map((l) => l.name).join(", ")}`,
    );
  }

  project.firstLayout = sceneName;
  const projectDir = dirname(projectPath);
  const tempFile = join(projectDir, `.preview-${randomUUID()}.json`);
  writeFileSync(tempFile, JSON.stringify(project), "utf-8");
  return {
    exportInput: tempFile,
    tempFile,
    resolvedScene: sceneName,
    resolvedFrom: "override",
  };
}

export async function previewScene(opts: PreviewOptions): Promise<PreviewResult> {
  const durationMs = opts.durationMs ?? 3000;
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;

  const prepared = prepareProjectFile(opts.projectPath, opts.sceneName);

  const tempBase = mkdtempSync(join(tmpdir(), "gdevelop-preview-"));
  const exportDir = join(tempBase, "build");

  let server: Server | undefined;
  let browser: import("puppeteer").Browser | undefined;
  const consoleLogs: string[] = [];
  const pageErrors: string[] = [];

  try {
    await runExport(prepared.exportInput, exportDir);

    if (!existsSync(join(exportDir, "index.html"))) {
      throw new Error(
        `Export succeeded but index.html not found at ${exportDir}. Possibly a different export structure.`,
      );
    }

    const started = await startStaticServer(exportDir);
    server = started.server;

    const puppeteer = (await import("puppeteer")).default;
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      pageErrors.push((err as Error).message ?? String(err));
    });

    await page.goto(`http://127.0.0.1:${started.port}/index.html`, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });

    await new Promise((r) => setTimeout(r, durationMs));

    const screenshotPath =
      opts.screenshotPath ?? join(tmpdir(), `gdevelop-preview-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath as `${string}.png`, type: "png" });

    const stats = statSync(screenshotPath);

    return {
      screenshotPath,
      sizeBytes: stats.size,
      width,
      height,
      durationMs,
      scene: prepared.resolvedScene,
      exportDir,
      consoleLogs: consoleLogs.slice(-50),
      pageErrors,
      resolvedFrom: prepared.resolvedFrom,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (prepared.tempFile && existsSync(prepared.tempFile)) {
      try {
        unlinkSync(prepared.tempFile);
      } catch {
        // ignore
      }
    }
    if (!opts.keepExport && existsSync(tempBase)) {
      try {
        rmSync(tempBase, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
