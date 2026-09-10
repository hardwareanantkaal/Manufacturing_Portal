"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateApiKey } from "./actions";

export function RegenerateKeyButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "Regenerating the API key will break every device already deployed with the current key, until they're reflashed or reconfigured. Continue?"
    );
    if (!confirmed) return;
    startTransition(() => {
      regenerateApiKey(productId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
    >
      <RefreshCw size={12} />
      {pending ? "Regenerating…" : "Regenerate"}
    </button>
  );
}
