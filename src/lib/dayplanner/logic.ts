export const APP_VERSION = "v27";
export const TRANSPORT_TYPES = "SCHIFF,RUFTAXI,BAHN,REGIONAL_BUS,UBAHN,TRAM,SBAHN,BUS";

export const LINE_COLORS: Record<string, string> = {
  U1: "#438136", U2: "#C40C37", U3: "#ED6720", U4: "#00A984",
  U5: "#BC7A00", U6: "#0065AE", U7: "#C40C37", U8: "#ED6720",
  S1: "#16BAE7", S2: "#76B82A", S3: "#951B81", S4: "#E30613",
  S6: "#00975F", S7: "#943126", S8: "#000000", S20: "#ED6720",
};

export const TYPE_COLORS: Record<string, string> = {
  UBAHN: "#0065AE", SBAHN: "#00975F", TRAM: "#E2001A",
  BUS: "#00586A", REGIONAL_BUS: "#00586A", BAHN: "#5b6770",
};

export type RouteLeg = {
  line: string;
  transportType: string;
  direction: string;
  board: string;
  alight: string;
  boardStationId?: string;
  boardTime: string;
  alightTime: string;
  realTime?: boolean;
  occupancy: string;
  delayMin: number;
  realtimeBoard: string | null;
  cancelled: boolean;
  warnings: string[];
};

export type RouteSummary = {
  // Stable identity for a route across re-fetches/realtime enrichment. Derived
  // from planned (not realtime) fields, so a delay never changes it. Departure
  // time alone is NOT unique — two routes can leave at the same minute — so use
  // this, never `departure`, to match/select/highlight a specific route.
  id: string;
  departure: string;
  arrival: string;
  durationMs: number;
  walk: { minutes: number; dest: string } | null;
  legs: RouteLeg[];
};

