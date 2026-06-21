import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chosenSummary,
  dayOffInfo,
  dedupeById,
  defaultDirection,
  effBoardMs,
  effDepartureMs,
  enrichRealtime,
  fetchRoutes,
  fetchRoutesPadded,
  fetchWeather,
  fmtDuration,
  fmtMins,
  fmtTime,
  isInProgress,
  leaveTier,
  lineColor,
  loadHolidays,
  localYmd,
  mapsUrlFor,
  pickChosen,
  planChosen,
  readRouteCache,
  resolveRouting,
  sortForArrival,
  writeRouteCache,
  routeCancelled,
  routeDelayMs,
  routeId,
  routeRelMin,
  routingDateTime,
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

describe("dedupeById", () => {
  it("keeps the first of each id and preserves order", () => {
    const dep = "2026-06-16T08:00:00.000Z";
    const a = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const dup = makeSummary({ departure: dep, legs: [makeLeg({ line: "U6" })] });
    const b = makeSummary({ departure: dep, legs: [makeLeg({ line: "U3" })] });
    expect(a.id).toBe(dup.id); // same departure + legs → colliding id
    const out = dedupeById([a, dup, b]);
    expect(out).toEqual([a, b]);
  });

  it("returns the list unchanged when all ids are unique", () => {
    const list = [makeSummary({ legs: [makeLeg({ line: "U6" })] }), makeSummary({ legs: [makeLeg({ line: "U3" })] })];
    expect(dedupeById(list)).toEqual(list);
  });
});

describe("planChosen", () => {
  const early = makeSummary({
    departure: "2026-06-16T05:00:00.000Z",
    arrival: "2026-06-16T05:40:00.000Z",
  });
  const late = makeSummary({
    departure: "2026-06-16T05:40:00.000Z",
    arrival: "2026-06-16T06:20:00.000Z",
  });

  const overshoot = makeSummary({
    departure: "2026-06-16T06:10:00.000Z",
    arrival: "2026-06-16T06:53:00.000Z",
  });

  it("arrive-by (no deadline) picks the global latest arrival", () => {
    expect(planChosen([late, early], "arrive")).toBe(late);
  });

  it("arrive-by with a deadline picks the latest arrival within it, not an overshoot", () => {
    const target = new Date("2026-06-16T06:45:00.000Z").getTime();
    // late arrives 06:20 (on time), overshoot arrives 06:53 (after) → late wins
    expect(planChosen([early, late, overshoot], "arrive", target)).toBe(late);
  });

  it("arrive-by falls back to the least-late route when all overshoot", () => {
    const target = new Date("2026-06-16T05:00:00.000Z").getTime();
    expect(planChosen([late, early], "arrive", target)).toBe(early);
  });

  it("leave-by picks the earliest departure", () => {
    expect(planChosen([late, early], "leave")).toBe(early);
  });

  it("returns null for an empty list", () => {
    expect(planChosen([], "arrive")).toBeNull();
  });
});

describe("sortForArrival", () => {
  const a = makeSummary({ departure: "2026-06-16T06:00:00.000Z", arrival: "2026-06-16T06:20:00.000Z" });
  const b = makeSummary({ departure: "2026-06-16T06:10:00.000Z", arrival: "2026-06-16T06:40:00.000Z" });
  const over = makeSummary({ departure: "2026-06-16T06:25:00.000Z", arrival: "2026-06-16T06:53:00.000Z" });

  it("lists on-time routes latest-first, then overshoots least-late", () => {
    const target = new Date("2026-06-16T06:45:00.000Z").getTime();
    expect(sortForArrival([a, over, b], target)).toEqual([b, a, over]);
  });
});

describe("routeRelMin", () => {
  const now = new Date("2026-06-16T08:00:00.000Z");

  it("is null in a plan (show all, no live countdown)", () => {
    expect(routeRelMin(makeSummary(), now, 0, true)).toBeNull();
  });

  it("is null for tomorrow", () => {
    expect(routeRelMin(makeSummary(), now, 1, false)).toBeNull();
  });

  it("gives minutes-until-departure for today live", () => {
    const s = makeSummary({ departure: "2026-06-16T08:10:00.000Z" });
    expect(routeRelMin(s, now, 0, false)).toBe(10);
  });

  it("is negative for a route that already departed (caller hides it)", () => {
    const s = makeSummary({ departure: "2026-06-16T07:50:00.000Z" });
    expect(routeRelMin(s, now, 0, false)!).toBeLessThan(0);
  });
});

