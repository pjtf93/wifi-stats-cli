# CHANGELOG

## session-2026-02-07-1459 (2026-02-07 14:59 CET)
- Added `.gitignore` for repo hygiene (`node_modules`, `dist`, logs, `.DS_Store`).
- Initialized git repository and prepared first commit.
- Created public GitHub repository and pushed main branch.

## session-2026-02-07-1420 (2026-02-07 14:20 CET)
- Prepared npm distribution: added publish guard script (`prepublishOnly` = test + build).
- Added npm package metadata (`keywords`, `publishConfig.access=public`).
- Updated README with `npx`/global install and maintainer publish commands.
- Verified package name availability on npm registry (`wifi-stats-cli` currently not found).
- Fixed TypeScript build blocker by removing invalid `preserveShebang` compiler option.

## session-2026-01-25-1425 (2026-01-25 14:25 CET)
- Initialized wifi-stats CLI with macOS data collection and JSON/pretty output.
- Added structured logging, docs, and basic configuration flags.
- Added system_profiler fallback when airport binary is unavailable.
- Added optional speed test via networkQuality.
- Renamed package to wifi-stats-cli.
- Migrated to TypeScript with build/test tooling and parser unit tests.
