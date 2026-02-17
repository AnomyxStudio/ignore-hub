import { expect, test } from "bun:test";
import {
  classifyRootTemplate,
  classifyTemplatePath,
  getTemplateIdFromPath,
  getTemplateNameFromPath,
  isSupportedTemplatePath,
} from "../src/domain/classification";

test("classifies Python template as language", () => {
  const result = classifyTemplatePath("Python.gitignore");
  expect(result?.kind).toBe("language");
  expect(result?.name).toBe("Python");
});

test("classifies Nextjs template as framework", () => {
  const result = classifyTemplatePath("Nextjs.gitignore");
  expect(result?.kind).toBe("framework");
  expect(result?.name).toBe("Nextjs");
});

test("classifies Global/macOS template as global", () => {
  const result = classifyTemplatePath("Global/macOS.gitignore");
  expect(result?.kind).toBe("global");
  expect(result?.id).toBe("Global/macOS");
});

test("defaults unknown root template to framework", () => {
  expect(classifyRootTemplate("LangChain")).toBe("framework");
});

test("parses names and ids from paths", () => {
  expect(getTemplateNameFromPath("Node.gitignore")).toBe("Node");
  expect(getTemplateNameFromPath("Global/JetBrains.gitignore")).toBe(
    "JetBrains"
  );
  expect(getTemplateIdFromPath("Node.gitignore")).toBe("Node");
  expect(getTemplateIdFromPath("Global/JetBrains.gitignore")).toBe(
    "Global/JetBrains"
  );
});

test("supports only root and Global template paths", () => {
  expect(isSupportedTemplatePath("Node.gitignore")).toBe(true);
  expect(isSupportedTemplatePath("Global/Linux.gitignore")).toBe(true);
  expect(isSupportedTemplatePath("community/JavaScript/Node.gitignore")).toBe(
    false
  );
  expect(isSupportedTemplatePath("README.md")).toBe(false);
});
