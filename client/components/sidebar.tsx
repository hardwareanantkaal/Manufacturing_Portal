"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CircuitBoard, RefreshCw, LogOut, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: CircuitBoard },
  { href: "/data", label: "Data", icon: Activity },
  { href: "/updates", label: "Updates", icon: RefreshCw },
];

export function Sidebar({
  clientName,
  userName,
  logoutAction,
}: {
  clientName: string;
  userName: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="h-14 flex flex-col justify-center px-4 border-b border-sidebar-border">
        <span className="font-semibold text-white tracking-wide text-sm">ANANTKAAL</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium truncate">
          {clientName}
        </span>
      </div>
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-white font-medium"
                  : "text-slate-400 hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form
        action={logoutAction}
        className="flex items-center justify-between gap-2 px-4 py-3 border-t border-sidebar-border"
      >
        <span className="text-xs text-slate-400 truncate">{userName}</span>
        <button
          type="submit"
          title="Sign out"
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-sidebar-accent transition-colors"
        >
          <LogOut size={14} />
        </button>
      </form>
    </aside>
  );
}
