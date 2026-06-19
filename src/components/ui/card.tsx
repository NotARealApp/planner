import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Card = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <section
      ref={ref}
      className={cn(
        "mb-3 rounded-xl border border-outline bg-surface-container px-5 py-4 shadow-elev-1",
        className,
      )}
      {...props}
    />
  );
});

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2
      className={cn(
        "mb-3 text-sm font-medium text-on-surface-variant",
        className,
      )}
    >
      {children}
    </h2>
  );
}
