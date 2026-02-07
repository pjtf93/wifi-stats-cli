# Solved Problems

## 2026-02-07 - TypeScript build failure on invalid shebang compiler option
- Problem: `pnpm build` failed with `TS5023: Unknown compiler option 'preserveShebang'`.
- Root cause: `preserveShebang` is not a valid TypeScript compiler option in the current TypeScript version.
- Solution: Removed `preserveShebang` from `tsconfig.json`.
- Files: `tsconfig.json`.
- Commands: `pnpm build`.

## 2026-01-25 - macOS Wi-Fi data acquisition plan
- Problem: Need reliable local sources for Wi-Fi link, signal, and network health metrics.
- Root cause: Data scattered across system utilities.
- Solution: Combine `airport -I`, `system_profiler SPAirPortDataType`, `route -n get default`, `scutil --dns`, `ping`, `dig +stats`, and `networkQuality -c`.
- Files: `src/collector.js`, `src/cli.js`.
- Commands: `airport -I`, `system_profiler SPAirPortDataType -detailLevel basic`, `route -n get default`, `scutil --dns`, `ping -c`, `dig +stats`, `networkQuality -c`.
