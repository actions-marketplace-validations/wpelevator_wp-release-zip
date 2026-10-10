# WP Release Zip

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-WP%20Release%20Zip-blue?logo=github)](https://github.com/marketplace/actions/wp-release-zip) [![Latest release](https://img.shields.io/github/v/release/wpelevator/wp-release-zip?include_prereleases&sort=semver)](https://github.com/wpelevator/wp-release-zip/releases) [![npm](https://img.shields.io/npm/v/@wpelevator/wp-release?label=wp-release)](https://www.npmjs.com/package/@wpelevator/wp-release)

GitHub Action that creates the release ZIP of a WordPress plugin or theme using [`@wpelevator/wp-release`](https://www.npmjs.com/package/@wpelevator/wp-release). It's named after the [`wp-release zip`](https://www.npmjs.com/package/@wpelevator/wp-release#zip) command that it runs.

**Status:** first release (0.x). Boolean inputs must be `true` or `false`; anything else fails the run.

The ZIP has a `{slug}/` root folder, which WordPress.org, plugin updates and WordPress Playground require, and leaves out everything that `.distignore` lists. It's reproducible: entries are sorted and use a fixed timestamp and file mode, so the same files always give the same ZIP. It needs no `zip` or `rsync` and works on any runner.

## Usage

```yaml
jobs:
  release:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7

      - run: npm ci && npm run build

      - id: zip
        uses: wpelevator/wp-release-zip@0.1.0
        with:
          source-dir: dist
          checksums: true

      - uses: softprops/action-gh-release@v3
        with:
          files: |
            ${{ steps.zip.outputs.zip-path }}
            ${{ steps.zip.outputs.checksums-path }}
```

Pass `zip-path` to [`wp-release-deploy-svn`](../wp-release-deploy-svn) as `from-zip` to deploy to WordPress.org exactly the files of the release asset, and to [`wp-release-sign`](../wp-release-sign) to sign it.

## Inputs

| Input | Default | Description |
|---|---|---|
| `source-dir` | `.` | Directory to archive. |
| `slug` | repository name | Plugin or theme slug. |
| `version` | `Version` header | Version for the ZIP and its filename. |
| `filename-format` | `{slug}.{version}` | Filename with `{slug}` and `{version}`. |
| `output` | the filename in the repository root | Path of the ZIP. |
| `distignore` | `.distignore` in `source-dir` when present | Path to the ignore file, or `false` to not read one. |
| `exclude` | | Extra gitignore-style patterns separated by commas or new lines, like `build/,assets/*,images/**/*`. They're applied after the ignore file, so a `!` pattern can re-include a file. |
| `root-folder` | `slug` | Folder inside the ZIP, or `false` to put the files at the ZIP root. |
| `checksums` | `false` | Also write the [checksums manifest](../wp-release-checksums) of the archived files next to the ZIP, with `.checksums.json` instead of `.zip`. |
| `force` | `false` | Overwrite existing output files. |

A ZIP or manifest written inside `source-dir`, and its `.sig`, is never archived. The `checksums` input is for manifests that you publish next to the ZIP. To ship the manifest inside the plugin, write it into `source-dir` with [`wp-release-checksums`](../wp-release-checksums#manifest-inside-the-plugin) before zipping and leave `checksums` off, since it would write a second manifest that lists the first.

## Outputs

| Output | Description |
|---|---|
| `zip-path` | Absolute path of the ZIP. |
| `checksums-path` | Absolute path of the checksums manifest, empty unless `checksums` is `true`. |
| `files` | Number of archived files. |

## How it works

[`src/run.ts`](src/run.ts) reads the inputs with [`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core), maps them to the arguments of the [`wp-release zip`](https://www.npmjs.com/package/@wpelevator/wp-release#zip) command and runs it through the `execute()` function of [`@wpelevator/wp-release`](https://www.npmjs.com/package/@wpelevator/wp-release), so the action and the CLI always behave the same. The action runs `dist/index.js`, a single file bundled with esbuild that includes `wp-release` and all other dependencies, so nothing is installed from npm when the action runs. The tooling version is fixed by the action ref you pin.

## Development

The source is TypeScript in `src/`. `dist/` is git-ignored in the monorepo, `npm run build` bundles it, and the split-push workflow commits it to the action's release repository. `npm test` runs the input mapping tests with Node.js type stripping, and `npm run lint` runs ESLint and a `tsc` type check.

```bash
npm run build --workspace @wpelevator/wp-release-zip-action
```
