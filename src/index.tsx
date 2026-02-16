#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { resolve } from "node:path";
import { App } from "./app/App";
import type { CliOptions } from "./domain/types";

interface ParseResult {
  options: CliOptions;
  showHelp: boolean;
}

function buildUsageText(): string {
  return [
    "🧩 ignore-hub",
    "",
    "Generate a .gitignore from github/gitignore templates with a friendly interactive wizard.",
    "",
    "Usage:",
    "  ignore-hub [options]",
    "",
    "Options:",
    "  --output <path>  📝 Write output file path (default: ./.gitignore)",
    "  --refresh        🔄 Refresh template index from GitHub",
    "  --stdout         📤 Print generated result to stdout instead of writing file",
    "  -h, --help       ❓ Show help"
  ].join("\n");
}

function parseCliOptions(argv: string[]): ParseResult {
  let output = resolve(process.cwd(), ".gitignore");
  let refresh = false;
  let stdout = false;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      showHelp = true;
      continue;
    }

    if (arg === "--refresh") {
      refresh = true;
      continue;
    }

    if (arg === "--stdout") {
      stdout = true;
      continue;
    }

    if (arg === "--output") {
      const outputArg = argv[index + 1];
      if (!outputArg || outputArg.startsWith("--")) {
        throw new Error("Missing value for --output");
      }

      output = resolve(process.cwd(), outputArg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    options: {
      output,
      refresh,
      stdout
    },
    showHelp
  };
}

async function main(): Promise<void> {
  const parsed = parseCliOptions(process.argv.slice(2));
  if (parsed.showHelp) {
    process.stdout.write(`${buildUsageText()}\n`);
    return;
  }

  const renderer = await createCliRenderer();
  createRoot(renderer).render(<App options={parsed.options} />);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`⚠️  ignore-hub: ${message}\n\n${buildUsageText()}\n`);
  process.exitCode = 1;
}
