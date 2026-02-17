import { expect, test } from "bun:test";
import { resolveTemplateQueries } from "../src/cli/template-resolution";
import {
  collectRuleSet,
  GENERATED_BLOCK_END,
  GENERATED_BLOCK_START,
  mergeGitignore,
  stripGeneratedBlock,
} from "../src/domain/merge-gitignore";
import type { TemplateMeta, TemplateWithSource } from "../src/domain/types";

const TEMPLATES: TemplateWithSource[] = [
  {
    meta: {
      id: "Node",
      name: "Node",
      path: "Node.gitignore",
      kind: "framework",
    },
    source: "# Node\nnode_modules/\ndist\n",
  },
  {
    meta: {
      id: "Nextjs",
      name: "Nextjs",
      path: "Nextjs.gitignore",
      kind: "framework",
    },
    source: "# Next\n.next\ndist\n",
  },
];

test("keeps existing rules first and dedupes generated rules", () => {
  const existing = "# User rules\ndist\n.env\n";
  const merged = mergeGitignore({
    existingContent: existing,
    templates: TEMPLATES,
  });

  expect(merged).toContain("# User rules");
  expect(merged).toContain("dist\n.env");
  expect(merged).toContain(GENERATED_BLOCK_START);
  expect(merged).toContain(GENERATED_BLOCK_END);
  expect(merged).toContain("### framework: Node");
  expect(merged).toContain("### framework: Nextjs");

  const occurrences = merged
    .split("\n")
    .filter((line) => line.trim() === "dist").length;
  expect(occurrences).toBe(1);
});

test("re-running merge replaces generated block instead of appending", () => {
  const firstPass = mergeGitignore({
    existingContent: "# Manual\nvenv/\n",
    templates: TEMPLATES,
  });

  const secondPass = mergeGitignore({
    existingContent: firstPass,
    templates: TEMPLATES,
  });

  expect(secondPass).toBe(firstPass);
  expect(secondPass.match(new RegExp(GENERATED_BLOCK_START, "g"))?.length).toBe(
    1
  );
  expect(secondPass.match(new RegExp(GENERATED_BLOCK_END, "g"))?.length).toBe(
    1
  );
});

test("stripGeneratedBlock preserves manual content", () => {
  const existing = `# Manual\nvenv/\n\n${GENERATED_BLOCK_START}\n### framework: Node\nnode_modules/\n${GENERATED_BLOCK_END}\n`;
  const stripped = stripGeneratedBlock(existing);
  expect(stripped.trim()).toBe("# Manual\nvenv/");
});

test("collectRuleSet includes only non-comment non-empty rules", () => {
  const rules = collectRuleSet("# Comment\n\nnode_modules/\n  dist\n");
  expect(rules.has("node_modules/")).toBe(true);
  expect(rules.has("dist")).toBe(true);
  expect(rules.has("# Comment")).toBe(false);
});

test("can disable watermark markers while still generating sections", () => {
  const merged = mergeGitignore({
    existingContent: "# Manual\n",
    templates: TEMPLATES,
    includeWatermark: false,
  });

  expect(merged).toContain("### framework: Node");
  expect(merged).toContain("### framework: Nextjs");
  expect(merged).not.toContain(GENERATED_BLOCK_START);
  expect(merged).not.toContain(GENERATED_BLOCK_END);
});

test("uses simple separators when requested", () => {
  const merged = mergeGitignore({
    existingContent: "# Manual\n",
    templates: TEMPLATES,
    useSimpleSectionSeparator: true,
  });

  expect(merged).toContain("## Node");
  expect(merged).toContain("## Nextjs");
  expect(merged).not.toContain("### framework: Node");
});

const TEMPLATE_INDEX: TemplateMeta[] = [
  { id: "Node", name: "Node", path: "Node.gitignore", kind: "framework" },
  {
    id: "JavaScript",
    name: "JavaScript",
    path: "JavaScript.gitignore",
    kind: "language",
  },
  { id: "Nextjs", name: "Nextjs", path: "Nextjs.gitignore", kind: "framework" },
];

test("resolves templates and merges with existing .gitignore rules", () => {
  const resolution = resolveTemplateQueries(TEMPLATE_INDEX, ["js", "nextjs"]);
  expect(resolution.issues).toEqual([]);
  expect(resolution.selected.map((template) => template.id)).toEqual([
    "JavaScript",
    "Nextjs",
  ]);

  const resolvedTemplates: TemplateWithSource[] = resolution.selected.map(
    (template) => {
      if (template.id === "JavaScript") {
        return {
          meta: template,
          source: "# JavaScript\nnode_modules/\n",
        };
      }

      return {
        meta: template,
        source: "# Nextjs\n.next\ndist/\n",
      };
    }
  );

  const merged = mergeGitignore({
    existingContent: "# Manual\nnode_modules/\n",
    templates: resolvedTemplates,
  });

  expect(merged).toContain("### framework: Nextjs");
  expect(merged).toContain("### language: JavaScript");
  expect(merged).toContain("# Manual");
  expect(merged.indexOf("node_modules/")).toBe(
    merged.lastIndexOf("node_modules/")
  );
});
