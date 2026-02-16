import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { buildCacheIndex } from "../domain/classification";
import type { CacheIndex, IndexLoadResult, TemplateMeta } from "../domain/types";
import { fetchTemplatePaths } from "./githubClient";

const CACHE_FILE_PATH = join(homedir(), ".cache", "ignore-hub", "index.json");

function isTemplateMeta(value: unknown): value is TemplateMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TemplateMeta>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.path === "string" &&
    (candidate.kind === "language" ||
      candidate.kind === "framework" ||
      candidate.kind === "global")
  );
}

function isCacheIndex(value: unknown): value is CacheIndex {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CacheIndex>;
  return (
    typeof candidate.fetchedAt === "string" &&
    candidate.sourceRef === "main" &&
    Array.isArray(candidate.templates) &&
    candidate.templates.every((template) => isTemplateMeta(template))
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function resolveCacheFilePath(): string {
  return CACHE_FILE_PATH;
}

export async function readCacheIndex(): Promise<CacheIndex | null> {
  try {
    const raw = await readFile(CACHE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isCacheIndex(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCacheIndex(index: CacheIndex): Promise<void> {
  await mkdir(dirname(CACHE_FILE_PATH), { recursive: true });
  await writeFile(CACHE_FILE_PATH, JSON.stringify(index, null, 2), "utf8");
}

export async function refreshTemplateIndex(): Promise<CacheIndex> {
  const paths = await fetchTemplatePaths();
  const index = buildCacheIndex(paths);
  await writeCacheIndex(index);
  return index;
}

export async function loadTemplateIndex(refresh: boolean): Promise<IndexLoadResult> {
  if (!refresh) {
    const cached = await readCacheIndex();
    if (cached) {
      return {
        index: cached,
        source: "cache"
      };
    }
  }

  try {
    const index = await refreshTemplateIndex();
    return {
      index,
      source: "network"
    };
  } catch (error) {
    const fallback = await readCacheIndex();
    if (fallback) {
      return {
        index: fallback,
        source: "cache",
        warning: `Network refresh failed, using cache. ${formatError(error)}`
      };
    }

    throw new Error(`Failed to load gitignore index. ${formatError(error)}`);
  }
}
