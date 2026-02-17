#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { readFile, writeFile } from "node:fs/promises";
import { App } from "./app/App";
import { detectProjectTemplates } from "./cli/projectDetector";
import {
  buildUsageText,
  parseCliOptions
} from "./cli/parseArgs";
import {
  renderTemplateResolutionMessage,
  resolveTemplateQueries
} from "./cli/templateResolution";
import { fetchTemplateSource } from "./data/githubClient";
import { loadTemplateIndex } from "./data/cacheStore";
import { mergeGitignore } from "./domain/mergeGitignore";
import type { CliOptions, TemplateMeta, TemplateWithSource } from "./domain/types";
import { normalizeTemplateName } from "./domain/classification";

async function readExistingOutput(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function fetchTemplatesWithSource(
  templates: TemplateMeta[],
): Promise<TemplateWithSource[]> {
  const collected: TemplateWithSource[] = [];
  const failures: string[] = [];

  for (const template of templates) {
    try {
      const source = await fetchTemplateSource(template.path);
      collected.push({ meta: template, source });
    } catch {
      failures.push(template.name);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to fetch template source for: ${failures.join(", ")}`);
  }

  return collected;
}

function hasSelectionModeOptions(options: CliOptions): boolean {
  return options.templates.length > 0 || options.auto;
}

async function runDirectGeneration(options: CliOptions): Promise<void> {
  const indexResult = await loadTemplateIndex(options.refresh);
  const availableTemplateIds = new Set(
    indexResult.index.templates.map((template) => normalizeTemplateName(template.id)),
  );
  const autoTemplateCandidates = options.auto
    ? await detectProjectTemplates(process.cwd())
    : [];
  const supportedAutoTemplates = options.auto
    ? autoTemplateCandidates.filter((id) => availableTemplateIds.has(normalizeTemplateName(id)))
    : [];
  const requestedTemplateNames = [...options.templates, ...supportedAutoTemplates];

  if (requestedTemplateNames.length === 0) {
    throw new Error("No templates resolved. Use --template <names> or --auto.");
  }

  const resolution = resolveTemplateQueries(indexResult.index.templates, requestedTemplateNames);
  if (resolution.issues.length > 0) {
    throw new Error(renderTemplateResolutionMessage(resolution.issues));
  }

  const templatesWithSource = await fetchTemplatesWithSource(resolution.selected);
  const existingContent = await readExistingOutput(options.output);
  const mergedContent = mergeGitignore({
    existingContent,
    templates: templatesWithSource,
    includeWatermark: options.includeWatermark,
    useSimpleSectionSeparator: options.useSimpleSectionSeparator
  });

  if (options.stdout) {
    process.stdout.write(mergedContent.endsWith("\n") ? mergedContent : `${mergedContent}\n`);
    return;
  }

  await writeFile(options.output, mergedContent, "utf8");
  process.stdout.write(`✅ IgnoreHub: generated .gitignore at ${options.output}\n`);
}

async function main(): Promise<void> {
  const parsed = parseCliOptions(process.argv.slice(2));
  if (parsed.showHelp) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  if (parsed.options.nonInteractive && !parsed.options.auto && parsed.options.templates.length === 0) {
    throw new Error("--no-interactive requires --template or --auto.");
  }

  if (hasSelectionModeOptions(parsed.options)) {
    await runDirectGeneration(parsed.options);
    return;
  }

  const renderer = await createCliRenderer();
  createRoot(renderer).render(<App options={parsed.options} />);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`⚠️  IgnoreHub: ${message}\n\n${buildUsageText()}\n`);
  process.exitCode = 1;
}
