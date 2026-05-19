const CDN_BASE = "https://resources.gdevelop-app.com/assets-database";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function fetchJsonCached<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Asset CDN error (${res.status}) for ${url}`);
  }
  const value = (await res.json()) as T;
  cache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export type AssetPack = {
  name: string;
  tag: string;
  categories: string[];
  thumbnailUrl: string;
  assetsCount: number;
  authors: { name: string; website?: string }[];
  licenses: { name: string; website?: string }[];
};

export type AssetShortHeader = {
  id: string;
  name: string;
  shortDescription: string;
  tags: string[];
  previewImageUrls: string[];
  license: string;
  objectType: string;
  animationsCount?: number;
  maxFramesCount?: number;
  width?: number;
  height?: number;
  dominantColors?: number[];
};

export type AssetFilters = {
  allTags: string[];
  defaultTags?: string[];
  [key: string]: unknown;
};

export type AssetDetails = {
  id: string;
  name: string;
  authors: string[];
  license: string;
  shortDescription: string;
  description: string;
  tags: string[];
  objectAssets: Array<{
    object: Record<string, unknown>;
    customization: unknown[];
    requiredExtensions: unknown[];
    resources?: unknown[];
  }>;
  [key: string]: unknown;
};

export async function getAssetPacks(): Promise<AssetPack[]> {
  const data = await fetchJsonCached<{ starterPacks: AssetPack[] }>(
    `${CDN_BASE}/assetPacks.json`,
  );
  return data.starterPacks;
}

export async function getAssetShortHeaders(): Promise<AssetShortHeader[]> {
  return fetchJsonCached<AssetShortHeader[]>(
    `${CDN_BASE}/assetShortHeaders.json`,
  );
}

export async function getAssetFilters(): Promise<AssetFilters> {
  return fetchJsonCached<AssetFilters>(`${CDN_BASE}/filters.json`);
}

export async function getAssetDetails(id: string): Promise<AssetDetails> {
  const safeId = id.replace(/[^a-f0-9]/gi, "");
  if (safeId.length !== id.length || safeId.length === 0) {
    throw new Error(`Invalid asset id: ${id}`);
  }
  return fetchJsonCached<AssetDetails>(`${CDN_BASE}/assets/${safeId}.json`);
}

export type SearchOptions = {
  query?: string;
  tags?: string[];
  objectType?: string;
  license?: string;
  limit?: number;
};

export function searchAssetsIn(
  headers: AssetShortHeader[],
  opts: SearchOptions,
): AssetShortHeader[] {
  const { query, tags, objectType, license, limit = 50 } = opts;
  const q = query?.toLowerCase().trim();
  const requiredTags = tags?.map((t) => t.toLowerCase()) ?? [];

  const matches: AssetShortHeader[] = [];
  for (const h of headers) {
    if (objectType && h.objectType !== objectType) continue;
    if (license && h.license !== license) continue;
    if (q) {
      const haystack = (
        h.name +
        " " +
        h.shortDescription +
        " " +
        h.tags.join(" ")
      ).toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    if (requiredTags.length) {
      const lowerTags = h.tags.map((t) => t.toLowerCase());
      if (!requiredTags.every((rt) => lowerTags.some((t) => t.includes(rt)))) {
        continue;
      }
    }
    matches.push(h);
    if (matches.length >= limit) break;
  }
  return matches;
}
