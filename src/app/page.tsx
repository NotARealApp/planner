"use client";

import Link from "next/link";
import { AppHeader, PageSubtitle } from "@/components/layout/app-header";
import { IconLink } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon, SettingsIcon } from "@/components/icons/nav-icons";
import { ThemeToggle } from "@/components/icons/theme-toggle";
import { useI18n } from "@/context/I18nProvider";
import { useTheme } from "@/context/ThemeProvider";
import { cn } from "@/lib/cn";

// Each tool gets its own M3 tonal container, for an expressive, colorful hub.
const APPS = [
  { href: "/dayplanner", emoji: "🌤️", titleKey: "card.office", descKey: "card.office.desc", tone: "bg-primary-container text-on-primary-container" },
  { href: "/trip", emoji: "🧳", titleKey: "card.trip", descKey: "card.trip.desc", tone: "bg-secondary-container text-on-secondary-container" },
  { href: "/gym", emoji: "🏋️", titleKey: "card.gym", descKey: "card.gym.desc", badgeKey: "badge.dev", tone: "bg-tertiary-container text-on-tertiary-container" },
] as const;

export default function HomePage() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <AppHeader
        title="Assistant"
        actions={
          <>
            <IconLink href="/settings" aria-label={t("a11y.settings")} title={t("a11y.settings")}>
              <SettingsIcon />
            </IconLink>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </>
        }
      />
      <PageSubtitle>{t("home.subtitle")}</PageSubtitle>

      {/* Expressive tonal cards — one container color per tool. */}
      <div className="space-y-3">
        {APPS.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className={cn(
              "flex items-center gap-4 rounded-[28px] px-5 py-5 transition duration-200 ease-[var(--ease-spring)]",
              "hover:brightness-[0.97] active:scale-[0.98]",
              app.tone,
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-current/15 text-2xl">
              {app.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight">{t(app.titleKey)}</h2>
              <p className="text-sm opacity-80">{t(app.descKey)}</p>
              {"badgeKey" in app && app.badgeKey && <Badge>{t(app.badgeKey)}</Badge>}
            </span>
            <ChevronRightIcon className="shrink-0 opacity-70 rtl:scale-x-[-1]" />
          </Link>
        ))}
      </div>
    </>
  );
}
