"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader, PageSubtitle } from "@/components/layout/app-header";
import { ThemeToggle } from "@/components/icons/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, FieldLabel } from "@/components/ui/input";
import { AddressField } from "@/components/settings/address-field";
import { SlideToggle } from "@/components/dayplanner/slide-toggle";
import { RouteLegs } from "@/components/dayplanner/route-legs";
import {
  HouseIcon,
  BuildingIcon,
  MapPinIcon,
  EditIcon,
  TrashIcon,
} from "@/components/icons/nav-icons";
import { useI18n } from "@/context/I18nProvider";
import { useTheme } from "@/context/ThemeProvider";
import {
  loadPlannerSettings,
  saveDestinations,
  type Destination,
  type Place,
  type PlannerSettings,
} from "@/lib/planner-settings";
import { geocodeAddress, reverseGeocode } from "@/lib/settings/geocoding";
import { fetchOccupancy, occLevel, isMcfit, type Occupancy, type OccLevel } from "@/lib/gym";
import { cn } from "@/lib/cn";
import {
  fetchRoutesPadded,
  summarizeRoute,
  dedupeById,
  fmtTime,
  fmtDuration,
  type RouteSummary,
} from "@/lib/dayplanner/logic";

// A place is "set" once it has real coords — EMPTY_PLACE is (0,0).
const isSet = (p: Place) => p.lat !== 0 || p.lon !== 0;

