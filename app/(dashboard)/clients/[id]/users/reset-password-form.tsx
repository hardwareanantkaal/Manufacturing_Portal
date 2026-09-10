"use client";

import { useActionState, useState } from "react";
import { resetUserPassword } from "./actions";

export function ResetPasswordForm({ userId, clientId }: { userId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(resetUserPassword, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="clientId" value={clientId} />
      <input
        name="password"
        type="text"
        required
        minLength={8}
        placeholder="New password"
        className="h-7 w-32 rounded-md border border-input bg-white px-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        autoFocus
      />
      <button
        type="submit"
        disabled={isPending}
        className="h-7 px-2 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  );
}
