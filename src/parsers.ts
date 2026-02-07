export type WifiStats = {
  ssid: string | null;
  bssid: string | null;
  signalDbm: number | null;
  noiseDbm: number | null;
  channel: number | null;
  band: string | null;
  linkRateMbps: number | null;
};

export type PingStats = {
  avgMs: number | null;
  jitterMs: number | null;
  lossPct: number | null;
};

export function parseAirportOutput(output: string): WifiStats {
  const lines = output.split("\n");
  const data: Record<string, string> = {};

  for (const line of lines) {
    if (!line.includes(":")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim();
    const value = rest.join(":").trim();
    if (key.length === 0) continue;
    data[key] = value;
  }

  const channelValue = data.channel ? data.channel.split(",")[0] : null;
  const channel = channelValue ? Number.parseInt(channelValue, 10) : null;
  const band = channel ? (channel > 14 ? "5 GHz" : "2.4 GHz") : null;
  const linkRate = data.lastTxRate ? Number.parseInt(data.lastTxRate, 10) : null;

  return {
    ssid: data.SSID ?? null,
    bssid: data.BSSID ?? null,
    signalDbm: data.agrCtlRSSI ? Number.parseInt(data.agrCtlRSSI, 10) : null,
    noiseDbm: data.agrCtlNoise ? Number.parseInt(data.agrCtlNoise, 10) : null,
    channel,
    band,
    linkRateMbps: linkRate
  };
}

export function parseSystemProfilerOutput(output: string): WifiStats {
  const ssidMatch = output.match(/Current Network Information:\s*\n\s{12}(.+):/);
  const signalMatch = output.match(/Signal \/ Noise: (-?\d+) dBm \/ (-?\d+) dBm/);
  const channelMatch = output.match(/Channel: (\d+) \(([^)]+)\)/);
  const transmitMatch = output.match(/Transmit Rate: (\d+)/);

  const channel = channelMatch ? Number.parseInt(channelMatch[1], 10) : null;
  let band = null;
  if (channelMatch && channelMatch[2]) {
    const bandMatch = channelMatch[2].match(/(\d+\.?\d*)GHz/i);
    band = bandMatch ? `${bandMatch[1]} GHz` : null;
  }

  return {
    ssid: ssidMatch ? ssidMatch[1].trim() : null,
    bssid: null,
    signalDbm: signalMatch ? Number.parseInt(signalMatch[1], 10) : null,
    noiseDbm: signalMatch ? Number.parseInt(signalMatch[2], 10) : null,
    channel,
    band,
    linkRateMbps: transmitMatch ? Number.parseInt(transmitMatch[1], 10) : null
  };
}

export function parsePingStats(output: string): PingStats {
  const lossMatch = output.match(/([\d.]+)% packet loss/);
  const rttMatch = output.match(
    /round-trip min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/
  );

  return {
    avgMs: rttMatch ? Number.parseFloat(rttMatch[2]) : null,
    jitterMs: rttMatch ? Number.parseFloat(rttMatch[4]) : null,
    lossPct: lossMatch ? Number.parseFloat(lossMatch[1]) : null
  };
}
