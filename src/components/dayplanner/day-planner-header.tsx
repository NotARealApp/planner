"use client";

import { AppHeader } from "@/components/layout/app-header";
import { ThemeToggle } from "@/components/icons/theme-toggle";

type DayPlannerHeaderProps = {
  title: string;
  homeLabel: string;
  settingsLabel: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

// The bottom nav now owns navigation (Today/Trip/Gym/Settings), so the header
// keeps only the theme toggle — no more redundant grid/settings links.
export function DayPlannerHeader({
  title,
  theme,
  onToggleTheme,
}: DayPlannerHeaderProps) {
  return (
    <AppHeader title={title} actions={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
  );
}
