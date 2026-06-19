"use client";

import { hourlyEntries, weatherInfo, type WeatherData } from "@/lib/weather";
import { WeatherIcon } from "@/components/icons/weather-icons";
import { cn } from "@/lib/cn";

type WeatherStripProps = {
  data: WeatherData;
  dayIdx: number;
  open: boolean;
  onToggle: () => void;
  t: (key: string) => string;
};

export function WeatherStrip({ data, dayIdx, open, onToggle, t }: WeatherStripProps) {
  const [labelKey, category] = weatherInfo(data.daily.weathercode[dayIdx] ?? 0);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="mb-4 flex w-full flex-wrap items-center gap-1.5 text-left text-sm text-on-surface-variant"
      >
        <WeatherIcon category={category} size={22} />
        <span className="font-bold tabular-nums text-on-surface">
          {Math.round(data.daily.temperature_2m_min[dayIdx])}° /{" "}
          {Math.round(data.daily.temperature_2m_max[dayIdx])}°
        </span>
        <span className="opacity-40">·</span>
        <span>{t(labelKey)}</span>
        <span className="opacity-40">·</span>
        <span>🌧️ {data.daily.precipitation_probability_max[dayIdx]}%</span>
        <span>💨 {Math.round(data.daily.windspeed_10m_max[dayIdx])} km/h</span>
        <span className={cn("ms-auto text-primary transition", open && "rotate-180")}>⌄</span>
      </button>

      {open && (
        <div className="mb-4 rounded-xl border border-outline bg-surface-container p-3.5">
          <div className="flex justify-between gap-1 overflow-x-auto">
            {hourlyEntries(data, dayIdx, 7, 2).map((e) => (
              <div key={e.hour} className="min-w-[42px] flex-1 rounded-xl bg-surface-high px-0.5 py-2 text-center">
                <div className="mb-1 text-[0.7rem] text-on-surface-variant">{e.hour}h</div>
                <div className="mb-0.5 flex justify-center">
                  <WeatherIcon category={e.category} size={24} />
                </div>
                <div className="text-sm font-bold tabular-nums">{e.temp}°</div>
                <div className="mt-0.5 text-[0.62rem] text-primary">🌧️ {e.rain}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
