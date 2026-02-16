import { expect, test } from "bun:test";
import {
  GENERATED_BLOCK_END,
  GENERATED_BLOCK_START,
  collectRuleSet,
  mergeGitignore,
  stripGeneratedBlock
} from "../src/domain/mergeGitignore";
import type { TemplateWithSource } from "../src/domain/types";

const TEMPLATES: TemplateWithSource[] = [
  {
    meta: { id: "Node", name: "Node", path: "Node.gitignore", kind: "framework" },
    source: "# Node\nnode_modules/\ndist\n"
  },
  {
    meta: { id: "Nextjs", name: "Nextjs", path: "Nextjs.gitignore", kind: "framework" },
    source: "# Next\n.next\ndist\n"
  }
];

test("keeps existing rules first and dedupes generated rules", () => {
  const existing = "# User rules\ndist\n.env\n";
  const merged = mergeGitignore({
    existingContent: existing,
    templates: TEMPLATES
  });

  expect(merged).toContain("# User rules");
  expect(merged).toContain("dist\n.env");
  expect(merged).toContain(GENERATED_BLOCK_START);
  expect(merged).toContain(GENERATED_BLOCK_END);
  expect(merged).toContain("### framework: Node");
  expect(merged).toContain("### framework: Nextjs");

  const occurrences = merged.split("\n").filter((line) => line.trim() === "dist").length;
  expect(occurrences).toBe(1);
});

test("re-running merge replaces generated block instead of appending", () => {
  const firstPass = mergeGitignore({
    existingContent: "# Manual\nvenv/\n",
    templates: TEMPLATES
  });

  const secondPass = mergeGitignore({
    existingContent: firstPass,
    templates: TEMPLATES
  });

  expect(secondPass).toBe(firstPass);
  expect(secondPass.match(new RegExp(GENERATED_BLOCK_START, "g"))?.length).toBe(1);
  expect(secondPass.match(new RegExp(GENERATED_BLOCK_END, "g"))?.length).toBe(1);
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
