"use client";

import { OutfitTiles, WeatherIcon } from "@/components/icons/weather-icons";
import { computeOutfit, weatherInfo, type WeatherData } from "@/lib/weather";
import {
  daytimeReduce,
  homeCountry,
  sunnyHours,
  tripOverall,
  type TripPlace,
} from "@/lib/trip/logic";
import { SUNNY_HOURS } from "@/lib/weather";

export function TripResults({
  place,
  weather,
  fmtDayDate,
  t,
}: {
  place: TripPlace;
  weather: WeatherData;
  fmtDayDate: (iso: string) => string;
  t: (key: string, p?: Record<string, string | number>) => string;
}) {
  const overall = tripOverall(weather);
  const intl = place.cc !== homeCountry();

  return (
    <div>
      {overall && (
        <div className="mb-3.5 rounded-[28px] bg-primary-container p-5 text-on-primary-container">
          <div className="text-base font-semibold leading-tight">
            {t("tr.packFor", {
              place: place.short,
              from: fmtDayDate(weather.daily.time[0]),
              to: fmtDayDate(weather.daily.time[weather.daily.time.length - 1]),
            })}
          </div>
          <div className="mb-3 text-xs tabular-nums opacity-70">
            {t("tr.upTo", { min: Math.round(overall.minT), max: Math.round(overall.maxT), rain: Math.round(overall.maxRain) })}
          </div>
          <OutfitTiles
            wearKey={overall.outfit.wearKey}
            wearText={t(overall.outfit.wearTextKey)}
            jacketKey={overall.outfit.jacketKey}
            jacketText={t(overall.outfit.jacketTextKey)}
            umbrella={overall.outfit.umbrella}
            sunny={overall.sunny}
            sunscreen={overall.outfit.sunscreen}
            wearLabel={t("tr.wear")}
            outerwearLabel={t("tr.outerwear")}
            umbrellaLabel={t("tr.umbrella")}
            sunglassesLabel={t("tr.sunglasses")}
            sunscreenLabel={t("tr.sunscreen")}
            yesLabel={t("tr.yes")}
            size={28}
          />
          {intl && (
            <div className="mt-3 rounded-xl bg-current/[0.07] px-3 py-2.5 text-xs font-bold">
              {t("tr.passport", { country: place.country })}
            </div>
          )}
          <div className="mt-2.5 text-xs opacity-70">
            {t("tr.covers")}
            {overall.outfit.noteKeys.length > 0 &&
              " · " + overall.outfit.noteKeys.map((k) => t(k)).join(" · ")}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {weather.daily.time.map((date, i) => (
          <TripDayCard key={date} date={date} index={i} weather={weather} fmtDayDate={fmtDayDate} t={t} />
        ))}
      </div>
    </div>
  );
}

function TripDayCard({
  date,
  index,
  weather,
  fmtDayDate,
  t,
}: {
  date: string;
  index: number;
  weather: WeatherData;
  fmtDayDate: (iso: string) => string;
  t: (key: string, p?: Record<string, string | number>) => string;
}) {
  const code = weather.daily.weathercode[index];
  if (code == null || weather.daily.temperature_2m_max[index] == null) {
    return (
      <div className="rounded-[18px] border border-outline bg-surface-container p-3.5 text-sm text-on-surface-variant">
        <div className="font-bold">{fmtDayDate(date)}</div>
        <div>{t("tr.noData")}</div>
      </div>
    );
  }

  const [labelKey, cat] = weatherInfo(code);
  const max = Math.round(weather.daily.temperature_2m_max[index]);
  const min = Math.round(weather.daily.temperature_2m_min[index]);
  const wMin = daytimeReduce(weather, index, "apparent_temperature", Math.min, Infinity);
  const wRain = daytimeReduce(weather, index, "precipitation_probability", Math.max, 0);
  const wWind = daytimeReduce(weather, index, "windspeed_10m", Math.max, 0);
  const outfit = computeOutfit(
    wMin ?? min,
    wRain ?? weather.daily.precipitation_probability_max[index],
    wWind ?? weather.daily.windspeed_10m_max[index],
    "trip",
    weather.daily.uv_index_max?.[index] ?? null,
  );

  return (
    <div className="rounded-[18px] border border-outline bg-surface-container p-3.5">
      <div className="mb-2.5 flex items-center gap-3">
        <WeatherIcon category={cat} size={34} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{fmtDayDate(date)}</div>
          <div className="text-xs text-on-surface-variant">{t(labelKey)}</div>
        </div>
        <div className="text-xl font-extrabold tabular-nums">
          {min}° / {max}°
        </div>
      </div>
      <div className="mb-2.5 text-xs tabular-nums text-on-surface-variant">
        🌧️ {weather.daily.precipitation_probability_max[index] ?? "–"}% · 💨{" "}
        {Math.round(weather.daily.windspeed_10m_max[index])} km/h
      </div>
      <OutfitTiles
        wearKey={outfit.wearKey}
        wearText={t(outfit.wearTextKey)}
        jacketKey={outfit.jacketKey}
        jacketText={t(outfit.jacketTextKey)}
        umbrella={outfit.umbrella}
        sunny={sunnyHours(weather, index) >= SUNNY_HOURS}
        sunscreen={outfit.sunscreen}
        wearLabel={t("tr.wear")}
        outerwearLabel={t("tr.outerwear")}
        umbrellaLabel={t("tr.umbrella")}
        sunglassesLabel={t("tr.sunglasses")}
        sunscreenLabel={t("tr.sunscreen")}
        yesLabel={t("tr.yes")}
        size={28}
      />
      {outfit.noteKeys.length > 0 && (
        <div className="mt-2.5 text-xs text-on-surface-variant">
          {outfit.noteKeys.map((k) => t(k)).join(" · ")}
        </div>
      )}
    </div>
  );
}