// Pure function of a route's stable planned fields. Same shape in → same id out,
// so it can also backfill an id onto an older persisted summary that predates it.
export function routeId(s: Pick<RouteSummary, "departure" | "legs">) {
  const legKey = s.legs.map((l) => `${l.line}@${l.boardTime}>${l.alightTime}`).join("~");
  return `${s.departure}|${legKey}`;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function fmtMins(min: number, t: (k: string, p?: Record<string, string | number>) => string) {
  if (min < 60) return `${min} ${t("dp.uMin")}`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}${t("dp.uH")} ${m}${t("dp.uM")}` : `${h}${t("dp.uH")}`;
}

export function fmtDuration(ms: number, t: (k: string, p?: Record<string, string | number>) => string) {
  return fmtMins(Math.round(ms / 60000), t);
}

export function summarizeRoute(route: { parts: Array<{
  line?: { label: string; transportType: string; destination: string } | null;
  from: { name: string; plannedDeparture: string; stationGlobalId?: string };
  to: { name: string; plannedDeparture: string };
  realTime?: boolean;
  occupancy?: string;
  messages?: unknown[];
  infos?: unknown[];
}> }): RouteSummary {
  const parts = route.parts;
  let walk: RouteSummary["walk"] = null;
  let leadWalkMs = 0;
  if (parts[0].line && parts[0].line.transportType === "PEDESTRIAN") {
    leadWalkMs = new Date(parts[0].to.plannedDeparture).getTime() - new Date(parts[0].from.plannedDeparture).getTime();
    walk = { minutes: Math.round(leadWalkMs / 60000), dest: parts[0].to.name };
  }

  const legs: RouteLeg[] = parts
    .filter((p) => p.line && p.line.transportType !== "PEDESTRIAN")
    .map((p) => ({
      line: p.line!.label,
      transportType: p.line!.transportType,
      direction: p.line!.destination,
      board: p.from.name,
      alight: p.to.name,
      boardStationId: p.from.stationGlobalId,
      boardTime: p.from.plannedDeparture,
      alightTime: p.to.plannedDeparture,
      realTime: p.realTime,
      occupancy: p.occupancy || "UNKNOWN",
      delayMin: 0,
      realtimeBoard: null,
      cancelled: false,
      warnings: [...(p.messages || []), ...(p.infos || [])]
        .map((m) => (typeof m === "string" ? m : (m as { text?: string; title?: string }).text || (m as { title?: string }).title || ""))
        .filter(Boolean),
    }));

  let departure: string;
  if (legs.length && leadWalkMs) {
    departure = new Date(new Date(legs[0].boardTime).getTime() - leadWalkMs).toISOString();
  } else {
    departure = parts[0].from.plannedDeparture;
  }

  const arrival = parts[parts.length - 1].to.plannedDeparture;
  const durationMs = new Date(arrival).getTime() - new Date(departure).getTime();
  return { id: routeId({ departure, legs }), departure, arrival, durationMs, walk, legs };
}

// Guarantee unique route ids in a list: the MVG response can repeat a route, and
// a stale cache may hold legacy ids that collide. Keeps the first of each id so
// React keys (and id-based matching) stay unique. Order preserved.
export function dedupeById(summaries: RouteSummary[]) {
  const seen = new Set<string>();
  return summaries.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

// --- route cache (pure) -----------------------------------------------------
// Stored under one localStorage key as a map of `${dayIdx}:${planKey}` → entry,
// so each day × plan (now / leave / arrive at a time) keeps its own routes and
// toggling between them reuses cache instead of refetching.
export type RouteCacheEntry = {
  savedAt: number;
  routes: { home: RouteSummary[] | null; office: RouteSummary[] | null };
};
export type RouteCacheMap = Record<string, RouteCacheEntry>;

export function routeCacheKey(dayIdx: number, planKey: string) {
  return `${dayIdx}:${planKey}`;
}

export function readRouteCache(
  map: unknown,
  dayIdx: number,
  planKey: string,
  nowMs: number,
  maxAgeMs: number,
): RouteCacheEntry | null {
  if (!map || typeof map !== "object") return null;
  const e = (map as RouteCacheMap)[routeCacheKey(dayIdx, planKey)];
  if (!e || nowMs - e.savedAt > maxAgeMs) return null;
  return e;
}

export function writeRouteCache(
  map: unknown,
  dayIdx: number,
  planKey: string,
  routes: RouteCacheEntry["routes"],
  nowMs: number,
  maxAgeMs: number,
  cap = 8,
): RouteCacheMap {
  const next: RouteCacheMap = map && typeof map === "object" ? { ...(map as RouteCacheMap) } : {};
  for (const k of Object.keys(next)) {
    if (nowMs - next[k].savedAt > maxAgeMs) delete next[k];
  }
  next[routeCacheKey(dayIdx, planKey)] = { savedAt: nowMs, routes };
  // Keep only the newest `cap` entries.
  const keys = Object.keys(next).sort((a, b) => next[b].savedAt - next[a].savedAt);
  for (const k of keys.slice(cap)) delete next[k];
  return next;
}

export function routeDelayMs(s: RouteSummary) {
  const leg = s.legs[0];
  return leg && leg.delayMin ? leg.delayMin * 60000 : 0;
}

export function effDepartureMs(s: RouteSummary) {
  return new Date(s.departure).getTime() + routeDelayMs(s);
}

export function effBoardMs(s: RouteSummary) {
  const leg = s.legs[0];
  const planned = leg ? new Date(leg.boardTime).getTime() : new Date(s.departure).getTime();
  return planned + routeDelayMs(s);
}

export function routeCancelled(s: RouteSummary) {
  return s.legs.some((l) => l.cancelled);
}

// Minutes until a route departs — for the live "now" view (today, no plan) only.
// Returns null for tomorrow or a leave-by/arrive-by plan, where every route is
// shown as-is with no live countdown and no "already departed" hiding.
export function routeRelMin(
  s: RouteSummary,
  now: Date,
  selectedDay: number,
  plan: boolean,
): number | null {
  if (selectedDay !== 0 || plan) return null;
  return (effDepartureMs(s) - now.getTime()) / 60000;
}

export function lineColor(line: string, type: string) {
  if (LINE_COLORS[line]) return LINE_COLORS[line];
  if (/^N\d/i.test(line)) return "#2b2d42";
  if (/^X\d/i.test(line)) return "#6a1b9a";
  if (/^5[0-9]$|^6[0-8]$/.test(line)) return "#004f6e";
  return TYPE_COLORS[type] || "#5b6770";
}

export function leaveTier(diffMin: number, urgentMin: number, soonMin: number) {
  if (diffMin <= urgentMin) return "urgent";
  if (diffMin <= soonMin) return "soon";
  return "ok";
}

export function pickChosen(summaries: RouteSummary[], now: Date, prepBufferMin: number) {
  const cutoffMs = now.getTime() + prepBufferMin * 60000;
  let chosen = summaries[summaries.length - 1];
  for (const s of summaries) {
    if (routeCancelled(s)) continue;
    if (effDepartureMs(s) > cutoffMs) { chosen = s; break; }
  }
  return chosen;
}

const arrMs = (s: RouteSummary) => new Date(s.arrival).getTime();

// Order routes for an arrive-by plan: on-time (arriving at/before the deadline)
// first, latest arrival first (least waiting); then any that overshoot the
// deadline, least-late first, as fallbacks. MVG's arrival routing can return
// routes arriving slightly after the target, so we can't trust its order.
export function sortForArrival(summaries: RouteSummary[], targetMs: number): RouteSummary[] {
  const onTime = summaries.filter((s) => arrMs(s) <= targetMs).sort((a, b) => arrMs(b) - arrMs(a));
  const late = summaries.filter((s) => arrMs(s) > targetMs).sort((a, b) => arrMs(a) - arrMs(b));
  return [...onTime, ...late];
}

// Best route for a leave-by/arrive-by plan. Arrive-by → the latest arrival that
// still meets the deadline (least waiting); if none meet it, the least-late one.
// Leave-by → the earliest departure at/after the chosen time.
export function planChosen(
  summaries: RouteSummary[],
  mode: PlanMode,
  targetMs?: number,
): RouteSummary | null {
  if (!summaries.length) return null;
  if (mode === "arrive") {
    if (targetMs != null) {
      const ordered = sortForArrival(summaries, targetMs);
      return ordered[0]; // latest on-time, or least-late if all overshoot
    }
    return summaries.reduce((b, s) => (arrMs(s) > arrMs(b) ? s : b));
  }
  return summaries.reduce((b, s) => (effDepartureMs(s) < effDepartureMs(b) ? s : b));
}

export function chosenSummary(
  summaries: RouteSummary[],
  now: Date,
  userPick: { dir: string; id: string } | null,
  selectedDirection: string,
  prepBufferMin: number,
) {
  if (userPick && userPick.dir === selectedDirection) {
    const m = summaries.find((s) => s.id === userPick.id);
    // Keep the user's pick while it's still catchable, OR while the trip is in
    // progress (departed but not yet arrived) — don't let auto-pick advance off
    // the train they're currently on.
    if (m && (effDepartureMs(m) > now.getTime() - 60000 || now.getTime() < new Date(m.arrival).getTime())) {
      return m;
    }
  }
  return pickChosen(summaries, now, prepBufferMin);
}

// A chosen route is "in progress" today once you've left but not yet arrived.
export function isInProgress(s: RouteSummary, now: Date) {
  return effDepartureMs(s) <= now.getTime() && now.getTime() < new Date(s.arrival).getTime();
}

export function routingDateTime(dayIdx: number, refHour: number, refMinute: number) {
  if (dayIdx === 1) {
    const ref = new Date();
    ref.setDate(ref.getDate() + 1);
    ref.setHours(refHour, refMinute, 0, 0);
    return ref;
  }
  return new Date();
}

export type PlanMode = "now" | "leave" | "arrive";
export type PlanTime = { mode: PlanMode; time: string };

// Resolve the routing datetime + arrival flag for a fetch. In "now" mode this is
// the existing behaviour (today → now, tomorrow → the preset time). A "leave"/
// "arrive" plan pins the selected day at the picked HH:MM and flips the API's
// arrival flag for arrive-by.
export function resolveRouting(
  dayIdx: number,
  presetHour: number,
  presetMinute: number,
  plan: PlanTime,
): { time: Date; isArrival: boolean } {
  if (plan.mode === "now") {
    return { time: routingDateTime(dayIdx, presetHour, presetMinute), isArrival: false };
  }
  const [hh, mm] = plan.time.split(":");
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  const d = new Date();
  d.setDate(d.getDate() + dayIdx);
  d.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return { time: d, isArrival: plan.mode === "arrive" };
}

export async function enrichRealtime(summaries: RouteSummary[]) {
  const byStation: Record<string, RouteLeg[]> = {};
  for (const s of summaries) {
    const leg = s.legs[0];
    if (!leg?.boardStationId) continue;
    (byStation[leg.boardStationId] = byStation[leg.boardStationId] || []).push(leg);
  }
  await Promise.all(
    Object.keys(byStation).map(async (gid) => {
      try {
        const deps = await fetch(
          `https://www.mvg.de/api/bgw-pt/v3/departures?globalId=${encodeURIComponent(gid)}&limit=60`,
        ).then((r) => r.json()) as Array<{
          label: string;
          plannedDepartureTime: number;
          delayInMinutes?: number;
          realtimeDepartureTime?: number;
          cancelled?: boolean;
          occupancy?: string;
        }>;
        for (const leg of byStation[gid]) {
          const plannedMs = new Date(leg.boardTime).getTime();
          const m = deps.find(
            (x) => x.label === leg.line && Math.abs(x.plannedDepartureTime - plannedMs) < 60000,
          );
          if (m) {
            leg.delayMin = m.delayInMinutes || 0;
            leg.realtimeBoard = m.realtimeDepartureTime
              ? new Date(m.realtimeDepartureTime).toISOString()
              : null;
            leg.cancelled = !!m.cancelled;
            leg.realTime = true;
            if (m.occupancy) leg.occupancy = m.occupancy;
          }
        }
      } catch { /* offline */ }
    }),
  );
}

