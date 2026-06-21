"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeProvider";
import { PageSubtitle } from "@/components/layout/app-header";
import { useDayPlanner } from "@/hooks/use-day-planner";
import { effDepartureMs, fmtMins, fmtTime, lineColor } from "@/lib/dayplanner/logic";
import { ArrowRightIcon, BuildingIcon, HouseIcon } from "@/components/icons/nav-icons";
import { cn } from "@/lib/cn";
import { DayPlannerHeader } from "./day-planner-header";
import { WeatherStrip } from "./weather-strip";
import { DayOffNote } from "./day-off-note";
import { SlideToggle } from "./slide-toggle";
import {
  HintToast,
  StickyLeaveBar,
  UndoToast,
  UpdatedFooter,
} from "./day-stepper";
import { DayPlannerSkeleton } from "./day-planner-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveByCard } from "./leave-by-card";
import { OutfitCard } from "./outfit-card";
import { PlanTimePicker } from "./plan-time-picker";
import { RoutesList } from "./routes-list";

export default function DayPlannerApp() {
  const { theme, toggleTheme } = useTheme();
  const p = useDayPlanner();
  // Latest-value ref so the once-registered touch handlers read fresh state.
  const pRef = useRef(p);
  useEffect(() => {
    pRef.current = p;
  });
  // Touch gestures: pull-to-refresh + swipe to switch direction.
  useEffect(() => {
    const PULL_THRESHOLD = 70;
    const SWIPE_THRESHOLD = 60;
    let startY: number | null = null;
    let startX = 0;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = window.scrollY === 0 ? e.touches[0].clientY : null;
      armed = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null || pRef.current.loading) return;
      armed = e.touches[0].clientY - startY > PULL_THRESHOLD;
    };
    const onEnd = (e: TouchEvent) => {
      if (armed) pRef.current.loadAll();
      armed = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = startY == null ? 0 : e.changedTouches[0].clientY - startY;
      // Swipe left → Going Home, swipe right → To Work (matches toggle order).
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        pRef.current.setSelectedDirection(dx < 0 ? "home" : "office");
      }
      startY = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  // Full-screen skeleton only until weather is ready (fast). Once it paints,
  // the real screen shows weather + outfit immediately and RoutesList renders
  // its own skeleton for the slow MVG transport fetch — no 5s full-screen wait.
  if (!p.settings || !p.weatherData) {
    return (
      <>
        <DayPlannerHeader
          title={p.t("dp.title")}
          homeLabel={p.t("a11y.home")}
          settingsLabel={p.t("a11y.settings")}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {p.dateLine && <PageSubtitle>{p.dateLine}</PageSubtitle>}
        <DayPlannerSkeleton />
      </>
    );
  }

  const sinceUpdate = p.now.getTime() - (p.lastUpdatedAt ?? 0);
  const updatedText = p.lastUpdatedAt
    ? `${sinceUpdate < 60000 ? p.t("dp.updatedNow") : p.t("dp.updatedAgo", { t: fmtMins(Math.floor(sinceUpdate / 60000), p.t) })} · ${p.appVersion}`
    : "";

  return (
    <>
      <StickyLeaveBar
        visible={!p.leaveCardVisible && !!p.showLeaveCard && !!p.leaveTrip && p.selectedDay === 0}
        icon={p.selectedDirection === "office" ? <BuildingIcon className="size-4" /> : <HouseIcon className="size-4" />}
        time={
          p.leaveTrip
            ? p.inProgress
              ? fmtTime(p.leaveTrip.arrival)
              : fmtTime(new Date(effDepartureMs(p.leaveTrip)).toISOString())
            : ""
        }
        line={p.leaveTrip?.legs[0]?.line}
        dotColor={
          p.leaveTrip?.legs[0]
            ? lineColor(p.leaveTrip.legs[0].line, p.leaveTrip.legs[0].transportType)
            : undefined
        }
        onClick={() => p.leaveCardRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <DayPlannerHeader
        title={p.t("dp.title")}
        homeLabel={p.t("a11y.home")}
        settingsLabel={p.t("a11y.settings")}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <PageSubtitle>{p.dateLine}</PageSubtitle>

      {p.weatherData && (
        <WeatherStrip
          data={p.weatherData}
          dayIdx={p.selectedDay}
          open={p.hourlyOpen}
          onToggle={p.toggleHourly}
          t={p.t}
        />
      )}

      <main>
        <div className="mb-3 flex items-center justify-between gap-2">
          <SlideToggle
            ariaLabel="Direction"
            value={p.selectedDirection}
            onChange={p.setSelectedDirection}
            options={[
              {
                value: "office",
                label: (
                  <span className="flex items-center gap-1">
                    <HouseIcon className="size-4" />
                    <ArrowRightIcon className="size-3 opacity-70" />
                    <BuildingIcon className="size-4" />
                  </span>
                ),
                srLabel: p.t("dp.toWork"),
              },
              {
                value: "home",
                label: (
                  <span className="flex items-center gap-1">
                    <BuildingIcon className="size-4" />
                    <ArrowRightIcon className="size-3 opacity-70" />
                    <HouseIcon className="size-4" />
                  </span>
                ),
                srLabel: p.t("dp.goingHome"),
              },
            ]}
          />
          <SlideToggle
            ariaLabel="Day"
            value={p.selectedDay === 0 ? "today" : "tomorrow"}
            onChange={(v) => p.setSelectedDay(v === "today" ? 0 : 1)}
            options={[
              { value: "today", label: p.dayLabel(0) },
              { value: "tomorrow", label: p.dayLabel(1) },
            ]}
          />
        </div>

        <PlanTimePicker value={p.planTime} onChange={p.setPlanTime} t={p.t} />

        {p.disruption && (
          <div
            className={cn(
              "mb-3 rounded-xl px-3 py-2 text-sm font-semibold",
              p.disruption.level === "bad"
                ? "bg-status-bad/15 text-status-bad"
                : "bg-status-warn/15 text-status-warn",
            )}
          >
            {p.disruption.msg}
          </div>
        )}

        {/* One slot: on a day off show the "no office" note in the Time-to-Go
            position; once the user heads out (or any workday) the route card
            takes the same spot — so the slot never appears/disappears. */}
        {p.dayOff && !(p.selectedDay === 0 && p.showLeaveOnDayOff) ? (
          <DayOffNote
            message={p.dayOffMsg}
            showTimes={false}
            hideLabel={p.t("dp.hideTimes")}
            showLabel={p.t("dp.headingOut")}
            onToggle={() => p.setShowLeaveOnDayOff(true)}
          />
        ) : p.showLeaveCard && p.leaveTrip ? (
          <LeaveByCard
            ref={p.leaveCardRef}
            chosen={p.leaveTrip}
            selectedDay={p.selectedDay}
            selectedDirection={p.selectedDirection}
            now={p.now}
            userPick={p.userPick}
            onReset={p.resetChosen}
            canNotify={p.canNotify}
            reminderArmed={p.reminderArmed}
            onToggleReminder={p.toggleReminder}
            inProgress={p.inProgress}
            nextTrip={p.nextTrip}
            plan={p.planActive ? p.planTime : null}
            planMissed={p.planMissed}
            t={p.t}
          />
        ) : p.loading && !p.routesError ? (
          // MVG routes still loading (first load or day-switch refetch) — hold the
          // slot with a hero skeleton instead of a gap / stale flash.
          <Skeleton className="mb-3 h-40 rounded-[28px]" />
        ) : null}

        <OutfitCard
          title={p.t("dp.outfitFor", { day: p.dayLabel(p.selectedDay) })}
          wearKey={p.outfit?.wearKey ?? ""}
          wearTextKey={p.outfit?.wearTextKey ?? ""}
          jacketKey={p.outfit?.jacketKey ?? ""}
          jacketTextKey={p.outfit?.jacketTextKey ?? ""}
          umbrella={p.outfit?.umbrella ?? false}
          sunny={p.outfit?.sunny ?? false}
          sunscreen={p.outfit?.sunscreen ?? false}
          notes={p.outfit?.notes ?? []}
          loading={!p.outfit}
          t={p.t}
        />

        <RoutesList
          title={p.routesTitle}
          summaries={p.summaries}
          visibleCount={p.visibleCount}
          selectedDay={p.selectedDay}
          selectedDirection={p.selectedDirection}
          chosenId={p.leaveTrip?.id}
          now={p.now}
          settings={p.settings}
          staleNote={
            !p.liveLoaded[p.selectedDirection] && p.routeCacheSavedAt > 0
              ? p.t("dp.offlineFrom", { time: fmtTime(new Date(p.routeCacheSavedAt).toISOString()) })
              : undefined
          }
          routesError={p.routesError}
          loading={p.loading}
          plan={p.planActive}
          onSelect={p.selectRoute}
          onShowMore={() => p.setVisibleCount(10)}
          onRetry={() => p.loadRoutes(p.selectedDay, p.selectedDirection, p.settings!)}
          t={p.t}
        />
      </main>

      <UpdatedFooter
        text={updatedText}
        stale={!!p.lastUpdatedAt && Date.now() - p.lastUpdatedAt >= 6 * 60000}
        forceLabel={p.t("dp.forceUpdate")}
        onForceUpdate={p.forceUpdate}
      />

      {p.undo && (
        <UndoToast
          message={p.t("dp.switched", { line: p.undo.summary.legs[0]?.line || "" })}
          actionLabel={p.t("dp.undo")}
          onAction={p.undoSwitch}
        />
      )}

      {!p.undo && p.showHints && (
        <HintToast message={p.t("dp.hint")} dismissLabel={p.t("dp.gotIt")} onDismiss={p.dismissHints} />
      )}
    </>
  );
}
