import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  active: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  success: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  completed: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },

  shipped: { pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },

  running: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  pending: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  downloading: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },

  offline: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  rma: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  failed: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },

  flashed: { pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  cancelled: { pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    pill: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-2 rounded-full border font-mono text-[11px] font-semibold uppercase tracking-tight",
        style.pill
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {status}
    </span>
  );
}
