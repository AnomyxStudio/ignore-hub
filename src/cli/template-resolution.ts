import { normalizeTemplateName } from "../domain/classification";
import type { TemplateMeta } from "../domain/types";

const TEMPLATE_ALIASES: Record<string, string[]> = {
  js: ["javascript"],
  nodejs: ["node"],
  ts: ["typescript"],
  csharp: ["csharp", "c#"],
  py: ["python"],
};

export interface TemplateResolutionMatch {
  template: TemplateMeta;
}

export interface TemplateResolutionIssue {
  matches: TemplateMeta[];
  query: string;
  rawQuery: string;
  type: "unknown" | "ambiguous";
}

export interface TemplateResolutionResult {
  issues: TemplateResolutionIssue[];
  selected: TemplateMeta[];
}

function normalize(query: string): string {
  return normalizeTemplateName(query);
}

function dedupeTemplateIds(templates: TemplateMeta[]): TemplateMeta[] {
  const seen = new Set<string>();
  const output: TemplateMeta[] = [];

  for (const template of templates) {
    if (seen.has(template.id)) {
      continue;
    }
    seen.add(template.id);
    output.push(template);
  }

  return output;
}

function templateMatchesQuery(
  template: TemplateMeta,
  normalizedQuery: string
): boolean {
  const normalizedId = normalize(template.id);
  const normalizedName = normalize(template.name);
  return (
    normalizedId === normalizedQuery ||
    normalizedName === normalizedQuery ||
    normalizedId.includes(normalizedQuery) ||
    normalizedName.includes(normalizedQuery)
  );
}

function templateMatchesExact(
  template: TemplateMeta,
  normalizedQuery: string
): boolean {
  const normalizedId = normalize(template.id);
  const normalizedName = normalize(template.name);
  return normalizedId === normalizedQuery || normalizedName === normalizedQuery;
}

function templateStartsWithQuery(
  template: TemplateMeta,
  normalizedQuery: string
): boolean {
  const normalizedId = normalize(template.id);
  const normalizedName = normalize(template.name);
  return (
    normalizedId.startsWith(normalizedQuery) ||
    normalizedName.startsWith(normalizedQuery)
  );
}

function sortTemplates(templates: TemplateMeta[]): TemplateMeta[] {
  return [...templates].sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

function makeMatchQueryCandidates(
  templates: TemplateMeta[],
  normalizedQuery: string
): TemplateMeta[] {
  return sortTemplates(
    dedupeTemplateIds(
      templates.filter((template) =>
        templateMatchesQuery(template, normalizedQuery)
      )
    )
  );
}

function makeExactCandidates(
  templates: TemplateMeta[],
  normalizedQuery: string
): TemplateMeta[] {
  return sortTemplates(
    dedupeTemplateIds(
      templates.filter((template) =>
        templateMatchesExact(template, normalizedQuery)
      )
    )
  );
}

function makeFallbackCandidates(
  templates: TemplateMeta[],
  normalizedQuery: string
): TemplateMeta[] {
  return sortTemplates(
    dedupeTemplateIds(
      templates.filter((template) =>
        templateStartsWithQuery(template, normalizedQuery)
      )
    )
  );
}

function expandAliases(query: string): string[] {
  const normalized = normalize(query);
  return TEMPLATE_ALIASES[normalized] ?? [normalized];
}

function resolveSingleQuery(
  templates: TemplateMeta[],
  rawQuery: string
): TemplateResolutionMatch[] | TemplateResolutionIssue[] {
  const expandedQueries = expandAliases(rawQuery).map((value) =>
    normalize(value)
  );
  const rawNormalized = normalize(rawQuery);

  const directQueries = [...new Set([...expandedQueries, rawNormalized])];

  for (const query of directQueries) {
    const exactCandidates = makeExactCandidates(templates, query);
    if (exactCandidates.length === 1) {
      const match = exactCandidates[0];
      if (match) {
        return [{ template: match }];
      }
    }
    if (exactCandidates.length > 1) {
      return [
        {
          query,
          rawQuery,
          type: "ambiguous",
          matches: exactCandidates,
        },
      ];
    }

    const candidates = makeMatchQueryCandidates(templates, query);
    if (candidates.length === 1) {
      const match = candidates[0];
      if (match) {
        return [{ template: match }];
      }
    }
    if (candidates.length > 1) {
      return [
        {
          query,
          rawQuery,
          type: "ambiguous",
          matches: candidates,
        },
      ];
    }
  }

  const fallbackCandidates = directQueries.flatMap((query) =>
    makeFallbackCandidates(templates, query)
  );
  const dedupedFallback = dedupeTemplateIds(fallbackCandidates);
  if (dedupedFallback.length === 1) {
    const match = dedupedFallback[0];
    if (match) {
      return [{ template: match }];
    }
  }

  return [
    {
      query: directQueries[0] ?? rawNormalized,
      rawQuery,
      type: "unknown",
      matches: dedupedFallback.slice(0, 8),
    },
  ];
}

export function resolveTemplateQueries(
  templates: TemplateMeta[],
  rawQueries: string[]
): TemplateResolutionResult {
  const selected: TemplateMeta[] = [];
  const issues: TemplateResolutionIssue[] = [];

  const seen = new Set<string>();

  for (const rawQuery of rawQueries) {
    const trimmedQuery = rawQuery.trim();
    if (trimmedQuery.length === 0) {
      continue;
    }

    const resolutions = resolveSingleQuery(templates, trimmedQuery);
    const first = resolutions[0];
    if (!first) {
      continue;
    }
    if ("template" in first) {
      const template = first.template;
      if (!seen.has(template.id)) {
        selected.push(template);
        seen.add(template.id);
      }
      continue;
    }

    issues.push(first);
  }

  if (issues.length > 0) {
    return { selected, issues };
  }

  return { selected, issues: [] };
}

export function renderTemplateResolutionMessage(
  issues: TemplateResolutionIssue[]
): string {
  const lines: string[] = [];

  for (const issue of issues) {
    if (issue.type === "ambiguous") {
      lines.push(
        `Template "${issue.rawQuery}" is ambiguous. Did you mean one of: ${issue.matches
          .map((match) => match.id)
          .join(", ")}`
      );
    } else {
      const suggestions = issue.matches.map((match) => match.id);
      if (suggestions.length > 0) {
        lines.push(
          `Template "${issue.rawQuery}" not found. Did you mean: ${suggestions.join(", ")}`
        );
      } else {
        lines.push(`Template "${issue.rawQuery}" not found.`);
      }
    }
  }

  return lines.join("\n");
}
