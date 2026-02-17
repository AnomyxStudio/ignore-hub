import { resolve } from "node:path";
import type { CliOptions } from "../domain/types";

interface ParseResult {
  options: CliOptions;
  showHelp: boolean;
  showVersion: boolean;
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
    "  --output <path>, -o      📝 Write output file path (default: ./.gitignore)",
    "  --refresh                🔄 Refresh template index from GitHub",
    "  --stdout                 📤 Print generated result to stdout instead of writing file",
    "  -t, --template <names>   🗂  Select templates directly (comma separated or repeated)",
    "  -a, --auto               🤖 Detect templates from current project layout",
    "  -s, --simple-sepration   📋 Toggle template headers to `## <Template>` and omit IGNORE-HUB watermarks",
    "  --no-interactive         🚀 Skip TUI and run in direct generation mode",
    "  -h, --help               ❓ Show help",
    "  -v, --version            🧭 Print installed version",
  ].join("\n");
}

function getRequiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function addTemplateValueFromArg(
  argv: string[],
  index: number,
  templates: string[]
): number {
  const value = getRequiredValue(argv, index, "--template");
  addTemplateValues(value, templates);
  return index + 1;
}

function addTemplateValueFromAssignment(
  arg: string,
  templates: string[]
): void {
  const separatorIndex = arg.indexOf("=");
  const value = arg.slice(separatorIndex + 1);
  if (value.length === 0) {
    throw new Error("Missing value for --template");
  }
  addTemplateValues(value, templates);
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
  let showVersion = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    switch (arg) {
      case "-h":
      case "--help":
        showHelp = true;
        break;
      case "-v":
      case "--version":
        showVersion = true;
        break;
      case "--refresh":
        refresh = true;
        break;
      case "--stdout":
        stdout = true;
        break;
      case "-a":
      case "--auto":
        auto = true;
        break;
      case "--no-interactive":
        nonInteractive = true;
        break;
      case "-s":
      case "--simple-sepration":
        useSimpleSectionSeparator = true;
        includeWatermark = false;
        break;
      case "-o":
      case "--output": {
        const outputValue = getRequiredValue(argv, index, "--output");
        output = resolve(process.cwd(), outputValue);
        index += 1;
        break;
      }
      case "-t":
      case "--template":
        index = addTemplateValueFromArg(argv, index, templates);
        break;
      default:
        if (arg.startsWith("-t=") || arg.startsWith("--template=")) {
          addTemplateValueFromAssignment(arg, templates);
          break;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
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
    showVersion,
  };
}
