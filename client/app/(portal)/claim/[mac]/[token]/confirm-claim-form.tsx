"use client";

import { useActionState } from "react";
import { confirmClaimAction } from "./actions";

export function ConfirmClaimForm({ mac, token }: { mac: string; token: string }) {
  const [error, formAction, isPending] = useActionState(confirmClaimAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="mac" value={mac} />
      <input type="hidden" name="token" value={token} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "Claiming..." : "Confirm Claim"}
      </button>
    </form>
  );
}
