// apps/web/src/components/dashboard/login-page.tsx
// Standalone email/password auth screen for the web app.
// Uses Better Auth directly so login and registration stay on one canonical path.

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Compass, LoaderCircle, Mail, Lock, UserRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";

type AuthMode = "signIn" | "signUp";

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

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

      router.replace("/profile");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to authenticate."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(181,136,74,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(44,93,123,0.15),transparent_30%),linear-gradient(180deg,#f8f3ea_0%,#fbfaf7_42%,#f2efe8_100%)] px-4 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-[10%] top-[12%] h-36 w-36 rounded-full bg-[#c99f63]/20 blur-3xl" />
        <div className="absolute bottom-[14%] right-[10%] h-44 w-44 rounded-full bg-[#2c5d7b]/20 blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/88 shadow-[0_35px_100px_rgba(45,54,63,0.14)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(165deg,#173d63_0%,#102744_55%,#0f1f33_100%)] px-8 py-10 text-white sm:px-10">
          <div>
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] bg-white/10 backdrop-blur">
              <Compass className="h-7 w-7" />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-white/55">
              ETEST Compass
            </p>
            <h1 className="max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
              Start your student onboarding flow with one canonical account.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/68">
              Sign in once to save your current and projected profile, return to
              unfinished work, and run recommendation passes against the stored
              catalog.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              "Email-first auth",
              "Saved profile snapshots",
              "Recommendation-ready workflow",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-6 flex rounded-2xl border border-border bg-surface-soft/90 p-1">
            {[
              { value: "signIn" as const, label: "Sign in" },
              { value: "signUp" as const, label: "Create account" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  mode === item.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mb-6 rounded-[1.6rem] border border-border bg-surface-soft px-4 py-3 text-sm text-muted-foreground">
            Use the same account for chat intake, manual profile edits, and
            recommendation review. Password auth is the only live path in this
            build.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signUp" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Name
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your display name"
                    className="w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    required
                  />
                </div>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Email
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Password
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  className="w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  required
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_16px_35px_rgba(23,61,99,0.18)] transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {pending
                ? "Working..."
                : mode === "signUp"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            {mode === "signUp" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signIn")}
                  className="font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
                .
              </>
            ) : (
              <>
                Need a new account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signUp")}
                  className="font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  Create one
                </button>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
