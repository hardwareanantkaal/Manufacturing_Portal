"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { cancelOtaJob } from "./actions";

export function CancelJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      "Cancel this OTA job? Devices that haven't picked it up yet never will. Devices already mid-download will still finish and report their own result — there's no way to interrupt a device once it's downloading."
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await cancelOtaJob(jobId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
      >
        <XCircle size={12} />
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}