function mapsUrl(origin: Place, dest: Place) {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${dest.lat},${dest.lon}&travelmode=transit`;
}

type FormState = {
  id: string | null; // null = adding new, else editing
  label: string;
  origin: "home" | "office";
  picked: Place | null;
  query: string;
  matches: Place[];
  gymStudioId: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  label: "",
  origin: "home",
  picked: null,
  query: "",
  matches: [],
  gymStudioId: "",
};

type RouteState = { status: "loading" | "error" | "ok"; list: RouteSummary[] };

export default function PlacesApp() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteState>>({});

  useEffect(() => {
    setSettings(loadPlannerSettings());
  }, []);

  // Debounced address search for the form's location picker — mirrors the
  // Settings page behaviour without pulling in its home/office-paired hook.
  useEffect(() => {
    const q = form?.query ?? "";
    if (q.length < 3) {
      setForm((f) => (f ? { ...f, matches: [] } : f));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await geocodeAddress(q);
        setForm((f) => (f ? { ...f, matches: results } : f));
      } catch {
        setError(t("set.geoErr"));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form?.query, t]);

  const persist = useCallback((next: Destination[]) => {
    saveDestinations(next);
    setSettings((s) => (s ? { ...s, destinations: next } : s));
  }, []);

  const loadRoutes = useCallback(
    async (dest: Destination, s: PlannerSettings) => {
      const origin = s[dest.origin];
      setRoutes((r) => ({ ...r, [dest.id]: { status: "loading", list: [] } }));
      try {
        const raw = await fetchRoutesPadded(origin, dest.place, new Date());
        const list = dedupeById((raw as Parameters<typeof summarizeRoute>[0][]).map(summarizeRoute));
        setRoutes((r) => ({ ...r, [dest.id]: { status: "ok", list } }));
      } catch {
        setRoutes((r) => ({ ...r, [dest.id]: { status: "error", list: [] } }));
      }
    },
    [],
  );

  function toggleOpen(dest: Destination) {
    if (!settings) return;
    if (openId === dest.id) {
      setOpenId(null);
      return;
    }
    setOpenId(dest.id);
    if (!routes[dest.id]) loadRoutes(dest, settings);
  }

  function startEdit(dest: Destination) {
    setError("");
    setForm({
      id: dest.id,
      label: dest.label,
      origin: dest.origin,
      picked: dest.place,
      query: "",
      matches: [],
      gymStudioId: dest.gymStudioId ?? "",
    });
  }

  function gps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setForm((f) =>
          f
            ? { ...f, picked: place, matches: [], query: "", gymStudioId: isMcfit(place.label) || isMcfit(f.label) ? f.gymStudioId : "" }
            : f,
        );
      } catch {
        setError(t("set.locErr"));
      }
    });
  }

  function saveForm() {
    if (!form || !settings) return;
    if (!form.label.trim()) {
      setError(t("places.needName"));
      return;
    }
    if (!form.picked) {
      setError(t("places.pickPlace"));
      return;
    }
    const entry: Destination = {
      id: form.id ?? crypto.randomUUID(),
      label: form.label.trim(),
      origin: form.origin,
      place: form.picked,
      gymStudioId: form.gymStudioId.replace(/\D/g, "") || undefined,
    };
    const next = form.id
      ? settings.destinations.map((d) => (d.id === form.id ? entry : d))
      : [...settings.destinations, entry];
    persist(next);
    // Edited destination's cached routes are now stale — drop them.
    setRoutes((r) => {
      const { [entry.id]: _drop, ...rest } = r;
      return rest;
    });
    setForm(null);
    setError("");
  }

  function remove(id: string) {
    if (!settings) return;
    persist(settings.destinations.filter((d) => d.id !== id));
    if (openId === id) setOpenId(null);
  }

  const anchorsReady = settings && (isSet(settings.home) || isSet(settings.office));

  return (
    <>
      <AppHeader
        title={t("places.title")}
        actions={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <PageSubtitle>{t("places.subtitle")}</PageSubtitle>

      {settings && !anchorsReady && (
        <Card>
          <p className="text-sm text-on-surface-variant">{t("places.setAnchors")}</p>
        </Card>
      )}

      {settings?.destinations.length === 0 && !form && (
        <p className="px-1 py-6 text-center text-sm text-on-surface-variant">{t("places.empty")}</p>
      )}

      <div className="space-y-3">
        {settings?.destinations.map((dest) => (
          <DestinationCard
            key={dest.id}
            dest={dest}
            origin={settings[dest.origin]}
            open={openId === dest.id}
            routes={routes[dest.id]}
            onToggle={() => toggleOpen(dest)}
            onEdit={() => startEdit(dest)}
            onDelete={() => remove(dest.id)}
            onRetry={() => loadRoutes(dest, settings)}
            t={t}
          />
        ))}
      </div>

      {form ? (
        <Card className="mt-3">
          <CardTitle>{form.id ? t("places.name") : t("places.add")}</CardTitle>

          <FieldLabel>{t("places.name")}</FieldLabel>
          <Input
            value={form.label}
            placeholder={t("places.namePh")}
            onChange={(e) => setForm((f) => (f ? { ...f, label: e.target.value } : f))}
          />

          <div className="mt-3">
            <FieldLabel>{t("places.from")}</FieldLabel>
            <SlideToggle
              ariaLabel={t("places.from")}
              fullWidth
              value={form.origin}
              onChange={(v) => setForm((f) => (f ? { ...f, origin: v } : f))}
              options={[
                {
                  value: "home",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <HouseIcon className="size-4" /> {t("places.fromHome")}
                    </span>
                  ),
                },
                {
                  value: "office",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <BuildingIcon className="size-4" /> {t("places.fromOffice")}
                    </span>
                  ),
                },
              ]}
            />
          </div>

          <div className="mt-3">
            <AddressField
              title={t("places.searchPlace")}
              icon={<MapPinIcon className="size-4 text-primary" />}
              query={form.query}
              placeholder={t("places.searchPlace")}
              gpsLabel={t("set.gps")}
              noPickLabel={t("set.noPick")}
              picked={form.picked}
              matches={form.matches}
              onQueryChange={(q) => setForm((f) => (f ? { ...f, query: q } : f))}
              onGps={gps}
              onSelect={(p) =>
                setForm((f) =>
                  f
                    ? { ...f, picked: p, matches: [], query: "", gymStudioId: isMcfit(p.label) || isMcfit(f.label) ? f.gymStudioId : "" }
                    : f,
                )
              }
            />
          </div>

          {/* Studio id is McFit-specific — show the field once either the picked
              location or the name says McFit, so naming it "McFit …" is enough
              even if the picked address (or GPS) doesn't carry the POI name. */}
          {(isMcfit(form.label) || (form.picked && isMcfit(form.picked.label))) && (
            <div className="mt-3">
              <FieldLabel>{t("places.gymId")}</FieldLabel>
              <Input
                value={form.gymStudioId}
                inputMode="numeric"
                placeholder={t("places.gymIdPh")}
                onChange={(e) => setForm((f) => (f ? { ...f, gymStudioId: e.target.value } : f))}
              />
              <p className="mt-1 text-xs text-on-surface-variant">{t("places.gymIdHint")}</p>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-status-bad">{error}</p>}

          <div className="mt-3 flex gap-2.5">
            <Button variant="ghost" fullWidth onClick={() => { setForm(null); setError(""); }}>
              {t("places.cancel")}
            </Button>
            <Button fullWidth onClick={saveForm}>
              {t("places.save")}
            </Button>
          </div>
        </Card>
      ) : (
        anchorsReady && (
          <Button className="mt-3" fullWidth onClick={() => { setError(""); setForm(EMPTY_FORM); }}>
            + {t("places.add")}
          </Button>
        )
      )}
    </>
  );
}

function DestinationCard({
  dest,
  origin,
  open,
  routes,
  onToggle,
  onEdit,
  onDelete,
  onRetry,
  t,
}: {
  dest: Destination;
  origin: Place;
  open: boolean;
  routes?: RouteState;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [confirming, setConfirming] = useState(false);
  const OriginIcon = dest.origin === "home" ? HouseIcon : BuildingIcon;
  const originLabel = dest.origin === "home" ? t("places.fromHome") : t("places.fromOffice");

  return (
    <Card>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-start"
          aria-expanded={open}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <MapPinIcon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{dest.label}</span>
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <OriginIcon className="size-3.5" />
              {t("places.from")} {originLabel}
            </span>
          </span>
        </button>
        {confirming ? (
          // Two-step delete: removing a saved place is irreversible, so the first
          // tap arms it and the second confirms. Tapping anything else cancels.
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-high"
            >
              {t("places.cancel")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full bg-status-bad px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              {t("places.delete")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("places.edit")}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-high"
            >
              <EditIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={t("places.delete")}
              className="rounded-full p-2 text-status-bad hover:bg-status-bad/10"
            >
              <TrashIcon className="size-4" />
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-outline-variant pt-3">
          {dest.gymStudioId && <GymOccupancy studioId={dest.gymStudioId} t={t} />}
          <h3 className="mb-2 text-sm font-medium text-on-surface-variant">{t("places.routes")}</h3>
          {!routes || routes.status === "loading" ? (
            <p className="text-sm text-on-surface-variant">{t("dp.loading")}</p>
          ) : routes.status === "error" ? (
            <p className="text-sm text-on-surface-variant">
              {t("dp.couldntRoutes")}{" "}
              <button type="button" className="underline" onClick={onRetry}>
                {t("dp.retry")}
              </button>
            </p>
          ) : routes.list.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t("dp.noDepartures")}</p>
          ) : (
            <div className="space-y-2.5">
              {routes.list.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-2xl border border-outline-variant bg-surface-container p-3">
                  <div className="mb-2 text-sm font-bold">
                    {fmtTime(r.departure)} → {fmtTime(r.arrival)} ({fmtDuration(r.durationMs, t)})
                  </div>
                  {r.walk && (
                    <p className="mb-2 text-xs text-on-surface-variant">
                      🚶 {t("dp.walkTo", { min: r.walk.minutes, dest: r.walk.dest })}
                    </p>
                  )}
                  <RouteLegs legs={r.legs} t={t} />
                </div>
              ))}
            </div>
          )}
          <a
            href={mapsUrl(origin, dest.place)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <MapPinIcon className="size-4" />
            {t("dp.openMaps")}
          </a>
        </div>
      )}
    </Card>
  );
}

const OCC_BAR: Record<OccLevel, string> = {
  low: "bg-status-good",
  med: "bg-status-warn",
  high: "bg-status-bad",
};
const OCC_TEXT: Record<OccLevel, string> = {
  low: "text-status-good",
  med: "text-status-warn",
  high: "text-status-bad",
};

// Live gym occupancy for a McFit/RSG studio. Fetches when the card opens; stays
// silent (renders nothing) when no proxy is configured, so the rest of the panel
// is unaffected. Shows the current load as a bar + a today-by-hour mini chart so
// you can see whether now is a good time or whether to wait out the rush.
function GymOccupancy({
  studioId,
  t,
}: {
  studioId: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [state, setState] = useState<"loading" | "error" | "hidden" | Occupancy>("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchOccupancy(studioId)
      .then((o) => alive && setState(o ?? "hidden"))
      .catch(() => alive && setState("error"));
    return () => { alive = false; };
  }, [studioId]);

  if (state === "hidden") return null;

  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-medium text-on-surface-variant">{t("gym.occupancy")}</h3>
      {state === "loading" ? (
        <div className="h-2 w-full animate-pulse rounded-full bg-surface-high" />
      ) : state === "error" ? (
        <p className="text-sm text-on-surface-variant">{t("gym.occErr")}</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className={cn("text-2xl font-bold", OCC_TEXT[state.level])}>{state.current}%</span>
            <span className={cn("text-sm font-semibold", OCC_TEXT[state.level])}>
              {t(`gym.${state.level}`)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-high">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 ease-out", OCC_BAR[state.level])}
              style={{ width: `${Math.max(2, state.current)}%` }}
            />
          </div>

          {/* Today by hour — each bar coloured by its own load (quiet mornings →
              busy evenings reads as a heatmap), the current hour at full opacity
              and ringed, the rest dimmed. Shows at a glance when to skip the rush. */}
          <p className="mt-3 mb-1.5 text-xs text-on-surface-variant">{t("gym.byHour")}</p>
          <div className="flex h-14 items-end gap-px">
            {state.hours.map((h) => (
              <div
                key={h.hour}
                title={`${String(h.hour).padStart(2, "0")}:00 · ${h.pct}%`}
                className={cn(
                  "flex-1 rounded-sm",
                  OCC_BAR[occLevel(h.pct)],
                  h.current ? "ring-2 ring-on-surface ring-offset-1 ring-offset-surface-container" : "opacity-35",
                )}
                style={{ height: `${Math.max(8, h.pct)}%` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
