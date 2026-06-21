"use client";

import {
  fmtDuration,
  fmtMins,
  fmtTime,
  leaveTier,
  mapsUrlFor,
  routeCancelled,
  routeRelMin,
  type RouteSummary,
} from "@/lib/dayplanner/logic";
import { PLANNER_CONFIG } from "@/hooks/use-day-planner";
import { leaveTierClass } from "@/components/ui/tier";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPinIcon } from "@/components/icons/nav-icons";
import { RouteLegs } from "./route-legs";
import { cn } from "@/lib/cn";
import type { Direction } from "@/hooks/use-day-planner";
import type { PlannerSettings } from "@/lib/planner-settings";

type RoutesListProps = {
  title: string;
  summaries: RouteSummary[];
  visibleCount: number;
  selectedDay: number;
  selectedDirection: Direction;
  chosenId?: string;
  now: Date;
  settings: PlannerSettings;
  staleNote?: string;
  routesError: boolean;
  loading: boolean;
  plan?: boolean;
  onSelect: (id: string) => void;
  onShowMore: () => void;
  onRetry: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function RoutesList({
  title,
  summaries,
  visibleCount,
  selectedDay,
  selectedDirection,
  chosenId,
  now,
  settings,
  staleNote,
  routesError,
  loading,
  plan,
  onSelect,
  onShowMore,
  onRetry,
  t,
}: RoutesListProps) {
  // Match the chosen route by its stable id, not departure time — two routes can
  // share a departure minute, and matching by time highlights all of them.
  const chosenIdx = chosenId != null ? summaries.findIndex((s) => s.id === chosenId) : -1;

  // Every route from the same origin starts with the same walk to the stop, so
  // lift it out of the rows and state it once. Only when all visible routes share
  // it — otherwise each row keeps its own.
  const visible = summaries.slice(0, visibleCount);
  const walkKey = (w: RouteSummary["walk"]) => (w ? `${w.minutes}|${w.dest}` : "");
  const commonWalk =
    visible.length > 1 && visible.every((s) => s.walk && walkKey(s.walk) === walkKey(visible[0].walk))
      ? visible[0].walk
      : null;

  return (
    <section className="mb-3">
      {/* Section-header rhythm: the list title sits on the page, the routes are
          standalone cards below it (no wrapping container). */}
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2 className="text-sm font-medium text-on-surface-variant">{title}</h2>
        {staleNote && <span className="text-xs text-status-warn">{staleNote}</span>}
      </div>
      {commonWalk && (
        <p className="mb-3 px-1 text-xs text-on-surface-variant">
          🚶 {t("dp.walkTo", { min: commonWalk.minutes, dest: commonWalk.dest })}
        </p>
      )}

      {routesError ? (
        <div className="text-sm text-on-surface-variant">
          {t("dp.couldntRoutes")}{" "}
          <Button variant="soft" className="ms-2 inline min-h-8 px-3 py-1 text-xs" onClick={onRetry}>
            {t("dp.retry")}
          </Button>
        </div>
      ) : summaries.length === 0 ? (
        loading ? (
          <div className="space-y-2" aria-label={t("dp.loading")} role="status">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">{t("dp.noDepartures")}</p>
        )
      ) : (
        <>
          {visible.map((route, idx) => (
            <RouteRow
              key={route.id}
              route={route}
              showWalk={!commonWalk}
              selectedDay={selectedDay}
              plan={plan}
              isChosen={idx === chosenIdx}
              now={now}
              settings={settings}
              selectedDirection={selectedDirection}
              onSelect={onSelect}
              t={t}
            />
          ))}
          {summaries.length > visibleCount && (
            <Button variant="ghost" fullWidth className="mt-2" onClick={onShowMore}>
              {t("dp.showMore")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function RouteRow({
  route,
  showWalk,
  selectedDay,
  plan,
  isChosen,
  now,
  settings,
  selectedDirection,
  onSelect,
  t,
}: {
  route: RouteSummary;
  showWalk: boolean;
  selectedDay: number;
  plan?: boolean;
  isChosen: boolean;
  now: Date;
  settings: PlannerSettings;
  selectedDirection: Direction;
  onSelect: (id: string) => void;
  t: RoutesListProps["t"];
}) {
  const delayM = route.legs[0]?.delayMin || 0;
  const cancelled = routeCancelled(route);
  // In a leave-by/arrive-by plan, show every planned route as-is — don't hide
  // ones before "now" or overlay a live countdown (that's only for live "now").
  const diffExact = routeRelMin(route, now, selectedDay, !!plan);
  if (diffExact !== null && diffExact < 0) return null;

  const relTier =
    diffExact !== null
      ? leaveTier(Math.round(diffExact), PLANNER_CONFIG.urgentMin, PLANNER_CONFIG.soonMin)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(route.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(route.id);
        }
      }}
      className={cn(
        // Standalone card on the page (section-header rhythm). Chosen route keeps
        // the green "catch this" accent — a left bar + ring.
        "mb-2.5 cursor-pointer rounded-2xl border border-outline-variant bg-surface-container p-3.5 transition hover:bg-surface-high",
        isChosen && "border-s-4 border-s-status-good bg-status-good/10 ring-2 ring-inset ring-status-good",
      )}
    >
      {isChosen && (
        <div className="mb-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-status-good">
          ▶ {t("dp.catchThis")}
        </div>
      )}
      <div className="mb-2 text-sm font-bold">
        {fmtTime(route.departure)} → {fmtTime(route.arrival)} ({fmtDuration(route.durationMs, t)})
        {cancelled && (
          <span className="ms-2 rounded-full bg-status-bad/20 px-2 py-0.5 text-xs text-status-bad">
            {t("dp.cancelled")}
          </span>
        )}
        {!cancelled && delayM > 0 && (
          <span className="ms-2 rounded-full bg-status-warn/20 px-2 py-0.5 text-xs text-status-warn">
            {t("dp.minLate", { n: delayM })}
          </span>
        )}
        {diffExact !== null && relTier && (
          <span className={cn("ms-1 text-sm font-semibold", leaveTierClass(relTier))}>
            · {Math.round(diffExact) <= 0 ? t("dp.now") : fmtMins(Math.round(diffExact), t)}
          </span>
        )}
      </div>

      {showWalk && route.walk && (
        <p className="mb-2 text-xs text-on-surface-variant">
          🚶 {t("dp.walkTo", { min: route.walk.minutes, dest: route.walk.dest })}
        </p>
      )}

      <RouteLegs legs={route.legs} t={t} />

      <div className="mt-2">
        <Button
          variant="ghost"
          className="inline-flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            window.open(mapsUrlFor(selectedDirection, settings.home, settings.office), "_blank");
          }}
        >
          <MapPinIcon className="size-4" />
          {t("dp.openMaps")}
        </Button>
      </div>
    </div>
  );
}
