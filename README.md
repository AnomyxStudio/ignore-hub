# ignore-hub

Interactive TUI CLI to generate `.gitignore` from
[`github/gitignore`](https://github.com/github/gitignore).

## Install

### From npm

```bash
bun add -g ignore-hub
# or
npm i -g ignore-hub
```

This package is distributed via npm and supports installation with **npm**/**bun**.  
The CLI runtime is **Bun-native** at the moment (via OpenTUI).

If global bin is not on PATH, run directly with:

```bash
bunx ignore-hub
bunx ih
```

### Local install (development)

```bash
bun install
bun link
```

Then run anywhere:

```bash
ignore-hub
ih
```

## Usage

```bash
ih [options]
```

`ignore-hub` and `ih` are equivalent.

Options:

- `--output <path>`: write output file path (default: `./.gitignore`)
- `--refresh`: force refresh template index from GitHub
- `--stdout`: print result to stdout instead of writing file
- `-h, --help`: show help
- `-t, --template <names>`: select templates directly (comma-separated or repeated)
- `-a, --auto`: detect templates from project structure
- `-s, --simple-sepration`: output template section headers as `## Template` and skip generated markers
- `--no-interactive`: skip interactive TUI and generate directly

Examples:

- `ih -t unity,node`
- `ih --auto --no-interactive`
- `ih --auto -t java,unity -o .gitignore`
- `ih -a -t java,unity -o .gitignore`
- `ih -t node -s`

## TUI keys

- `↑/↓`: move
- `Space`: toggle selection
- `Enter`: next step / confirm
- `Backspace`: delete search text (when searching) or go previous step
- `Ctrl+R`: refresh template index
- `q`: quit
- `type letters/numbers`: quick filter in current step

## Auto-detect extensibility

- `--auto` uses `DEFAULT_PROJECT_TEMPLATE_DETECTION_RULES` from
  `src/cli/projectDetector.ts`.
- Each rule is a template id plus a set of marker combinations.
- A template is matched when **any** marker combination is fully satisfied.
- Marker types currently supported:
  - `path` (required file/directory path, optional expected type)
  - `extension` (file extension with max recursion depth)

To add a new project-to-template mapping, add a new rule in this list.

## Publishing (for maintainers)

1. Set a unique package name/metadata in `package.json` and bump `version`.
2. `bun run prepublishOnly` (runs typecheck + tests)
3. `npm login` (or `bun npm login`)
4. `npm publish` / `bun publish`

If your package scope is scoped (e.g. `@scope/ignore-hub`), add
`publishConfig.access=public` to publish publicly.

## Repo

Source code: `github/gitignore` only.

- `src/data/githubClient.ts`: fetches template index and template content
- `src/data/cacheStore.ts`: manages `~/.cache/ignore-hub/index.json`
- `src/domain/classification.ts`: classifies root templates into `language` / `framework`
- `src/domain/mergeGitignore.ts`: merges selections into an idempotent `###` section
- `src/app/*`: OpenTUI steps and wizard flow
