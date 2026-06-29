"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { AppHeader, PageSubtitle } from "@/components/layout/app-header";
import { GlobeIcon, HouseIcon, BuildingIcon } from "@/components/icons/nav-icons";
import { ThemeToggle } from "@/components/icons/theme-toggle";
import { AddressField, StatusMessage, TimeFields } from "@/components/settings/address-field";
import { useI18n } from "@/context/I18nProvider";
import { useTheme } from "@/context/ThemeProvider";
import { useAddressSearch } from "@/hooks/use-address-search";
import type { Lang } from "@/lib/i18n";
import {
  loadPlannerSettings,
  resetPlannerSettings,
  savePlannerSettings,
  type PlannerSettings,
} from "@/lib/planner-settings";
import { haversineKm, hhmm } from "@/lib/settings/geocoding";

export default function SettingsApp() {
  const { t, lang, setLanguage } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const {
    picked,
    setPicked,
    homeQuery,
    setHomeQuery,
    officeQuery,
    setOfficeQuery,
    homeMatches,
    officeMatches,
    setHomeMatches,
    setOfficeMatches,
    status,
    statusVariant,
    setStatus,
    setStatusVariant,
    gps,
    selectPlace,
  } = useAddressSearch(t);
  const [arrival, setArrival] = useState("09:00");
  const [returnTime, setReturnTime] = useState("18:00");
  const [testResult, setTestResult] = useState("");

  const load = useCallback(() => {
    const s = loadPlannerSettings();
    setPicked({ home: s.home, office: s.office });
    setArrival(hhmm(s.officeArrival));
    setReturnTime(hhmm(s.homeReturn));
    setHomeMatches([]);
    setOfficeMatches([]);
  }, [setPicked, setHomeMatches, setOfficeMatches]);

  useEffect(() => {
    load();
  }, [load]);

  function readTimes() {
    // Fall back only on a non-numeric value — `0` (midnight) is valid, so don't
    // use `||`, which would turn 00:00 into the default hour.
    const part = (s: string, i: number, def: number) => {
      const n = parseInt(s.split(":")[i], 10);
      return Number.isNaN(n) ? def : n;
    };
    return {
      officeArrival: { hour: part(arrival, 0, 9), minute: part(arrival, 1, 0) },
      homeReturn: { hour: part(returnTime, 0, 18), minute: part(returnTime, 1, 0) },
    };
  }

  function save() {
    if (!picked.home || !picked.office) {
      setStatus(t("set.pickBoth"));
      setStatusVariant("bad");
      return;
    }
    // Keep any destinations the Places page saved — they live in the same blob
    // but this form doesn't edit them, so re-read them fresh and pass through.
    const settings: PlannerSettings = {
      home: picked.home,
      office: picked.office,
      ...readTimes(),
      destinations: loadPlannerSettings().destinations,
    };
    savePlannerSettings(settings);
    setStatus(t("set.savedOk"));
    setStatusVariant("ok");
  }

  async function testRoute() {
    if (!picked.home || !picked.office) {
      setStatus(t("set.pickBothTest"));
      setStatusVariant("bad");
      return;
    }
    setTestResult(t("set.testing"));
    const km = haversineKm(picked.home, picked.office);
    if (km < 0.1) {
      setTestResult(t("set.testSame"));
      return;
    }
    if (km > 200) setTestResult(t("set.testFar", { km: Math.round(km) }));
    try {
      const url =
        `https://www.mvg.de/api/bgw-pt/v3/routes?originLatitude=${picked.home.lat}&originLongitude=${picked.home.lon}` +
        `&destinationLatitude=${picked.office.lat}&destinationLongitude=${picked.office.lon}` +
        `&routingDateTime=${new Date().toISOString()}&routingDateTimeIsArrival=false` +
        `&transportTypes=SCHIFF,RUFTAXI,BAHN,REGIONAL_BUS,UBAHN,TRAM,SBAHN,BUS`;
      const routes = await fetch(url).then((r) => r.json());
      setTestResult(Array.isArray(routes) && routes.length ? t("set.testOk") : t("set.testNone"));
    } catch {
      setTestResult(t("set.testErr"));
    }
  }

  return (
    <>
      <AppHeader
        title={t("set.title")}
        actions={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <PageSubtitle>{t("set.subtitle")}</PageSubtitle>

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

      <TimeFields
        title={t("set.times")}
        arrivalLabel={t("set.arrival")}
        returnLabel={t("set.return")}
        arrival={arrival}
        returnTime={returnTime}
        onArrivalChange={setArrival}
        onReturnChange={setReturnTime}
      />

      <Card>
        <CardTitle>{t("set.check")}</CardTitle>
        <Button variant="tonal" fullWidth onClick={testRoute}>
          {t("set.testBtn")}
        </Button>
        {testResult && <p className="mt-2.5 text-sm">{testResult}</p>}
      </Card>

      <StatusMessage message={status} variant={statusVariant} />

      <div className="mt-1 flex gap-2.5">
        <Button
          variant="ghost"
          fullWidth
          onClick={() => {
            resetPlannerSettings();
            load();
            setStatus(t("set.resetOk"));
            setStatusVariant("ok");
            setTestResult("");
          }}
        >
          {t("set.reset")}
        </Button>
        <Button fullWidth onClick={save}>
          {t("set.save")}
        </Button>
      </div>
    </>
  );
}
