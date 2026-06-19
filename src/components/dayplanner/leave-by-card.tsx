"use client";

import { forwardRef } from "react";
import {
  effBoardMs,
  effDepartureMs,
  fmtMins,
  fmtTime,
  leaveTier,
  lineColor,
  type RouteSummary,
} from "@/lib/dayplanner/logic";
import { PLANNER_CONFIG } from "@/hooks/use-day-planner";
import { RouteLegs } from "./route-legs";
import { cn } from "@/lib/cn";
import type { Direction } from "@/hooks/use-day-planner";

// M3 Expressive tonal hero. The live card's container shifts with leave urgency
// (calm primary → heads-up tertiary → urgent error) so the countdown stays
// high-contrast on-container; plan/in-progress cards stay calm primary.
const CARD = "mb-3 rounded-[28px] px-6 py-5 transition-colors duration-300";
const TIER_CARD: Record<string, string> = {
  ok: "bg-primary-container text-on-primary-container",
  soon: "bg-tertiary-container text-on-tertiary-container",
  urgent: "bg-error-container text-on-error-container",
};

// Filled-tonal pill — state layer via brightness, springy press.
const M3_PILL =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full bg-secondary-container px-5 py-2 text-sm font-medium text-on-secondary-container transition duration-200 ease-[var(--ease-spring)] hover:brightness-95 active:scale-95";
const M3_PILL_ON = "bg-primary text-on-primary hover:brightness-105";

// Label + line chip — shared header for every hero card.
function CardHead({ eyebrow, line, dotColor }: { eyebrow: string; line?: string; dotColor?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-sm font-medium opacity-80">{eyebrow}</span>
      {line && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-current/10 px-3 py-1 text-xs font-semibold">
          {dotColor && <span aria-hidden className="size-2 rounded-full" style={{ background: dotColor }} />}
          {line}
        </span>
      )}
    </div>
  );
}

