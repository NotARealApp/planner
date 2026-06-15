"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/context/I18nProvider";
import { loadPlannerSettings, type PlannerSettings } from "@/lib/planner-settings";
import {
  APP_VERSION,
  HOLIDAY_QUIPS,
  WEEKEND_QUIPS,
  chosenSummary,
  dayOffInfo,
  defaultDirection,
  effBoardMs,
  effDepartureMs,
  enrichRealtime,
  fetchRoutesPadded,
  fetchWeather,
  fmtTime,
  isInProgress,
  loadHolidays,
  pick,
  pickChosen,
  routeCancelled,
  routingDateTime,
  shortPlace,
  summarizeRoute,
  type RouteSummary,
} from "@/lib/dayplanner/logic";
import {
  SUNNY_HOURS,
  computeOutfit,
  daytimeApparentMin,
  daytimeMaxWind,
  daytimeMinTemp,
  daytimeRainChance,
  daytimeSunnyHours,
  type WeatherData,
} from "@/lib/weather";

export const PLANNER_CONFIG = {
  urgentMin: 4,
  soonMin: 8,
  prepBufferMin: 3,
  disruptionDelayMin: 5,
  refreshMs: 5 * 60 * 1000,
  routeCacheMaxAgeMs: 30 * 60 * 1000,
};

const ROUTE_CACHE_KEY = "planner_routes_cache";
const WEATHER_CACHE_KEY = "dayplanner_weather_cache";
const REMINDER_KEY = "leave_reminder";
const ACTIVE_TRIP_KEY = "active_trip";
// Hard cap so a trip whose arrival never passed (app closed mid-trip / corrupt
// data) can't linger forever. No real trip lasts a day.
const ACTIVE_TRIP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type ActiveTrip = { dir: string; departure: string; summary: RouteSummary; savedAt: number };

// Restore the active trip, dropping it if already arrived, too old, or invalid.
function loadActiveTrip(): ActiveTrip | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE_TRIP_KEY) || "null");
    if (!a?.summary?.arrival) return null;
    const arrived = Date.now() >= new Date(a.summary.arrival).getTime();
    const tooOld = !a.savedAt || Date.now() - a.savedAt > ACTIVE_TRIP_MAX_AGE_MS;
    if (arrived || tooOld) {
      localStorage.removeItem(ACTIVE_TRIP_KEY);
      return null;
    }
    return a as ActiveTrip;
  } catch {
    return null;
  }
}

export type Direction = "home" | "office";

export type Reminder = {
  dir: string;
  departure: string;
  leaveTs: number;
  label: string;
  line: string;
  lastDelay: number;
};

const canNotify = typeof window !== "undefined" && "Notification" in window;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const ICON = `${BASE_PATH}/icon-192.png`;

// Nuke all caches + service workers and reload fresh. Escape hatch for when a
// stale service worker won't let go of old code.
export async function forceUpdate() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  location.reload();
}

// Show a notification now. Prefer the SW registration (iOS only supports that);
// fall back to the Notification constructor elsewhere.
async function notify(title: string, body: string, tag: string) {
  if (!canNotify || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: ICON,
      badge: ICON,
      tag,
      requireInteraction: true,
    });
  } catch {
    try {
      new Notification(title, { body, icon: ICON, tag });
    } catch { /* ignore */ }
  }
}

