import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chosenSummary,
  defaultDirection,
  effBoardMs,
  effDepartureMs,
  fmtDuration,
  fmtMins,
  fmtTime,
  isInProgress,
  leaveTier,
  lineColor,
  localYmd,
  mapsUrlFor,
  pickChosen,
  routeCancelled,
  routeDelayMs,
  routeId,
  shortPlace,
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

// fmtMins/fmtDuration take a translator; identity makes assertions exact.
const tId = (k: string) => k;

afterEach(() => {
  vi.useRealTimers();
});

// --- routeId ----------------------------------------------------------------

describe("routeId", () => {
  it("is deterministic for the same planned route", () => {
    expect(routeId(makeSummary())).toBe(routeId(makeSummary()));
  });

  it("differs for two routes that share a departure time but not their legs", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const u6 = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const u3 = makeSummary({ departure: dep, legs: [makeLeg({ line: "U3" })] });
    expect(u6.departure).toBe(u3.departure);
    expect(routeId(u6)).not.toBe(routeId(u3));
  });

  it("ignores realtime fields — a delay does not change the id", () => {
    const delayed = makeSummary();
    delayed.legs[0].delayMin = 7;
    delayed.legs[0].realtimeBoard = "2026-06-16T08:07:00.000Z";
    delayed.legs[0].realTime = true;
    expect(routeId(delayed)).toBe(routeId(makeSummary()));
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

  it("computes durationMs from departure to final arrival", () => {
    const s = summarizeRoute(rawRoute("U6", "2026-06-16T08:00:00.000Z", "2026-06-16T08:20:00.000Z"));
    expect(s.durationMs).toBe(20 * 60000);
  });

  it("folds a leading pedestrian leg into departure + walk, not a leg", () => {
    const s = summarizeRoute({
      parts: [
        {
          line: { label: "walk", transportType: "PEDESTRIAN", destination: "Stop" },
          from: { name: "Home", plannedDeparture: "2026-06-16T07:55:00.000Z" },
          to: { name: "Stop", plannedDeparture: "2026-06-16T08:00:00.000Z" },
        },
        {
          line: { label: "U6", transportType: "UBAHN", destination: "Garching" },
          from: { name: "Stop", plannedDeparture: "2026-06-16T08:00:00.000Z", stationGlobalId: "x" },
          to: { name: "Garching", plannedDeparture: "2026-06-16T08:20:00.000Z" },
        },
      ],
    });
    expect(s.legs).toHaveLength(1);
    expect(s.walk).toEqual({ minutes: 5, dest: "Stop" });
    // departure = first transit board minus the 5-min walk.
    expect(s.departure).toBe("2026-06-16T07:55:00.000Z");
  });
});

// --- delay / timing helpers -------------------------------------------------

describe("delay + timing helpers", () => {
  it("routeDelayMs converts the first leg's delay minutes to ms", () => {
    expect(routeDelayMs(makeSummary({ legs: [makeLeg({ delayMin: 3 })] }))).toBe(180000);
    expect(routeDelayMs(makeSummary())).toBe(0);
    expect(routeDelayMs(makeSummary({ legs: [] }))).toBe(0);
  });

  it("effDepartureMs adds delay to the planned departure", () => {
    const s = makeSummary({ departure: "2026-06-16T08:00:00.000Z", legs: [makeLeg({ delayMin: 5 })] });
    expect(effDepartureMs(s)).toBe(new Date("2026-06-16T08:05:00.000Z").getTime());
  });

  it("effBoardMs uses the first leg's board time + delay, falling back to departure", () => {
    const s = makeSummary({ legs: [makeLeg({ boardTime: "2026-06-16T08:02:00.000Z", delayMin: 1 })] });
    expect(effBoardMs(s)).toBe(new Date("2026-06-16T08:03:00.000Z").getTime());
    const walkOnly = makeSummary({ departure: "2026-06-16T08:00:00.000Z", legs: [] });
    expect(effBoardMs(walkOnly)).toBe(new Date("2026-06-16T08:00:00.000Z").getTime());
  });

  it("routeCancelled is true when any leg is cancelled", () => {
    expect(routeCancelled(makeSummary())).toBe(false);
    expect(routeCancelled(makeSummary({ legs: [makeLeg(), makeLeg({ cancelled: true })] }))).toBe(true);
  });

  it("isInProgress is true only between effective departure and arrival", () => {
    const s = makeSummary({
      departure: "2026-06-16T08:00:00.000Z",
      arrival: "2026-06-16T08:20:00.000Z",
    });
    expect(isInProgress(s, new Date("2026-06-16T07:59:00.000Z"))).toBe(false);
    expect(isInProgress(s, new Date("2026-06-16T08:10:00.000Z"))).toBe(true);
    expect(isInProgress(s, new Date("2026-06-16T08:20:00.000Z"))).toBe(false);
  });
});

// --- pickChosen -------------------------------------------------------------

describe("pickChosen", () => {
  const now = new Date("2026-06-16T07:00:00.000Z");

  it("picks the first non-cancelled departure past the prep-buffer cutoff", () => {
    const past = makeSummary({ departure: "2026-06-16T06:50:00.000Z" });
    const soon = makeSummary({ departure: "2026-06-16T07:02:00.000Z" }); // inside 5-min buffer
    const good = makeSummary({ departure: "2026-06-16T07:30:00.000Z" });
    expect(pickChosen([past, soon, good], now, 5)).toBe(good);
  });

  it("skips cancelled routes", () => {
    const cancelled = makeSummary({ departure: "2026-06-16T07:30:00.000Z", legs: [makeLeg({ cancelled: true })] });
    const good = makeSummary({ departure: "2026-06-16T07:40:00.000Z" });
    expect(pickChosen([cancelled, good], now, 5)).toBe(good);
  });

  it("falls back to the last route when none clear the cutoff", () => {
    const a = makeSummary({ departure: "2026-06-16T06:00:00.000Z" });
    const b = makeSummary({ departure: "2026-06-16T06:30:00.000Z" });
    expect(pickChosen([a, b], now, 5)).toBe(b);
  });
});

// --- chosenSummary ----------------------------------------------------------

describe("chosenSummary", () => {
  const now = new Date("2026-06-16T07:00:00.000Z");

  it("returns the route matching the pick's id, not the first sharing its departure", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const first = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const second = makeSummary({ departure: dep, legs: [makeLeg({ line: "U3" })] });
    const chosen = chosenSummary([first, second], now, { dir: "office", id: second.id }, "office", 5);
    expect(chosen.id).toBe(second.id);
  });

  it("falls back to auto-pick when the pick is for another direction", () => {
    const summaries = [makeSummary()];
    const chosen = chosenSummary(summaries, now, { dir: "home", id: summaries[0].id }, "office", 5);
    expect(chosen).toBe(pickChosen(summaries, now, 5));
  });

  it("drops a stale pick (already departed and arrived) and auto-picks", () => {
    const stale = makeSummary({
      departure: "2026-06-16T06:00:00.000Z",
      arrival: "2026-06-16T06:20:00.000Z",
    });
    const good = makeSummary({ departure: "2026-06-16T07:30:00.000Z" });
    const chosen = chosenSummary([stale, good], now, { dir: "office", id: stale.id }, "office", 5);
    expect(chosen).toBe(good);
  });
});