type LeaveByCardProps = {
  chosen: RouteSummary;
  selectedDay: number;
  selectedDirection: Direction;
  now: Date;
  userPick: { dir: string; id: string } | null;
  onReset: () => void;
  canNotify: boolean;
  reminderArmed: boolean;
  onToggleReminder: () => void;
  inProgress: boolean;
  nextTrip: RouteSummary | null;
  plan?: { mode: string; time: string } | null;
  planMissed?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const LeaveByCard = forwardRef<HTMLElement, LeaveByCardProps>(function LeaveByCard(
  { chosen, selectedDay, selectedDirection, now, userPick, onReset, canNotify, reminderArmed, onToggleReminder, inProgress, nextTrip, plan, planMissed, t },
  ref,
) {
  const origin = t(selectedDirection === "office" ? "dp.home" : "dp.office");
  const dest = t(selectedDirection === "office" ? "dp.toWork" : "dp.goingHome");

  const line0 = chosen.legs[0];
  const dotColor = lineColor(line0?.line || "walk", line0?.transportType || "");

  // In progress — you've left, not yet arrived. Show a trip-progress card.
  if (inProgress) {
    const leave = effDepartureMs(chosen);
    const arrive = new Date(chosen.arrival).getTime();
    const frac = Math.min(1, Math.max(0, (now.getTime() - leave) / Math.max(1, arrive - leave)));
    const arriveIn = Math.max(0, Math.round((arrive - now.getTime()) / 60000));

    return (
      <section ref={ref} className={cn(CARD, TIER_CARD.ok)}>
        <CardHead eyebrow={`${t("dp.onYourWay")} · ${dest}`} line={line0?.line} dotColor={dotColor} />
        <LeaveColumn
          label={t("dp.arriving")}
          time={fmtTime(chosen.arrival)}
          countdown={arriveIn <= 0 ? t("dp.now") : t("dp.arriveIn", { t: fmtMins(arriveIn, t) })}
          countdownClass="font-extrabold text-status-good"
        />
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/15">
          <div className="h-full rounded-full bg-current transition-[width] duration-500" style={{ width: `${Math.round(frac * 100)}%` }} />
        </div>
        {chosen.walk && (
          <p className="mt-2 text-xs opacity-70">
            🚶 {t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest })}
          </p>
        )}
        <div className="mt-3 rounded-2xl bg-current/[0.07] p-3">
          <RouteLegs legs={chosen.legs} t={t} now={now} tone="primary" />
        </div>
        {nextTrip &&
          nextTrip.departure !== chosen.departure &&
          effDepartureMs(nextTrip) > now.getTime() && (
            <p className="mt-2 text-center text-xs opacity-60">
              {t("dp.nextFromHere", {
                line: nextTrip.legs[0]?.line || "walk",
                time: fmtTime(new Date(effDepartureMs(nextTrip)).toISOString()),
              })}
            </p>
          )}
      </section>
    );
  }

  // Static plan (no live countdown): tomorrow, or a leave-by/arrive-by plan.
  if (selectedDay === 1 || plan) {
    const leaveTime = new Date(chosen.departure);
    const board = chosen.legs[0] ? new Date(chosen.legs[0].boardTime) : leaveTime;
    const line = chosen.legs[0]?.line || "walk";
    const ctx = plan
      ? `${t(plan.mode === "arrive" ? "dp.arriveBy" : "dp.leaveBy")} ${plan.time}`
      : t("dp.tomorrow");

    return (
      <section ref={ref} className={cn(CARD, TIER_CARD.ok)}>
        <CardHead eyebrow={`${ctx} · ${dest}`} line={line} dotColor={dotColor} />
        <div className="grid grid-cols-2 gap-3">
          <LeaveColumn label={t("dp.leaveAt", { origin })} time={fmtTime(leaveTime.toISOString())} sub={t("dp.aroundTime")} />
          <LeaveColumn label={t("dp.firstTrain", { line })} time={fmtTime(board.toISOString())} sub={t("dp.planningAhead")} />
        </div>
        <p className="mt-2 text-center text-xs opacity-70">
          {chosen.walk ? t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest }) : t("dp.noWalk")} · {ctx}
        </p>
        {planMissed && plan && (
          <p className="mt-2 rounded-lg bg-status-warn/20 px-3 py-1.5 text-center text-xs font-medium text-status-warn">
            {t("dp.noArriveBy", { time: plan.time, earliest: fmtTime(chosen.arrival) })}
          </p>
        )}
        {plan && (canNotify || (!!userPick && userPick.dir === selectedDirection)) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {canNotify && (
              <button type="button" onClick={onToggleReminder} className={cn(M3_PILL, reminderArmed && M3_PILL_ON)}>
                {reminderArmed ? t("dp.reminderOn") : t("dp.remindMe")}
              </button>
            )}
            {!!userPick && userPick.dir === selectedDirection && (
              <button type="button" onClick={onReset} className={M3_PILL}>
                {t("dp.default")}
              </button>
            )}
          </div>
        )}
        {reminderArmed && (
          <p className="mt-2 text-center text-xs opacity-80">
            {t("dp.reminderSet", { time: fmtTime(leaveTime.toISOString()) })}
          </p>
        )}
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

  const departText = departDiff <= 0 ? t("dp.now") : fmtMins(departDiff, t);
  const leaveLevel = leaveTier(leaveDiff, PLANNER_CONFIG.urgentMin, PLANNER_CONFIG.soonMin);

  let depLabel = t("dp.departure", { line: lineLabel });
  if (chosen.legs[0]?.cancelled) depLabel += ` ✖ ${t("dp.cancelled")}`;
  else if (delayMin > 0) depLabel += ` · ${t("dp.minLate", { n: delayMin })}`;

  const isUserPick = !!userPick && userPick.dir === selectedDirection;

  return (
    <section
      ref={ref}
      className={cn(CARD, "animate-[var(--animate-pop-in)]", TIER_CARD[leaveLevel])}
    >
      <CardHead
        eyebrow={`${t("dp.timeToGo")} · ${dest}`}
        line={`${lineLabel}${delayMin > 0 ? ` · +${delayMin}` : ""}`}
        dotColor={dotColor}
      />

      <div className="text-sm font-medium opacity-80">{t("dp.leaveAt", { origin })}</div>
      <div className="text-[3.5rem] font-bold leading-none tracking-tight tabular-nums">
        {leaveDiff <= 0 ? t("dp.leaveNow") : fmtMins(leaveDiff, t)}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-current/[0.07] px-4 py-3">
        <div>
          <div className="text-xs font-medium opacity-70">{depLabel}</div>
          <div className="text-lg font-semibold tabular-nums">{fmtTime(departTime.toISOString())}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{departText}</div>
      </div>

      <p className="mt-3 text-xs opacity-70">
        {chosen.walk ? t("dp.walkTo", { min: chosen.walk.minutes, dest: chosen.walk.dest }) : t("dp.noWalk")}
        {isUserPick ? ` · ${t("dp.yourPick")}` : ""}
      </p>
      {!isUserPick && <p className="mt-1 text-xs opacity-55">{t("dp.tapToTrack")}</p>}

      {(canNotify || isUserPick) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canNotify && (
            <button type="button" onClick={onToggleReminder} className={cn(M3_PILL, reminderArmed && M3_PILL_ON)}>
              {reminderArmed ? t("dp.reminderOn") : t("dp.remindMe")}
            </button>
          )}
          {isUserPick && (
            <button type="button" onClick={onReset} className={M3_PILL}>
              {t("dp.default")}
            </button>
          )}
        </div>
      )}
      {reminderArmed && (
        <p className="mt-2 text-xs opacity-80">
          {t("dp.reminderSet", { time: fmtTime(leaveTime.toISOString()) })}
        </p>
      )}
    </section>
  );
});

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
    <div className="rounded-2xl bg-current/[0.07] px-3 py-3 text-center">
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="text-[1.75rem] font-bold leading-tight tabular-nums">{time}</div>
      {countdown && <div className={cn("mt-0.5 text-base font-semibold", countdownClass)}>{countdown}</div>}
      {sub && <div className="mt-0.5 text-xs opacity-65">{sub}</div>}
    </div>
  );
}
