import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Preserves every other search param (range, from, to) when flipping pages —
// only ?page changes.
function pageHref(basePath: string, currentParams: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function ReadingsPagination({
  basePath,
  currentParams,
  page,
  totalPages,
}: {
  basePath: string;
  currentParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-slate-50">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={pageHref(basePath, currentParams, Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium border border-border transition-colors ${
            page <= 1
              ? "pointer-events-none opacity-40 bg-white"
              : "bg-white text-foreground hover:bg-slate-100"
          }`}
        >
          <ChevronLeft size={13} />
          Prev
        </Link>
        <Link
          href={pageHref(basePath, currentParams, Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium border border-border transition-colors ${
            page >= totalPages
              ? "pointer-events-none opacity-40 bg-white"
              : "bg-white text-foreground hover:bg-slate-100"
          }`}
        >
          Next
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
