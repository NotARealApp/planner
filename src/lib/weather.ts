export const WEATHER_CODES: Record<number, [string, string]> = {
  0: ["wx.clear", "sun"],
  1: ["wx.mclear", "sun"],
  2: ["wx.pcloudy", "cloud-sun"],
  3: ["wx.overcast", "cloud"],
  45: ["wx.fog", "fog"],
  48: ["wx.fog", "fog"],
  51: ["wx.drizzleL", "rain"],
  53: ["wx.drizzle", "rain"],
  55: ["wx.drizzleD", "rain"],
  56: ["wx.fdrizzle", "rain"],
  57: ["wx.fdrizzle", "rain"],
  61: ["wx.rainL", "rain"],
  63: ["wx.rain", "rain"],
  65: ["wx.rainH", "rain"],
  66: ["wx.frain", "rain"],
  67: ["wx.frain", "rain"],
  71: ["wx.snowL", "snow"],
  73: ["wx.snow", "snow"],
  75: ["wx.snowH", "snow"],
  77: ["wx.grains", "snow"],
  80: ["wx.showers", "rain"],
  81: ["wx.showers", "rain"],
  82: ["wx.vshowers", "storm"],
  85: ["wx.sshowers", "snow"],
  86: ["wx.sshowers", "snow"],
  95: ["wx.storm", "storm"],
  96: ["wx.hail", "storm"],
  99: ["wx.hail", "storm"],
};

export function weatherInfo(code: number): [string, string] {
  return WEATHER_CODES[code] || ["wx.unknown", "cloud"];
}

export const WAKING = { start: 8, end: 21 };
export const SUNNY_HOURS = 3;
// WHO UV index: 6+ is "high" — sun protection worth flagging.
export const UV_HIGH = 6;

export type WeatherData = {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weathercode: (number | null)[];
    windspeed_10m_max: number[];
    uv_index_max?: (number | null)[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: (number | null)[];
    weathercode: number[];
    windspeed_10m: number[];
  };
};

export function daytimeHourlyReduce(
  data: WeatherData,
  dayIdx: number,
  field: keyof WeatherData["hourly"],
  fn: (acc: number, val: number) => number,
  init: number,
): number {
  const targetDate = data.daily.time[dayIdx];
  let result = init;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const [date, time] = data.hourly.time[i].split("T");
    if (date !== targetDate) continue;
    const hour = parseInt(time.split(":")[0], 10);
    if (hour >= WAKING.start && hour <= WAKING.end) {
      const val = data.hourly[field][i];
      if (typeof val === "number") result = fn(result, val);
    }
  }
  return result;
}

export function daytimeRainChance(data: WeatherData, dayIdx: number) {
  return daytimeHourlyReduce(data, dayIdx, "precipitation_probability", Math.max, 0);
}

export function daytimeMinTemp(data: WeatherData, dayIdx: number) {
  return daytimeHourlyReduce(data, dayIdx, "temperature_2m", Math.min, Infinity);
}

export function daytimeApparentMin(data: WeatherData, dayIdx: number) {
  const v = daytimeHourlyReduce(data, dayIdx, "apparent_temperature", Math.min, Infinity);
  return !isFinite(v) ? daytimeMinTemp(data, dayIdx) : v;
}

export function daytimeMaxWind(data: WeatherData, dayIdx: number) {
  return daytimeHourlyReduce(data, dayIdx, "windspeed_10m", Math.max, 0);
}

export function daytimeSunnyHours(data: WeatherData, dayIdx: number) {
  const targetDate = data.daily.time[dayIdx];
  let hours = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const [date, time] = data.hourly.time[i].split("T");
    if (date !== targetDate) continue;
    const hour = parseInt(time.split(":")[0], 10);
    if (hour < WAKING.start || hour > WAKING.end) continue;
    if (weatherInfo(data.hourly.weathercode[i])[1] === "sun") hours++;
  }
  return hours;
}

export function hourlyEntries(
  data: WeatherData,
  dayIdx: number,
  count: number,
  stepH: number,
) {
  const targetDate = data.daily.time[dayIdx];
  const startHour = dayIdx === 0 ? new Date().getHours() : WAKING.start;
  const entries: { hour: number; temp: number; rain: number | null; category: string }[] = [];
  for (let i = 0; i < data.hourly.time.length && entries.length < count; i++) {
    const [date, time] = data.hourly.time[i].split("T");
    if (date !== targetDate) continue;
    const hour = parseInt(time.split(":")[0], 10);
    if (hour < startHour || hour > WAKING.end) continue;
    if ((hour - startHour) % stepH !== 0) continue;
    entries.push({
      hour,
      temp: Math.round(data.hourly.temperature_2m[i]),
      rain: data.hourly.precipitation_probability[i],
      category: weatherInfo(data.hourly.weathercode[i])[1],
    });
  }
  return entries;
}

export type OutfitResult = {
  wearKey: string;
  wearTextKey: string;
  jacketKey: string;
  jacketTextKey: string;
  umbrella: boolean;
  sunscreen: boolean;
  noteKeys: string[];
};

export function computeOutfit(
  minTemp: number,
  rainProb: number | null,
  wind: number,
  variant: "dayplanner" | "trip" = "trip",
  uv: number | null = null,
): OutfitResult {
  let wearKey: string, wearTextKey: string, jacketKey: string, jacketTextKey: string;
  const noteKeys: string[] = [];
  const dp = variant === "dayplanner";

  if (minTemp < 2) {
    wearKey = "sweater";
    wearTextKey = dp ? "fit.thermal" : "fit.thermalS";
    jacketKey = "coat";
    jacketTextKey = "fit.bigCoat";
    noteKeys.push("fit.scarf");
  } else if (minTemp < 9) {
    wearKey = "sweater";
    wearTextKey = "fit.warmSweater";
    jacketKey = "coat";
    jacketTextKey = dp ? "fit.warmCoat" : "fit.warmCoatS";
  } else if (minTemp < 15) {
    wearKey = "shirt";
    wearTextKey = dp ? "fit.longSleeve" : "fit.longSleeveS";
    jacketKey = "coat";
    jacketTextKey = "fit.lightJacket";
  } else if (minTemp < 21) {
    wearKey = "shirt";
    wearTextKey = dp ? "fit.tshirtLight" : "fit.tshirtLightS";
    jacketKey = "sun";
    jacketTextKey = dp ? "fit.noCoat" : "fit.noCoatS";
  } else {
    wearKey = "shirt";
    wearTextKey = "fit.tshirt";
    jacketKey = "sun";
    jacketTextKey = dp ? "fit.noCoat" : "fit.noJacketS";
  }

  if (wind >= 30) noteKeys.push("dp.windy");
  const umbrella = rainProb != null && rainProb >= 30;
  const sunscreen = uv != null && uv >= UV_HIGH;
  return { wearKey, wearTextKey, jacketKey, jacketTextKey, umbrella, sunscreen, noteKeys };
}
