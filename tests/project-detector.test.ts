import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DEFAULT_PROJECT_TEMPLATE_DETECTION_RULES,
  detectProjectTemplates,
  type ProjectTemplateDetectionRule,
} from "../src/cli/project-detector";

async function createProjectWithFiles(paths: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "ignore-hub-project-XXXXXX"));

  for (const relativePath of paths) {
    const fullPath = join(root, relativePath);
    if (relativePath.endsWith("/")) {
      await mkdir(fullPath, { recursive: true });
      continue;
    }
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, "");
  }

  return root;
}

async function cleanupProject(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

test("detects node project from package and tsconfig markers", async () => {
  const projectPath = await createProjectWithFiles([
    "package.json",
    "tsconfig.json",
  ]);

  try {
    const templates = await detectProjectTemplates(projectPath);
    expect(templates).toEqual(["node", "javascript", "typescript"]);
  } finally {
    await cleanupProject(projectPath);
  }
});

test("detects rust, java, and docker markers", async () => {
  const projectPath = await createProjectWithFiles([
    "Cargo.toml",
    "pom.xml",
    "Dockerfile",
  ]);

  try {
    const templates = await detectProjectTemplates(projectPath);
    expect(templates).toEqual(["java", "rust", "docker"]);
  } finally {
    await cleanupProject(projectPath);
  }
});

test("supports custom rule combinations with custom detection map", async () => {
  const projectPath = await createProjectWithFiles([
    "combo/marker-a",
    "combo/marker-b",
    "combo/marker-c",
  ]);

  const customRules: ProjectTemplateDetectionRule[] = [
    {
      templateId: "combo-template",
      combinations: [
        [
          { kind: "path", path: "combo/marker-a", expectedType: "file" },
          { kind: "path", path: "combo/marker-b", expectedType: "file" },
        ],
        [{ kind: "path", path: "combo/marker-c", expectedType: "file" }],
      ],
    },
  ];

  try {
    const templates = await detectProjectTemplates(projectPath, [
      ...DEFAULT_PROJECT_TEMPLATE_DETECTION_RULES,
      ...customRules,
    ]);
    expect(templates).toContain("combo-template");
  } finally {
    await cleanupProject(projectPath);
  }
});

test("detects unity and csharp indicators", async () => {
  const projectPath = await createProjectWithFiles([
    "Assets/.gitkeep",
    "Packages/.gitkeep",
    "ProjectSettings/ProjectVersion.txt",
    "App.csproj",
  ]);

  try {
    const templates = await detectProjectTemplates(projectPath);
    expect(templates).toEqual(["unity", "csharp"]);
  } finally {
    await cleanupProject(projectPath);
  }
});
