"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Onboarding } from "@/components/onboarding/onboarding";
import { isOnboarded } from "@/lib/planner-settings";

// The app opens on the answer, not a menu: an onboarded device goes straight to
// the day planner; the bottom tab bar handles moving between tools. New devices
// see onboarding first. Mount-guarded so static HTML doesn't flash before hydration.
export default function HomePage() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (isOnboarded()) router.replace("/dayplanner");
    else setShowOnboarding(true);
  }, [router]);

  return showOnboarding ? <Onboarding /> : null;
}
