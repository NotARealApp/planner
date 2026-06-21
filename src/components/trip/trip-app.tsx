"use client";

import { FormEvent, useState } from "react";
import { AppHeader, PageSubtitle } from "@/components/layout/app-header";
import { ThemeToggle } from "@/components/icons/theme-toggle";
import { useI18n } from "@/context/I18nProvider";
import { useTheme } from "@/context/ThemeProvider";
import { TripForm } from "@/components/trip/trip-form";
import { TripSummaryBar, PlaceChips } from "@/components/trip/trip-summary-bar";
import { TripResults } from "@/components/trip/trip-results";
import { TripSkeleton } from "@/components/trip/trip-skeleton";
import {
  geocodeTripPlace,
  fetchTripWeather,
  tripDateRange,
  ymd,
  type TripPlace,
} from "@/lib/trip/logic";
import type { WeatherData } from "@/lib/weather";

export default function TripApp() {
  const { t, dateLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const today = new Date();
  const defaultEnd = new Date();
  defaultEnd.setDate(defaultEnd.getDate() + 5);

  const [dest, setDest] = useState("");
  const [start, setStart] = useState(ymd(today));
  const [end, setEnd] = useState(ymd(defaultEnd));
  const [status, setStatus] = useState("");
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [chosenPlace, setChosenPlace] = useState<TripPlace | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const fmtDayDate = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString(dateLocale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  async function runPlan(place: TripPlace, startDate: string, endDate: string) {
    setLoading(true);
    setStatus(t("tr.loadingFor", { place: place.short }));
    try {
      const data = await fetchTripWeather(place.lat, place.lon, startDate, endDate);
      if (!data?.daily?.time?.length) throw new Error("no forecast");
      setWeather(data);
      setChosenPlace(place);
      setCollapsed(true);
      setStatus("");
    } catch {
      setStatus(t("tr.forecastErr"));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setWeather(null);
    setPlaces([]);
    if (!dest.trim() || !start || !end) return;
    if (end < start) {
      setStatus(t("tr.endBeforeStart"));
      return;
    }
    setStatus(t("tr.finding"));
    try {
      const results = await geocodeTripPlace(dest.trim());
      if (!results.length) {
        setStatus(t("tr.noPlace", { q: dest }));
        return;
      }
      setPlaces(results);
      await runPlan(results[0], start, end);
    } catch {
      setStatus(t("tr.geoErr"));
    }
  }

  return (
    <>
      <AppHeader
        title={t("tr.title")}
        actions={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <PageSubtitle>{t("tr.subtitle")}</PageSubtitle>

      {collapsed && chosenPlace && weather ? (
        <TripSummaryBar
          place={chosenPlace}
          weather={weather}
          fmtDayDate={fmtDayDate}
          onEdit={() => setCollapsed(false)}
          t={t}
        />
      ) : (
        <TripForm
          dest={dest}
          start={start}
          end={end}
          minDate={ymd(today)}
          onDestChange={setDest}
          onStartChange={setStart}
          onEndChange={setEnd}
          onSubmit={onSubmit}
          t={t}
        />
      )}

      {places.length > 1 && !collapsed && (
        <PlaceChips
          places={places}
          active={chosenPlace}
          onSelect={(p) => runPlan(p, start, end)}
        />
      )}

      {status && <p className="my-2 min-h-[1em] text-center text-sm text-on-surface-variant">{status}</p>}

      {loading && <TripSkeleton />}

      {weather && chosenPlace && !loading && (
        <TripResults
          place={chosenPlace}
          weather={weather}
          tripDates={tripDateRange(start, end)}
          fmtDayDate={fmtDayDate}
          t={t}
        />
      )}
    </>
  );
}
