import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getReceipt } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/receipt/$paymentId")({
  head: () => ({ meta: [{ title:"Payment Receipt — SkillEarn Assam" },{ name:"description",content:"View and print your SkillEarn Assam payment receipt." },{ property:"og:title",content:"Payment Receipt — SkillEarn Assam" },{ property:"og:description",content:"Verified service payment receipt." },{ property:"og:type",content:"website" },{ name:"twitter:card",content:"summary" }] }),
  component: ReceiptPage,
});

type Receipt = Awaited<ReturnType<typeof getReceipt>>;
function ReceiptPage() {
  const { paymentId } = Route.useParams();
  const load = useServerFn(getReceipt);
  const [data,setData] = useState<Receipt | null>(null);
  const [error,setError] = useState("");
  useEffect(()=>{load({data:{paymentId}}).then(setData).catch((reason)=>setError(reason instanceof Error ? reason.message : "Receipt could not be loaded."));},[load,paymentId]);
  const provider = data?.booking.provider_profiles as {display_name?:string;skill?:string;district?:string}|null;
  const service = data?.booking.services as {name?:string}|null;
  return <AppShell title="Payment receipt" eyebrow="Verified transaction"><div className="mx-auto max-w-2xl">{error ? <p className="glass-panel rounded-xl p-6">{error}</p> : !data ? <p className="glass-panel rounded-xl p-6">Loading receipt…</p> : <article className="receipt glass-panel rounded-xl p-5 sm:p-8"><div className="flex items-start justify-between gap-4 border-b border-glass-border pb-5"><div><p className="text-xs uppercase text-primary">SkillEarn Assam</p><h2 className="mt-1 font-display text-2xl font-bold">Payment receipt</h2><p className="text-sm text-muted-foreground">{data.payment.receipt_number}</p></div><Badge variant="outline">{data.payment.status}</Badge></div><dl className="mt-6 grid gap-4 sm:grid-cols-2"><ReceiptItem label="Provider" value={provider?.display_name ?? "Service provider"}/><ReceiptItem label="Service" value={service?.name ?? provider?.skill ?? "Local service"}/><ReceiptItem label="Booking date" value={`${data.booking.booking_date} · ${data.booking.booking_time.slice(0,5)}`}/><ReceiptItem label="Payment method" value={data.payment.method.replace("_"," ")}/><ReceiptItem label="Reference" value={data.payment.transaction_reference ?? "Verified"}/><ReceiptItem label="Location" value={provider?.district ?? data.booking.service_address}/></dl><div className="mt-6 border-y border-glass-border py-5"><div className="flex justify-between text-sm"><span>Service amount</span><span>₹{Number(data.payment.amount).toLocaleString("en-IN")}</span></div><div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>Platform commission ({data.commissionPercent}%)</span><span>Included</span></div><div className="mt-4 flex justify-between font-display text-xl font-bold"><span>Total paid</span><span>₹{Number(data.payment.amount).toLocaleString("en-IN")}</span></div></div><p className="mt-5 text-xs text-muted-foreground">Issued {new Date(data.payment.verified_at ?? data.payment.created_at).toLocaleString("en-IN")}. This receipt confirms an admin-verified payment reference.</p><div className="no-print mt-6 flex gap-3"><Button asChild variant="glass"><Link to="/dashboard"><ArrowLeft/> Dashboard</Link></Button><Button variant="light" onClick={()=>window.print()}><Printer/> Print / save PDF</Button></div></article>}</div></AppShell>;
}
function ReceiptItem({label,value}:{label:string;value:string}) { return <div><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }