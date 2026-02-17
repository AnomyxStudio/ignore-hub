#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app/app";
import { buildUsageText, parseCliOptions } from "./cli/parse-args";
import { detectProjectTemplates } from "./cli/project-detector";
import {
  renderTemplateResolutionMessage,
  resolveTemplateQueries,
} from "./cli/template-resolution";
import { loadTemplateIndex } from "./data/cache-store";
import { fetchTemplateSource } from "./data/github-client";
import { normalizeTemplateName } from "./domain/classification";
import { mergeGitignore } from "./domain/merge-gitignore";
import type {
  CliOptions,
  TemplateMeta,
  TemplateWithSource,
} from "./domain/types";

declare const __IGNORE_HUB_VERSION__: string | undefined;

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

async function readPackageVersion(): Promise<string> {
  if (
    typeof __IGNORE_HUB_VERSION__ !== "undefined" &&
    __IGNORE_HUB_VERSION__.length > 0
  ) {
    return __IGNORE_HUB_VERSION__;
  }

  const packageManifest = new URL("../package.json", import.meta.url);
  try {
    const packageManifestContents = await readFile(packageManifest, "utf8");
    const metadata = JSON.parse(packageManifestContents) as {
      version?: string;
    };

    return metadata.version ?? "unknown";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "unknown";
    }
    throw error;
  }
}

function isInteractiveCapable(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

async function fetchTemplatesWithSource(
  templates: TemplateMeta[]
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
    throw new Error(
      `Failed to fetch template source for: ${failures.join(", ")}`
    );
  }

  return collected;
}

function hasSelectionModeOptions(options: CliOptions): boolean {
  return options.templates.length > 0 || options.auto;
}

async function runDirectGeneration(options: CliOptions): Promise<void> {
  const indexResult = await loadTemplateIndex(options.refresh);
  const availableTemplateIds = new Set(
    indexResult.index.templates.map((template) =>
      normalizeTemplateName(template.id)
    )
  );
  const autoTemplateCandidates = options.auto
    ? await detectProjectTemplates(process.cwd())
    : [];
  const supportedAutoTemplates = options.auto
    ? autoTemplateCandidates.filter((id) =>
        availableTemplateIds.has(normalizeTemplateName(id))
      )
    : [];
  const requestedTemplateNames = [
    ...options.templates,
    ...supportedAutoTemplates,
  ];

  if (requestedTemplateNames.length === 0) {
    throw new Error("No templates resolved. Use --template <names> or --auto.");
  }

  const resolution = resolveTemplateQueries(
    indexResult.index.templates,
    requestedTemplateNames
  );
  if (resolution.issues.length > 0) {
    throw new Error(renderTemplateResolutionMessage(resolution.issues));
  }

  const templatesWithSource = await fetchTemplatesWithSource(
    resolution.selected
  );
  const existingContent = await readExistingOutput(options.output);
  const mergedContent = mergeGitignore({
    existingContent,
    templates: templatesWithSource,
    includeWatermark: options.includeWatermark,
    useSimpleSectionSeparator: options.useSimpleSectionSeparator,
  });

  if (options.stdout) {
    process.stdout.write(
      mergedContent.endsWith("\n") ? mergedContent : `${mergedContent}\n`
    );
    return;
  }

  await writeFile(options.output, mergedContent, "utf8");
  process.stdout.write(
    `✅ IgnoreHub: generated .gitignore at ${options.output}\n`
  );
}

async function main(): Promise<void> {
  const parsed = parseCliOptions(process.argv.slice(2));
  if (parsed.showHelp) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }
  if (parsed.showVersion) {
    const version = await readPackageVersion();
    process.stdout.write(`ignore-hub ${version}\n`);
    return;
  }

  if (
    parsed.options.nonInteractive &&
    !parsed.options.auto &&
    parsed.options.templates.length === 0
  ) {
    throw new Error("--no-interactive requires --template or --auto.");
  }

  if (hasSelectionModeOptions(parsed.options)) {
    await runDirectGeneration(parsed.options);
    return;
  }

  if (!isInteractiveCapable()) {
    throw new Error(
      "Interactive mode requires a TTY. Use --no-interactive with --template or --auto."
    );
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
