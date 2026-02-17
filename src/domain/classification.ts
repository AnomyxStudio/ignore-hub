import type { CacheIndex, TemplateKind, TemplateMeta } from "./types";

const ROOT_TEMPLATE_PATTERN = /^[^/]+\.gitignore$/;
const GLOBAL_TEMPLATE_PATTERN = /^Global\/.+\.gitignore$/;
const GITIGNORE_FILE_SUFFIX = /\.gitignore$/;

const LANGUAGE_TEMPLATE_NAMES = new Set(
  [
    "AL",
    "Actionscript",
    "Ada",
    "Agda",
    "C",
    "C++",
    "Clojure",
    "CommonLisp",
    "D",
    "Dart",
    "Delphi",
    "Elixir",
    "Elm",
    "Erlang",
    "Fortran",
    "Gleam",
    "Go",
    "Groovy",
    "Haskell",
    "Haxe",
    "Idris",
    "Java",
    "JavaScript",
    "Julia",
    "Kotlin",
    "Lua",
    "Luau",
    "Nim",
    "Nix",
    "OCaml",
    "Objective-C",
    "Perl",
    "PHP",
    "PureScript",
    "Python",
    "R",
    "Racket",
    "Raku",
    "ReScript",
    "Ruby",
    "Rust",
    "Scala",
    "Scheme",
    "Swift",
    "TeX",
    "VBA",
    "Zig",
  ].map(normalizeTemplateName)
);

const FRAMEWORK_TEMPLATE_NAMES = new Set(
  [
    "Angular",
    "AppEngine",
    "CakePHP",
    "CFWheels",
    "CodeIgniter",
    "Concrete5",
    "CraftCMS",
    "Dotnet",
    "Drupal",
    "EPiServer",
    "ExpressionEngine",
    "Firebase",
    "FuelPHP",
    "Grails",
    "JENKINS_HOME",
    "Jekyll",
    "Joomla",
    "Kohana",
    "Laravel",
    "Maven",
    "Nanoc",
    "Nestjs",
    "Nextjs",
    "Node",
    "PlayFramework",
    "Plone",
    "Prestashop",
    "Rails",
    "Sass",
    "SymphonyCMS",
    "Symfony",
    "Terraform",
    "TurboGears2",
    "Typo3",
    "Unity",
    "UnrealEngine",
    "VisualStudio",
    "WordPress",
    "Yeoman",
    "Yii",
    "ZendFramework",
  ].map(normalizeTemplateName)
);

const LANGUAGE_HINTS = [
  "python",
  "java",
  "kotlin",
  "swift",
  "ruby",
  "rust",
  "perl",
  "php",
  "haskell",
  "scala",
  "clojure",
  "ocaml",
  "nim",
  "nix",
  "racket",
  "raku",
  "lua",
  "dart",
  "elixir",
  "erlang",
  "fortran",
  "julia",
  "zig",
  "cplusplus",
  "objectivec",
  "actionscript",
  "typescript",
];

export function normalizeTemplateName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isSupportedTemplatePath(path: string): boolean {
  return ROOT_TEMPLATE_PATTERN.test(path) || GLOBAL_TEMPLATE_PATTERN.test(path);
}

export function getTemplateNameFromPath(path: string): string {
  const cleanedPath = path.replace(GITIGNORE_FILE_SUFFIX, "");
  if (cleanedPath.startsWith("Global/")) {
    return cleanedPath.slice("Global/".length);
  }
  return cleanedPath;
}

export function getTemplateIdFromPath(path: string): string {
  const cleanedPath = path.replace(GITIGNORE_FILE_SUFFIX, "");
  if (cleanedPath.startsWith("Global/")) {
    return cleanedPath;
  }
  return cleanedPath;
}

export function classifyRootTemplate(templateName: string): TemplateKind {
  const normalized = normalizeTemplateName(templateName);

  if (LANGUAGE_TEMPLATE_NAMES.has(normalized)) {
    return "language";
  }

  if (FRAMEWORK_TEMPLATE_NAMES.has(normalized)) {
    return "framework";
  }

  if (LANGUAGE_HINTS.some((hint) => normalized.includes(hint))) {
    return "language";
  }

  return "framework";
}

export function classifyTemplatePath(path: string): TemplateMeta | null {
  if (!isSupportedTemplatePath(path)) {
    return null;
  }

  const name = getTemplateNameFromPath(path);
  const id = getTemplateIdFromPath(path);

  if (path.startsWith("Global/")) {
    return {
      id,
      name,
      path,
      kind: "global",
    };
  }

  return {
    id,
    name,
    path,
    kind: classifyRootTemplate(name),
  };
}

export function sortTemplates(templates: TemplateMeta[]): TemplateMeta[] {
  return [...templates].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function buildCacheIndex(paths: string[]): CacheIndex {
  const templates = sortTemplates(
    paths
      .map((path) => classifyTemplatePath(path))
      .filter((template): template is TemplateMeta => template !== null)
  );

  return {
    fetchedAt: new Date().toISOString(),
    sourceRef: "main",
    templates,
  };
}
