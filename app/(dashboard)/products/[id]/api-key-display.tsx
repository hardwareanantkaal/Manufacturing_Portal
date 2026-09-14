"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CopyButton } from "@/components/copy-button";

export function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [revealed, setRevealed] = useState(false);
  const masked = `${apiKey.slice(0, 6)}${"•".repeat(Math.max(apiKey.length - 6, 0))}`;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 w-24">
        API Key
      </span>
      <code className="flex-1 font-mono text-xs text-foreground truncate">
        {revealed ? apiKey : masked}
      </code>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? "Hide API key" : "Reveal API key"}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <CopyButton value={apiKey} title="Copy API key" />
    </div>
  );
}
