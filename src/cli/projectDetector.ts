import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

function isNodeNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isNodeNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

export interface PathMarkerCondition {
  kind: "path";
  path: string;
  expectedType?: "file" | "directory" | "any";
}

export interface ExtensionMarkerCondition {
  kind: "extension";
  extension: string;
  maxDepth: number;
}

export interface PredicateMarkerCondition {
  kind: "predicate";
  test: (projectPath: string) => Promise<boolean> | boolean;
}

export type MarkerCondition =
  | PathMarkerCondition
  | ExtensionMarkerCondition
  | PredicateMarkerCondition;

export type MarkerCombination = MarkerCondition[];

export interface ProjectTemplateDetectionRule {
  templateId: string;
  combinations: MarkerCombination[];
}

export const DEFAULT_PROJECT_TEMPLATE_DETECTION_RULES: ProjectTemplateDetectionRule[] = [
  {
    templateId: "node",
    combinations: [[{ kind: "path", path: "package.json", expectedType: "file" }]]
  },
  {
    templateId: "javascript",
    combinations: [[{ kind: "path", path: "package.json", expectedType: "file" }]]
  },
  {
    templateId: "bun",
    combinations: [[{ kind: "path", path: "bun.lock", expectedType: "file" }]]
  },
  {
    templateId: "typescript",
    combinations: [[{ kind: "path", path: "tsconfig.json", expectedType: "file" }]]
  },
  {
    templateId: "al",
    combinations: [[{ kind: "extension", extension: ".al", maxDepth: 4 }]]
  },
  {
    templateId: "actionscript",
    combinations: [[{ kind: "extension", extension: ".as", maxDepth: 3 }]]
  },
  {
    templateId: "ada",
    combinations: [
      [{ kind: "extension", extension: ".ada", maxDepth: 4 }],
      [{ kind: "extension", extension: ".adb", maxDepth: 4 }],
      [{ kind: "extension", extension: ".ads", maxDepth: 4 }]
    ]
  },
  {
    templateId: "agda",
    combinations: [
      [{ kind: "extension", extension: ".agda", maxDepth: 3 }],
      [{ kind: "extension", extension: ".lagda", maxDepth: 3 }]
    ]
  },
  {
    templateId: "dart",
    combinations: [[{ kind: "path", path: "pubspec.yaml", expectedType: "file" }]]
  },
  {
    templateId: "d",
    combinations: [[{ kind: "extension", extension: ".d", maxDepth: 3 }]]
  },
  {
    templateId: "clojure",
    combinations: [
      [{ kind: "path", path: "project.clj", expectedType: "file" }],
      [{ kind: "path", path: "deps.edn", expectedType: "file" }]
    ]
  },
  {
    templateId: "delphi",
    combinations: [[{ kind: "extension", extension: ".dpr", maxDepth: 3 }]]
  },
  {
    templateId: "elixir",
    combinations: [[{ kind: "path", path: "mix.exs", expectedType: "file" }]]
  },
  {
    templateId: "elm",
    combinations: [[{ kind: "path", path: "elm.json", expectedType: "file" }]]
  },
  {
    templateId: "erlang",
    combinations: [
      [{ kind: "path", path: "rebar.config", expectedType: "file" }],
      [{ kind: "path", path: "rebar.config.script", expectedType: "file" }]
    ]
  },
  {
    templateId: "fortran",
    combinations: [
      [{ kind: "extension", extension: ".f", maxDepth: 3 }],
      [{ kind: "extension", extension: ".for", maxDepth: 3 }],
      [{ kind: "extension", extension: ".f90", maxDepth: 3 }]
    ]
  },
  {
    templateId: "gleam",
    combinations: [[{ kind: "path", path: "gleam.toml", expectedType: "file" }]]
  },
  {
    templateId: "haskell",
    combinations: [
      [{ kind: "path", path: "stack.yaml", expectedType: "file" }],
      [{ kind: "extension", extension: ".hs", maxDepth: 4 }]
    ]
  },
  {
    templateId: "haxe",
    combinations: [[{ kind: "extension", extension: ".hx", maxDepth: 4 }]]
  },
  {
    templateId: "idris",
    combinations: [[{ kind: "extension", extension: ".idr", maxDepth: 3 }]]
  },
  {
    templateId: "go",
    combinations: [[{ kind: "path", path: "go.mod", expectedType: "file" }]]
  },
  {
    templateId: "java",
    combinations: [
      [{ kind: "path", path: "pom.xml", expectedType: "file" }],
      [{ kind: "path", path: "build.gradle", expectedType: "file" }],
      [{ kind: "path", path: "build.gradle.kts", expectedType: "file" }]
    ]
  },
  {
    templateId: "scala",
    combinations: [
      [{ kind: "path", path: "build.sbt", expectedType: "file" }],
      [{ kind: "extension", extension: ".scala", maxDepth: 3 }]
    ]
  },
  {
    templateId: "kotlin",
    combinations: [
      [{ kind: "path", path: "build.gradle.kts", expectedType: "file" }],
      [{ kind: "extension", extension: ".kt", maxDepth: 4 }]
    ]
  },
  {
    templateId: "rust",
    combinations: [[{ kind: "path", path: "Cargo.toml", expectedType: "file" }]]
  },
  {
    templateId: "python",
    combinations: [
      [{ kind: "path", path: "requirements.txt", expectedType: "file" }],
      [{ kind: "path", path: "Pipfile", expectedType: "file" }],
      [{ kind: "path", path: "pyproject.toml", expectedType: "file" }]
    ]
  },
  {
    templateId: "julia",
    combinations: [[{ kind: "path", path: "Manifest.toml", expectedType: "file" }]]
  },
  {
    templateId: "lua",
    combinations: [[{ kind: "extension", extension: ".lua", maxDepth: 3 }]]
  },
  {
    templateId: "luau",
    combinations: [[{ kind: "extension", extension: ".luau", maxDepth: 3 }]]
  },
  {
    templateId: "nim",
    combinations: [
      [{ kind: "extension", extension: ".nim", maxDepth: 3 }],
      [{ kind: "extension", extension: ".nimble", maxDepth: 3 }]
    ]
  },
  {
    templateId: "nix",
    combinations: [
      [{ kind: "path", path: "default.nix", expectedType: "file" }],
      [{ kind: "path", path: "flake.nix", expectedType: "file" }],
      [{ kind: "path", path: "shell.nix", expectedType: "file" }]
    ]
  },
  {
    templateId: "ocaml",
    combinations: [
      [{ kind: "path", path: "dune-project", expectedType: "file" }],
      [{ kind: "extension", extension: ".opam", maxDepth: 3 }]
    ]
  },
  {
    templateId: "objectivec",
    combinations: [
      [{ kind: "extension", extension: ".m", maxDepth: 3 }],
      [{ kind: "extension", extension: ".mm", maxDepth: 3 }]
    ]
  },
  {
    templateId: "perl",
    combinations: [
      [{ kind: "path", path: "Makefile.PL", expectedType: "file" }],
      [{ kind: "path", path: "cpanfile", expectedType: "file" }]
    ]
  },
  {
    templateId: "purescript",
    combinations: [[{ kind: "path", path: "spago.dhall", expectedType: "file" }]]
  },
  {
    templateId: "r",
    combinations: [[{ kind: "path", path: "DESCRIPTION", expectedType: "file" }]]
  },
  {
    templateId: "racket",
    combinations: [[{ kind: "extension", extension: ".rkt", maxDepth: 3 }]]
  },
  {
    templateId: "raku",
    combinations: [
      [{ kind: "extension", extension: ".raku", maxDepth: 3 }],
      [{ kind: "path", path: "META6.json", expectedType: "file" }]
    ]
  },
  {
    templateId: "rescript",
    combinations: [[{ kind: "path", path: "bsconfig.json", expectedType: "file" }]]
  },
  {
    templateId: "scheme",
    combinations: [[{ kind: "extension", extension: ".scm", maxDepth: 4 }]]
  },
  {
    templateId: "swift",
    combinations: [[{ kind: "path", path: "Package.swift", expectedType: "file" }]]
  },
  {
    templateId: "tex",
    combinations: [[{ kind: "extension", extension: ".tex", maxDepth: 4 }]]
  },
  {
    templateId: "vba",
    combinations: [
      [{ kind: "extension", extension: ".vba", maxDepth: 3 }],
      [{ kind: "extension", extension: ".vb", maxDepth: 3 }],
      [{ kind: "path", path: "VBA", expectedType: "directory" }]
    ]
  },
  {
    templateId: "zig",
    combinations: [[{ kind: "path", path: "build.zig", expectedType: "file" }]]
  },
  {
    templateId: "php",
    combinations: [[{ kind: "path", path: "composer.json", expectedType: "file" }]]
  },
  {
    templateId: "ruby",
    combinations: [[{ kind: "path", path: "Gemfile", expectedType: "file" }]]
  },
  {
    templateId: "angular",
    combinations: [[{ kind: "path", path: "angular.json", expectedType: "file" }]]
  },
  {
    templateId: "appengine",
    combinations: [[{ kind: "path", path: "app.yaml", expectedType: "file" }]]
  },
  {
    templateId: "firebase",
    combinations: [[{ kind: "path", path: "firebase.json", expectedType: "file" }]]
  },
  {
    templateId: "grails",
    combinations: [[{ kind: "path", path: "grails-app", expectedType: "directory" }]]
  },
  {
    templateId: "jenkinshome",
    combinations: [[{ kind: "path", path: "Jenkinsfile", expectedType: "file" }]]
  },
  {
    templateId: "jekyll",
    combinations: [[{ kind: "path", path: "_config.yml", expectedType: "file" }]]
  },
  {
    templateId: "laravel",
    combinations: [[{ kind: "path", path: "artisan", expectedType: "file" }]]
  },
  {
    templateId: "maven",
    combinations: [
      [
        { kind: "path", path: "pom.xml", expectedType: "file" },
        { kind: "path", path: "src/main/java", expectedType: "directory" }
      ]
    ]
  },
  {
    templateId: "nestjs",
    combinations: [[{ kind: "path", path: "nest-cli.json", expectedType: "file" }]]
  },
  {
    templateId: "nextjs",
    combinations: [[{ kind: "path", path: "next.config.js", expectedType: "file" }]]
  },
  {
    templateId: "playframework",
    combinations: [[{ kind: "path", path: "conf/application.conf", expectedType: "file" }]]
  },
  {
    templateId: "rails",
    combinations: [[
      { kind: "path", path: "Gemfile", expectedType: "file" },
      { kind: "path", path: "config/application.rb", expectedType: "file" }
    ]]
  },
  {
    templateId: "sass",
    combinations: [[{ kind: "extension", extension: ".sass", maxDepth: 3 }]]
  },
  {
    templateId: "symfony",
    combinations: [[{ kind: "path", path: "symfony.lock", expectedType: "file" }]]
  },
  {
    templateId: "terraform",
    combinations: [[{ kind: "extension", extension: ".tf", maxDepth: 3 }]]
  },
  {
    templateId: "typo3",
    combinations: [[{ kind: "path", path: "typo3", expectedType: "directory" }]]
  },
  {
    templateId: "unrealengine",
    combinations: [[{ kind: "extension", extension: ".uproject", maxDepth: 2 }]]
  },
  {
    templateId: "visualstudio",
    combinations: [[{ kind: "extension", extension: ".sln", maxDepth: 2 }]]
  },
  {
    templateId: "wordpress",
    combinations: [[{ kind: "path", path: "wp-config.php", expectedType: "file" }]]
  },
  {
    templateId: "yeoman",
    combinations: [[{ kind: "path", path: ".yo-rc.json", expectedType: "file" }]]
  },
  {
    templateId: "zendframework",
    combinations: [[{ kind: "path", path: "config/application.config.php", expectedType: "file" }]]
  },
  {
    templateId: "docker",
    combinations: [[{ kind: "path", path: "Dockerfile", expectedType: "file" }]]
  },
  {
    templateId: "unity",
    combinations: [
      [{ kind: "path", path: "ProjectSettings/ProjectVersion.txt", expectedType: "file" }],
      [
        { kind: "path", path: "Assets", expectedType: "directory" },
        { kind: "path", path: "Packages", expectedType: "directory" }
      ],
      [
        { kind: "path", path: "Assets", expectedType: "directory" },
        { kind: "extension", extension: ".cs", maxDepth: 2 }
      ]
    ]
  },
  {
    templateId: "csharp",
    combinations: [[{ kind: "extension", extension: ".csproj", maxDepth: 0 }]]
  },
  {
    templateId: "adventuregamestudio",
    combinations: [[{ kind: "extension", extension: ".agf.user", maxDepth: 6 }]]
  },
  {
    templateId: "android",
    combinations: [[{ kind: "path", path: "local.properties", expectedType: "file" }]]
  },
  {
    templateId: "appceleratortitanium",
    combinations: [[{ kind: "path", path: "build.log", expectedType: "file" }]]
  },
  {
    templateId: "archlinuxpackages",
    combinations: [[{ kind: "path", path: "PKGBUILD", expectedType: "file" }]]
  },
  {
    templateId: "autotools",
    combinations: [[{ kind: "path", path: "configure", expectedType: "file" }]]
  },
  {
    templateId: "ballerina",
    combinations: [[{ kind: "path", path: "Dependencies.toml", expectedType: "file" }]]
  },
  {
    templateId: "c",
    combinations: [
      [{ kind: "extension", extension: ".c", maxDepth: 4 }],
      [{ kind: "extension", extension: ".cpp", maxDepth: 4 }]
    ]
  },
  {
    templateId: "cfwheels",
    combinations: [[{ kind: "path", path: "db/sql", expectedType: "directory" }]]
  },
  {
    templateId: "cmake",
    combinations: [[{ kind: "path", path: "CMakeLists.txt", expectedType: "file" }]]
  },
  {
    templateId: "cuda",
    combinations: [[{ kind: "extension", extension: ".cu", maxDepth: 4 }]]
  },
  {
    templateId: "cakephp",
    combinations: [[{ kind: "path", path: "config/app.php", expectedType: "file" }]]
  },
  {
    templateId: "chefcookbook",
    combinations: [[{ kind: "path", path: ".kitchen/local.yml", expectedType: "file" }]]
  },
  {
    templateId: "codeigniter",
    combinations: [
      [{ kind: "path", path: "application/config", expectedType: "directory" }],
      [{ kind: "path", path: "application/logs", expectedType: "directory" }],
      [{ kind: "path", path: "user_guide_src/build", expectedType: "directory" }]
    ]
  },
  {
    templateId: "commonlisp",
    combinations: [[{ kind: "extension", extension: ".lisp-temp", maxDepth: 4 }]]
  },
  {
    templateId: "composer",
    combinations: [[{ kind: "path", path: "composer.lock", expectedType: "file" }]]
  },
  {
    templateId: "concrete5",
    combinations: [[{ kind: "path", path: "application/files", expectedType: "directory" }]]
  },
  {
    templateId: "coq",
    combinations: [[{ kind: "extension", extension: ".vo", maxDepth: 4 }]]
  },
  {
    templateId: "craftcms",
    combinations: [[{ kind: "path", path: "craft/storage", expectedType: "directory" }]]
  },
  {
    templateId: "dm",
    combinations: [[{ kind: "extension", extension: ".dmb", maxDepth: 4 }]]
  },
  {
    templateId: "dotnet",
    combinations: [[{ kind: "extension", extension: ".sln", maxDepth: 4 }]]
  },
  {
    templateId: "drupal",
    combinations: [[{ kind: "path", path: "web/sites", expectedType: "directory" }]]
  },
  {
    templateId: "episerver",
    combinations: [[{ kind: "path", path: "License.config", expectedType: "file" }]]
  },
  {
    templateId: "eagle",
    combinations: [[{ kind: "path", path: "eagle.epf", expectedType: "file" }]]
  },
  {
    templateId: "elisp",
    combinations: [[{ kind: "extension", extension: ".elc", maxDepth: 3 }]]
  },
  {
    templateId: "expressionengine",
    combinations: [[{ kind: "path", path: "system/expressionengine/config/database.php", expectedType: "file" }]]
  },
  {
    templateId: "extjs",
    combinations: [[{ kind: "path", path: "bootstrap.json", expectedType: "file" }]]
  },
  {
    templateId: "fancy",
    combinations: [[{ kind: "extension", extension: ".fyc", maxDepth: 4 }]]
  },
  {
    templateId: "finale",
    combinations: [[{ kind: "extension", extension: ".mid", maxDepth: 4 }]]
  },
  {
    templateId: "flaxengine",
    combinations: [[{ kind: "path", path: "Binaries", expectedType: "directory" }]]
  },
  {
    templateId: "flutter",
    combinations: [
      [{ kind: "path", path: ".dart_tool", expectedType: "directory" }],
      [{ kind: "path", path: ".flutter-plugins", expectedType: "file" }],
      [{ kind: "path", path: ".flutter-plugins-dependencies", expectedType: "file" }]
    ]
  },
  {
    templateId: "forcedotcom",
    combinations: [[{ kind: "path", path: "salesforce.schema", expectedType: "file" }]]
  },
  {
    templateId: "gwt",
    combinations: [
      [{ kind: "path", path: ".gwt", expectedType: "directory" }],
      [{ kind: "path", path: ".apt_generated", expectedType: "directory" }],
      [{ kind: "path", path: ".gwt-tmp", expectedType: "directory" }]
    ]
  },
  {
    templateId: "fuelphp",
    combinations: [[{ kind: "path", path: "fuel/app", expectedType: "directory" }]]
  },
  {
    templateId: "gcov",
    combinations: [[{ kind: "extension", extension: ".gcov", maxDepth: 4 }]]
  },
  {
    templateId: "gitbook",
    combinations: [
      [{ kind: "path", path: ".grunt", expectedType: "directory" }],
      [{ kind: "path", path: "_book", expectedType: "directory" }]
    ]
  },
  {
    templateId: "githubpages",
    combinations: [[{ kind: "path", path: "_site", expectedType: "directory" }]]
  },
  {
    templateId: "godot",
    combinations: [[{ kind: "path", path: ".godot", expectedType: "directory" }]]
  },
  {
    templateId: "gradle",
    combinations: [[{ kind: "path", path: "gradlew", expectedType: "file" }]]
  },
  {
    templateId: "hip",
    combinations: [[{ kind: "extension", extension: ".ninja_log", maxDepth: 4 }]]
  },
  {
    templateId: "iar",
    combinations: [[{ kind: "extension", extension: ".sim", maxDepth: 4 }]]
  },
  {
    templateId: "igorpro",
    combinations: [[{ kind: "extension", extension: ".pxp", maxDepth: 4 }]]
  },
  {
    templateId: "jboss",
    combinations: [[{ kind: "path", path: "jboss/server", expectedType: "directory" }]]
  },
  {
    templateId: "joomla",
    combinations: [[{ kind: "path", path: "administrator/components", expectedType: "directory" }]]
  },
  {
    templateId: "katalon",
    combinations: [
      [
        { kind: "path", path: ".mtj.tmp", expectedType: "directory" },
        { kind: "path", path: ".project", expectedType: "file" }
      ]
    ]
  },
  {
    templateId: "kicad",
    combinations: [[{ kind: "extension", extension: ".kicad_pcb-bak", maxDepth: 4 }]]
  },
  {
    templateId: "kohana",
    combinations: [[{ kind: "path", path: "application/cache", expectedType: "directory" }]]
  },
  {
    templateId: "labview",
    combinations: [[{ kind: "extension", extension: ".lvlibp", maxDepth: 4 }]]
  },
  {
    templateId: "langchain",
    combinations: [[{ kind: "path", path: ".langgraph_api", expectedType: "directory" }]]
  },
  {
    templateId: "leiningen",
    combinations: [[{ kind: "path", path: "project.clj", expectedType: "file" }]]
  },
  {
    templateId: "lemonstand",
    combinations: [[{ kind: "path", path: "boot.php", expectedType: "file" }]]
  },
  {
    templateId: "lilypond",
    combinations: [[{ kind: "extension", extension: ".mid", maxDepth: 4 }]]
  },
  {
    templateId: "lithium",
    combinations: [
      [{ kind: "path", path: "libraries", expectedType: "directory" }],
      [{ kind: "path", path: "resources/tmp", expectedType: "directory" }]
    ]
  },
  {
    templateId: "magento",
    combinations: [[{ kind: "path", path: "app/etc/local.xml", expectedType: "file" }]]
  },
  {
    templateId: "mercury",
    combinations: [[{ kind: "extension", extension: ".beams", maxDepth: 4 }]]
  },
  {
    templateId: "metaprogrammingsystem",
    combinations: [[{ kind: "path", path: "source_gen", expectedType: "directory" }]]
  },
  {
    templateId: "modelsim",
    combinations: [[{ kind: "extension", extension: ".wlf", maxDepth: 4 }]]
  },
  {
    templateId: "modelica",
    combinations: [[{ kind: "extension", extension: ".mo", maxDepth: 4 }]]
  },
  {
    templateId: "nanoc",
    combinations: [
      [{ kind: "path", path: "output", expectedType: "directory" }],
      [{ kind: "path", path: "tmp/nanoc", expectedType: "directory" }],
      [{ kind: "path", path: "crash.log", expectedType: "file" }]
    ]
  },
  {
    templateId: "opa",
    combinations: [[{ kind: "extension", extension: ".opp", maxDepth: 4 }]]
  },
  {
    templateId: "opencart",
    combinations: [[{ kind: "path", path: "system/storage", expectedType: "directory" }]]
  },
  {
    templateId: "oracleforms",
    combinations: [[{ kind: "extension", extension: ".fmx", maxDepth: 4 }]]
  },
  {
    templateId: "packer",
    combinations: [[{ kind: "extension", extension: ".pkrvars.hcl", maxDepth: 4 }]]
  },
  {
    templateId: "phalcon",
    combinations: [
      [{ kind: "path", path: "cache", expectedType: "directory" }],
      [{ kind: "path", path: "config/development", expectedType: "directory" }]
    ]
  },
  {
    templateId: "plone",
    combinations: [[{ kind: "path", path: "buildout.cfg", expectedType: "file" }]]
  },
  {
    templateId: "prestashop",
    combinations: [[{ kind: "path", path: "config.php", expectedType: "file" }]]
  },
  {
    templateId: "processing",
    combinations: [[{ kind: "path", path: "application.linux64", expectedType: "file" }]]
  },
  {
    templateId: "qooxdoo",
    combinations: [
      [{ kind: "path", path: "cache", expectedType: "directory" }],
      [{ kind: "path", path: "cache-downloads", expectedType: "directory" }],
      [{ kind: "path", path: "source/inspector.html", expectedType: "file" }]
    ]
  },
  {
    templateId: "qt",
    combinations: [[{ kind: "path", path: ".qmake.cache", expectedType: "file" }]]
  },
  {
    templateId: "ros",
    combinations: [[{ kind: "path", path: "devel", expectedType: "directory" }]]
  },
  {
    templateId: "rhodesrhomobile",
    combinations: [
      [{ kind: "path", path: "bin/RhoBundle", expectedType: "directory" }],
      [
        {
          kind: "predicate",
          test: async (projectPath) => {
            const entries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
            return entries.some(
              (entry) =>
                entry.isFile() &&
                (entry.name.startsWith("rholog-") || entry.name.startsWith("sim-")),
            );
          },
        },
      ],
    ]
  },
  {
    templateId: "scons",
    combinations: [[{ kind: "path", path: ".sconsign.dblite", expectedType: "file" }]]
  },
  {
    templateId: "ssdtsqlproj",
    combinations: [[{ kind: "extension", extension: ".sqlproj", maxDepth: 4 }]]
  },
  {
    templateId: "salesforce",
    combinations: [[{ kind: "path", path: ".sfdx", expectedType: "directory" }]]
  },
  {
    templateId: "scrivener",
    combinations: [[{ kind: "path", path: "QuickLook", expectedType: "directory" }]]
  },
  {
    templateId: "sdcc",
    combinations: [[{ kind: "extension", extension: ".lst", maxDepth: 4 }]]
  },
  {
    templateId: "seamgen",
    combinations: [
      [{ kind: "path", path: "bootstrap/data", expectedType: "directory" }],
      [{ kind: "path", path: "bootstrap/tmp", expectedType: "directory" }]
    ]
  },
  {
    templateId: "sketchup",
    combinations: [[{ kind: "extension", extension: ".skb", maxDepth: 4 }]]
  },
  {
    templateId: "smalltalk",
    combinations: [[{ kind: "extension", extension: ".sml", maxDepth: 4 }]]
  },
  {
    templateId: "solidityremix",
    combinations: [[{ kind: "path", path: "artifacts", expectedType: "directory" }]]
  },
  {
    templateId: "stella",
    combinations: [[{ kind: "extension", extension: ".a26", maxDepth: 4 }]]
  },
  {
    templateId: "sugarcrm",
    combinations: [[{ kind: "path", path: "custom/history", expectedType: "directory" }]]
  },
  {
    templateId: "symphonycms",
    combinations: [[{ kind: "path", path: "manifest/logs", expectedType: "directory" }]]
  },
  {
    templateId: "testcomplete",
    combinations: [[{ kind: "extension", extension: ".tcLogs", maxDepth: 4 }]]
  },
  {
    templateId: "textpattern",
    combinations: [[{ kind: "path", path: "textpattern", expectedType: "directory" }]]
  },
  {
    templateId: "turbogears2",
    combinations: [[{ kind: "path", path: "tox.ini", expectedType: "file" }]]
  },
  {
    templateId: "twincat3",
    combinations: [[{ kind: "path", path: "TwinCAT", expectedType: "directory" }]]
  },
  {
    templateId: "vvvv",
    combinations: [
      [{ kind: "path", path: "workspace.xml", expectedType: "file" }],
      [{ kind: "path", path: "bin", expectedType: "directory" }]
    ]
  },
  {
    templateId: "waf",
    combinations: [
      [
        {
          kind: "predicate",
          test: async (projectPath) => {
            const hasWafDir = await hasRootDirectoryWithPrefix(projectPath, [
              ".waf-",
              ".waf3-",
              "waf-",
              "waf3-",
            ]);
            if (hasWafDir) {
              return true;
            }

            const entries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
            return entries.some(
              (entry) =>
                entry.isFile() &&
                entry.name.startsWith(".lock-waf_") &&
                entry.name.endsWith("_build"),
            );
          },
        },
      ],
    ]
  },
  {
    templateId: "xojo",
    combinations: [[{ kind: "extension", extension: ".xojo_uistate", maxDepth: 4 }]]
  },
  {
    templateId: "yii",
    combinations: [[{ kind: "path", path: "protected/runtime", expectedType: "directory" }]]
  },
  {
    templateId: "zephir",
    combinations: [[{ kind: "path", path: "ext/build", expectedType: "directory" }]]
  },
  {
    templateId: "ecutest",
    combinations: [[{ kind: "extension", extension: ".dbc", maxDepth: 4 }]]
  }
];

