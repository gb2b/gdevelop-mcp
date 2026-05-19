const CDN_BASE = "https://resources.gdevelop-app.com/examples-database";
const EXAMPLES_REPO = "GDevelopApp/GDevelop-examples";
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

async function fetchJsonCached<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Examples CDN error (${res.status}) for ${url}`);
  const value = (await res.json()) as T;
  cache.set(url, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export type ExampleShortHeader = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  license: string;
  previewImageUrls: string[];
  authorIds: string[];
  tags: string[];
  gdevelopVersion?: string;
  codeSizeLevel?: string;
  difficultyLevel?: string;
};

export type ExampleFilters = {
  allTags: string[];
  defaultTags?: string[];
  [key: string]: unknown;
};

export async function getExampleHeaders(): Promise<ExampleShortHeader[]> {
  return fetchJsonCached<ExampleShortHeader[]>(
    `${CDN_BASE}/exampleShortHeaders.json`,
  );
}

export async function getExampleFilters(): Promise<ExampleFilters> {
  return fetchJsonCached<ExampleFilters>(`${CDN_BASE}/filters.json`);
}

export type SearchOptions = {
  query?: string;
  tags?: string[];
  license?: string;
  difficulty?: string;
  limit?: number;
};

export function searchExamplesIn(
  headers: ExampleShortHeader[],
  opts: SearchOptions,
): ExampleShortHeader[] {
  const { query, tags, license, difficulty, limit = 30 } = opts;
  const q = query?.toLowerCase().trim();
  const requiredTags = tags?.map((t) => t.toLowerCase()) ?? [];

  const matches: ExampleShortHeader[] = [];
  for (const h of headers) {
    if (license && h.license !== license) continue;
    if (difficulty && h.difficultyLevel !== difficulty) continue;
    if (q) {
      const haystack = (
        h.name +
        " " +
        h.shortDescription +
        " " +
        h.description +
        " " +
        h.tags.join(" ")
      ).toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    if (requiredTags.length) {
      const lowerTags = h.tags.map((t) => t.toLowerCase());
      if (!requiredTags.every((rt) => lowerTags.some((t) => t.includes(rt))))
        continue;
    }
    matches.push(h);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function findExampleBySlugOrId(
  headers: ExampleShortHeader[],
  slugOrId: string,
): ExampleShortHeader | undefined {
  return headers.find((h) => h.slug === slugOrId || h.id === slugOrId);
}

export { EXAMPLES_REPO };
