"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeProvider";
import { PageSubtitle } from "@/components/layout/app-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useDayPlanner } from "@/hooks/use-day-planner";
import { effDepartureMs, fmtMins, fmtTime } from "@/lib/dayplanner/logic";
import { cn } from "@/lib/cn";
import { DayPlannerHeader } from "./day-planner-header";
import { WeatherStrip } from "./weather-strip";
import { DayOffNote } from "./day-off-note";
import {
  DayStepper,
  HintToast,
  PullIndicator,
  StickyLeaveBar,
  UndoToast,
  UpdatedFooter,
} from "./day-stepper";
import { LeaveByCard } from "./leave-by-card";
import { OutfitCard } from "./outfit-card";
import { RoutesList } from "./routes-list";

export default function DayPlannerApp() {
  const { theme, toggleTheme } = useTheme();
  const p = useDayPlanner();
  const pRef = useRef(p);
  pRef.current = p;
  const [pullArmed, setPullArmed] = useState(false);

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
      setPullArmed(armed);
    };
    const onEnd = (e: TouchEvent) => {
      setPullArmed(false);
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

  if (!p.settings) {
    return <p className="text-sm text-on-surface-variant">{p.t("dp.loading")}</p>;
  }

  const updatedText = p.lastUpdatedAt
    ? `${Date.now() - p.lastUpdatedAt < 60000 ? p.t("dp.updatedNow") : p.t("dp.updatedAgo", { t: fmtMins(Math.floor((Date.now() - p.lastUpdatedAt) / 60000), p.t) })} · ${p.appVersion}`
    : "";

  return (
    <>
      <PullIndicator visible={p.loading || pullArmed} />

      <StickyLeaveBar
        visible={!p.leaveCardVisible && !!p.showLeaveCard && !!p.leaveTrip && p.selectedDay === 0}
        icon={p.selectedDirection === "office" ? "🏢" : "🏠"}
        time={
          p.leaveTrip
            ? p.inProgress
              ? fmtTime(p.leaveTrip.arrival)
              : fmtTime(new Date(effDepartureMs(p.leaveTrip)).toISOString())
            : ""
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
        {p.dayOff && (
          <DayOffNote
            message={p.dayOffMsg}
            showTimes={p.showLeaveOnDayOff}
            hideLabel={p.t("dp.hideTimes")}
            showLabel={p.t("dp.headingOut")}
            onToggle={() => p.setShowLeaveOnDayOff((v) => !v)}
          />
        )}

        <SegmentedControl
          ariaLabel="Direction"
          value={p.selectedDirection}
          onChange={p.setSelectedDirection}
          options={[
            { value: "office", label: p.t("dp.toWork") },
            { value: "home", label: p.t("dp.goingHome") },
          ]}
        />

        <DayStepper
          dayName={p.dayLabel(p.selectedDay)}
          dayDate={p.stepperDate}
          prevDisabled={p.selectedDay === 0}
          nextDisabled={p.selectedDay === 1}
          onPrev={() => p.setSelectedDay(0)}
          onNext={() => p.setSelectedDay(1)}
        />

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

        {p.showLeaveCard && p.leaveTrip && (
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
            t={p.t}
          />
        )}

        <OutfitCard
          title={p.t("dp.outfitFor", { day: p.dayLabel(p.selectedDay) })}
          wearKey={p.outfit?.wearKey ?? ""}
          wearTextKey={p.outfit?.wearTextKey ?? ""}
          jacketKey={p.outfit?.jacketKey ?? ""}
          jacketTextKey={p.outfit?.jacketTextKey ?? ""}
          umbrella={p.outfit?.umbrella ?? false}
          sunny={p.outfit?.sunny ?? false}
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
          chosenDeparture={p.leaveTrip?.departure}
          now={p.now}
          settings={p.settings}
          staleNote={
            !p.liveLoaded[p.selectedDirection] && p.routeCacheSavedAt > 0
              ? p.t("dp.offlineFrom", { time: fmtTime(new Date(p.routeCacheSavedAt).toISOString()) })
              : undefined
          }
          routesError={p.routesError}
          loading={p.loading}
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
