# wifi-stats skill

Use this repo/package when user asks to check Wi-Fi quality on macOS.

## Tool
- CLI name: `wifi-stats`
- npm package: `wifi-stats-cli`

## Quick run
```bash
npx wifi-stats-cli --pretty
```

## Structured output for agents
```bash
npx wifi-stats-cli --json
```

## Recommended flags
- `--samples 20` for more stable ping/jitter
- `--internet-host 1.1.1.1` to test WAN latency
- `--dns-host cloudflare.com` to test DNS resolution
- `--speedtest` to include `networkQuality` throughput data

## Interpretation hints
- Signal (RSSI): around `-50 dBm` strong, `-70 dBm` weak
- Noise: lower (more negative) is better, e.g. `-90 dBm`
- Ping/loss: lower ping + `0%` loss expected on healthy links
- DNS lookup: low single-digit ms usually good on LAN DNS

## Requirements
- macOS (uses `airport/system_profiler`, `route`, `scutil`, `ping`, `dig`, optional `networkQuality`)
- Node.js >= 18

## Failure modes
- `airport` missing: tool auto-falls back to `system_profiler`
- non-zero exit code indicates incomplete/errored metrics; check JSON `error` fields/log output
