import { expect, test } from "bun:test";
import { resolveTemplateQueries } from "../src/cli/template-resolution";
import type { TemplateMeta } from "../src/domain/types";

const TEMPLATE_INDEX: TemplateMeta[] = [
  { id: "Java", name: "Java", path: "Java.gitignore", kind: "language" },
  {
    id: "JavaScript",
    name: "JavaScript",
    path: "JavaScript.gitignore",
    kind: "language",
  },
  { id: "Node", name: "Node", path: "Node.gitignore", kind: "framework" },
  {
    id: "Global/MonoDevelop",
    name: "Global/MonoDevelop",
    path: "Global/MonoDevelop.gitignore",
    kind: "global",
  },
  { id: "Unity", name: "Unity", path: "Unity.gitignore", kind: "framework" },
];

test("resolves aliases to canonical template ids", () => {
  const result = resolveTemplateQueries(TEMPLATE_INDEX, ["js"]);
  expect(result.issues).toEqual([]);
  expect(result.selected.map((template) => template.id)).toEqual([
    "JavaScript",
  ]);
});

test("returns suggestions for ambiguous matches", () => {
  const result = resolveTemplateQueries(TEMPLATE_INDEX, ["ja"]);
  expect(result.issues).toEqual([
    {
      query: "ja",
      rawQuery: "ja",
      type: "ambiguous",
      matches: [
        { id: "Java", name: "Java", path: "Java.gitignore", kind: "language" },
        {
          id: "JavaScript",
          name: "JavaScript",
          path: "JavaScript.gitignore",
          kind: "language",
        },
      ],
    },
  ]);
});

test("preserves deterministic resolution order and removes duplicates", () => {
  const result = resolveTemplateQueries(TEMPLATE_INDEX, [
    "node",
    "java",
    "node",
  ]);
  expect(result.selected.map((template) => template.id)).toEqual([
    "Node",
    "Java",
  ]);
});

test("prefers exact matches before substring matches", () => {
  const result = resolveTemplateQueries(TEMPLATE_INDEX, ["node"]);
  expect(result.issues).toEqual([]);
  expect(result.selected).toEqual([
    { id: "Node", name: "Node", path: "Node.gitignore", kind: "framework" },
  ]);
});

test("reports unknown template names", () => {
  const result = resolveTemplateQueries(TEMPLATE_INDEX, ["not-a-template"]);
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({
    type: "unknown",
    rawQuery: "not-a-template",
    matches: [],
  });
});
