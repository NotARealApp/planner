"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { DumbbellIcon } from "@/components/icons/nav-icons";
import { ThemeToggle } from "@/components/icons/theme-toggle";
import { useI18n } from "@/context/I18nProvider";
import { useTheme } from "@/context/ThemeProvider";

export default function GymPage() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <AppHeader
        title={t("card.gym")}
        actions={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      />
      <div className="mt-2 rounded-[28px] bg-tertiary-container px-6 py-14 text-center text-on-tertiary-container">
        <span className="flex mx-auto size-20 items-center justify-center rounded-full bg-current/15">
          <DumbbellIcon className="size-9" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold">{t("gym.title")}</h2>
        <p className="mt-1 text-sm opacity-80">{t("gym.sub")}</p>
        <div className="mt-4 flex justify-center">
          <Badge>{t("badge.dev")}</Badge>
        </div>
      </div>
    </>
  );
}
