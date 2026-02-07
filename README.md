# wifi-stats

macOS Wi-Fi diagnostics CLI with JSON or pretty output.

## Install

### Run without install (recommended)

```bash
npx wifi-stats-cli --pretty
```

### Global install

```bash
npm install -g wifi-stats-cli
wifi-stats --pretty
```

### Local development

```bash
pnpm install
pnpm build
pnpm start
```

## Dev

```bash
pnpm dev
```

## Usage

```bash
wifi-stats --json
wifi-stats --pretty
wifi-stats --samples 20
wifi-stats --internet-host 1.1.1.1
wifi-stats --dns-host cloudflare.com
wifi-stats --speedtest
```

## Publish to npm (maintainer)

```bash
npm login
pnpm install
pnpm test
pnpm build
npm publish
```

## Data sources

- Wi-Fi details: `airport -I` (fallback: `system_profiler SPAirPortDataType -detailLevel basic`)
- Gateway: `route -n get default`
- DNS server: `scutil --dns`
- Ping/jitter/loss: `ping`
- DNS lookup: `dig +stats`
- Speed test: `networkQuality -c`
