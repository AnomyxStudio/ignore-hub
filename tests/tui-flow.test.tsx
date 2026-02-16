import { expect, test } from "bun:test";
import {
  isEnterKey,
  moveCursor,
  toggleTemplateSelection,
} from "../src/app/App";
import { filterItems } from "../src/app/steps/MultiSelectStep";
import type { TemplateMeta } from "../src/domain/types";

test("cursor movement clamps to list bounds", () => {
  expect(moveCursor(0, "up", 5)).toBe(0);
  expect(moveCursor(0, "down", 5)).toBe(1);
  expect(moveCursor(4, "down", 5)).toBe(4);
  expect(moveCursor(2, "up", 5)).toBe(1);
  expect(moveCursor(0, "down", 0)).toBe(0);
});

test("selection toggles on repeated key presses", () => {
  const start = new Set<string>();
  const afterFirstToggle = toggleTemplateSelection(start, "Node");
  expect(afterFirstToggle.has("Node")).toBe(true);

  const afterSecondToggle = toggleTemplateSelection(afterFirstToggle, "Node");
  expect(afterSecondToggle.has("Node")).toBe(false);
});

test("enter key accepts enter and return aliases", () => {
  expect(isEnterKey("enter")).toBe(true);
  expect(isEnterKey("return")).toBe(true);
  expect(isEnterKey("space")).toBe(false);
});

test("filterItems narrows templates by case-insensitive match", () => {
  const templates: TemplateMeta[] = [
    { id: "Node", name: "Node", kind: "framework", path: "Node.gitignore" },
    { id: "Nextjs", name: "Nextjs", kind: "framework", path: "Nextjs.gitignore" },
    { id: "Python", name: "Python", kind: "language", path: "Python.gitignore" },
  ];

  expect(filterItems(templates, "").length).toBe(3);
  expect(filterItems(templates, "next").map((item: TemplateMeta) => item.name)).toEqual([
    "Nextjs",
  ]);
  expect(filterItems(templates, "python").map((item: TemplateMeta) => item.name)).toEqual([
    "Python",
  ]);
});

test("filterItems can search by kind", () => {
  const templates: TemplateMeta[] = [
    { id: "Node", name: "Node", kind: "framework", path: "Node.gitignore" },
    { id: "Python", name: "Python", kind: "language", path: "Python.gitignore" },
    { id: "Rust", name: "Rust", kind: "language", path: "Rust.gitignore" },
  ];

  expect(filterItems(templates, "lang").map((item: TemplateMeta) => item.name)).toEqual([
    "Python",
    "Rust",
  ]);
  expect(filterItems(templates, "fw").length).toBe(0); // "fw" not in the haystack
  expect(filterItems(templates, "framework").map((item: TemplateMeta) => item.name)).toEqual([
    "Node",
  ]);
});