export async function fetchRoutes(
  origin: { lat: number; lon: number },
  dest: { lat: number; lon: number },
  dateTime: Date,
  isArrival = false,
) {
  const dt = dateTime.toISOString();
  const url =
    `https://www.mvg.de/api/bgw-pt/v3/routes?originLatitude=${origin.lat}&originLongitude=${origin.lon}` +
    `&destinationLatitude=${dest.lat}&destinationLongitude=${dest.lon}` +
    `&routingDateTime=${dt}&routingDateTimeIsArrival=${isArrival}&transportTypes=${TRANSPORT_TYPES}`;
  return fetch(url).then((r) => r.json());
}

export async function fetchRoutesPadded(
  origin: { lat: number; lon: number },
  dest: { lat: number; lon: number },
  dateTime: Date,
  isArrival = false,
) {
  const routes = await fetchRoutes(origin, dest, dateTime, isArrival);
  // Padding walks forward to the next departures — wrong direction for arrive-by,
  // so take the API's set as-is there.
  if (isArrival) return routes.slice(0, 10);
  let attempts = 0;
  while (routes.length < 10 && routes.length > 0 && attempts < 3) {
    const last = routes[routes.length - 1];
    const lastDep = new Date(last.parts[0].from.plannedDeparture);
    lastDep.setMinutes(lastDep.getMinutes() + 1);
    let more;
    try {
      more = await fetchRoutes(origin, dest, lastDep);
    } catch {
      break;
    }
    const seen = new Set(
      routes.map((r: { parts: Array<{ from: { plannedDeparture: string }; line?: { label: string } }> }) =>
        r.parts[0].from.plannedDeparture + (r.parts[0].line ? r.parts[0].line.label : ""),
      ),
    );
    let gained = 0;
    for (const r of more) {
      const key = r.parts[0].from.plannedDeparture + (r.parts[0].line ? r.parts[0].line.label : "");
      if (!seen.has(key)) {
        seen.add(key);
        routes.push(r);
        gained++;
      }
    }
    if (gained === 0) break;
    attempts++;
  }
  return routes.slice(0, 10);
}

