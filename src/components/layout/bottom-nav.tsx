"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/context/I18nProvider";
import { isRtl } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import {
  CalendarTodayIcon,
  SuitcaseIcon,
  MapPinIcon,
  SettingsIcon,
} from "@/components/icons/nav-icons";

// The four primary destinations. This bar replaces the old /apps grid hub —
// every feature is one tap away, so there's no separate "home" screen.
const TABS = [
  { href: "/dayplanner", labelKey: "nav.today", Icon: CalendarTodayIcon },
  { href: "/trip", labelKey: "nav.trip", Icon: SuitcaseIcon },
  { href: "/places", labelKey: "nav.places", Icon: MapPinIcon },
  { href: "/settings", labelKey: "nav.settings", Icon: SettingsIcon },
] as const;

export function BottomNav() {
  const { t, lang } = useI18n();
  const rtl = isRtl(lang);
  const pathname = usePathname() || "";
  // Only show on the four tab destinations — onboarding and any stray route
  // stay chrome-free.
  const active = TABS.findIndex((tab) => pathname.startsWith(tab.href));
  if (active === -1) return null;

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto grid max-w-[480px] grid-cols-4 px-2 py-1.5">
        {/* Sliding pill behind the active tab — same motion language as the
            SlideToggle thumb. Anchored to the inline-start edge and translated
            in the reading direction, so it tracks the active tab under RTL too. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1.5 start-2 rounded-2xl bg-secondary-container transition-transform duration-200 ease-out"
          style={{ width: `calc((100% - 1rem) / 4)`, transform: `translateX(${active * (rtl ? -100 : 100)}%)` }}
        />
        {TABS.map((tab, i) => {
          const on = i === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.65rem] font-medium transition-colors",
                on ? "text-on-secondary-container" : "text-on-surface-variant",
              )}
            >
              <tab.Icon className="size-[22px]" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
