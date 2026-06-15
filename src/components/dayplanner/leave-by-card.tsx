"use client";

import { forwardRef } from "react";
import {
  effBoardMs,
  effDepartureMs,
  fmtMins,
  fmtTime,
  leaveTier,
  type RouteSummary,
} from "@/lib/dayplanner/logic";
import { PLANNER_CONFIG } from "@/hooks/use-day-planner";
import { leaveTierClass } from "@/components/ui/segmented-control";
import { RouteLegs } from "./route-legs";
import { cn } from "@/lib/cn";
import type { Direction } from "@/hooks/use-day-planner";

// Purple hero gradient (matches the original #leaveByCard background).
const CARD_BG =
  "linear-gradient(160deg, var(--app-primary-container), color-mix(in srgb, var(--app-primary-container) 78%, #000))";
const CARD_CLS =
  "mb-3 rounded-xl border border-primary/35 px-5 py-4 text-on-primary-container shadow-elev-1";
const PILL =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/45 bg-[var(--leave-btn-bg)] px-4 py-2 text-sm font-medium text-on-primary-container transition hover:bg-[var(--leave-btn-bg-hover)]";

type LeaveByCardProps = {
  chosen: RouteSummary;
  selectedDay: number;
  selectedDirection: Direction;
  now: Date;
  userPick: { dir: string; departure: string } | null;
  onReset: () => void;
  canNotify: boolean;
  reminderArmed: boolean;
  onToggleReminder: () => void;
  inProgress: boolean;
  nextTrip: RouteSummary | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const LeaveByCard = forwardRef<HTMLElement, LeaveByCardProps>(function LeaveByCard(
  { chosen, selectedDay, selectedDirection, now, userPick, onReset, canNotify, reminderArmed, onToggleReminder, inProgress, nextTrip, t },
  ref,
) {
  const origin = t(selectedDirection === "office" ? "dp.home" : "dp.office");
  const dest = t(selectedDirection === "office" ? "dp.toWork" : "dp.goingHome");

  // In progress — you've left, not yet arrived. Show a trip-progress card.
  if (inProgress) {
    const leave = effDepartureMs(chosen);
    const arrive = new Date(chosen.arrival).getTime();
    const frac = Math.min(1, Math.max(0, (now.getTime() - leave) / Math.max(1, arrive - leave)));
    const arriveIn = Math.max(0, Math.round((arrive - now.getTime()) / 60000));

    return (
      <section ref={ref} className={CARD_CLS} style={{ background: CARD_BG }}>
        <HeroTitle>{`${t("dp.onYourWay")} — ${dest}`}</HeroTitle>
        <LeaveColumn
          label={t("dp.arriving")}
          time={fmtTime(chosen.arrival)}
          countdown={arriveIn <= 0 ? t("dp.now") : t("dp.arriveIn", { t: fmtMins(arriveIn, t) })}
          countdownClass="font-extrabold text-status-good"
        />
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--leave-col-bg)]">
          <div className="h-full rounded-full bg-status-good transition-[width] duration-500" style={{ width: `${Math.round(frac * 100)}%` }} />
        </div>
        {chosen.walk && (
          <p className="mt-2 text-xs text-on-primary-container/70">
            🚶 {t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest })}
          </p>
        )}
        <div className="mt-3 rounded-2xl bg-[var(--leave-col-bg)] p-3">
          <RouteLegs legs={chosen.legs} t={t} now={now} tone="primary" />
        </div>
        {nextTrip &&
          nextTrip.departure !== chosen.departure &&
          effDepartureMs(nextTrip) > now.getTime() && (
            <p className="mt-2 text-center text-xs text-on-primary-container/60">
              {t("dp.nextFromHere", {
                line: nextTrip.legs[0]?.line || "walk",
                time: fmtTime(new Date(effDepartureMs(nextTrip)).toISOString()),
              })}
            </p>
          )}
      </section>
    );
  }

  // Tomorrow — static plan, no live countdown.
  if (selectedDay === 1) {
    const leaveTime = new Date(chosen.departure);
    const board = chosen.legs[0] ? new Date(chosen.legs[0].boardTime) : leaveTime;
    const line = chosen.legs[0]?.line || "walk";

    return (
      <section ref={ref} className={CARD_CLS} style={{ background: CARD_BG }}>
        <HeroTitle>
          {`${t("dp.tomorrow")} — ${t(selectedDirection === "office" ? "dp.toWork" : "dp.goingHome")}`}
        </HeroTitle>
        <div className="grid grid-cols-2 gap-3">
          <LeaveColumn label={t("dp.leaveAt", { origin })} time={fmtTime(leaveTime.toISOString())} sub={t("dp.aroundTime")} />
          <LeaveColumn label={t("dp.firstTrain", { line })} time={fmtTime(board.toISOString())} sub={t("dp.planningAhead")} />
        </div>
        <p className="mt-2 text-center text-xs text-on-primary-container/70">
          {chosen.walk ? t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest }) : t("dp.noWalk")} · {t("dp.tomorrow")}
        </p>
      </section>
    );
  }

  // Today — live countdown.
  const leaveTime = new Date(effDepartureMs(chosen));
  const departTime = new Date(effBoardMs(chosen));
  const delayMin = chosen.legs[0]?.delayMin || 0;
  const leaveDiff = Math.round((leaveTime.getTime() - now.getTime()) / 60000);
  const departDiff = Math.round((departTime.getTime() - now.getTime()) / 60000);
  const lineLabel = chosen.legs[0]?.line || "walk";

  const leaveText = leaveDiff <= 0 ? t("dp.leaveNow") : t("dp.leaveIn", { t: fmtMins(leaveDiff, t) });
  const departText = departDiff <= 0 ? t("dp.now") : fmtMins(departDiff, t);
  const leaveLevel = leaveTier(leaveDiff, PLANNER_CONFIG.urgentMin, PLANNER_CONFIG.soonMin);
  const departLevel = leaveTier(departDiff, PLANNER_CONFIG.urgentMin, PLANNER_CONFIG.soonMin);

  let depLabel = t("dp.departure", { line: lineLabel });
  if (chosen.legs[0]?.cancelled) depLabel += ` ✖ ${t("dp.cancelled")}`;
  else if (delayMin > 0) depLabel += ` · ${t("dp.minLate", { n: delayMin })}`;

  const isUserPick = !!userPick && userPick.dir === selectedDirection;

  return (
    <section ref={ref} className={CARD_CLS} style={{ background: CARD_BG }}>
      <HeroTitle>
        {`${t("dp.timeToGo")} — ${t(selectedDirection === "office" ? "dp.toWork" : "dp.goingHome")}`}
      </HeroTitle>
      <div className="grid grid-cols-2 gap-3">
        <LeaveColumn
          label={t("dp.leaveAt", { origin })}
          time={fmtTime(leaveTime.toISOString())}
          countdown={leaveText}
          countdownClass={cn("font-extrabold", leaveTierClass(leaveLevel))}
        />
        <LeaveColumn
          label={depLabel}
          time={fmtTime(departTime.toISOString())}
          countdown={departText}
          countdownClass={leaveTierClass(departLevel)}
        />
      </div>
      <p className="mt-2 text-center text-xs text-on-primary-container/70">
        {chosen.walk ? t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest }) : t("dp.noWalk")}
        {isUserPick ? ` · ${t("dp.yourPick")}` : ""}
      </p>
      {!isUserPick && (
        <p className="mt-1 text-center text-xs text-on-primary-container/55">{t("dp.tapToTrack")}</p>
      )}
      {(canNotify || isUserPick) && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {canNotify && (
            <button
              type="button"
              onClick={onToggleReminder}
              className={cn(PILL, reminderArmed && "border-primary bg-primary text-on-primary hover:bg-primary")}
            >
              {reminderArmed ? t("dp.reminderOn") : t("dp.remindMe")}
            </button>
          )}
          {isUserPick && (
            <button type="button" onClick={onReset} className={cn(PILL, "border-dashed")}>
              {t("dp.default")}
            </button>
          )}
        </div>
      )}
    </section>
  );
});

function HeroTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-on-primary-container/70">{children}</h2>
  );
}

function LeaveColumn({
  label,
  time,
  sub,
  countdown,
  countdownClass,
}: {
  label: string;
  time: string;
  sub?: string;
  countdown?: string;
  countdownClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--leave-col-bg)] px-2.5 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-on-primary-container/70">{label}</div>
      <div className="text-[1.75rem] font-bold leading-tight text-on-primary-container">{time}</div>
      {countdown && <div className={cn("mt-0.5 text-[1.05rem]", countdownClass)}>{countdown}</div>}
      {sub && <div className="mt-0.5 text-[0.78rem] text-on-primary-container/65">{sub}</div>}
    </div>
  );
}
