#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

declare const Bun: typeof import("bun");

const SUPPORTED_TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-x64",
  "bun-windows-arm64",
  "bun-windows-x64",
] as const satisfies readonly Bun.Build.CompileTarget[];

type SupportedTarget = (typeof SUPPORTED_TARGETS)[number];
const SUPPORTED_TARGET_SET = new Set<string>(SUPPORTED_TARGETS);

interface PackageJsonLike {
  version?: string;
}

function isSupportedTarget(target: string): target is SupportedTarget {
  return SUPPORTED_TARGET_SET.has(target);
}

function getCurrentTarget(): SupportedTarget {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const arch = process.arch;
  const target = `bun-${platform}-${arch}`;

  if (!isSupportedTarget(target)) {
    throw new Error(
      `Unsupported host target "${target}". Pass explicit targets: ${[
        ...SUPPORTED_TARGETS,
      ].join(", ")}`
    );
  }

  return target;
}

function parseTargets(
  argv: string[],
  envTargets: string | undefined
): SupportedTarget[] {
  const raw =
    argv.length > 0 ? argv.join(",") : (envTargets ?? getCurrentTarget());

  const targets = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const validatedTargets: SupportedTarget[] = [];

  for (const target of targets) {
    if (!isSupportedTarget(target)) {
      throw new Error(
        `Unsupported target "${target}". Supported: ${[
          ...SUPPORTED_TARGETS,
        ].join(", ")}`
      );
    }
    validatedTargets.push(target);
  }

  return validatedTargets;
}

function getOutputPath(target: SupportedTarget): string {
  const extension = target.includes("windows") ? ".exe" : "";
  return join("dist", `ignore-hub-${target}${extension}`);
}

async function buildOne(target: SupportedTarget, version: string) {
  const outputPath = getOutputPath(target);
  const result = await Bun.build({
    entrypoints: ["./src/index.tsx"],
    target: "bun",
    minify: true,
    sourcemap: "none",
    define: {
      __IGNORE_HUB_VERSION__: JSON.stringify(version),
    },
    compile: {
      outfile: outputPath,
      target,
    },
  });

  if (!result.success) {
    const details = result.logs.map((log) => log.message).join("\n");
    throw new Error(`Failed building ${target}\n${details}`);
  }

  return outputPath;
}

async function main() {
  const packageJson = (await Bun.file(
    "./package.json"
  ).json()) as PackageJsonLike;
  const version = packageJson.version ?? "unknown";
  const currentTarget = getCurrentTarget();
  const targets = parseTargets(process.argv.slice(2), process.env.IH_TARGETS);

  for (const target of targets) {
    if (target !== currentTarget) {
      throw new Error(
        [
          `Cross-target build "${target}" is not supported from "${currentTarget}".`,
          "OpenTUI loads platform-native modules dynamically.",
          "Build each target on a matching OS/arch runner.",
        ].join(" ")
      );
    }
  }

  await mkdir("dist", { recursive: true });

  for (const target of targets) {
    const outputPath = await buildOne(target, version);
    process.stdout.write(`built ${outputPath}\n`);
  }
}

await main();
