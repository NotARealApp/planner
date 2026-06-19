import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-outline bg-surface-high px-3 text-[0.95rem] text-on-surface",
        "placeholder:text-on-surface-variant focus:border-transparent focus:outline-2 focus:outline-primary",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-12 w-full rounded-md border border-outline bg-surface-high px-3 text-[0.95rem] text-on-surface",
        "focus:border-transparent focus:outline-2 focus:outline-primary",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-on-surface-variant">{children}</span>
  );
}