// --- formatting + misc pure helpers ----------------------------------------

describe("fmtMins / fmtDuration", () => {
  it("renders minutes under an hour", () => {
    expect(fmtMins(45, tId)).toBe("45 dp.uMin");
  });
  it("renders hours and minutes", () => {
    expect(fmtMins(90, tId)).toBe("1dp.uH 30dp.uM");
  });
  it("omits minutes on a whole hour", () => {
    expect(fmtMins(120, tId)).toBe("2dp.uH");
  });
  it("fmtDuration rounds ms to the nearest minute", () => {
    expect(fmtDuration(20 * 60000 + 20000, tId)).toBe("20 dp.uMin");
  });
});

describe("fmtTime", () => {
  it("formats an ISO string as HH:MM", () => {
    expect(fmtTime("2026-06-16T08:05:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("leaveTier", () => {
  it("classifies by urgent/soon thresholds", () => {
    expect(leaveTier(3, 5, 15)).toBe("urgent");
    expect(leaveTier(5, 5, 15)).toBe("urgent");
    expect(leaveTier(10, 5, 15)).toBe("soon");
    expect(leaveTier(15, 5, 15)).toBe("soon");
    expect(leaveTier(20, 5, 15)).toBe("ok");
  });
});

describe("lineColor", () => {
  it("uses the exact line color when known", () => {
    expect(lineColor("U6", "UBAHN")).toBe("#0065AE");
  });
  it("colors night and express lines by prefix", () => {
    expect(lineColor("N40", "BUS")).toBe("#2b2d42");
    expect(lineColor("X30", "BUS")).toBe("#6a1b9a");
  });
  it("colors regional bus number ranges", () => {
    expect(lineColor("55", "BUS")).toBe("#004f6e");
    expect(lineColor("68", "BUS")).toBe("#004f6e");
  });
  it("falls back to the transport-type color, then a default", () => {
    expect(lineColor("99", "TRAM")).toBe("#E2001A");
    expect(lineColor("99", "MYSTERY")).toBe("#5b6770");
  });
});

describe("localYmd", () => {
  it("formats a date as zero-padded local YYYY-MM-DD", () => {
    expect(localYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("shortPlace", () => {
  it("takes the part before the first comma, trimmed", () => {
    expect(shortPlace("Marienplatz, München, DE")).toBe("Marienplatz");
    expect(shortPlace("")).toBe("");
  });
});

describe("mapsUrlFor", () => {
  const home = { lat: 1, lon: 2 };
  const office = { lat: 3, lon: 4 };
  it("routes home → office when heading to the office", () => {
    expect(mapsUrlFor("office", home, office)).toContain("origin=1,2&destination=3,4");
  });
  it("reverses origin/destination when going home", () => {
    expect(mapsUrlFor("home", home, office)).toContain("origin=3,4&destination=1,2");
  });
});

describe("defaultDirection", () => {
  it("is office in the morning and home from 13:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 9, 0));
    expect(defaultDirection()).toBe("office");
    vi.setSystemTime(new Date(2026, 5, 16, 13, 0));
    expect(defaultDirection()).toBe("home");
  });
});
