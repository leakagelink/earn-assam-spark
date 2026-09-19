import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Banknote, BriefcaseBusiness, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminWorkspace, reviewKyc } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Admin Control — SkillEarn Assam" },
    { name: "description", content: "Manage SkillEarn Assam providers, KYC, bookings, payments and safety." },
    { property: "og:title", content: "Admin Control — SkillEarn Assam" },
    { property: "og:description", content: "Secure SkillEarn Assam operations dashboard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminPage,
});

type AdminData = Awaited<ReturnType<typeof getAdminWorkspace>>;
function AdminPage() {
  const load = useServerFn(getAdminWorkspace); const review = useServerFn(reviewKyc);
  const [data,setData] = useState<AdminData | null>(null); const [message,setMessage] = useState("");
  const refresh = async () => setData(await load());
  useEffect(() => { refresh().catch(() => setMessage("Admin access is required.")); }, [load]);
  if (!data) return <AppShell title="Admin control" eyebrow="Protected operations"><p className="glass-panel rounded-xl p-6">{message || "Loading secure controls…"}</p></AppShell>;
  const pendingKyc = data.kyc.filter((item) => item.status === "pending");
  return <AppShell title="Admin control" eyebrow="Protected operations">
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={UsersRound} label="Customers" value={data.profiles.length} /><Metric icon={BriefcaseBusiness} label="Providers" value={data.providers.length} /><Metric icon={BadgeCheck} label="KYC pending" value={pendingKyc.length} /><Metric icon={Banknote} label="Bookings" value={data.bookings.length} /></section>
    <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="glass-panel rounded-xl p-5"><h2 className="font-display text-xl font-bold">KYC review queue</h2><div className="mt-4 grid gap-3">{pendingKyc.length ? pendingKyc.map((item) => <article key={item.id} className="rounded-lg border border-glass-border bg-glass p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Provider verification</p><p className="text-xs text-muted-foreground">Submitted {new Date(item.submitted_at).toLocaleDateString("en-IN")}</p></div><Badge variant="outline">pending</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" variant="light" onClick={async () => { await review({ data: { providerUserId:item.provider_user_id,approved:true,reason:"" } }); await refresh(); }}>Approve</Button><Button size="sm" variant="ghost" onClick={async () => { await review({ data: { providerUserId:item.provider_user_id,approved:false,reason:"Documents need correction." } }); await refresh(); }}>Reject</Button></div></article>) : <p className="py-8 text-center text-sm text-muted-foreground">No pending KYC reviews.</p>}</div></div><div className="grid gap-4"><Summary title="Money controls" lines={[`Payments: ${data.payments.length}`,`Withdrawals: ${data.withdrawals.length}`,`Commission: ${data.commission?.commission_percent ?? 10}%`,`Minimum withdrawal: ₹${data.commission?.minimum_withdrawal ?? 500}`]} /><Summary title="Trust & safety" lines={[`Reports: ${data.reports.length}`,`Disputes: ${data.disputes.length}`,`Featured providers: ${data.providers.filter((item) => item.is_featured).length}`]} /><Summary title="Growth tools" lines={[`Coupons: ${data.coupons.length}`,`Plans: ${data.plans.length}`,`Payment methods configured: ${data.methods.filter((item) => item.is_enabled).length}`]} /></div></section>
    <section className="mt-5 glass-panel rounded-xl p-5"><div className="flex items-center gap-2"><ShieldAlert className="text-primary" /><h2 className="font-display text-xl font-bold">Operational overview</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Summary title="Pending bookings" lines={[String(data.bookings.filter((item) => item.status === "pending").length)]} /><Summary title="Pending payments" lines={[String(data.payments.filter((item) => item.status === "pending").length)]} /><Summary title="Open complaints" lines={[String(data.reports.filter((item) => item.status === "open").length + data.disputes.filter((item) => item.status === "open").length)]} /></div></section>
  </AppShell>;
}
function Metric({icon:Icon,label,value}:{icon:typeof UsersRound;label:string;value:number}) { return <div className="glass-panel rounded-xl p-5"><Icon className="size-5 text-primary" /><p className="mt-4 text-xs uppercase text-muted-foreground">{label}</p><p className="font-display text-2xl font-bold">{value}</p></div>; }
function Summary({title,lines}:{title:string;lines:string[]}) { return <div className="glass-panel rounded-xl p-5"><h3 className="font-display font-bold">{title}</h3>{lines.map((line) => <p key={line} className="mt-2 text-sm text-muted-foreground">{line}</p>)}</div>; }