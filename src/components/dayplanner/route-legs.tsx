"use client";

import { fmtTime, lineColor, OCCUPANCY, type RouteLeg } from "@/lib/dayplanner/logic";
import { cn } from "@/lib/cn";

type Tone = "surface" | "primary";

const MUTED: Record<Tone, string> = {
  surface: "text-on-surface-variant",
  primary: "text-on-primary-container/75",
};
const DIVIDER: Record<Tone, string> = {
  surface: "border-outline/50",
  primary: "border-current/25",
};

// Per-leg breakdown: line badge → direction, board stop, alight stop. When
// `now` is given, the leg currently in progress is highlighted (so a rider
// mid-trip can see which leg they're on and where to change/get off).
export function RouteLegs({
  legs,
  t,
  now,
  tone = "surface",
}: {
  legs: RouteLeg[];
  t: (key: string, params?: Record<string, string | number>) => string;
  now?: Date;
  tone?: Tone;
}) {
  return (
    <div className={cn("space-y-2 border-s-2 ps-4", DIVIDER[tone])}>
      {legs.map((leg, li) => {
        const current =
          !!now &&
          new Date(leg.boardTime).getTime() <= now.getTime() &&
          now.getTime() < new Date(leg.alightTime).getTime();
        return (
          <div key={li} className={cn(current && "-ms-2 rounded-md bg-status-good/15 px-2 py-1")}>
            <div className="text-xs">
              <span
                className="me-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold text-white"
                style={{ background: lineColor(leg.line, leg.transportType) }}
              >
                {leg.line}
              </span>
              → {leg.direction}
              {current && <span className="ms-2 font-semibold text-status-good">● {t("dp.onYourWay")}</span>}
              {!current && leg.realTime && <span className="ms-2 text-status-good">● {t("dp.live")}</span>}
              {OCCUPANCY[leg.occupancy] && (
                <span className={cn("ms-2", MUTED[tone])}>● {t(OCCUPANCY[leg.occupancy][1])}</span>
              )}
            </div>
            <p className={cn("text-xs", MUTED[tone])}>● {fmtTime(leg.boardTime)} {leg.board}</p>
            <p className={cn("text-xs", MUTED[tone])}>○ {fmtTime(leg.alightTime)} {leg.alight}</p>
          </div>
        );
      })}
    </div>
  );
}
