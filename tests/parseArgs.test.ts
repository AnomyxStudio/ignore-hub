import { expect, test } from "bun:test";
import { parseCliOptions } from "../src/cli/parseArgs";

test("parses comma-separated template names", () => {
  const result = parseCliOptions(["-t", "unity,node, java"]);
  expect(result.options.templates).toEqual(["unity", "node", "java"]);
});

test("parses repeated template flags", () => {
  const result = parseCliOptions(["-t", "unity", "-t", "java", "-t", "node"]);
  expect(result.options.templates).toEqual(["unity", "java", "node"]);
});

test("preserves duplicates while keeping parser output simple", () => {
  const result = parseCliOptions(["-t", "node,java", "-t", "node"]);
  expect(result.options.templates).toEqual(["node", "java", "node"]);
});

test("removes empty values from comma-separated input", () => {
  const result = parseCliOptions(["-t", "unity,, ,java,"]);
  expect(result.options.templates).toEqual(["unity", "java"]);
});

test("throws on missing template value", () => {
  expect(() => parseCliOptions(["--template"])).toThrow("Missing value for --template");
});

test("parses --template with equals notation", () => {
  const result = parseCliOptions(["--template=unity,node"]);
  expect(result.options.templates).toEqual(["unity", "node"]);
});

test("keeps unknown template names for resolver handling", () => {
  const result = parseCliOptions(["--template", "some-unknown-template"]);
  expect(result.options.templates).toEqual(["some-unknown-template"]);
});

test("supports short alias for auto detection", () => {
  const result = parseCliOptions(["-a"]);
  expect(result.options.auto).toBe(true);
  expect(result.options.templates).toEqual([]);
});

test("supports output alias -o", () => {
  const result = parseCliOptions(["-o", "./out/.gitignore"]);
  expect(result.options.output.endsWith("/out/.gitignore")).toBe(true);
});

test("defaults watermark on and simple separators off", () => {
  const result = parseCliOptions([]);
  expect(result.options.includeWatermark).toBe(true);
  expect(result.options.useSimpleSectionSeparator).toBe(false);
});

test("supports enabling simple separators", () => {
  const result = parseCliOptions(["--simple-sepration"]);
  expect(result.options.useSimpleSectionSeparator).toBe(true);
  expect(result.options.includeWatermark).toBe(false);
});

test("supports short alias for simple separator", () => {
  const result = parseCliOptions(["-s"]);
  expect(result.options.useSimpleSectionSeparator).toBe(true);
  expect(result.options.includeWatermark).toBe(false);
});

test("allows template simplicity flag to adjust both separators and watermark", () => {
  const result = parseCliOptions([
    "-t",
    "node",
    "-a",
    "-s"
  ]);
  expect(result.options.templates).toEqual(["node"]);
  expect(result.options.auto).toBe(true);
  expect(result.options.includeWatermark).toBe(false);
  expect(result.options.useSimpleSectionSeparator).toBe(true);
});
