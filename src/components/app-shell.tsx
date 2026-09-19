import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  const router = useRouter();
  return <div className="kinetic-bg min-h-screen text-foreground">
    <header className="sticky top-0 z-30 border-b border-glass-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><Button asChild variant="ghost" size="icon"><Link to="/" aria-label="Back home"><ArrowLeft /></Link></Button><div className="min-w-0"><p className="truncate text-[10px] uppercase text-primary">{eyebrow}</p><h1 className="truncate font-display text-lg font-bold sm:text-xl">{title}</h1></div></div>
        <Button variant="glass" size="sm" onClick={async () => { await supabase.auth.signOut(); router.navigate({ to: "/" }); }}><LogOut /> Sign out</Button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
  </div>;
}