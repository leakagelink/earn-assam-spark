import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, CheckCircle2, Clock3, Heart, IndianRupee, Power, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboard, setProviderAvailability, updateBookingStatus } from "@/lib/marketplace.functions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Bookings & Earnings — SkillEarn Assam" },
    { name: "description", content: "Track customer bookings, provider jobs, payments and earnings." },
    { property: "og:title", content: "Bookings & Earnings — SkillEarn Assam" },
    { property: "og:description", content: "Your SkillEarn Assam customer and provider dashboard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DashboardPage,
});

type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

function DashboardPage() {
  const load = useServerFn(getDashboard);
  const changeStatus = useServerFn(updateBookingStatus);
  const changeAvailability = useServerFn(setProviderAvailability);
  const [data, setData] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");
  const refresh = async () => setData(await load());
  useEffect(() => { refresh().catch(() => setMessage("Dashboard could not be loaded.")); }, [load]);
  const customerBookings = data?.customerBookings ?? [];
  const providerBookings = data?.providerBookings ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const statusAction = async (id: string, status: "accepted" | "rejected" | "in_progress" | "completed" | "cancelled") => { try { await changeStatus({ data: { bookingId: id, status } }); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Status could not be changed."); } };
  return <AppShell title="Bookings & earnings" eyebrow="Live workspace">
    {message && <p className="mb-5 rounded-md border border-glass-border bg-glass p-3 text-sm">{message}</p>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={CalendarDays} label="My bookings" value={customerBookings.length} />
      <Metric icon={Clock3} label="Today's jobs" value={providerBookings.filter((item) => item.booking_date === today).length} />
      <Metric icon={CheckCircle2} label="Completed" value={providerBookings.filter((item) => item.status === "completed").length} />
      <Metric icon={IndianRupee} label="Wallet" value={`₹${Number(data?.wallet?.balance ?? 0).toLocaleString("en-IN")}`} />
    </section>
    {data?.provider && <section className="mt-5 glass-panel rounded-xl p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase text-primary">Provider mode</p><h2 className="mt-1 font-display text-xl font-bold">{data.provider.display_name}</h2><p className="text-sm text-muted-foreground">New bookings are {data.provider.is_available ? "enabled" : "paused"}.</p></div><Button variant={data.provider.is_available ? "light" : "glass"} onClick={async () => { await changeAvailability({ data: { available: !data.provider?.is_available } }); await refresh(); }}><Power /> {data.provider.is_available ? "Available ON" : "Available OFF"}</Button></div></section>}
    <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <BookingList title="My customer bookings" empty="No bookings yet. Find a verified provider to get started." bookings={customerBookings} actions={(booking) => booking.status === "pending" ? <Button size="sm" variant="ghost" onClick={() => statusAction(booking.id,"cancelled")}>Cancel</Button> : null} />
      {data?.provider && <BookingList title="Provider jobs" empty="No customer requests yet." bookings={providerBookings} actions={(booking) => <div className="flex flex-wrap gap-2">{booking.status === "pending" && <><Button size="sm" variant="light" onClick={() => statusAction(booking.id,"accepted")}>Accept</Button><Button size="sm" variant="ghost" onClick={() => statusAction(booking.id,"rejected")}>Reject</Button></>}{booking.status === "accepted" && <Button size="sm" variant="light" onClick={() => statusAction(booking.id,"in_progress")}>Start job</Button>}{booking.status === "in_progress" && <Button size="sm" variant="light" onClick={() => statusAction(booking.id,"completed")}>Complete</Button>}</div>} />}
    </section>
    <section className="mt-5 grid gap-5 sm:grid-cols-3"><Panel icon={Heart} title="Favourites" value={`${data?.favourites.length ?? 0} saved`} /><Panel icon={WalletCards} title="Payments" value={`${data?.payments.length ?? 0} receipts`} /><Panel icon={IndianRupee} title="Withdrawals" value={`${data?.withdrawals.length ?? 0} requests`} /></section>
    {data?.roles.includes("admin") && <Button asChild className="mt-6" variant="kinetic"><Link to="/admin">Open admin control</Link></Button>}
  </AppShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string | number }) { return <div className="glass-panel rounded-xl p-5"><Icon className="size-5 text-primary" /><p className="mt-4 text-xs uppercase text-muted-foreground">{label}</p><p className="font-display text-2xl font-bold">{value}</p></div>; }
function Panel({ icon: Icon, title, value }: { icon: typeof Heart; title: string; value: string }) { return <div className="glass-panel rounded-xl p-5"><Icon className="size-5 text-primary" /><h3 className="mt-3 font-display font-bold">{title}</h3><p className="text-sm text-muted-foreground">{value}</p></div>; }
function BookingList({ title, empty, bookings, actions }: { title: string; empty: string; bookings: BookingRow[]; actions: (booking: BookingRow) => React.ReactNode }) { return <div className="glass-panel rounded-xl p-5"><h2 className="font-display text-xl font-bold">{title}</h2><div className="mt-4 grid gap-3">{bookings.length ? bookings.map((booking) => <article key={booking.id} className="rounded-lg border border-glass-border bg-glass p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{booking.booking_date} · {booking.booking_time.slice(0,5)}</p><p className="mt-1 text-sm text-muted-foreground">{booking.service_address}</p><p className="mt-1 text-sm">₹{Number(booking.quoted_price).toLocaleString("en-IN")}</p></div><Badge variant="outline">{booking.status.replace("_"," ")}</Badge></div><div className="mt-3">{actions(booking)}</div></article>) : <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>}</div></div>; }