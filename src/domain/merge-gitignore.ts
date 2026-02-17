import type { TemplateWithSource } from "./types";

export interface MergeGitignoreOptions {
  includeWatermark: boolean;
  useSimpleSectionSeparator: boolean;
}

export const GENERATED_BLOCK_START = "### IGNORE-HUB GENERATED START";
export const GENERATED_BLOCK_END = "### IGNORE-HUB GENERATED END";

const GENERATED_BLOCK_PATTERN = new RegExp(
  `${escapeForRegExp(GENERATED_BLOCK_START)}[\\s\\S]*?${escapeForRegExp(
    GENERATED_BLOCK_END
  )}\\n?`,
  "g"
);

function escapeForRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

function isRuleLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith("#");
}

function normalizeRuleLine(line: string): string {
  return line.trim();
}

function trimTrailingBlankLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") {
    end -= 1;
  }
  return lines.slice(0, end);
}

export function stripGeneratedBlock(content: string): string {
  const normalized = normalizeNewlines(content);
  const withoutGenerated = normalized
    .replace(GENERATED_BLOCK_PATTERN, "")
    .trimEnd();
  return withoutGenerated;
}

export function collectRuleSet(content: string): Set<string> {
  const normalized = normalizeNewlines(content);
  const rules = new Set<string>();

  for (const line of normalized.split("\n")) {
    if (!isRuleLine(line)) {
      continue;
    }
    rules.add(normalizeRuleLine(line));
  }

  return rules;
}

function dedupeTemplateSourceLines(
  source: string,
  seenRules: Set<string>
): string[] {
  const output: string[] = [];
  const normalized = normalizeNewlines(source);

  for (const line of normalized.split("\n")) {
    if (!isRuleLine(line)) {
      output.push(line);
      continue;
    }

    const normalizedRule = normalizeRuleLine(line);
    if (seenRules.has(normalizedRule)) {
      continue;
    }

    seenRules.add(normalizedRule);
    output.push(line);
  }

  return trimTrailingBlankLines(output);
}

function getSectionHeader(
  template: TemplateWithSource,
  useSimpleSectionSeparator: boolean
): string {
  if (useSimpleSectionSeparator) {
    return `## ${template.meta.name}`;
  }

  return `### ${template.meta.kind}: ${template.meta.name}`;
}

function buildGeneratedBlock(
  templates: TemplateWithSource[],
  existingRules: Set<string>,
  options: MergeGitignoreOptions
): string {
  const lines: string[] = [];

  if (options.includeWatermark) {
    lines.push(GENERATED_BLOCK_START);
  }

  for (const template of templates) {
    lines.push(getSectionHeader(template, options.useSimpleSectionSeparator));

    const sectionLines = dedupeTemplateSourceLines(
      template.source,
      existingRules
    );
    if (sectionLines.length > 0) {
      lines.push(...sectionLines);
    }

    lines.push("");
  }

  if (lines.at(-1) === "") {
    lines.pop();
  }

  if (options.includeWatermark) {
    lines.push(GENERATED_BLOCK_END);
  }

  if (lines.length === 0) {
    return "";
  }

  return lines.join("\n");
}

function composeOutput(manualContent: string, generatedBlock: string): string {
  const normalizedManual = normalizeNewlines(manualContent).trimEnd();
  if (normalizedManual.length === 0) {
    return `${generatedBlock}\n`;
  }

  return `${normalizedManual}\n\n${generatedBlock}\n`;
}

interface MergeGitignoreInput {
  existingContent: string | null;
  includeWatermark?: boolean;
  templates: TemplateWithSource[];
  useSimpleSectionSeparator?: boolean;
}

export function mergeGitignore({
  existingContent,
  templates,
  includeWatermark = true,
  useSimpleSectionSeparator = false,
}: MergeGitignoreInput): string {
  const source = existingContent ?? "";
  const manualContent = stripGeneratedBlock(source);
  const existingRules = collectRuleSet(manualContent);
  const generatedBlock = buildGeneratedBlock(templates, existingRules, {
    includeWatermark,
    useSimpleSectionSeparator,
  });

  return composeOutput(manualContent, generatedBlock);
}
