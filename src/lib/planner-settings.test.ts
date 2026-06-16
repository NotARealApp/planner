import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PLACES,
  loadPlannerSettings,
  resetPlannerSettings,
  savePlannerSettings,
  SETTINGS_KEY,
} from "./planner-settings";

// loadPlannerSettings/save/reset need a browser-like environment. Provide a
// minimal Map-backed localStorage and a window object for the test only.
function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as Record<string, unknown>).window = { localStorage };
  (globalThis as Record<string, unknown>).localStorage = localStorage;
  return store;
}

describe("planner-settings", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installStorage();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadPlannerSettings()).toEqual(DEFAULT_PLACES);
  });

  it("merges stored fields over defaults, filling the rest", () => {
    const home = { label: "Home", lat: 1, lon: 2, countryCode: "DE" };
    store.set(SETTINGS_KEY, JSON.stringify({ home }));
    const loaded = loadPlannerSettings();
    expect(loaded.home).toEqual(home);
    expect(loaded.office).toEqual(DEFAULT_PLACES.office);
    expect(loaded.officeArrival).toEqual(DEFAULT_PLACES.officeArrival);
  });

  it("falls back to defaults on corrupt JSON", () => {
    store.set(SETTINGS_KEY, "{not json");
    expect(loadPlannerSettings()).toEqual(DEFAULT_PLACES);
  });

  it("round-trips through save", () => {
    const next = { ...DEFAULT_PLACES, homeReturn: { hour: 17, minute: 30 } };
    savePlannerSettings(next);
    expect(loadPlannerSettings()).toEqual(next);
  });

  it("reset clears stored settings", () => {
    savePlannerSettings(DEFAULT_PLACES);
    resetPlannerSettings();
    expect(store.has(SETTINGS_KEY)).toBe(false);
  });
});