export async function fetchWeather(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=Europe%2FBerlin&forecast_days=2`;
  return fetch(url).then((r) => r.json());
}

export async function loadHolidays(year: number) {
  const key = `holidays_DE_BY_${year}`;
  try {
    const c = JSON.parse(localStorage.getItem(key) || "null");
    if (c && Date.now() - c.savedAt < 30 * 24 * 3600 * 1000) return c.dates as Record<string, string>;
  } catch { /* ignore */ }
  try {
    const all = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`).then((r) => r.json()) as Array<{
      date: string;
      localName?: string;
      name: string;
      counties: string[] | null;
    }>;
    const dates: Record<string, string> = {};
    for (const h of all) {
      if (!h.counties || h.counties.includes("DE-BY")) dates[h.date] = h.localName || h.name;
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), dates }));
    return dates;
  } catch {
    return {};
  }
}

export function localYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayOffInfo(holidayMap: Record<string, string>, dayIdx: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayIdx);
  const dow = d.getDay();
  const name = holidayMap[localYmd(d)];
  if (name) return { holiday: true, name };
  if (dow === 0 || dow === 6) return { holiday: false };
  return null;
}

export function defaultDirection() {
  const h = new Date().getHours();
  return h >= 13 && h < 24 ? "home" : "office";
}

export function shortPlace(name: string) {
  return (name || "").split(",")[0].trim();
}

export function mapsUrlFor(
  direction: string,
  home: { lat: number; lon: number },
  office: { lat: number; lon: number },
) {
  const o = direction === "office" ? home : office;
  const d = direction === "office" ? office : home;
  return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lon}&destination=${d.lat},${d.lon}&travelmode=transit`;
}

export const OCCUPANCY: Record<string, [string, string]> = {
  LOW: ["occ-low", "dp.quiet"],
  MEDIUM: ["occ-med", "dp.busy"],
  HIGH: ["occ-high", "dp.packed"],
};

export const WEEKEND_QUIPS = ["dp.we1", "dp.we2", "dp.we3", "dp.we4", "dp.we5"];
export const HOLIDAY_QUIPS = ["dp.ho1", "dp.ho2", "dp.ho3"];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
