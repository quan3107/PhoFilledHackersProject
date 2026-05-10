// Shared visual primitives for the student onboarding UI.
// Keep the component tree compact and reuse the same card/pill styling across panels.
"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

export function SectionCard({
  title,
  icon: Icon,
  children,
  className = "",
}: Readonly<{
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={`overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2.5 border-b border-border bg-[var(--surface-soft,#f4f7fb)] px-5 py-3.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-foreground">
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Pill({
  children,
  className = "",
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <span
      className={`inline-flex items-center rounded-xl px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "success";
}>) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-muted text-foreground";

  return (
    <div className={`rounded-2xl px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.08em] text-current/70">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-current">{value}</p>
    </div>
  );
}
