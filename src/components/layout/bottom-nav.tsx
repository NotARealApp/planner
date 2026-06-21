"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/cn";
import {
  CalendarTodayIcon,
  SuitcaseIcon,
  DumbbellIcon,
  SettingsIcon,
} from "@/components/icons/nav-icons";

// The four primary destinations. This bar replaces the old /apps grid hub —
// every feature is one tap away, so there's no separate "home" screen.
const TABS = [
  { href: "/dayplanner", labelKey: "nav.today", Icon: CalendarTodayIcon },
  { href: "/trip", labelKey: "nav.trip", Icon: SuitcaseIcon },
  { href: "/gym", labelKey: "nav.gym", Icon: DumbbellIcon },
  { href: "/settings", labelKey: "nav.settings", Icon: SettingsIcon },
] as const;

export function BottomNav() {
  const { t } = useI18n();
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
            SlideToggle thumb, so selection feels of a piece across the app. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1.5 left-2 rounded-2xl bg-secondary-container transition-transform duration-300 ease-[var(--ease-spring)]"
          style={{ width: `calc((100% - 1rem) / 4)`, transform: `translateX(${active * 100}%)` }}
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
