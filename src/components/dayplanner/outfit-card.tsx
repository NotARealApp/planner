"use client";

import { Card } from "@/components/ui/card";
import { OutfitTiles } from "@/components/icons/weather-icons";
import { WeatherStrip } from "./weather-strip";
import type { WeatherData } from "@/lib/weather";

type OutfitCardProps = {
  title: string;
  wearKey: string;
  wearTextKey: string;
  jacketKey: string;
  jacketTextKey: string;
  umbrella: boolean;
  sunny: boolean;
  sunscreen: boolean;
  notes: string[];
  loading: boolean;
  weather: WeatherData | null;
  dayIdx: number;
  hourlyOpen: boolean;
  onToggleHourly: () => void;
  t: (key: string) => string;
};

export function OutfitCard({
  title,
  wearKey,
  wearTextKey,
  jacketKey,
  jacketTextKey,
  umbrella,
  sunny,
  sunscreen,
  notes,
  loading,
  weather,
  dayIdx,
  hourlyOpen,
  onToggleHourly,
  t,
}: OutfitCardProps) {
  return (
    <section className="mb-3">
      {/* Section-header rhythm: title on the page, card below — matching the
          transit list, so the screen reads as a consistent stack of sections. */}
      <h2 className="mb-3 px-1 text-sm font-medium text-on-surface-variant">{title}</h2>
      <Card className="mb-0">
        {weather && (
          <WeatherStrip data={weather} dayIdx={dayIdx} open={hourlyOpen} onToggle={onToggleHourly} t={t} />
        )}
      {loading || !wearKey ? (
        <p className="text-sm text-on-surface-variant">{t("dp.loading")}</p>
      ) : (
        <>
          <OutfitTiles
            wearKey={wearKey}
            wearText={t(wearTextKey)}
            jacketKey={jacketKey}
            jacketText={t(jacketTextKey)}
            umbrella={umbrella}
            sunny={sunny}
            sunscreen={sunscreen}
            wearLabel={t("dp.wear")}
            outerwearLabel={t("dp.outerwear")}
            umbrellaLabel={t("dp.umbrella")}
            sunglassesLabel={t("dp.sunglasses")}
            sunscreenLabel={t("dp.sunscreen")}
          />
          {notes.length > 0 && (
            <p className="mt-3 text-xs text-on-surface-variant">{notes.join(" · ")}</p>
          )}
        </>
      )}
      </Card>
    </section>
  );
}
