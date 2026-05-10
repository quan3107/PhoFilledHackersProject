// apps/student-onboarding/src/components/student-onboarding/auth-wall.tsx
// Figma-auth-wall-aligned login surface for the canonical student app.
// Keeps the Make composition while routing the live email/password path into Better Auth.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Compass,
  Loader2,
  Lock,
  Mail,
  Shield,
  UserRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { type Locale, copy } from "@/lib/onboarding-data";
import { FacebookIcon, GoogleIcon } from "./icons";

type AuthMode = "signIn" | "signUp";

interface AuthWallProps {
  locale: Locale;
}

export function AuthWall({ locale }: AuthWallProps) {
  const router = useRouter();
  const text = copy[locale];
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !email.trim() ||
      !password.trim() ||
      (mode === "signUp" && !name.trim())
    ) {
      return;
    }

    setError(null);
    setLoading("email");

    try {
      if (mode === "signUp") {
        await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
        });
      }

      router.replace("/");
      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Unable to authenticate."
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-57px)] items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4D8E]/5 via-background to-[#1B4D8E]/10" />
        <div className="absolute inset-0 flex opacity-[0.08]">
          <div className="w-[40%] space-y-4 border-r border-border/50 p-8">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className={`flex ${index % 2 === 0 ? "justify-end" : ""}`}
              >
                <div
                  className={`h-10 rounded-2xl ${
                    index % 2 === 0 ? "w-48 bg-primary" : "w-64 bg-muted"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-4 p-8">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-32 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Compass className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl text-foreground">{text.authTitle}</h1>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                {text.authSubtitle}
              </p>
            </div>
          </div>

          <div className="flex rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                mode === "signIn"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                mode === "signUp"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground opacity-60"
            >
              <GoogleIcon />
              {text.authGoogle}
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground opacity-60"
            >
              <FacebookIcon />
              {text.authFacebook}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {text.authOr}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "signUp" ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled={loading !== null}
                  required
                />
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={text.authEmailPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={loading !== null}
                required
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                minLength={8}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={loading !== null}
                required
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading !== null}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {mode === "signUp" ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            Social login and magic-link flows are still visible from the Figma
            design, but the live backend path available in this build is
            email/password.
          </div>

          <div className="flex items-start gap-2 border-t border-border pt-2">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {text.authTrust}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {text.authTerms}{" "}
          <span className="cursor-pointer underline hover:text-foreground">
            {text.authTermsOfService}
          </span>{" "}
          {text.authAnd}{" "}
          <span className="cursor-pointer underline hover:text-foreground">
            {text.authPrivacy}
          </span>
        </p>
      </div>
    </div>
  );
}
