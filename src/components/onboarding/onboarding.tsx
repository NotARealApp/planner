"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { AddressField, StatusMessage } from "@/components/settings/address-field";
import {
  ArrowRightIcon,
  BuildingIcon,
  GlobeIcon,
  HouseIcon,
  LockIcon,
} from "@/components/icons/nav-icons";
import { useI18n } from "@/context/I18nProvider";
import { useAddressSearch } from "@/hooks/use-address-search";
import type { Lang } from "@/lib/i18n";
import { DEFAULT_PLACES, savePlannerSettings, type PlannerSettings } from "@/lib/planner-settings";

export function Onboarding() {
  const { t, lang, setLanguage } = useI18n();
  const router = useRouter();
  const {
    picked,
    homeQuery,
    setHomeQuery,
    officeQuery,
    setOfficeQuery,
    homeMatches,
    officeMatches,
    status,
    statusVariant,
    setStatus,
    setStatusVariant,
    gps,
    selectPlace,
  } = useAddressSearch(t);
  function finish() {
    if (!picked.home || !picked.office) {
      setStatus(t("set.pickBoth"));
      setStatusVariant("bad");
      return;
    }
    // Times default to the usual 9–6; editable later in Settings. Onboarding
    // asks only for the two addresses it can't work without.
    const settings: PlannerSettings = {
      home: picked.home,
      office: picked.office,
      officeArrival: DEFAULT_PLACES.officeArrival,
      homeReturn: DEFAULT_PLACES.homeReturn,
      destinations: [],
    };
    savePlannerSettings(settings);
    router.push("/dayplanner");
  }

  return (
    <div className="space-y-4">
      <header className="px-1 pt-4 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t("ob.welcome")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-on-surface-variant">{t("ob.subtitle")}</p>
      </header>

      {/* Privacy reassurance — nothing leaves the device. Icon-in-circle + a
          title/body, so the promise reads as the page's anchor, not a footnote. */}
      <div className="flex items-start gap-4 rounded-[28px] bg-secondary-container px-5 py-4 text-on-secondary-container">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-on-secondary-container/10">
          <LockIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t("ob.privacyTitle")}</h2>
          <p className="mt-0.5 text-sm leading-snug opacity-90">{t("ob.privacy")}</p>
        </div>
      </div>

      <Card>
        <CardTitle className="flex items-center gap-2">
          <GlobeIcon className="size-4 text-primary" />
          {t("set.language")}
        </CardTitle>
        <Select value={lang} onChange={(e) => setLanguage(e.target.value as Lang)}>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="ml">മലയാളം</option>
          <option value="fa">فارسی</option>
        </Select>
      </Card>

      {/* Two addresses sit side-by-side on desktop, stacked on mobile. */}
      <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
        <AddressField
          title={t("set.home")}
          icon={<HouseIcon className="size-4 text-primary" />}
          query={homeQuery}
          placeholder={t("set.searchHome")}
          gpsLabel={t("set.gps")}
          noPickLabel={t("set.noPick")}
          picked={picked.home}
          matches={homeMatches}
          onQueryChange={setHomeQuery}
          onGps={() => gps("home")}
          onSelect={(p) => selectPlace("home", p)}
        />

        <AddressField
          title={t("set.office")}
          icon={<BuildingIcon className="size-4 text-primary" />}
          query={officeQuery}
          placeholder={t("set.searchOffice")}
          gpsLabel={t("set.gps")}
          noPickLabel={t("set.noPick")}
          picked={picked.office}
          matches={officeMatches}
          onQueryChange={setOfficeQuery}
          onGps={() => gps("office")}
          onSelect={(p) => selectPlace("office", p)}
        />
      </div>

      <StatusMessage message={status} variant={statusVariant} />

      <Button fullWidth onClick={finish} className="flex items-center justify-center gap-2">
        {t("ob.start")}
        <ArrowRightIcon className="size-4" />
      </Button>
    </div>
  );
}
