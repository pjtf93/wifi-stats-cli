import { describe, expect, it } from "vitest";
import { parseAirportOutput, parsePingStats, parseSystemProfilerOutput } from "../src/parsers.js";

describe("parsers", () => {
  it("parses airport output", () => {
    const input = [
      "SSID: MyWifi",
      "BSSID: aa:bb:cc:dd:ee:ff",
      "agrCtlRSSI: -53",
      "agrCtlNoise: -91",
      "channel: 48,1",
      "lastTxRate: 576"
    ].join("\n");

    const parsed = parseAirportOutput(input);

    expect(parsed).toEqual({
      ssid: "MyWifi",
      bssid: "aa:bb:cc:dd:ee:ff",
      signalDbm: -53,
      noiseDbm: -91,
      channel: 48,
      band: "5 GHz",
      linkRateMbps: 576
    });
  });

  it("parses system_profiler output", () => {
    const input = [
      "Wi-Fi:",
      "      Interfaces:",
      "        en0:",
      "          Current Network Information:",
      "            MyHome:",
      "              Channel: 48 (5GHz, 80MHz)",
      "              Signal / Noise: -51 dBm / -91 dBm",
      "              Transmit Rate: 960"
    ].join("\n");

    const parsed = parseSystemProfilerOutput(input);

    expect(parsed).toEqual({
      ssid: "MyHome",
      bssid: null,
      signalDbm: -51,
      noiseDbm: -91,
      channel: 48,
      band: "5 GHz",
      linkRateMbps: 960
    });
  });

  it("parses ping stats", () => {
    const input = [
      "12 packets transmitted, 12 packets received, 0.0% packet loss",
      "round-trip min/avg/max/stddev = 9.123/10.456/11.789/0.987 ms"
    ].join("\n");

    const parsed = parsePingStats(input);

    expect(parsed).toEqual({
      avgMs: 10.456,
      jitterMs: 0.987,
      lossPct: 0
    });
  });
});
