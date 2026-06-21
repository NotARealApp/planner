import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // pb-24 clears the fixed bottom nav; the nav hides itself off the tab
        // routes, but the small extra bottom space elsewhere is harmless.
        "mx-auto max-w-[480px] px-4 pb-24 pt-4 md:max-w-[640px] lg:max-w-[720px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
