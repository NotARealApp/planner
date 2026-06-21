"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { OutfitTiles } from "@/components/icons/weather-icons";

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
  t,
}: OutfitCardProps) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
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
            yesLabel={t("dp.yes")}
          />
          {notes.length > 0 && (
            <p className="mt-3 text-xs text-on-surface-variant">{notes.join(" · ")}</p>
          )}
        </>
      )}
    </Card>
  );
}
