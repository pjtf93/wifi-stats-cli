#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import type { DnsLookupResult, PingResult, SpeedTestResult } from "./collector.js";
import {
  dnsLookup,
  getAirportInfo,
  getDefaultGateway,
  getDnsServer,
  pingHost,
  runSpeedTest
} from "./collector.js";
import type { WifiStats } from "./parsers.js";
import { log } from "./logger.js";

const HELP_TEXT = `wifi-stats - macOS Wi-Fi diagnostics

USAGE:
  wifi-stats [options]

OPTIONS:
  --json               Output JSON only
  --pretty             Force pretty output
  --samples <n>        Ping samples (default: 12)
  --internet-host <h>  Internet ping target (default: 1.1.1.1)
  --router-host <h>    Router ping target (default: system gateway)
  --dns-host <h>       DNS lookup hostname (default: cloudflare.com)
  --speedtest          Run networkQuality speed test
  --no-color           Disable ANSI color
  -h, --help           Show help
  --version            Show version
`;

type Options = {
  json: boolean;
  pretty: boolean;
  samples: number;
  internetHost: string;
  routerHost: string | null;
  dnsHost: string;
  speedtest: boolean;
  noColor: boolean;
};

type ParseResult = {
  options: Options;
  showHelp?: boolean;
  showVersion?: boolean;
  unknown?: string[];
};

type OutputData = {
  timestamp: string;
  wifi: WifiStats | null;
  router: {
    gateway: string | null;
    ping: PingResult | null;
  };
  internet: {
    target: string;
    ping: PingResult | null;
  };
  dns: {
    server: string | null;
    source: "router" | "system";
    lookup: DnsLookupResult | null;
  };
  speedtest: SpeedTestResult | null;
  meta: {
    samples: number;
    dnsHost: string;
    speedtest: boolean;
  };
};

function parseArgs(argv: string[]): ParseResult {
  const options: Options = {
    json: false,
    pretty: false,
    samples: 12,
    internetHost: "1.1.1.1",
    routerHost: null,
    dnsHost: "cloudflare.com",
    speedtest: false,
    noColor: false
  };

  const args = [...argv];
  const unknown: string[] = [];

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--pretty") {
      options.pretty = true;
      continue;
    }

    if (arg === "--no-color") {
      options.noColor = true;
      continue;
    }

    if (arg === "--samples") {
      const value = args.shift();
      options.samples = value ? Number.parseInt(value, 10) : Number.NaN;
      continue;
    }

    if (arg === "--internet-host") {
      options.internetHost = args.shift() ?? "";
      continue;
    }

    if (arg === "--router-host") {
      options.routerHost = args.shift() ?? null;
      continue;
    }

    if (arg === "--dns-host") {
      options.dnsHost = args.shift() ?? "";
      continue;
    }

    if (arg === "--speedtest") {
      options.speedtest = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      return { options, showHelp: true };
    }

    if (arg === "--version") {
      return { options, showVersion: true };
    }

    if (arg.startsWith("-")) {
      unknown.push(arg);
    }
  }

  return { options, unknown };
}

function colorize(enabled: boolean, colorCode: number, text: string): string {
  if (!enabled) return text;
  return `\u001b[${colorCode}m${text}\u001b[0m`;
}

function formatMetric(
  label: string,
  value: number | string | null | undefined,
  unit: string,
  color: number,
  colorEnabled: boolean
): string {
  const displayValue = value === null || value === undefined ? "n/a" : value;
  const coloredValue = colorize(colorEnabled, color, String(displayValue));
  return `  ${label}: ${coloredValue}${unit ? ` ${unit}` : ""}`;
}

