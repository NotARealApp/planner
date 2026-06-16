import { describe, expect, it } from "vitest";
import type { WeatherData } from "@/lib/weather";
import { EUROPE_CC, daytimeReduce, homeCountry, sunnyHours, tripOverall, ymd } from "./logic";

function fixture(): WeatherData {
  const hours = ["07", "08", "12", "21", "22"];
  const mk = (day: string, temp: number, app: number, rain: number, wc: number, wind: number) =>
    hours.map((h) => ({ t: `${day}T${h}:00`, temp, app, rain, wc, wind }));
  const rows = [...mk("2026-07-01", 18, 17, 20, 0, 10), ...mk("2026-07-02", 22, 21, 60, 61, 25)];
  return {
    daily: {
      time: ["2026-07-01", "2026-07-02"],
      temperature_2m_max: [21, 26],
      temperature_2m_min: [14, 16],
      precipitation_probability_max: [20, 60],
      weathercode: [0, 61],
      windspeed_10m_max: [10, 25],
    },
    hourly: {
      time: rows.map((r) => r.t),
      temperature_2m: rows.map((r) => r.temp),
      apparent_temperature: rows.map((r) => r.app),
      precipitation_probability: rows.map((r) => r.rain),
      weathercode: rows.map((r) => r.wc),
      windspeed_10m: rows.map((r) => r.wind),
    },
  };
}

describe("ymd", () => {
  it("formats zero-padded local YYYY-MM-DD", () => {
    expect(ymd(new Date(2026, 6, 1))).toBe("2026-07-01");
  });
});

describe("EUROPE_CC", () => {
  it("includes European country codes and excludes others", () => {
    expect(EUROPE_CC.has("DE")).toBe(true);
    expect(EUROPE_CC.has("GB")).toBe(true);
    expect(EUROPE_CC.has("US")).toBe(false);
    expect(EUROPE_CC.has("JP")).toBe(false);
  });
});

describe("daytimeReduce", () => {
  const d = fixture();
  it("reduces values within the waking window", () => {
    expect(daytimeReduce(d, 1, "precipitation_probability", Math.max, 0)).toBe(60);
  });
  it("returns null when the day has no in-window data", () => {
    expect(daytimeReduce(d, 5, "temperature_2m", Math.min, Infinity)).toBeNull();
  });
});

describe("sunnyHours", () => {
  it("counts sun-category hours in the waking window", () => {
    // Day 0 weathercode 0 (sun) at 08,12,21 → 3 sunny hours.
    expect(sunnyHours(fixture(), 0)).toBe(3);
    expect(sunnyHours(fixture(), 1)).toBe(0);
  });
});

describe("homeCountry", () => {
  it("defaults to DE without stored settings", () => {
    expect(homeCountry()).toBe("DE");
  });
});

describe("tripOverall", () => {
  it("aggregates min/max across valid days and includes an outfit", () => {
    const o = tripOverall(fixture());
    expect(o).not.toBeNull();
    expect(o!.maxT).toBe(26);
    expect(o!.maxRain).toBe(60);
    expect(o!.maxWind).toBe(25);
    expect(o!.sunny).toBe(true);
    expect(o!.outfit).toBeTruthy();
  });

  it("returns null when no day has data", () => {
    const empty: WeatherData = {
      daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [], weathercode: [], windspeed_10m_max: [] },
      hourly: { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], weathercode: [], windspeed_10m: [] },
    };
    expect(tripOverall(empty)).toBeNull();
  });
});
