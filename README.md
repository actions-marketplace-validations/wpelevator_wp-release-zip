# WP Release Zip

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-WP%20Release%20Zip-blue?logo=github)](https://github.com/marketplace/actions/wp-release-zip) [![Latest release](https://img.shields.io/github/v/release/wpelevator/wp-release-zip?include_prereleases&sort=semver)](https://github.com/wpelevator/wp-release-zip/releases) [![npm](https://img.shields.io/npm/v/@wpelevator/wp-release?label=wp-release)](https://www.npmjs.com/package/@wpelevator/wp-release)

GitHub Action that creates the release ZIP of a WordPress plugin or theme using [`@wpelevator/wp-release`](https://www.npmjs.com/package/@wpelevator/wp-release). It's named after the [`wp-release zip`](https://www.npmjs.com/package/@wpelevator/wp-release#zip) command that it runs.

The ZIP has a `{slug}/` root folder, which WordPress.org, plugin updates and WordPress Playground require, and leaves out everything that `.distignore` lists. The optional `exclude-gitattributes: true` input also honors Git `export-ignore` attributes, including nested `.gitattributes` files. It's reproducible: entries are sorted and use a fixed timestamp and file mode, so the same files always give the same ZIP. It needs no `zip` or `rsync` and works on any runner.

## Usage

Use `true` or `false` for boolean inputs; the action validates these values before running the command.

These actions require a runner with the Node.js 24 action runtime. Keep self-hosted runners updated before using them.

Pin `uses:` to the latest released version from the [releases page](https://github.com/wpelevator/wp-release-zip/releases). Upgrades are intentionally manual: floating major or minor tags are not published.

```yaml
jobs:
  release:
    runs-on: ubuntu-24.04
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7

      - run: npm ci && npm run build

      - id: zip
        uses: wpelevator/wp-release-zip@0.4.0
        with:
          source-dir: dist
          checksums: true
          sign: true
          signing-key: ${{ secrets.WP_RELEASE_SIGNING_KEY }}

      - uses: softprops/action-gh-release@v3
        with:
          files: |
            ${{ steps.zip.outputs.zip-path }}
            ${{ steps.zip.outputs.checksums-path }}
            ${{ steps.zip.outputs.signatures }}
```

In a repository with a `wp-release.config.js`, zip a package with the `files` config of its package group, the same files that its deploys ship:

```yaml
      - id: zip
        uses: wpelevator/wp-release-zip@0.4.0
        with:
          package: plugins/my-plugin
          # config: release/custom.mjs # Optional custom release config.
          checksums: true
```

Set `sign: true` to sign the ZIP and the optional checksums manifest in the same step. `sign-format: wordpress,minisign,ssh` writes all three formats and implies signing even without `sign: true`. The `signing-key` input overrides `WP_RELEASE_SIGNING_KEY` and is masked in the logs. The key, formats and existing signature destinations are validated before the ZIP or manifest is written.

Pass `zip-path` to [`wp-release-deploy-svn`](https://github.com/wpelevator/wp-release-deploy-svn) as `from-zip` to deploy to WordPress.org exactly the files of the release asset, or use [`wp-release-sign`](https://github.com/wpelevator/wp-release-sign) to sign files separately.

The action itself needs only `contents: read` for checkout. This example grants `contents: write` because `softprops/action-gh-release` uploads assets to a GitHub release; jobs that only create ZIPs should use `contents: read`.

## Inputs

| Input | Default | Description |
|---|---|---|
| `package` | | Package of `wp-release.config.js`, by identifier or path under the configured root like `plugins/my-plugin`, to zip its directory with the [`files` config](https://www.npmjs.com/package/@wpelevator/wp-release#deploy-configured-packages) of its package group, the same files that its deploys ship. The slug defaults to the directory name, so the `slug` input is ignored, and `source-dir` and the file selection inputs can't be combined with it. |
| `config` | conventional config in the repository root | JavaScript release config path for `package`, passed as `--config`. |
| `source-dir` | `.` | Directory to archive. |
| `slug` | repository name | Plugin or theme slug. |
| `version` | `Version` header | Version for the ZIP and its filename. |
| `filename-format` | `{slug}.{version}` | Filename with `{slug}` and `{version}`. |
| `output` | the filename in the repository root | Path of the ZIP. |
| `distignore` | `.distignore` in `source-dir` when present | Path to the ignore file, or `false` to not read one. |
| `exclude` | | Extra gitignore-style patterns separated by commas or new lines, like `build/,assets/*,images/**/*`. They're applied after the ignore file, so a `!` pattern can re-include a file. |
| `exclude-gitattributes` | `false` | Also exclude paths marked `export-ignore` by Git attributes. Requires `source-dir` to be inside a Git repository. |
| `root-folder` | `slug` | Folder inside the ZIP, or `false` to put the files at the ZIP root. |
| `checksums` | `false` | Also write the [checksums manifest](https://github.com/wpelevator/wp-release-checksums) of the archived files next to the ZIP, with `.checksums.json` instead of `.zip`. |
| `sign` | `false` | Sign the ZIP and the optional checksums manifest, writing a WordPress `.sig` next to each. |
| `sign-format` | `wordpress` | Comma-separated signature formats: `wordpress` (`.sig`), `minisign` (`.minisig`), `ssh` (`.sshsig`). Implies signing. |
| `signing-key` | `WP_RELEASE_SIGNING_KEY` env var | Base64 32-byte Ed25519 seed or 64-byte libsodium secret key. Pass it from a secret. Setting the key alone does not enable signing. |
| `force` | `false` | Overwrite existing ZIP, manifest and signature files. |

A ZIP or manifest written inside `source-dir`, and their `.sig`, `.minisig` and `.sshsig` signatures, are never archived. The `checksums` input is for manifests that you publish next to the ZIP. To ship the manifest inside the plugin, write it into `source-dir` with [`wp-release-checksums`](https://github.com/wpelevator/wp-release-checksums#manifest-inside-the-plugin) before zipping and leave `checksums` off, since it would write a second manifest that lists the first.

## Outputs

| Output | Description |
|---|---|
| `zip-path` | Absolute path of the ZIP. |
| `checksums-path` | Absolute path of the checksums manifest, empty unless `checksums` is `true`. |
| `files` | Number of archived files. |
| `signatures` | Absolute paths of the written signature files, one per line; empty without signing. |
| `public-key` | Base64 public key of the signing key; empty without signing. |

## Job summary

Each run adds a section to the job summary of the run with the ZIP, its number of files and the checksums manifest, when `checksums` is `true`. Signing also adds the signature files and the public key in each selected format. A failed run adds its error instead, and the run fails. The paths are relative to the workspace.

## Without the action

When you can't use a GitHub Action, such as on another CI system or in a local release script, add the same tooling as a development dependency and run the CLI command that the action runs, passing the signing key through the `WP_RELEASE_SIGNING_KEY` environment variable:

```bash
npm install --save-dev @wpelevator/wp-release
npx wp-release zip dist --checksums --sign
```

The inputs map to the flags of [`wp-release zip`](https://www.npmjs.com/package/@wpelevator/wp-release#zip): `source-dir` is the first argument, `package`, `config`, `filename-format`, `output`, `distignore`, `exclude`, `exclude-gitattributes`, `checksums`, `sign`, `sign-format` and `force` keep their names, `root-folder: false` is `--no-root-folder` and `distignore: false` is `--no-distignore`. Add `--json` to read the paths of the ZIP and the manifest from the output. The CLI needs Node.js 22.12 or later, and has no other dependencies on the runner. Run `npx wp-release zip --help` for all options.

## How it works

[`src/run.ts`](src/run.ts) reads the inputs with [`@actions/core`](https://github.com/actions/toolkit/tree/main/packages/core), maps them to the arguments of the [`wp-release zip`](https://www.npmjs.com/package/@wpelevator/wp-release#zip) command and runs it through the `execute()` function of [`@wpelevator/wp-release`](https://www.npmjs.com/package/@wpelevator/wp-release), so the action and the CLI always behave the same. The action runs `dist/index.js`, a single file bundled with esbuild that includes `wp-release` and all other dependencies, so nothing is installed from npm when the action runs. The tooling version is fixed by the action ref you pin.

## Development

The source is TypeScript in `src/`. `dist/` is git-ignored in the monorepo. `npm run build` bundles the `@wpelevator/wp-release` dependency at the version that the action's `package.json` pins. The dependents policy of the monorepo release configuration re-releases the actions whenever a later version falls outside their pins and rewrites them, so they don't need a manual update. A pin that drifts from the published version, like a deliberate pin to an older release, selects a registry install instead, and `changeset-status` warns until the pin resolves the package again. The split-push workflow commits the bundle to the action's release repository. `npm test` runs the input mapping and action execution tests with Node.js type stripping, and `npm run lint` runs ESLint and a `tsc` type check.

```bash
npm run build --workspace @wpelevator/wp-release-zip-action
```