export function useDayPlanner() {
  const { t, dateLocale } = useI18n();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedDirection, setSelectedDirection] = useState<Direction>("office");
  const [routeCache, setRouteCache] = useState<{ home: RouteSummary[] | null; office: RouteSummary[] | null }>({
    home: null,
    office: null,
  });
  const [liveLoaded, setLiveLoaded] = useState({ home: false, office: false });
  const [routeCacheSavedAt, setRouteCacheSavedAt] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [showLeaveOnDayOff, setShowLeaveOnDayOff] = useState(false);
  const [dayOffMsg, setDayOffMsg] = useState("");
  const [hourlyOpen, setHourlyOpen] = useState(false);
  const [userPick, setUserPick] = useState<{ dir: string; departure: string } | null>(null);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undo, setUndo] = useState<{ summary: RouteSummary } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [routesError, setRoutesError] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [leaveCardVisible, setLeaveCardVisible] = useState(true);
  const [, setTick] = useState(0);
  const leaveCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSettings(loadPlannerSettings());
    setHourlyOpen(localStorage.getItem("hourly_open") === "1");
    try {
      setUserPick(JSON.parse(localStorage.getItem("user_pick") || "null"));
    } catch { /* ignore */ }
    setActiveTrip(loadActiveTrip());
    setShowHints(!localStorage.getItem("hints_seen_v1"));
    const to = searchParams.get("to");
    setSelectedDirection(to === "home" || to === "office" ? to : (defaultDirection() as Direction));
  }, [searchParams]);

  const dayLabel = useCallback((dayIdx: number) => t(dayIdx === 0 ? "dp.today" : "dp.tomorrow"), [t]);

  const routesTitle = useMemo(() => {
    if (!settings) return "";
    const day = dayLabel(selectedDay);
    const place =
      selectedDirection === "home"
        ? shortPlace(settings.home.label)
        : shortPlace(settings.office.label);
    return selectedDirection === "home"
      ? t("dp.toHome", { place, day })
      : t("dp.toOffice", { place, day });
  }, [settings, selectedDay, selectedDirection, t, dayLabel]);

  const loadRouteCache = useCallback((dayIdx: number) => {
    try {
      const o = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "null");
      if (!o || o.dayIdx !== dayIdx) return null;
      if (Date.now() - o.savedAt > PLANNER_CONFIG.routeCacheMaxAgeMs) return null;
      return o as { dayIdx: number; savedAt: number; routes: { home: RouteSummary[]; office: RouteSummary[] } };
    } catch {
      return null;
    }
  }, []);

  const saveRouteCache = useCallback(
    (dayIdx: number, routes: typeof routeCache, loaded: typeof liveLoaded) => {
      if (!loaded.home && !loaded.office) return;
      try {
        localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify({ dayIdx, savedAt: Date.now(), routes }));
      } catch { /* ignore */ }
    },
    [],
  );

  const loadRoutes = useCallback(
    async (dayIdx: number, dir: Direction, places: PlannerSettings) => {
      setRoutesError(false);
      let cache: { home: RouteSummary[] | null; office: RouteSummary[] | null } = {
        home: null,
        office: null,
      };
      let loaded = { home: false, office: false };

      const cached = loadRouteCache(dayIdx);
      if (cached) {
        cache = cached.routes;
        setRouteCache(cache);
        setRouteCacheSavedAt(cached.savedAt);
      } else {
        setRouteCache({ home: null, office: null });
      }

      const fetchDir = async (
        d: Direction,
        origin: { lat: number; lon: number },
        dest: { lat: number; lon: number },
        ref: { hour: number; minute: number },
      ) => {
        try {
          const time = routingDateTime(dayIdx, ref.hour, ref.minute);
          const routes = await fetchRoutesPadded(origin, dest, time);
          cache = { ...cache, [d]: routes.map(summarizeRoute) };
          loaded = { ...loaded, [d]: true };
          setRouteCache({ ...cache });
          setLiveLoaded({ ...loaded });
          if (dayIdx === 0 && cache[d]) {
            await enrichRealtime(cache[d]);
            setRouteCache({ ...cache });
          }
        } catch {
          if (!cache[d]) setRoutesError(true);
        }
      };

      if (dir === "home") {
        await fetchDir("home", places.office, places.home, places.homeReturn);
        await fetchDir("office", places.home, places.office, places.officeArrival);
      } else {
        await fetchDir("office", places.home, places.office, places.officeArrival);
        await fetchDir("home", places.office, places.home, places.homeReturn);
      }

      setLiveLoaded(loaded);
      setRouteCacheSavedAt(Date.now());
      saveRouteCache(dayIdx, cache, loaded);
      setLastUpdatedAt(Date.now());
      setVisibleCount(5);
    },
    [loadRouteCache, saveRouteCache],
  );

  const loadAll = useCallback(async () => {
    if (!settings || loading) return;
    setLoading(true);
    try {
      const yr = new Date().getFullYear();
      const [hy, hy2] = await Promise.all([loadHolidays(yr), loadHolidays(yr + 1)]);
      setHolidayMap({ ...hy, ...hy2 });
      try {
        const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null");
        if (cached?.data) setWeatherData(cached.data);
      } catch { /* ignore */ }
      const data = await fetchWeather(settings.home.lat, settings.home.lon);
      setWeatherData(data);
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
      await loadRoutes(selectedDay, selectedDirection, settings);
    } finally {
      setLoading(false);
    }
  }, [settings, loading, selectedDay, selectedDirection, loadRoutes]);

  useEffect(() => {
    if (settings) loadAll();
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (settings) loadRoutes(selectedDay, selectedDirection, settings);
  }, [selectedDay, selectedDirection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (settings) loadAll();
    }, PLANNER_CONFIG.refreshMs);
    return () => clearInterval(id);
  }, [settings, loadAll]);

  useEffect(() => {
    const card = leaveCardRef.current;
    if (!card || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(([e]) => setLeaveCardVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(card);
    return () => obs.disconnect();
  }, []);

  // --- Leave reminder + disruption watcher ---
  const clearReminder = useCallback(() => {
    setReminder(null);
    localStorage.removeItem(REMINDER_KEY);
    if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.getNotifications) {
          reg
            .getNotifications({ tag: "leave-reminder" })
            .then((ns) => ns.forEach((n) => n.close()))
            .catch(() => {});
        }
      });
    }
  }, []);

  // Notification Triggers fire even when the app is closed (Android/Chrome);
  // elsewhere (iOS) fall back to a timer while the page is alive.
  const scheduleReminder = useCallback(
    async (r: Reminder) => {
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
      let triggered = false;
      if (
        "serviceWorker" in navigator &&
        "showTrigger" in Notification.prototype &&
        "TimestampTrigger" in window
      ) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(t("dp.leaveTitle"), {
            body: r.label,
            tag: "leave-reminder",
            icon: ICON,
            badge: ICON,
            requireInteraction: true,
            // @ts-expect-error Notification Triggers (experimental, not in lib.dom)
            showTrigger: new window.TimestampTrigger(r.leaveTs),
          });
          triggered = true;
        } catch {
          triggered = false;
        }
      }
      if (!triggered) {
        const ms = r.leaveTs - Date.now();
        if (ms > 0 && ms < 0x7fffffff) {
          reminderTimerRef.current = setTimeout(() => {
            notify(t("dp.leaveTitle"), r.label, "leave-reminder");
            clearReminder();
          }, ms);
        }
      }
    },
    [t, clearReminder],
  );

  const toggleReminder = useCallback(async () => {
    if (reminder) {
      clearReminder();
      return;
    }
    const sums = routeCache[selectedDirection];
    if (!sums || !sums.length) return;
    const ch = chosenSummary(sums, new Date(), userPick, selectedDirection, PLANNER_CONFIG.prepBufferMin);
    const leaveTs = effDepartureMs(ch);
    if (leaveTs <= Date.now()) {
      alert(t("dp.permTrip"));
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      alert(t("dp.permAsk"));
      return;
    }
    const line = ch.legs[0]?.line || "walk";
    const board = fmtTime(new Date(effBoardMs(ch)).toISOString());
    const label = t("dp.leaveBody", {
      origin: t(selectedDirection === "office" ? "dp.home" : "dp.office"),
      line,
      time: board,
    });
    const r: Reminder = {
      dir: selectedDirection,
      departure: ch.departure,
      leaveTs,
      label,
      line,
      lastDelay: ch.legs[0]?.delayMin || 0,
    };
    setReminder(r);
    localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
    await scheduleReminder(r);
  }, [reminder, clearReminder, routeCache, selectedDirection, userPick, t, scheduleReminder]);

  // Re-arm a saved reminder on load, or drop it if its leave time has passed.
  useEffect(() => {
    let r: Reminder | null = null;
    try {
      r = JSON.parse(localStorage.getItem(REMINDER_KEY) || "null");
    } catch {
      r = null;
    }
    if (!r) return;
    if (r.leaveTs <= Date.now()) clearReminder();
    else {
      setReminder(r);
      scheduleReminder(r);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While a reminder is armed, watch the chosen train: re-aim if it's cancelled,
  // or shift the leave time (and alert) when it's newly delayed.
  useEffect(() => {
    if (!reminder || reminder.dir !== selectedDirection) return;
    const sums = routeCache[selectedDirection];
    if (!sums || !sums.length) return;
    const now2 = new Date();
    const s = sums.find((x) => x.departure === reminder.departure);

    if (!s || routeCancelled(s)) {
      const next = pickChosen(sums, now2, PLANNER_CONFIG.prepBufferMin);
      if (next && !routeCancelled(next) && next.departure !== reminder.departure) {
        const oldLine = reminder.line || t("dp.yourTrain");
        const nextLine = next.legs[0]?.line || "next";
        const board = fmtTime(new Date(effBoardMs(next)).toISOString());
        const leave = fmtTime(new Date(effDepartureMs(next)).toISOString());
        const r: Reminder = {
          dir: selectedDirection,
          departure: next.departure,
          leaveTs: effDepartureMs(next),
          lastDelay: next.legs[0]?.delayMin || 0,
          line: nextLine,
          label: t("dp.leaveBody", {
            origin: t(selectedDirection === "office" ? "dp.home" : "dp.office"),
            line: nextLine,
            time: board,
          }),
        };
        setUserPick({ dir: selectedDirection, departure: next.departure });
        localStorage.setItem("user_pick", JSON.stringify({ dir: selectedDirection, departure: next.departure }));
        setReminder(r);
        localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
        scheduleReminder(r);
        notify(t("dp.cancelTitle"), t("dp.cancelBody", { old: oldLine, line: nextLine, board, leave }), "leave-reminder");
      }
      return;
    }

    const delay = s.legs[0]?.delayMin || 0;
    const newLeave = effDepartureMs(s);
    if (Math.abs(newLeave - reminder.leaveTs) > 60000) {
      const wasDelay = reminder.lastDelay || 0;
      const r: Reminder = { ...reminder, leaveTs: newLeave, lastDelay: delay, line: s.legs[0]?.line || reminder.line };
      setReminder(r);
      localStorage.setItem(REMINDER_KEY, JSON.stringify(r));
      scheduleReminder(r);
      if (delay >= PLANNER_CONFIG.disruptionDelayMin && delay > wasDelay) {
        notify(
          t("dp.lateTitle"),
          t("dp.lateBody", { line: r.line, n: delay, time: fmtTime(new Date(newLeave).toISOString()) }),
          "leave-reminder",
        );
      }
    }
  }, [reminder, selectedDirection, routeCache, t, scheduleReminder]);

  const dayOff = dayOffInfo(holidayMap, selectedDay);
  useEffect(() => {
    if (!dayOff) {
      setDayOffMsg("");
      return;
    }
    if (!dayOffMsg) {
      setDayOffMsg(
        dayOff.holiday ? t(pick(HOLIDAY_QUIPS), { n: dayOff.name! }) : t(pick(WEEKEND_QUIPS)),
      );
    }
  }, [dayOff, dayOffMsg, t]);

  const summaries = routeCache[selectedDirection] || [];
  const now = new Date();
  const chosen = summaries.length
    ? chosenSummary(summaries, now, userPick, selectedDirection, PLANNER_CONFIG.prepBufferMin)
    : null;

  // The active trip is the picked route persisted with its full RouteSummary, so
  // the progress card survives navigation and the route dropping out of the live
  // results once it has departed. Shown until arrival.
  const progressTrip =
    selectedDay === 0 &&
    activeTrip &&
    activeTrip.dir === selectedDirection &&
    isInProgress(activeTrip.summary, now)
      ? activeTrip.summary
      : null;
  const inProgress = !!progressTrip;
  // What the leave/progress card renders: the in-progress trip wins over the
  // (auto-advanced) next pick.
  const leaveTrip = progressTrip ?? chosen;
  // While in progress, the next catchable departure (e.g. if a connection is
  // missed) — shown as a slim secondary line on the progress card.
  const nextTrip = inProgress && summaries.length ? pickChosen(summaries, now, PLANNER_CONFIG.prepBufferMin) : null;

  // Drop the cached active trip once it has arrived.
  const activeArrived = !!activeTrip && now.getTime() >= new Date(activeTrip.summary.arrival).getTime();
  useEffect(() => {
    if (activeArrived) {
      setActiveTrip(null);
      localStorage.removeItem(ACTIVE_TRIP_KEY);
    }
  }, [activeArrived]);

  const outfit = useMemo(() => {
    if (!weatherData) return null;
    const rainProb = daytimeRainChance(weatherData, selectedDay);
    const wind = daytimeMaxWind(weatherData, selectedDay);
    const realMin = daytimeMinTemp(weatherData, selectedDay);
    const minTemp = daytimeApparentMin(weatherData, selectedDay);
    const base = computeOutfit(minTemp, rainProb, wind, "dayplanner");
    const notes = [...base.noteKeys.map((k) => t(k))];
    if (isFinite(realMin) && isFinite(minTemp) && Math.abs(minTemp - realMin) >= 2) {
      notes.unshift(t("dp.feelsLike", { feels: Math.round(minTemp), actual: Math.round(realMin) }));
    }
    return { ...base, notes, sunny: daytimeSunnyHours(weatherData, selectedDay) >= SUNNY_HOURS };
  }, [weatherData, selectedDay, t]);

  const setActive = (summary: RouteSummary) => {
    const a: ActiveTrip = { dir: selectedDirection, departure: summary.departure, summary, savedAt: Date.now() };
    setActiveTrip(a);
    localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(a));
  };
  const clearActive = () => {
    setActiveTrip(null);
    localStorage.removeItem(ACTIVE_TRIP_KEY);
  };

  const selectRoute = (departure: string) => {
    // Switching away from an in-progress trip → switch but offer a quick undo.
    if (inProgress && progressTrip && progressTrip.departure !== departure) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndo({ summary: progressTrip });
      undoTimerRef.current = setTimeout(() => setUndo(null), 6000);
    }
    setUserPick({ dir: selectedDirection, departure });
    localStorage.setItem("user_pick", JSON.stringify({ dir: selectedDirection, departure }));
    // Active trip is a today-only concept; don't persist tomorrow's plan as one.
    const summary = summaries.find((s) => s.departure === departure);
    if (summary && selectedDay === 0) setActive(summary);
    if (reminder && reminder.departure !== departure) clearReminder();
    leaveCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const undoSwitch = () => {
    if (!undo) return;
    const s = undo.summary;
    setUserPick({ dir: selectedDirection, departure: s.departure });
    localStorage.setItem("user_pick", JSON.stringify({ dir: selectedDirection, departure: s.departure }));
    setActive(s);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndo(null);
  };

  const resetChosen = () => {
    setUserPick(null);
    localStorage.removeItem("user_pick");
    clearActive();
    clearReminder();
  };

  const toggleHourly = () => {
    const next = !hourlyOpen;
    setHourlyOpen(next);
    localStorage.setItem("hourly_open", next ? "1" : "0");
  };

  const dismissHints = () => {
    localStorage.setItem("hints_seen_v1", "1");
    setShowHints(false);
  };

  const showLeaveCard = (summaries.length > 0 || inProgress) && (!dayOff || (selectedDay === 0 && showLeaveOnDayOff));

  const reminderArmed =
    !!reminder && reminder.dir === selectedDirection && !!chosen && reminder.departure === chosen.departure;

  // Disruption banner for the chosen train (today only): cancelled / badly late /
  // carrying a service message — surfaced above the card without scrolling.
  const disruption = (() => {
    if (selectedDay !== 0 || !chosen || !showLeaveCard) return null;
    const lineLabel = chosen.legs[0]?.line || "walk";
    const delayMin = chosen.legs[0]?.delayMin || 0;
    const warns = chosen.legs.flatMap((l) => l.warnings);
    if (routeCancelled(chosen)) return { msg: `⚠ ${lineLabel} ${t("dp.cancelled")}`, level: "bad" as const };
    if (delayMin >= PLANNER_CONFIG.disruptionDelayMin)
      return { msg: `⚠ ${lineLabel} ${t("dp.minLate", { n: delayMin })}`, level: "warn" as const };
    if (warns.length) return { msg: `⚠ ${warns[0]}`, level: "warn" as const };
    return null;
  })();

  const dateLine = new Date().toLocaleDateString(dateLocale(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stepperDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedDay);
    return d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
  })();

  return {
    t,
    settings,
    weatherData,
    selectedDay,
    setSelectedDay,
    selectedDirection,
    setSelectedDirection: (d: Direction) => {
      setSelectedDirection(d);
      setVisibleCount(5);
    },
    liveLoaded,
    routeCacheSavedAt,
    visibleCount,
    setVisibleCount,
    hourlyOpen,
    toggleHourly,
    userPick,
    lastUpdatedAt,
    loading,
    routesError,
    showHints,
    dismissHints,
    leaveCardVisible,
    leaveCardRef,
    dayOff,
    dayOffMsg,
    showLeaveOnDayOff,
    setShowLeaveOnDayOff,
    summaries,
    now,
    chosen,
    outfit,
    selectRoute,
    resetChosen,
    showLeaveCard,
    canNotify,
    reminderArmed,
    toggleReminder,
    disruption,
    inProgress,
    progressTrip,
    leaveTrip,
    nextTrip,
    undo,
    undoSwitch,
    routesTitle,
    dayLabel,
    stepperDate,
    dateLine,
    loadRoutes,
    loadAll,
    forceUpdate,
    appVersion: APP_VERSION,
  };
}
