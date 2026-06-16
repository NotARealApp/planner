import { describe, expect, it } from "vitest";
import { haversineKm, hhmm } from "./geocoding";

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm({ label: "", lat: 48.137, lon: 11.575 }, { label: "", lat: 48.137, lon: 11.575 })).toBe(0);
  });

  it("matches the known München↔Berlin great-circle distance (~504 km)", () => {
    const muc = { label: "", lat: 48.1372, lon: 11.5756 };
    const ber = { label: "", lat: 52.52, lon: 13.405 };
    expect(haversineKm(muc, ber)).toBeGreaterThan(500);
    expect(haversineKm(muc, ber)).toBeLessThan(510);
  });

  it("is symmetric", () => {
    const a = { label: "", lat: 10, lon: 20 };
    const b = { label: "", lat: -5, lon: 40 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe("hhmm", () => {
  it("zero-pads hour and minute", () => {
    expect(hhmm({ hour: 9, minute: 5 })).toBe("09:05");
    expect(hhmm({ hour: 18, minute: 0 })).toBe("18:00");
  });
});
