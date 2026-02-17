import { resolve } from "node:path";
import type { CliOptions } from "../domain/types";

interface ParseResult {
  options: CliOptions;
  showHelp: boolean;
}

function addTemplateValues(values: string, target: string[]): void {
  for (const raw of values.split(",")) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    target.push(trimmed);
  }
}

export function buildUsageText(): string {
  return [
    "🧩 IgnoreHub",
    "",
    "Generate a .gitignore from github/gitignore templates with a friendly interactive wizard.",
    "",
    "Usage:",
    "  ignore-hub [options]",
    "  ih [options]",
    "",
    "Options:",
    "  --output <path>, -o     📝 Write output file path (default: ./.gitignore)",
    "  --refresh               🔄 Refresh template index from GitHub",
    "  --stdout                📤 Print generated result to stdout instead of writing file",
    "  -t, --template <names>  🗂 Select templates directly (comma separated or repeated)",
    "  -a, --auto             🤖 Detect templates from current project layout",
    "  -s, --simple-sepration Toggle template headers to `## <Template>` and omit IGNORE-HUB watermarks",
    "  --no-interactive        ⚡ Skip TUI and run in direct generation mode",
    "  -h, --help              ❓ Show help",
  ].join("\n");
}

export function parseCliOptions(argv: string[]): ParseResult {
  let output = resolve(process.cwd(), ".gitignore");
  let refresh = false;
  let stdout = false;
  const templates: string[] = [];
  let auto = false;
  let nonInteractive = false;
  let includeWatermark = true;
  let useSimpleSectionSeparator = false;
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

    if (arg === "-a" || arg === "--auto") {
      auto = true;
      continue;
    }

    if (arg === "--no-interactive") {
      nonInteractive = true;
      continue;
    }

    if (arg === "-s" || arg === "--simple-sepration") {
      useSimpleSectionSeparator = true;
      includeWatermark = false;
      continue;
    }

    if (arg === "-t" || arg === "--template") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --template");
      }
      addTemplateValues(value, templates);
      index += 1;
      continue;
    }

    if (!arg) {
      continue;
    }

    if (arg.startsWith("-t=") || arg.startsWith("--template=")) {
      const separatorIndex = arg.indexOf("=");
      const rawValue = arg.slice(separatorIndex + 1);
      if (rawValue.length === 0) {
        throw new Error("Missing value for --template");
      }
      addTemplateValues(rawValue, templates);
      continue;
    }

    if (arg === "--output" || arg === "-o") {
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
      stdout,
      templates,
      auto,
      nonInteractive,
      includeWatermark,
      useSimpleSectionSeparator,
    },
    showHelp,
  };
}
