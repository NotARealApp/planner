import { describe, expect, it } from "vitest";
import {
  computeOutfit,
  daytimeApparentMin,
  daytimeMaxWind,
  daytimeMinTemp,
  daytimeRainChance,
  daytimeSunnyHours,
  hourlyEntries,
  weatherInfo,
  type WeatherData,
} from "./weather";

// Two days. Hourly rows deliberately include pre-waking (07) and post-waking
// (22) hours that the daytime reducers must ignore (waking window is 8–21).
function fixture(): WeatherData {
  const hours = ["07", "08", "12", "18", "21", "22"];
  const mk = (day: string, temps: number[], app: number[], rain: (number | null)[], wc: number[], wind: number[]) =>
    hours.map((h, i) => ({ t: `${day}T${h}:00`, temp: temps[i], app: app[i], rain: rain[i], wc: wc[i], wind: wind[i] }));

  const d0 = mk("2026-06-16", [99, 10, 20, 15, 12, 99], [99, 9, 19, 14, 11, 99], [99, 40, 10, 80, 5, 99], [99, 0, 3, 61, 0, 99], [99, 12, 35, 8, 5, 99]);
  const d1 = mk("2026-06-17", [99, 5, 6, 7, 8, 99], [99, 4, 5, 6, 7, 99], [99, 0, 0, 0, 0, 99], [99, 3, 3, 3, 3, 99], [99, 1, 1, 1, 1, 99]);
  const rows = [...d0, ...d1];

  return {
    daily: {
      time: ["2026-06-16", "2026-06-17"],
      temperature_2m_max: [20, 8],
      temperature_2m_min: [10, 5],
      precipitation_probability_max: [80, 0],
      weathercode: [61, 3],
      windspeed_10m_max: [35, 1],
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

describe("weatherInfo", () => {
  it("maps a known code to [textKey, category]", () => {
    expect(weatherInfo(0)).toEqual(["wx.clear", "sun"]);
    expect(weatherInfo(61)).toEqual(["wx.rainL", "rain"]);
  });
  it("falls back for an unknown code", () => {
    expect(weatherInfo(12345)).toEqual(["wx.unknown", "cloud"]);
  });
});

describe("daytime reducers (waking window 8–21)", () => {
  const d = fixture();

  it("daytimeRainChance takes the max within the window, ignoring 07/22", () => {
    expect(daytimeRainChance(d, 0)).toBe(80);
  });
  it("daytimeMinTemp takes the min within the window", () => {
    expect(daytimeMinTemp(d, 0)).toBe(10);
  });
  it("daytimeMaxWind takes the max within the window", () => {
    expect(daytimeMaxWind(d, 0)).toBe(35);
  });
  it("daytimeApparentMin uses apparent temps", () => {
    expect(daytimeApparentMin(d, 0)).toBe(9);
  });
  it("daytimeSunnyHours counts only 'sun' category hours in the window", () => {
    // Day 0: codes 0 (08h) and 0 (21h) are sun; 3 and 61 are not.
    expect(daytimeSunnyHours(d, 0)).toBe(2);
  });
});

describe("hourlyEntries", () => {
  it("returns stepped entries for a future day starting at the waking hour", () => {
    const d = fixture();
    // dayIdx 1 → startHour 8, step 2 → 8,10,12,...,18; 21 is off-step. Rows
    // present at 08/12/18 qualify; 21 does not ((21-8) is odd).
    const entries = hourlyEntries(d, 1, 10, 2);
    expect(entries.map((e) => e.hour)).toEqual([8, 12, 18]);
    expect(entries[0]).toMatchObject({ hour: 8, temp: 5, category: "cloud" });
  });
});

describe("computeOutfit", () => {
  it("recommends a heavy coat + scarf below 2°C", () => {
    const o = computeOutfit(-1, 0, 5);
    expect(o.jacketTextKey).toBe("fit.bigCoat");
    expect(o.noteKeys).toContain("fit.scarf");
  });
  it("flags an umbrella at 30%+ rain", () => {
    expect(computeOutfit(15, 30, 5).umbrella).toBe(true);
    expect(computeOutfit(15, 29, 5).umbrella).toBe(false);
    expect(computeOutfit(15, null, 5).umbrella).toBe(false);
  });
  it("adds a wind note at 30+ km/h", () => {
    expect(computeOutfit(15, 0, 30).noteKeys).toContain("dp.windy");
    expect(computeOutfit(15, 0, 29).noteKeys).not.toContain("dp.windy");
  });
  it("varies wording by variant for mild temps", () => {
    expect(computeOutfit(18, 0, 0, "dayplanner").jacketTextKey).toBe("fit.noCoat");
    expect(computeOutfit(18, 0, 0, "trip").jacketTextKey).toBe("fit.noCoatS");
  });
});
