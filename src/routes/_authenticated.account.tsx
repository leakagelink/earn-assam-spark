import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, BriefcaseBusiness, CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { claimFirstAdmin, getMyWorkspace } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [
    { title: "My Account — SkillEarn Assam" },
    { name: "description", content: "Manage your SkillEarn Assam customer and provider account." },
    { property: "og:title", content: "My Account — SkillEarn Assam" },
    { property: "og:description", content: "Manage bookings, provider profile and verification." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountPage,
});

type Workspace = Awaited<ReturnType<typeof getMyWorkspace>>;

function AccountPage() {
  const loadWorkspace = useServerFn(getMyWorkspace);
  const claimAdmin = useServerFn(claimFirstAdmin);
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { loadWorkspace().then(setWorkspace).catch(() => setMessage("Account details could not be loaded.")); }, [loadWorkspace]);

  const kycLabel = workspace?.kyc?.status ? workspace.kyc.status[0].toUpperCase() + workspace.kyc.status.slice(1) : "Not submitted";
  return <AppShell title="My account" eyebrow="Customer workspace">
    {message && <p className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{message}</p>}
    <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="glass-panel rounded-xl p-5 sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase text-primary">Profile</p><h2 className="mt-1 font-display text-2xl font-bold">{workspace?.profile?.full_name ?? "Loading…"}</h2><p className="mt-1 text-sm text-muted-foreground">{workspace?.profile?.district ?? "Add your Assam location"}</p></div><span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><UserRound /></span></div>
        <div className="mt-6 flex flex-wrap gap-2">{workspace?.roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}</div>
      </div>
      <div className="glass-panel rounded-xl p-5 sm:p-7"><p className="text-xs uppercase text-primary">Quick actions</p><div className="mt-4 grid gap-3"><Button asChild variant="light"><Link to="/provider/setup"><BriefcaseBusiness /> {workspace?.provider ? "Edit provider profile" : "Become a provider"}</Link></Button><Button variant="glass" disabled><CalendarDays /> My bookings · Coming next</Button></div></div>
    </section>
    {workspace?.provider && <section className="mt-5 glass-panel rounded-xl p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase text-primary">Provider status</p><h2 className="mt-1 flex items-center gap-2 font-display text-xl font-bold">{workspace.provider.display_name}{workspace.provider.is_verified && <BadgeCheck className="text-primary" />}</h2></div><Badge variant={workspace.kyc?.status === "rejected" ? "destructive" : "outline"}>{kycLabel}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{workspace.provider.skill} · {workspace.provider.block_name}, {workspace.provider.district}</p>{workspace.kyc?.rejection_reason && <p className="mt-3 text-sm text-destructive">Reason: {workspace.kyc.rejection_reason}</p>}<Button asChild className="mt-5" variant="kinetic"><Link to="/provider/setup"><ShieldCheck /> {workspace.kyc ? "Manage KYC" : "Submit KYC"}</Link></Button></section>}
    {!workspace?.roles.includes("admin") && <section className="mt-5 border-t border-glass-border pt-5"><Button variant="ghost" size="sm" onClick={async () => { const result = await claimAdmin(); setMessage(result.claimed ? "Admin access activated for this account." : "The first admin is already assigned."); await router.invalidate(); }}>Activate first admin</Button></section>}
  </AppShell>;
}