"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function StickyLeaveBar({
  visible,
  icon,
  time,
  line,
  dotColor,
  onClick,
}: {
  visible: boolean;
  icon: ReactNode;
  time: string;
  line?: string;
  dotColor?: string;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      role="status"
      onClick={onClick}
      className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-outline bg-surface-container px-4 py-3 text-sm font-semibold shadow-lg"
    >
      <span>{icon}</span>
      <span>{time}</span>
      {dotColor && line && (
        <span className="ms-1 inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant">
          <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: dotColor }} />
          {line}
        </span>
      )}
    </button>
  );
}

export function HintToast({
  message,
  dismissLabel,
  onDismiss,
}: {
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-xl border border-outline bg-surface-container p-4 shadow-elev-2"
    >
      <span className="flex-1 text-sm">{message}</span>
      <Button variant="soft" className="min-h-9 shrink-0 px-4 py-2 text-xs" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  );
}

export function UndoToast({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex items-center gap-3 rounded-xl border border-outline bg-surface-container p-4 shadow-elev-2"
    >
      <span className="flex-1 text-sm">{message}</span>
      <Button variant="soft" className="min-h-9 shrink-0 px-4 py-2 text-xs" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function UpdatedFooter({
  text,
  stale,
  forceLabel,
  onForceUpdate,
}: {
  text: string;
  stale: boolean;
  forceLabel: string;
  onForceUpdate: () => void;
}) {
  if (!text) return null;
  // The "Updated …" line is itself the (discreet, unlabelled) force-refresh
  // trigger — no scary "clear cache" button leaking system internals.
  return (
    <div className="mt-2 flex justify-center">
      <button
        type="button"
        onClick={onForceUpdate}
        title={forceLabel}
        className={cn("text-center text-xs text-on-surface-variant", stale && "text-status-warn")}
      >
        {text}
      </button>
    </div>
  );
}
