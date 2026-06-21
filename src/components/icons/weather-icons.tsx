const WEATHER_ICONS: Record<string, string> = {
  sun: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  "cloud-sun": `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3" stroke="#f5a623"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 3.5l-1 1" stroke="#f5a623"/><path d="M9 18a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 4.5 18H9z" stroke="currentColor" fill="none" transform="translate(6,2)"/></svg>`,
  cloud: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7.5 19h10z"/></svg>`,
  fog: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 14a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.4 1.8"/><path d="M3 14h13M3 18h18M3 10h6"/></svg>`,
  rain: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 13a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7.5 13h10z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#4da3ff"/></svg>`,
  snow: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 13a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7.5 13h10z"/><path d="M8 17v3M8 18.5l-1.5 1M8 18.5l1.5 1M12 17v3M12 18.5l-1.5 1M12 18.5l1.5 1M16 17v3M16 18.5l-1.5 1M16 18.5l1.5 1" stroke="#9ad6ff"/></svg>`,
  storm: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 12a3.5 3.5 0 0 0 0-7 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7.5 12h10z"/><path d="M13 11l-3 4h3l-2 4" stroke="#f5a623"/></svg>`,
};

const OUTFIT_ICONS: Record<string, string> = {
  shirt: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5 5.5 5 3.5 8.5l3 1.8L8 9v12h8V9l1.5 1.3 3-1.8L18.5 5 15 3.5a3 3 0 0 1-6 0Z"/></svg>`,
  sweater: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5 4 5.5 2.5 16l2.8.6.7-7V21h12v-11.4l.7 7 2.8-.6L22 5.5 17 3.5a3 3 0 0 1-6 0Z"/><path d="M4 15.5h2.7M17.3 15.5H20M9.3 4.2 12 6.6l2.7-2.4"/></svg>`,
  coat: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 5 5 4 11l2.2.6V21h11.6v-9.4L20 11l-1-6-3-2-3 3-3-3Z"/><path d="M12 6.5V21M11.4 11h.01M11.4 14h.01"/></svg>`,
  umbrella: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 8 0 0 1 9 8H3a9 8 0 0 1 9-8Z"/><path d="M12 11v7a2.5 2.5 0 0 0 5 0"/><path d="M12 3V2"/></svg>`,
  glasses: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="7" height="6" rx="3"/><rect x="14" y="10" width="7" height="6" rx="3"/><path d="M10 12.5q2-1 4 0"/><path d="M3 11 1 8.5M21 11l2-2.5"/></svg>`,
  sunscreen: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="8" width="10" height="13" rx="2"/><path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8"/><path d="M12 12.5v4M10 14.5h4"/></svg>`,
};

function SvgIcon({ html, size }: { html: string; size?: number }) {
  let svg = html;
  if (size) svg = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return <span className="inline-flex" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function WeatherIcon({ category, size }: { category: string; size?: number }) {
  return <SvgIcon html={WEATHER_ICONS[category] || WEATHER_ICONS.cloud} size={size} />;
}

export function OutfitIcon({ name, size = 36 }: { name: string; size?: number }) {
  if (name === "sun") return <WeatherIcon category="sun" size={size} />;
  return <SvgIcon html={OUTFIT_ICONS[name] || ""} size={size} />;
}

export function OutfitTiles({
  wearKey,
  wearText,
  jacketKey,
  jacketText,
  umbrella,
  sunny,
  sunscreen,
  wearLabel,
  outerwearLabel,
  umbrellaLabel,
  sunglassesLabel,
  sunscreenLabel,
  yesLabel,
  size = 36,
}: {
  wearKey: string;
  wearText: string;
  jacketKey: string;
  jacketText: string;
  umbrella?: boolean;
  sunny?: boolean;
  sunscreen?: boolean;
  wearLabel: string;
  outerwearLabel: string;
  umbrellaLabel: string;
  sunglassesLabel: string;
  sunscreenLabel?: string;
  yesLabel: string;
  size?: number;
}) {
  const sunTile = { icon: "sunscreen", label: sunscreenLabel ?? "", text: yesLabel };
  const tiles = [{ icon: wearKey, label: wearLabel, text: wearText }];
  // No jacket needed (warm) + high UV → drop the "Outerwear: No" tile, show sunscreen instead.
  if (sunscreen && jacketKey === "sun") {
    tiles.push(sunTile);
  } else {
    tiles.push({ icon: jacketKey, label: outerwearLabel, text: jacketText });
    if (sunscreen) tiles.push(sunTile);
  }
  if (umbrella) tiles.push({ icon: "umbrella", label: umbrellaLabel, text: yesLabel });
  if (sunny) tiles.push({ icon: "glasses", label: sunglassesLabel, text: yesLabel });

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl bg-surface-high px-1 py-2 text-center">
          <div className="mb-1 flex h-9 items-center justify-center text-primary">
            <OutfitIcon name={tile.icon} size={size} />
          </div>
          <div className="text-[0.62rem] font-bold uppercase tracking-wide text-on-surface-variant">
            {tile.label}
          </div>
          <div className="mt-0.5 text-xs font-bold">{tile.text}</div>
        </div>
      ))}
    </div>
  );
}