describe("route cache (readRouteCache / writeRouteCache)", () => {
  const routes = (n: string) => ({ home: [makeSummary({ legs: [makeLeg({ line: n })] })], office: null });
  const MAX = 30 * 60 * 1000;

  it("keeps distinct day×plan entries instead of overwriting", () => {
    // This is the bug that shipped: a single-entry cache lost the previous plan.
    let map = writeRouteCache(null, 0, "now:", routes("now"), 1000, MAX);
    map = writeRouteCache(map, 0, "arrive:09:00", routes("arr"), 1000, MAX);
    map = writeRouteCache(map, 0, "leave:08:00", routes("leave"), 1000, MAX);
    expect(readRouteCache(map, 0, "now:", 1000, MAX)?.routes.home![0].legs[0].line).toBe("now");
    expect(readRouteCache(map, 0, "arrive:09:00", 1000, MAX)?.routes.home![0].legs[0].line).toBe("arr");
    expect(readRouteCache(map, 0, "leave:08:00", 1000, MAX)?.routes.home![0].legs[0].line).toBe("leave");
  });

  it("scopes by day too (same plan, different day = different entry)", () => {
    const map = writeRouteCache(null, 0, "now:", routes("today"), 1000, MAX);
    expect(readRouteCache(map, 1, "now:", 1000, MAX)).toBeNull();
    expect(readRouteCache(map, 0, "now:", 1000, MAX)).not.toBeNull();
  });

  it("misses an expired entry", () => {
    const map = writeRouteCache(null, 0, "now:", routes("old"), 0, MAX);
    expect(readRouteCache(map, 0, "now:", MAX + 1, MAX)).toBeNull();
  });

  it("drops expired entries and caps to the newest N on write", () => {
    let map: ReturnType<typeof writeRouteCache> = {};
    for (let i = 0; i < 10; i++) map = writeRouteCache(map, 0, `arrive:${i}`, routes(String(i)), 1000 + i, MAX, 8);
    expect(Object.keys(map)).toHaveLength(8);
    // Oldest two evicted, newest kept.
    expect(readRouteCache(map, 0, "arrive:0", 1100, MAX)).toBeNull();
    expect(readRouteCache(map, 0, "arrive:9", 1100, MAX)).not.toBeNull();
  });

  it("tolerates a corrupt/legacy value (returns null / starts fresh)", () => {
    expect(readRouteCache({ dayIdx: 0, savedAt: 1 }, 0, "now:", 1, MAX)).toBeNull();
    expect(readRouteCache(null, 0, "now:", 1, MAX)).toBeNull();
    const map = writeRouteCache("garbage", 0, "now:", routes("x"), 1, MAX);
    expect(readRouteCache(map, 0, "now:", 1, MAX)).not.toBeNull();
  });
});

describe("resolveRouting", () => {
  it("now mode today is a live (non-arrival) query", () => {
    expect(resolveRouting(0, 9, 0, { mode: "now", time: "" }).isArrival).toBe(false);
  });

  it("now mode tomorrow uses the preset time", () => {
    const r = resolveRouting(1, 9, 15, { mode: "now", time: "" });
    expect(r.isArrival).toBe(false);
    expect([r.time.getHours(), r.time.getMinutes()]).toEqual([9, 15]);
  });

  it("leave-by pins the picked time, not an arrival", () => {
    const r = resolveRouting(0, 9, 0, { mode: "leave", time: "07:30" });
    expect(r.isArrival).toBe(false);
    expect([r.time.getHours(), r.time.getMinutes()]).toEqual([7, 30]);
  });

  it("arrive-by flips the arrival flag", () => {
    const r = resolveRouting(0, 9, 0, { mode: "arrive", time: "09:05" });
    expect(r.isArrival).toBe(true);
    expect([r.time.getHours(), r.time.getMinutes()]).toEqual([9, 5]);
  });

  it("preserves midnight rather than defaulting", () => {
    const r = resolveRouting(0, 9, 0, { mode: "leave", time: "00:00" });
    expect([r.time.getHours(), r.time.getMinutes()]).toEqual([0, 0]);
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

// --- date helpers (fake timers) --------------------------------------------

describe("dayOffInfo", () => {
  afterEach(() => vi.useRealTimers());

  it("flags a configured holiday by name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 9, 0)); // Wed 2026-06-17
    expect(dayOffInfo({ "2026-06-17": "Test Day" }, 0)).toEqual({ holiday: true, name: "Test Day" });
  });

  it("flags weekends as a non-holiday day off", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 9, 0)); // Sat
    expect(dayOffInfo({}, 0)).toEqual({ holiday: false });
  });

  it("returns null on a plain weekday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 9, 0)); // Wed
    expect(dayOffInfo({}, 0)).toBeNull();
  });
});

describe("routingDateTime", () => {
  afterEach(() => vi.useRealTimers());

  it("returns roughly now for today", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 5, 16, 8, 30);
    vi.setSystemTime(now);
    expect(routingDateTime(0, 9, 0).getTime()).toBe(now.getTime());
  });

  it("returns tomorrow at the reference time for the next day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 8, 30));
    const r = routingDateTime(1, 9, 15);
    expect(r.getDate()).toBe(17);
    expect(r.getHours()).toBe(9);
    expect(r.getMinutes()).toBe(15);
  });
});

