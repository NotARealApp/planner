import { describe, expect, it } from "vitest";
import {
  chosenSummary,
  pickChosen,
  routeId,
  summarizeRoute,
  type RouteLeg,
  type RouteSummary,
} from "./logic";

// --- fixtures ---------------------------------------------------------------

function makeLeg(over: Partial<RouteLeg> = {}): RouteLeg {
  return {
    line: "U6",
    transportType: "UBAHN",
    direction: "Garching",
    board: "Marienplatz",
    alight: "Garching",
    boardStationId: "de:09162:2",
    boardTime: "2026-06-16T08:00:00.000Z",
    alightTime: "2026-06-16T08:20:00.000Z",
    realTime: false,
    occupancy: "UNKNOWN",
    delayMin: 0,
    realtimeBoard: null,
    cancelled: false,
    warnings: [],
    ...over,
  };
}

function makeSummary(over: Partial<RouteSummary> = {}): RouteSummary {
  const departure = over.departure ?? "2026-06-16T08:00:00.000Z";
  const legs = over.legs ?? [makeLeg()];
  return {
    id: routeId({ departure, legs }),
    departure,
    arrival: "2026-06-16T08:20:00.000Z",
    durationMs: 20 * 60000,
    walk: null,
    legs,
    ...over,
  };
}

// Minimal raw shape that summarizeRoute() consumes.
function rawRoute(line: string, dep: string, arr: string) {
  return {
    parts: [
      {
        line: { label: line, transportType: "UBAHN", destination: "Garching" },
        from: { name: "Marienplatz", plannedDeparture: dep, stationGlobalId: "de:09162:2" },
        to: { name: "Garching", plannedDeparture: arr },
        occupancy: "UNKNOWN",
      },
    ],
  };
}

// --- routeId ----------------------------------------------------------------

describe("routeId", () => {
  it("is deterministic for the same planned route", () => {
    const a = makeSummary();
    const b = makeSummary();
    expect(routeId(a)).toBe(routeId(b));
  });

  it("differs for two routes that share a departure time but not their legs", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const u6 = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const u3 = makeSummary({ departure: dep, legs: [makeLeg({ line: "U3" })] });
    // Core of the original bug: same departure minute must NOT collapse to one id.
    expect(u6.departure).toBe(u3.departure);
    expect(routeId(u6)).not.toBe(routeId(u3));
  });

  it("ignores realtime fields — a delay does not change the id", () => {
    const onTime = makeSummary();
    const delayed = makeSummary();
    delayed.legs[0].delayMin = 7;
    delayed.legs[0].realtimeBoard = "2026-06-16T08:07:00.000Z";
    delayed.legs[0].realTime = true;
    expect(routeId(delayed)).toBe(routeId(onTime));
  });
});

// --- summarizeRoute ---------------------------------------------------------

describe("summarizeRoute", () => {
  it("stamps an id equal to routeId(summary)", () => {
    const s = summarizeRoute(rawRoute("U6", "2026-06-16T08:00:00.000Z", "2026-06-16T08:20:00.000Z"));
    expect(s.id).toBe(routeId(s));
  });

  it("gives same-departure / different-line routes distinct ids", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const a = summarizeRoute(rawRoute("U6", dep, "2026-06-16T08:20:00.000Z"));
    const b = summarizeRoute(rawRoute("U3", dep, "2026-06-16T08:25:00.000Z"));
    expect(a.id).not.toBe(b.id);
  });
});

// --- chosenSummary ----------------------------------------------------------

describe("chosenSummary", () => {
  const now = new Date("2026-06-16T07:00:00.000Z");

  it("returns the route matching the pick's id, not the first sharing its departure", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const first = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const second = makeSummary({ departure: dep, legs: [makeLeg({ line: "U3" })] });
    const summaries = [first, second];
    const pick = { dir: "office", id: second.id };
    const chosen = chosenSummary(summaries, now, pick, "office", 5);
    expect(chosen.id).toBe(second.id);
  });

  it("falls back to auto-pick when the pick is for another direction", () => {
    const summaries = [makeSummary()];
    const pick = { dir: "home", id: summaries[0].id };
    const chosen = chosenSummary(summaries, now, pick, "office", 5);
    expect(chosen).toBe(pickChosen(summaries, now, 5));
  });
});
