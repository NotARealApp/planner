import type { ReactNode } from "react";

export function AppHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-1 flex items-center justify-between">
      <h1 className="text-[1.75rem] font-normal tracking-tight">{title}</h1>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function PageSubtitle({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-sm text-on-surface-variant">{children}</p>;
}
