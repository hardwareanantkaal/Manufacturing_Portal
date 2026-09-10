"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";

function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, null);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-9 rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold text-foreground tracking-wide">ANANTKAAL</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            Client Portal
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
