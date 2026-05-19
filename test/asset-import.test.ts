import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importAssetsIntoProject } from "../src/core/asset-import.js";
import { minimalValidProject } from "./fixtures.js";

const ASSET_ID_1 = "aaaa1111";
const ASSET_ID_2 = "bbbb2222";

const detailFor = (id: string, name: string) => ({
  id,
  name,
  authors: ["test"],
  license: "CC0 (public domain)",
  shortDescription: "",
  description: "",
  tags: ["test"],
  objectAssets: [
    {
      object: {
        name,
        type: "Sprite",
        animations: [],
        variables: [],
        effects: [],
        behaviors: [],
      },
      customization: [],
      requiredExtensions: [],
      resources: [
        {
          url: `https://example.test/${name}.png`,
          name: `${name}.png`,
          kind: "image",
        },
      ],
    },
  ],
});

function mockFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/assets/aaaa1111.json")) {
        return new Response(JSON.stringify(detailFor(ASSET_ID_1, "Alpha")));
      }
      if (url.endsWith("/assets/bbbb2222.json")) {
        return new Response(JSON.stringify(detailFor(ASSET_ID_2, "Beta")));
      }
      if (url.endsWith("/assetShortHeaders.json")) {
        return new Response(
          JSON.stringify([
            {
              id: ASSET_ID_1,
              name: "Alpha",
              shortDescription: "",
              tags: ["forest", "tree"],
              previewImageUrls: [],
              license: "CC0 (public domain)",
              objectType: "sprite",
            },
            {
              id: ASSET_ID_2,
              name: "Beta",
              shortDescription: "",
              tags: ["forest", "rock"],
              previewImageUrls: [],
              license: "CC0 (public domain)",
              objectType: "sprite",
            },
          ]),
        );
      }
      if (url.includes("example.test")) {
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      }
      return new Response("not found", { status: 404 });
    }),
  );
}

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "asset-import-test-"));
  const path = join(dir, "game.json");
  writeFileSync(path, JSON.stringify(minimalValidProject(), null, 2), "utf-8");
  return path;
}

describe("importAssetsIntoProject", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires either assetIds or packTag", async () => {
    const path = makeTempProject();
    await expect(
      importAssetsIntoProject(path, { scope: "scene", scene: "MainScene" }),
    ).rejects.toThrow(/assetIds.*packTag/);
  });

  it("imports a single asset and registers a resource", async () => {
    const path = makeTempProject();
    const result = await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1],
      scope: "scene",
      scene: "MainScene",
      backup: false,
    });
    expect(result.totalImported).toBe(1);
    expect(result.results[0].status).toBe("imported");
    expect(result.results[0].objectName).toBe("Alpha");

    const after = JSON.parse(readFileSync(path, "utf-8"));
    expect(after.layouts[0].objects).toHaveLength(1);
    expect(after.resources.resources).toHaveLength(1);
  });

  it("imports several assets in a single batch", async () => {
    const path = makeTempProject();
    const result = await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1, ASSET_ID_2],
      scope: "scene",
      scene: "MainScene",
      backup: false,
    });
    expect(result.totalImported).toBe(2);
    expect(result.totalFailed).toBe(0);
  });

  it("resolves packTag to matching asset ids", async () => {
    const path = makeTempProject();
    const result = await importAssetsIntoProject(path, {
      packTag: "forest",
      scope: "scene",
      scene: "MainScene",
      backup: false,
    });
    expect(result.totalRequested).toBe(2);
    expect(result.totalImported).toBe(2);
  });

  it("creates a backup when backup is not disabled", async () => {
    const path = makeTempProject();
    const result = await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1],
      scope: "scene",
      scene: "MainScene",
    });
    expect(result.backupPath).toBeDefined();
    expect(existsSync(result.backupPath!)).toBe(true);
  });

  it("skips an asset whose object name already exists", async () => {
    const path = makeTempProject();
    await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1],
      scope: "scene",
      scene: "MainScene",
      backup: false,
    });
    const second = await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1],
      scope: "scene",
      scene: "MainScene",
      backup: false,
    });
    expect(second.results[0].status).toBe("skipped");
  });

  it("places instances in a horizontal grid when placeAt is provided", async () => {
    const path = makeTempProject();
    const result = await importAssetsIntoProject(path, {
      assetIds: [ASSET_ID_1, ASSET_ID_2],
      scope: "scene",
      scene: "MainScene",
      placeAt: { x: 100, y: 200 },
      placementSpacing: { x: 50, y: 0 },
      backup: false,
    });
    expect(result.results[0].instancePosition).toEqual({ x: 100, y: 200 });
    expect(result.results[1].instancePosition).toEqual({ x: 150, y: 200 });
  });
});