function isSkippableDir(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized.startsWith(".") ||
    normalized === "node_modules" ||
    normalized === "dist" ||
    normalized === "build" ||
    normalized === "coverage" ||
    normalized === "vendor" ||
    normalized === ".cache"
  );
}

async function hasFileWithExtension(
  root: string,
  extension: string,
  maxDepth: number,
  currentDepth = 0,
): Promise<boolean> {
  if (currentDepth > maxDepth) return false;

  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!isSkippableDir(entry.name)) {
        const found = await hasFileWithExtension(
          join(root, entry.name),
          extension,
          maxDepth,
          currentDepth + 1,
        );
        if (found) return true;
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
      return true;
    }
  }

  return false;
}

async function hasRootDirectoryWithPrefix(root: string, prefixes: string[]): Promise<boolean> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries.some(
    (entry) => entry.isDirectory() && prefixes.some((prefix) => entry.name.startsWith(prefix)),
  );
}

async function matchesPathCondition(
  projectPath: string,
  condition: PathMarkerCondition,
): Promise<boolean> {
  const absolutePath = join(projectPath, condition.path);
  if (!(await pathExists(absolutePath))) {
    return false;
  }

  const expectedType = condition.expectedType ?? "any";
  if (expectedType === "any") {
    return true;
  }

  const statResult = await stat(absolutePath);
  return expectedType === "directory" ? statResult.isDirectory() : statResult.isFile();
}

async function evaluateCondition(
  projectPath: string,
  condition: MarkerCondition,
): Promise<boolean> {
  if (condition.kind === "path") {
    return matchesPathCondition(projectPath, condition);
  }

  if (condition.kind === "extension") {
    return hasFileWithExtension(projectPath, condition.extension, condition.maxDepth);
  }

  return Boolean(await condition.test(projectPath));
}

async function matchesCombination(
  projectPath: string,
  combination: MarkerCombination,
): Promise<boolean> {
  for (const condition of combination) {
    if (!(await evaluateCondition(projectPath, condition))) {
      return false;
    }
  }

  return true;
}

export async function detectProjectTemplates(
  projectPath: string,
  detectionRules: ProjectTemplateDetectionRule[] = DEFAULT_PROJECT_TEMPLATE_DETECTION_RULES,
): Promise<string[]> {
  const detected: string[] = [];

  for (const rule of detectionRules) {
    let matched = false;

    for (const combination of rule.combinations) {
      if (await matchesCombination(projectPath, combination)) {
        matched = true;
        break;
      }
    }

    if (matched && !detected.includes(rule.templateId)) {
      detected.push(rule.templateId);
    }
  }

  return detected;
}
