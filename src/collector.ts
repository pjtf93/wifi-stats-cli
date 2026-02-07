import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import {
  parseAirportOutput,
  parsePingStats,
  parseSystemProfilerOutput,
  type PingStats,
  type WifiStats
} from "./parsers.js";
import type { Logger } from "./logger.js";

const execFileAsync = promisify(execFile);
const AIRPORT_PATH = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";

type CommandResult = {
  stdout: string;
  stderr: string;
  error: Error | null;
};

export type PingResult = PingStats & {
  target: string;
  samples: number;
  error: string | null;
};

export type DnsLookupResult = {
  host: string;
  server: string | null;
  lookupMs: number | null;
  error: string | null;
};

export type SpeedTestResult = {
  downloadMbps: number | null;
  uploadMbps: number | null;
  baseRttMs: number | null;
  responsivenessMs: number | null;
  interfaceName: string | null;
  endpoint: string | null;
  raw: {
    startDate: string | null;
    endDate: string | null;
    osVersion: string | null;
  } | null;
  error: string | null;
};

type SpeedTestRaw = {
  dl_throughput?: number;
  ul_throughput?: number;
  base_rtt?: number;
  responsiveness?: number;
  interface_name?: string;
  test_endpoint?: string;
  start_date?: string;
  end_date?: string;
  os_version?: string;
};

async function runCommand(command: string, args: string[], options: Record<string, unknown> = {}): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      ...options
    });
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: null };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "command failed",
      error: err
    };
  }
}

export async function getAirportInfo(log: Logger): Promise<WifiStats | null> {
  log("info", "collect.airport.start", { command: AIRPORT_PATH });
  let hasAirport = true;

  try {
    await access(AIRPORT_PATH);
  } catch (error) {
    hasAirport = false;
    const message = error instanceof Error ? error.message : String(error);
    log("error", "collect.airport.missing", { error: message });
  }

  if (hasAirport) {
    const result = await runCommand(AIRPORT_PATH, ["-I"]);

    if (!result.error) {
      const parsed = parseAirportOutput(result.stdout);
      log("success", "collect.airport.success", { ssid: parsed.ssid });
      return parsed;
    }

    log("error", "collect.airport.error", { stderr: result.stderr });
  }

  log("info", "collect.system-profiler.start", {});
  const profilerResult = await runCommand("system_profiler", [
    "SPAirPortDataType",
    "-detailLevel",
    "basic"
  ]);

  if (profilerResult.error) {
    log("error", "collect.system-profiler.error", { stderr: profilerResult.stderr });
    return null;
  }

  const parsed = parseSystemProfilerOutput(profilerResult.stdout);
  log("success", "collect.system-profiler.success", { ssid: parsed.ssid });
  return parsed;
}

export async function getDefaultGateway(log: Logger): Promise<string | null> {
  log("info", "collect.gateway.start", {});
  const result = await runCommand("route", ["-n", "get", "default"]);
  const match = result.stdout.match(/gateway: (.+)/);
  const gateway = match ? match[1].trim() : null;

  if (!gateway) {
    log("error", "collect.gateway.error", { stderr: result.stderr });
    return null;
  }

  log("success", "collect.gateway.success", { gateway });
  return gateway;
}

export async function pingHost(host: string, count: number, log: Logger): Promise<PingResult> {
  log("info", "collect.ping.start", { host, count });
  const result = await runCommand("ping", ["-n", "-c", String(count), host]);
  const stats = parsePingStats(result.stdout);

  if (!stats.avgMs && result.error) {
    log("error", "collect.ping.error", { host, stderr: result.stderr });
    return {
      target: host,
      avgMs: null,
      jitterMs: null,
      lossPct: null,
      samples: count,
      error: result.stderr || "ping failed"
    };
  }

  log("success", "collect.ping.success", {
    host,
    avgMs: stats.avgMs,
    jitterMs: stats.jitterMs,
    lossPct: stats.lossPct
  });

  return {
    target: host,
    avgMs: stats.avgMs,
    jitterMs: stats.jitterMs,
    lossPct: stats.lossPct,
    samples: count,
    error: result.error ? result.stderr : null
  };
}

export async function getDnsServer(log: Logger): Promise<string | null> {
  log("info", "collect.dns-server.start", {});
  const result = await runCommand("scutil", ["--dns"]);
  const match = result.stdout.match(/nameserver\[0\] : ([\d.]+)/);
  const server = match ? match[1] : null;

  if (!server) {
    log("error", "collect.dns-server.error", { stderr: result.stderr });
    return null;
  }

  log("success", "collect.dns-server.success", { server });
  return server;
}

export async function dnsLookup(host: string, server: string | null, log: Logger): Promise<DnsLookupResult> {
  log("info", "collect.dns-lookup.start", { host, server });
  const args = ["+stats", "+tries=1", "+time=2", host];
  if (server) args.push(`@${server}`);
  const result = await runCommand("dig", args);
  const match = result.stdout.match(/Query time: (\d+) msec/);
  const lookupMs = match ? Number.parseInt(match[1], 10) : null;

  if (lookupMs === null) {
    log("error", "collect.dns-lookup.error", { stderr: result.stderr });
    return {
      host,
      server,
      lookupMs: null,
      error: result.stderr || "dns lookup failed"
    };
  }

  log("success", "collect.dns-lookup.success", { host, lookupMs });
  return {
    host,
    server,
    lookupMs,
    error: result.error ? result.stderr : null
  };
}

export async function runSpeedTest(log: Logger): Promise<SpeedTestResult> {
  log("info", "collect.speedtest.start", {});
  const result = await runCommand("networkQuality", ["-c"]);

  if (result.error) {
    log("error", "collect.speedtest.error", { stderr: result.stderr });
    return {
      downloadMbps: null,
      uploadMbps: null,
      baseRttMs: null,
      responsivenessMs: null,
      interfaceName: null,
      endpoint: null,
      raw: null,
      error: result.stderr || "networkQuality failed"
    };
  }

  let parsed: SpeedTestRaw | null = null;
  try {
    parsed = JSON.parse(result.stdout) as SpeedTestRaw;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "collect.speedtest.parse-error", { error: message });
    return {
      downloadMbps: null,
      uploadMbps: null,
      baseRttMs: null,
      responsivenessMs: null,
      interfaceName: null,
      endpoint: null,
      raw: null,
      error: "networkQuality output parse failed"
    };
  }

  const downloadMbps = parsed.dl_throughput ? Math.round(parsed.dl_throughput / 1_000_000) : null;
  const uploadMbps = parsed.ul_throughput ? Math.round(parsed.ul_throughput / 1_000_000) : null;

  const response: SpeedTestResult = {
    downloadMbps,
    uploadMbps,
    baseRttMs: parsed.base_rtt ?? null,
    responsivenessMs: parsed.responsiveness ?? null,
    interfaceName: parsed.interface_name ?? null,
    endpoint: parsed.test_endpoint ?? null,
    raw: {
      startDate: parsed.start_date ?? null,
      endDate: parsed.end_date ?? null,
      osVersion: parsed.os_version ?? null
    },
    error: null
  };

  log("success", "collect.speedtest.success", {
    downloadMbps,
    uploadMbps,
    baseRttMs: response.baseRttMs
  });

  return response;
}
