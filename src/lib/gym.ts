// McFit / RSG-Group studio occupancy. The API needs an `x-tenant` header and
// sends no CORS, so the static app can't call it directly — requests go through
// a tiny Cloudflare Worker (see proxy/gym-worker.js) whose URL lives in
// NEXT_PUBLIC_GYM_PROXY. No proxy configured → fetchOccupancy returns null and
// the gym panel stays hidden.
export const GYM_PROXY = (process.env.NEXT_PUBLIC_GYM_PROXY ?? "").replace(/\/+$/, "");

// Photon (the address search) returns the POI name in the label, so a McFit
// studio picked from the map reads as "McFit, …". That's our cue to ask for the
// studio id — no other location needs it.
export function isMcfit(label: string): boolean {
  return /mcfit/i.test(label);
}

export type OccLevel = "low" | "med" | "high";
export type OccHour = { hour: number; pct: number; current: boolean };
export type Occupancy = { current: number; level: OccLevel; hours: OccHour[] };

// % of capacity → how it feels on the floor. Tunable knob: McFit's scale peaks
// near ~90% at the evening rush, so these bands (not a flat 0/50/100) match the
// real range — quiet enough to lift, vs. queueing for a rack.
export function occLevel(pct: number): OccLevel {
  if (pct < 40) return "low";
  if (pct < 70) return "med";
  return "high";
}

type RawHour = { startTime: string; current: boolean; percentage: number };

export async function fetchOccupancy(studioId: string): Promise<Occupancy | null> {
  if (!GYM_PROXY || !studioId) return null;
  const raw = (await fetch(`${GYM_PROXY}/${studioId}`).then((r) => r.json())) as RawHour[];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const hours: OccHour[] = raw.map((h) => ({
    // startTime looks like "2026-06-29T21:00:00.000+02:00[Europe/Berlin]" — the
    // bracketed zone trips Date.parse, so drop it before reading the hour.
    hour: new Date(h.startTime.replace(/\[.*\]$/, "")).getHours(),
    pct: h.percentage,
    current: h.current,
  }));
  const current = hours.find((h) => h.current)?.pct ?? 0;
  return { current, level: occLevel(current), hours };
}
