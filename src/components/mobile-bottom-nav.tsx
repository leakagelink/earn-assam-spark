import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CircleUserRound, Home, Search } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/search", label: "Search", icon: Search, exact: true },
  { to: "/dashboard", label: "Bookings", icon: CalendarDays, exact: false },
  { to: "/account", label: "Profile", icon: CircleUserRound, exact: false },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-glass-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {items.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className={`flex h-16 min-w-0 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="size-5 shrink-0" />
            <span className="truncate px-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}