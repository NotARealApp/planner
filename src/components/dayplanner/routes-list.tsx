"use client";

import {
  effDepartureMs,
  fmtDuration,
  fmtMins,
  fmtTime,
  leaveTier,
  lineColor,
  mapsUrlFor,
  OCCUPANCY,
  routeCancelled,
  type RouteSummary,
} from "@/lib/dayplanner/logic";
import { PLANNER_CONFIG } from "@/hooks/use-day-planner";
import { leaveTierClass } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Direction } from "@/hooks/use-day-planner";
import type { PlannerSettings } from "@/lib/planner-settings";

type RoutesListProps = {
  title: string;
  summaries: RouteSummary[];
  visibleCount: number;
  selectedDay: number;
  selectedDirection: Direction;
  chosenDeparture?: string;
  now: Date;
  settings: PlannerSettings;
  staleNote?: string;
  routesError: boolean;
  loading: boolean;
  onSelect: (departure: string) => void;
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
  chosenDeparture,
  now,
  settings,
  staleNote,
  routesError,
  loading,
  onSelect,
  onShowMore,
  onRetry,
  t,
}: RoutesListProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {staleNote && <p className="mb-3 text-xs text-status-warn">{staleNote}</p>}

      {routesError ? (
        <div className="text-sm text-on-surface-variant">
          {t("dp.couldntRoutes")}{" "}
          <Button variant="soft" className="ms-2 inline min-h-8 px-3 py-1 text-xs" onClick={onRetry}>
            {t("dp.retry")}
          </Button>
        </div>
      ) : summaries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{loading ? t("dp.loading") : t("dp.noDepartures")}</p>
      ) : (
        <>
          {summaries.slice(0, visibleCount).map((route, idx) => (
            <RouteRow
              key={route.departure}
              route={route}
              index={idx}
              selectedDay={selectedDay}
              isChosen={chosenDeparture === route.departure}
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
    </Card>
  );
}

function RouteRow({
  route,
  index,
  selectedDay,
  isChosen,
  now,
  settings,
  selectedDirection,
  onSelect,
  t,
}: {
  route: RouteSummary;
  index: number;
  selectedDay: number;
  isChosen: boolean;
  now: Date;
  settings: PlannerSettings;
  selectedDirection: Direction;
  onSelect: (dep: string) => void;
  t: RoutesListProps["t"];
}) {
  const delayM = route.legs[0]?.delayMin || 0;
  const cancelled = routeCancelled(route);
  const diffExact = selectedDay === 0 ? (effDepartureMs(route) - now.getTime()) / 60000 : null;
  if (diffExact !== null && diffExact < 0) return null;

  const relTier =
    diffExact !== null
      ? leaveTier(Math.round(diffExact), PLANNER_CONFIG.urgentMin, PLANNER_CONFIG.soonMin)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(route.departure)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(route.departure)}
      className={cn(
        "mb-2 cursor-pointer rounded-2xl border-s-4 border-outline bg-surface-high p-3 transition hover:bg-surface-highest",
        isChosen && "border-s-status-good bg-status-good/10 ring-2 ring-inset ring-status-good",
      )}
    >
      {isChosen && (
        <div className="mb-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-status-good">
          ▶ {t("dp.catchThis")}
        </div>
      )}
      <div className="mb-2 text-sm font-bold">
        <span className="me-2 inline-flex size-5 items-center justify-center rounded-full bg-surface-container text-xs">
          {index + 1}
        </span>
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

      {route.walk && (
        <p className="mb-2 text-xs text-on-surface-variant">
          🚶 {t("dp.walkTo", { min: route.walk.minutes, dest: route.walk.dest })}
        </p>
      )}

      <div className="space-y-2 border-s-2 border-outline/50 ps-4">
        {route.legs.map((leg, li) => (
          <div key={li}>
            <div className="text-xs">
              <span
                className="me-1 rounded px-1.5 py-0.5 text-[0.7rem] font-bold text-white"
                style={{ background: lineColor(leg.line, leg.transportType) }}
              >
                {leg.line}
              </span>
              → {leg.direction}
              {leg.realTime && <span className="ms-2 text-status-good">● {t("dp.live")}</span>}
              {OCCUPANCY[leg.occupancy] && (
                <span className="ms-2 text-on-surface-variant">● {t(OCCUPANCY[leg.occupancy][1])}</span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">● {fmtTime(leg.boardTime)} {leg.board}</p>
            <p className="text-xs text-on-surface-variant">○ {fmtTime(leg.alightTime)} {leg.alight}</p>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Button
          variant="ghost"
          className="min-h-9 px-3 py-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            window.open(mapsUrlFor(selectedDirection, settings.home, settings.office), "_blank");
          }}
        >
          {t("dp.openMaps")}
        </Button>
      </div>
    </div>
  );
}
