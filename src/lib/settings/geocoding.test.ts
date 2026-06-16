import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, haversineKm, hhmm, reverseGeocode } from "./geocoding";

function mockFetch(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => payload })));
}

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

describe("geocodeAddress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps photon features to Place (coords swapped, country upper-cased)", async () => {
    mockFetch({
      features: [
        {
          properties: { name: "Marienplatz", housenumber: "1", street: "Marienplatz", postcode: "80331", city: "München", country: "Germany", countrycode: "de" },
          geometry: { coordinates: [11.5756, 48.1372] },
        },
      ],
    });
    const [p] = await geocodeAddress("Marienplatz");
    expect(p.lat).toBe(48.1372);
    expect(p.lon).toBe(11.5756);
    expect(p.countryCode).toBe("DE");
    expect(p.label).toBe("Marienplatz, 1 Marienplatz, 80331, München, Germany");
  });

  it("returns [] when there are no features", async () => {
    mockFetch({});
    expect(await geocodeAddress("nowhere")).toEqual([]);
  });
});

describe("reverseGeocode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds a label from the first feature", async () => {
    mockFetch({ features: [{ properties: { name: "Marienplatz", city: "München", country: "Germany", countrycode: "de" }, geometry: { coordinates: [11.57, 48.13] } }] });
    const p = await reverseGeocode(48.13, 11.57);
    expect(p.label).toBe("Marienplatz, München, Germany");
    expect(p.countryCode).toBe("DE");
  });

  it("falls back to formatted coordinates when no feature is found", async () => {
    mockFetch({ features: [] });
    const p = await reverseGeocode(48.13, 11.57);
    expect(p.label).toBe("48.13000, 11.57000");
  });
});
