"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { type Locale, type ThemeMode, copy } from "@/lib/onboarding-data";

export interface Viewer {
  name: string;
  email: string;
}

interface GlobalHeaderProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  viewer: Viewer | null;
  onLogin?: () => void;
  onLogout?: () => void;
  onNavigateProfile?: () => void;
  onNavigateSettings?: () => void;
}

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
  {
    value: "system",
    label: "System",
    icon: <Monitor className="h-3.5 w-3.5" />,
  },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return name.slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function GlobalHeader({
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  viewer,
  onLogin,
  onLogout,
  onNavigateProfile,
  onNavigateSettings,
}: GlobalHeaderProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const text = copy[locale];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setThemeMenuOpen(false);
      }

      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 md:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Compass className="h-4 w-4" />
        </div>
        <span className="text-sm tracking-tight text-foreground">
          {text.headerTitle}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={() => onLocaleChange("en")}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs transition ${
              locale === "en"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onLocaleChange("vi")}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs transition ${
              locale === "vi"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            VI
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setThemeMenuOpen((current) => !current)}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          {themeMenuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border bg-card py-1 shadow-lg">
              {themeOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onThemeChange(option.value);
                    setThemeMenuOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                    option.value === theme
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  {option.icon}
                  {option.label}
                  {option.value === theme ? (
                    <span className="ml-auto text-primary">✓</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {viewer ? (
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary/15 text-xs text-primary"
            >
              {getInitials(viewer.name)}
            </button>

            {accountMenuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card py-2 shadow-xl">
                <div className="px-3 py-2">
                  <p className="text-sm text-foreground">{viewer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {viewer.email}
                  </p>
                </div>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted/50"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  {text.headerProfile}
                </button>
                <button
                  type="button"
                  onClick={onNavigateSettings}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition hover:bg-muted/50"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {text.headerPlan}
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  {text.headerLogout}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="cursor-pointer rounded-lg bg-primary px-4 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {text.headerLogin}
          </button>
        )}
      </div>
    </header>
  );
}