// --- network functions (fetch mocked) --------------------------------------

function mockFetch(impl: (url: string) => unknown) {
  const fn = vi.fn(async (url: string) => ({ json: async () => impl(url) }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("enrichRealtime", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("overlays live delay/cancellation onto the matching leg", async () => {
    const board = "2026-06-16T08:00:00.000Z";
    const s = makeSummary({ legs: [makeLeg({ line: "U6", boardStationId: "gid1", boardTime: board })] });
    mockFetch(() => [
      { label: "U6", plannedDepartureTime: new Date(board).getTime(), delayInMinutes: 4, cancelled: true, occupancy: "HIGH" },
    ]);
    await enrichRealtime([s]);
    expect(s.legs[0].delayMin).toBe(4);
    expect(s.legs[0].cancelled).toBe(true);
    expect(s.legs[0].realTime).toBe(true);
    expect(s.legs[0].occupancy).toBe("HIGH");
  });

  it("leaves legs untouched when nothing matches", async () => {
    const s = makeSummary({ legs: [makeLeg({ line: "U6", boardStationId: "gid1" })] });
    mockFetch(() => [{ label: "S8", plannedDepartureTime: 0, delayInMinutes: 9 }]);
    await enrichRealtime([s]);
    expect(s.legs[0].delayMin).toBe(0);
  });
});

describe("fetchRoutes / fetchRoutesPadded", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchRoutes hits the MVG routes endpoint with both endpoints", async () => {
    const fn = mockFetch(() => []);
    await fetchRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, new Date("2026-06-16T08:00:00.000Z"));
    const url = fn.mock.calls[0][0];
    expect(url).toContain("originLatitude=1&originLongitude=2");
    expect(url).toContain("destinationLatitude=3&destinationLongitude=4");
  });

  it("fetchRoutes defaults to a departure query (isArrival=false)", async () => {
    const fn = mockFetch(() => []);
    await fetchRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, new Date());
    expect(fn.mock.calls[0][0]).toContain("routingDateTimeIsArrival=false");
  });

  it("fetchRoutes sets the arrival flag when isArrival=true", async () => {
    const fn = mockFetch(() => []);
    await fetchRoutes({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, new Date(), true);
    expect(fn.mock.calls[0][0]).toContain("routingDateTimeIsArrival=true");
  });

  it("fetchRoutesPadded caps results at 10 and dedupes by departure+line", async () => {
    const mk = (min: number) => ({
      parts: [{ from: { plannedDeparture: `2026-06-16T08:${String(min).padStart(2, "0")}:00.000Z` }, line: { label: "U6" } }],
    });
    let call = 0;
    mockFetch(() => {
      call++;
      // First page: 3 routes. Later pages: repeat the same (no gain) → loop stops.
      return call === 1 ? [mk(0), mk(5), mk(10)] : [mk(10)];
    });
    const out = await fetchRoutesPadded({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, new Date());
    expect(out).toHaveLength(3);
  });

  it("fetchRoutesPadded does NOT pad in arrival mode (single fetch, wrong direction to pad)", async () => {
    const mk = (min: number) => ({
      parts: [{ from: { plannedDeparture: `2026-06-16T08:${String(min).padStart(2, "0")}:00.000Z` }, line: { label: "U6" } }],
    });
    const fn = mockFetch(() => [mk(0), mk(5)]);
    const out = await fetchRoutesPadded({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, new Date(), true);
    expect(out).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(1); // no padding round-trips
  });
});

describe("fetchWeather", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the 2-day Berlin forecast", async () => {
    const fn = mockFetch(() => ({}));
    await fetchWeather(48.1, 11.5);
    const url = fn.mock.calls[0][0];
    expect(url).toContain("latitude=48.1&longitude=11.5");
    expect(url).toContain("forecast_days=2");
    expect(url).toContain("uv_index_max"); // drives the sunscreen tile
  });
});

describe("loadHolidays", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns a fresh cache without fetching", async () => {
    localStorage.setItem("holidays_DE_BY_2026", JSON.stringify({ savedAt: Date.now(), dates: { "2026-01-01": "Neujahr" } }));
    const fn = mockFetch(() => []);
    const out = await loadHolidays(2026);
    expect(out).toEqual({ "2026-01-01": "Neujahr" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("fetches and keeps only nationwide or Bavarian (DE-BY) holidays", async () => {
    mockFetch(() => [
      { date: "2026-01-01", name: "New Year", localName: "Neujahr", counties: null },
      { date: "2026-08-15", name: "Assumption", counties: ["DE-BY"] },
      { date: "2026-10-31", name: "Reformation", counties: ["DE-BB"] },
    ]);
    const out = await loadHolidays(2026);
    expect(out).toEqual({ "2026-01-01": "Neujahr", "2026-08-15": "Assumption" });
  });
});
