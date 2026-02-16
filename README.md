# ignore-hub

Interactive TUI CLI to generate `.gitignore` from
[`github/gitignore`](https://github.com/github/gitignore).

## Install

### From npm (once published)

```bash
bun add -g ignore-hub
# or
npm i -g ignore-hub
```

This package requires **Bun** runtime because it uses an OpenTUI CLI entrypoint.

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
ih [--output <path>] [--refresh] [--stdout]
```

`ignore-hub` and `ih` are equivalent.

Options:

- `--output <path>`: write output file path (default: `./.gitignore`)
- `--refresh`: force refresh template index from GitHub
- `--stdout`: print result to stdout instead of writing file
- `-h, --help`: show help

## TUI keys

- `↑/↓`: move
- `Space`: toggle selection
- `Enter`: next step / confirm
- `Backspace`: delete search text (when searching) or go previous step
- `r`: refresh template index
- `q`: quit
- `type letters/numbers`: quick filter in current step

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