function renderPretty(output: OutputData, options: Options): void {
  const colorEnabled = process.stdout.isTTY && !options.noColor && !process.env.NO_COLOR;

  const title = colorize(colorEnabled, 1, "Wi-Fi Stats");
  console.log(title);

  if (output.wifi) {
    console.log("\nWi-Fi");
    console.log(`  SSID: ${output.wifi.ssid ?? "Unknown"}${output.wifi.band ? ` (${output.wifi.band})` : ""}`);
    console.log(`  BSSID: ${output.wifi.bssid ?? "Unknown"}`);
    console.log(formatMetric("Link Rate", output.wifi.linkRateMbps, "Mbps", 32, colorEnabled));
    console.log(formatMetric("Signal", output.wifi.signalDbm, "dBm", 33, colorEnabled));
    console.log(formatMetric("Noise", output.wifi.noiseDbm, "dBm", 32, colorEnabled));
    console.log(`  Channel: ${output.wifi.channel ?? "Unknown"}`);
  } else {
    console.log("\nWi-Fi\n  n/a");
  }

  console.log("\nRouter");
  console.log(`  Gateway: ${output.router.gateway ?? "Unknown"}`);
  if (output.router.ping) {
    console.log(formatMetric("Ping", output.router.ping.avgMs, "ms", 32, colorEnabled));
    console.log(formatMetric("Jitter", output.router.ping.jitterMs, "ms", 31, colorEnabled));
    console.log(formatMetric("Loss", output.router.ping.lossPct, "%", 33, colorEnabled));
  }

  console.log("\nInternet");
  console.log(`  Target: ${output.internet.target}`);
  if (output.internet.ping) {
    console.log(formatMetric("Ping", output.internet.ping.avgMs, "ms", 33, colorEnabled));
    console.log(formatMetric("Jitter", output.internet.ping.jitterMs, "ms", 31, colorEnabled));
    console.log(formatMetric("Loss", output.internet.ping.lossPct, "%", 32, colorEnabled));
  }

  console.log("\nDNS");
  console.log(`  Server: ${output.dns.server ?? "Unknown"} (${output.dns.source})`);
  if (output.dns.lookup) {
    console.log(formatMetric("Lookup", output.dns.lookup.lookupMs, "ms", 32, colorEnabled));
  }

  if (output.speedtest) {
    console.log("\nSpeed Test");
    if (output.speedtest.error) {
      console.log(`  Error: ${output.speedtest.error}`);
    } else {
      console.log(formatMetric("Download", output.speedtest.downloadMbps, "Mbps", 32, colorEnabled));
      console.log(formatMetric("Upload", output.speedtest.uploadMbps, "Mbps", 32, colorEnabled));
      console.log(formatMetric("Base RTT", output.speedtest.baseRttMs, "ms", 33, colorEnabled));
      console.log(formatMetric("Responsiveness", output.speedtest.responsivenessMs, "ms", 33, colorEnabled));
      if (output.speedtest.endpoint) {
        console.log(`  Endpoint: ${output.speedtest.endpoint}`);
      }
    }
  }
}

async function loadVersion(): Promise<string> {
  const pkgUrl = new URL("../package.json", import.meta.url);
  const pkgRaw = await readFile(pkgUrl, "utf8");
  const pkg = JSON.parse(pkgRaw) as { version: string };
  return pkg.version;
}

async function main(): Promise<void> {
  const { options, showHelp, showVersion, unknown } = parseArgs(process.argv.slice(2));

  if (showHelp) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  if (showVersion) {
    const version = await loadVersion();
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }

  if (unknown && unknown.length > 0) {
    process.stderr.write(`Unknown option(s): ${unknown.join(", ")}\n`);
    process.stderr.write("Run --help for usage.\n");
    process.exit(2);
  }

  if (!Number.isFinite(options.samples) || options.samples <= 0) {
    process.stderr.write("--samples must be a positive integer.\n");
    process.exit(2);
  }

  log("info", "wifi-stats.start", { options });

  const wifi = await getAirportInfo(log);
  const gateway = options.routerHost ?? (await getDefaultGateway(log));
  const dnsServer = await getDnsServer(log);

  const [routerPing, internetPing, dnsResult, speedtest] = await Promise.all([
    gateway ? pingHost(gateway, options.samples, log) : Promise.resolve(null),
    pingHost(options.internetHost, options.samples, log),
    dnsLookup(options.dnsHost, dnsServer, log),
    options.speedtest ? runSpeedTest(log) : Promise.resolve(null)
  ]);

  const output: OutputData = {
    timestamp: new Date().toISOString(),
    wifi,
    router: {
      gateway,
      ping: routerPing
    },
    internet: {
      target: options.internetHost,
      ping: internetPing
    },
    dns: {
      server: dnsServer,
      source: dnsServer && gateway && dnsServer === gateway ? "router" : "system",
      lookup: dnsResult
    },
    speedtest,
    meta: {
      samples: options.samples,
      dnsHost: options.dnsHost,
      speedtest: options.speedtest
    }
  };

  let hadError = !wifi || !gateway || !dnsServer || !routerPing || !internetPing || !dnsResult;
  if (routerPing?.error || internetPing?.error || dnsResult?.error) hadError = true;
  if (options.speedtest && speedtest?.error) hadError = true;

  if (options.json || (!process.stdout.isTTY && !options.pretty)) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    renderPretty(output, options);
  }

  log("success", "wifi-stats.complete", { hadError });
  process.exitCode = hadError ? 1 : 0;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log("error", "wifi-stats.crash", { error: message });
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
