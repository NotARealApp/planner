import type { WeatherData } from "@/lib/weather";
import { WAKING, SUNNY_HOURS, computeOutfit, weatherInfo } from "@/lib/weather";

export const EUROPE_CC = new Set([
  "AL","AD","AT","BY","BE","BA","BG","HR","CY","CZ","DK","EE","FI","FR","DE",
  "GR","HU","IS","IE","IT","XK","LV","LI","LT","LU","MT","MD","MC","ME","NL",
  "MK","NO","PL","PT","RO","RU","SM","RS","SK","SI","ES","SE","CH","UA","GB",
  "VA","TR","GI","FO","IM","JE","GG",
]);

export type TripPlace = {
  lat: number;
  lon: number;
  label: string;
  short: string;
  cc: string;
  country: string;
};

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daytimeReduce(
  data: WeatherData,
  dayIdx: number,
  field: keyof WeatherData["hourly"],
  fn: (a: number, b: number) => number,
  init: number,
) {
  const date = data.daily.time[dayIdx];
  let res = init;
  let seen = false;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const [d, t] = data.hourly.time[i].split("T");
    if (d !== date) continue;
    const h = parseInt(t.split(":")[0], 10);
    if (h < WAKING.start || h > WAKING.end) continue;
    const v = data.hourly[field][i];
    if (typeof v !== "number") continue;
    res = fn(res, v);
    seen = true;
  }
  return seen ? res : null;
}

export function sunnyHours(data: WeatherData, dayIdx: number) {
  const date = data.daily.time[dayIdx];
  let hours = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const [d, t] = data.hourly.time[i].split("T");
    if (d !== date) continue;
    const h = parseInt(t.split(":")[0], 10);
    if (h < WAKING.start || h > WAKING.end) continue;
    if (weatherInfo(data.hourly.weathercode[i])[1] === "sun") hours++;
  }
  return hours;
}

export function homeCountry() {
  try {
    const s = JSON.parse(localStorage.getItem("planner_settings") || "null");
    return (s?.home?.countryCode || "DE").toUpperCase();
  } catch {
    return "DE";
  }
}

export async function geocodeTripPlace(name: string): Promise<TripPlace[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en`;
  const d = await fetch(url).then((r) => r.json());
  return (d.results || [])
    .filter((r: { country_code: string }) => EUROPE_CC.has(r.country_code))
    .slice(0, 5)
    .map((r: { latitude: number; longitude: number; name: string; admin1?: string; country: string; country_code: string }) => ({
      lat: r.latitude,
      lon: r.longitude,
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      short: r.name,
      cc: (r.country_code || "").toUpperCase(),
      country: r.country,
    }));
}

export async function fetchTripWeather(lat: number, lon: number, start: string, end: string) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=auto&start_date=${start}&end_date=${end}`;
  return fetch(url).then((r) => r.json()) as Promise<WeatherData>;
}

export function tripOverall(data: WeatherData) {
  let minT = Infinity;
  let maxT = -Infinity;
  let maxRain = 0;
  let maxWind = 0;
  let maxUv = 0;
  let anySunny = false;
  let valid = 0;

  for (let i = 0; i < data.daily.time.length; i++) {
    if (data.daily.temperature_2m_max[i] == null) continue;
    valid++;
    if (sunnyHours(data, i) >= SUNNY_HOURS) anySunny = true;
    const dMin = daytimeReduce(data, i, "apparent_temperature", Math.min, Infinity);
    const dRain = daytimeReduce(data, i, "precipitation_probability", Math.max, 0);
    const dWind = daytimeReduce(data, i, "windspeed_10m", Math.max, 0);
    minT = Math.min(minT, dMin ?? data.daily.temperature_2m_min[i]);
    maxT = Math.max(maxT, data.daily.temperature_2m_max[i]);
    maxRain = Math.max(maxRain, dRain ?? data.daily.precipitation_probability_max[i] ?? 0);
    maxWind = Math.max(maxWind, dWind ?? data.daily.windspeed_10m_max[i]);
    maxUv = Math.max(maxUv, data.daily.uv_index_max?.[i] ?? 0);
  }

  if (!valid) return null;
  return { minT, maxT, maxRain, maxWind, sunny: anySunny, outfit: computeOutfit(minT, maxRain, maxWind, "trip", maxUv) };
}
