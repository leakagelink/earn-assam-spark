import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  GraduationCap,
  Hammer,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/rahul-electrician.jpg";
import bikashImage from "@/assets/bikash-plumber.jpg";
import miraImage from "@/assets/mira-photographer.jpg";
import jitenImage from "@/assets/jiten-carpenter.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillEarn Assam — Trusted Local Services" },
      { name: "description", content: "Search verified skilled workers by district, block and village across Assam." },
      { property: "og:title", content: "SkillEarn Assam — Trusted Local Services" },
      { property: "og:description", content: "Book verified local electricians, plumbers, photographers and more across Assam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const districts = ["All districts", "Bongaigaon", "Dibrugarh", "Guwahati", "Jorhat", "Lakhimpur"];
const categories = [
  { name: "Electrical", icon: Zap },
  { name: "Plumbing", icon: Wrench },
  { name: "Photography", icon: Camera },
  { name: "Carpentry", icon: Hammer },
  { name: "Tuition", icon: GraduationCap },
  { name: "Beauty", icon: Sparkles },
];
const providers = [
  { name: "Bikash Das", skill: "Plumbing", district: "Lakhimpur", image: bikashImage, rating: 4.8, jobs: 142, price: "₹350", unit: "hr", available: true, tags: ["Leak repair", "Pipes"] },
  { name: "Mira Phukan", skill: "Photography", district: "Dibrugarh", image: miraImage, rating: 5.0, jobs: 98, price: "₹2,500", unit: "day", available: true, tags: ["Weddings", "Events"] },
  { name: "Jiten Sharma", skill: "Carpentry", district: "Jorhat", image: jitenImage, rating: 4.7, jobs: 126, price: "₹400", unit: "hr", available: false, tags: ["Furniture", "Custom"] },
];

function Index() {
  const [district, setDistrict] = useState("All districts");
  const [service, setService] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [booking, setBooking] = useState<(typeof providers)[number] | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMessage, setAuthMessage] = useState("");
  const [bookingDone, setBookingDone] = useState(false);

  const visibleProviders = useMemo(() => providers.filter((provider) => {
    const districtMatch = district === "All districts" || provider.district === district;
    const term = service.trim().toLowerCase();
    const serviceMatch = !term || `${provider.skill} ${provider.tags.join(" ")}`.toLowerCase().includes(term);
    const categoryMatch = activeCategory === "All" || provider.skill === activeCategory;
    return districtMatch && serviceMatch && categoryMatch;
  }), [district, service, activeCategory]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const result = authMode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setAuthMessage(result.error ? result.error.message : authMode === "signin" ? "Signed in successfully." : "Check your email to confirm your account.");
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setAuthMessage(result.error.message);
  }

  return (
    <div className="kinetic-bg relative min-h-screen overflow-hidden pb-24 text-foreground md:pb-0">
      <div className="glass-panel pointer-events-none absolute -left-60 -top-72 h-[34rem] w-[34rem] rotate-12 rounded-[2.5rem] opacity-60" />
      <div className="glass-panel pointer-events-none absolute right-[-18rem] top-28 h-[38rem] w-[30rem] -rotate-12 rounded-[2.5rem] opacity-40" />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-6">
        <a href="#top" className="flex items-center gap-3" aria-label="SkillEarn Assam home">
          <span className="grid size-10 place-items-center rounded-xl bg-primary font-display text-lg font-extrabold text-primary-foreground shadow-lg">SE</span>
          <span><strong className="block font-display text-lg leading-none">SkillEarn Assam<span className="text-primary">.</span></strong><small className="mt-1 block text-[10px] text-muted-foreground">LOCAL SKILLS · REAL EARNING</small></span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          <a href="#services" className="transition-colors hover:text-foreground">Services</a>
          <a href="#providers" className="transition-colors hover:text-foreground">Providers</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#earn" className="transition-colors hover:text-foreground">Earn with us</a>
        </nav>
        <div className="flex items-center gap-2">
          <div className="glass-panel hidden rounded-full px-3 py-2 text-xs sm:flex sm:gap-2"><span className="text-primary">EN</span><span className="text-muted-foreground">অস</span><span className="text-muted-foreground">हि</span></div>
          <Button variant="light" onClick={() => setAuthOpen(true)}>Sign in</Button>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-12 sm:px-8 lg:grid-cols-12 lg:pt-16">
          <div className="reveal lg:col-span-7">
            <div className="glass-panel mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"><span className="size-2 rounded-full bg-primary" /> KYC-verified providers across Assam</div>
            <h1 className="text-balance font-display text-[2.65rem] font-extrabold leading-[0.98] sm:text-[4.15rem]">Find trusted <span className="text-primary">skilled</span><br />workers in your<br />block &amp; village.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">Search by District, Block and GP/Village. Book, pay securely and rate verified local professionals.</p>

            <div className="glass-panel mt-8 max-w-2xl rounded-2xl p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="flex min-w-0 items-center gap-3 rounded-xl bg-glass px-3 py-2.5">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase text-muted-foreground">Location</span><select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full bg-transparent text-sm font-medium outline-none">{districts.map((item) => <option key={item} className="bg-popover" value={item}>{item}</option>)}</select></span>
                </label>
                <label className="flex min-w-0 items-center gap-3 rounded-xl bg-glass px-3 py-2.5">
                  <Search className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase text-muted-foreground">Service</span><input value={service} onChange={(e) => setService(e.target.value)} className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground" placeholder="Electrician, plumber…" /></span>
                </label>
                <Button size="xl" variant="kinetic" onClick={() => document.querySelector("#providers")?.scrollIntoView({ behavior: "smooth" })}><Search /> Search</Button>
              </div>
            </div>

            <div id="services" className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
              <button onClick={() => setActiveCategory("All")} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ${activeCategory === "All" ? "bg-primary text-primary-foreground" : "glass-panel"}`}>All services</button>
              {categories.map(({ name, icon: Icon }) => <button key={name} onClick={() => setActiveCategory(name)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium ${activeCategory === name ? "bg-primary text-primary-foreground" : "glass-panel"}`}><Icon className="size-3.5" />{name}</button>)}
            </div>
          </div>

          <div className="reveal reveal-delay relative mx-auto w-full max-w-[27rem] lg:col-span-5">
            <div className="glass-panel rotate-2 rounded-3xl p-4 shadow-2xl">
              <img src={heroImage} alt="Rahul Boro, verified electrician in Guwahati" width={1024} height={1280} className="aspect-[4/5] w-full rounded-2xl object-cover" />
              <div className="mt-4 flex items-center justify-between"><div><p className="flex items-center gap-1.5 font-display font-bold">Rahul Boro <BadgeCheck className="size-4 text-primary" /></p><p className="text-xs text-muted-foreground">Electrical · Guwahati</p></div><div className="text-right"><p className="font-display font-bold text-primary">4.9 ★</p><p className="text-[10px] text-muted-foreground">212 jobs</p></div></div>
            </div>
            <div className="glass-panel absolute -bottom-5 left-0 rounded-2xl px-4 py-3 shadow-xl sm:-left-4"><p className="text-[10px] uppercase text-muted-foreground">Verified</p><p className="flex items-center gap-2 font-display text-sm font-bold"><ShieldCheck className="size-4 text-primary" /> KYC · ID · Skill</p></div>
          </div>
        </section>

        <section id="providers" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-8">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs uppercase text-primary">Nearby · Top rated</p><h2 className="font-display text-2xl font-extrabold sm:text-3xl">Trusted pros near you</h2></div><span className="text-sm text-muted-foreground">{visibleProviders.length} found</span></div>
          {visibleProviders.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleProviders.map((provider) => (
            <article key={provider.name} className="glass-panel rounded-2xl p-4 transition-transform hover:-translate-y-1">
              <div className="flex items-center gap-3"><img src={provider.image} alt={`${provider.name}, ${provider.skill}`} width={816} height={816} loading="lazy" className="size-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><h3 className="flex items-center gap-1 font-display font-bold">{provider.name}<BadgeCheck className="size-4 shrink-0 text-primary" /></h3><p className="text-xs text-muted-foreground">{provider.skill} · {provider.district}</p><p className="mt-1 flex items-center gap-1 text-xs"><Star className="size-3 fill-primary text-primary" /> {provider.rating} <span className="text-muted-foreground">· {provider.jobs} jobs</span></p></div><Button variant="ghost" size="icon" aria-label={`Save ${provider.name}`}><Heart /></Button></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{provider.tags.map((tag) => <span className="rounded-full bg-glass px-2 py-1 text-[11px]" key={tag}>{tag}</span>)}</div>
              <div className="mt-4 flex items-center justify-between border-t border-glass-border pt-4"><div><p className={`text-[10px] ${provider.available ? "text-primary" : "text-muted-foreground"}`}>{provider.available ? "● Available now" : "Next available tomorrow"}</p><p className="font-display font-bold">{provider.price}<span className="font-body text-xs font-normal text-muted-foreground">/{provider.unit}</span></p></div><div className="flex gap-2"><Button variant="glass" size="icon" aria-label={`Chat with ${provider.name}`}><MessageCircle /></Button><Button variant="light" onClick={() => { setBooking(provider); setBookingDone(false); }}>Book</Button></div></div>
            </article>
          ))}</div> : <div className="glass-panel rounded-2xl p-10 text-center"><Search className="mx-auto size-7 text-primary" /><h3 className="mt-3 font-display font-bold">No exact match yet</h3><p className="mt-1 text-sm text-muted-foreground">Try another district or service.</p><Button className="mt-4" variant="glass" onClick={() => { setDistrict("All districts"); setService(""); setActiveCategory("All"); }}>Clear filters</Button></div>}
        </section>

        <section id="how" className="border-y border-glass-border bg-glass"><div className="mx-auto max-w-7xl px-4 py-14 sm:px-8"><p className="text-xs uppercase text-primary">Simple and protected</p><h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">From search to service in four steps</h2><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[Search,"Search nearby"],[BadgeCheck,"Compare verified"],[CalendarDays,"Book & pay"],[Star,"Review service"]].map(([Icon,label], index) => { const StepIcon = Icon as typeof Search; return <div key={label as string} className="flex items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><StepIcon className="size-5" /></span><div><span className="text-[10px] text-muted-foreground">0{index+1}</span><p className="font-display font-bold">{label as string}</p></div>{index < 3 && <ChevronRight className="ml-auto hidden size-4 text-muted-foreground lg:block" />}</div>})}</div></div></section>

        <section id="earn" className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-8 lg:grid-cols-2"><div className="glass-panel rounded-2xl p-6"><BriefcaseBusiness className="size-6 text-primary" /><h2 className="mt-4 font-display text-2xl font-bold">Post a job</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Describe what you need and receive responses from skilled locals near you.</p><Button className="mt-5" variant="light">Post now <ArrowRight /></Button></div><div className="rounded-2xl bg-primary p-6 text-primary-foreground"><WalletCards className="size-6" /><h2 className="mt-4 font-display text-2xl font-bold">Turn your skill into income</h2><p className="mt-2 max-w-md text-sm opacity-75">Complete KYC, set your price and start receiving work in your district.</p><Button className="mt-5" variant="light" onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}>Become a provider <ArrowRight /></Button></div></section>
      </main>

      <nav className="glass-panel fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-x-0 border-b-0 md:hidden">{[[Home,"Home"],[Search,"Search"],[BriefcaseBusiness,"Jobs"],[CalendarDays,"Bookings"],[CircleUserRound,"Profile"]].map(([Icon,label],i) => { const NavIcon = Icon as typeof Home; return <button key={label as string} onClick={() => i === 4 ? setAuthOpen(true) : document.querySelector(i === 0 ? "#top" : i === 1 ? "#services" : i === 2 ? "#earn" : "#providers")?.scrollIntoView({behavior:"smooth"})} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] ${i === 0 ? "text-primary" : "text-muted-foreground"}`}><NavIcon className="size-5" />{label as string}</button>})}</nav>

      <Dialog open={Boolean(booking)} onOpenChange={(open) => !open && setBooking(null)}><DialogContent className="glass-panel max-w-md border-glass-border bg-popover text-foreground">{bookingDone ? <div className="py-6 text-center"><CheckCircle2 className="mx-auto size-12 text-primary" /><DialogTitle className="mt-4">Booking request sent</DialogTitle><DialogDescription className="mt-2">{booking?.name} will confirm your date and final price.</DialogDescription><Button className="mt-6" variant="kinetic" onClick={() => setBooking(null)}>Done</Button></div> : <><DialogHeader><DialogTitle>Book {booking?.name}</DialogTitle><DialogDescription>Choose your preferred date, time and service address.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); setBookingDone(true); }}><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="date">Date</Label><Input id="date" type="date" required className="mt-2" /></div><div><Label htmlFor="time">Time</Label><Input id="time" type="time" required className="mt-2" /></div></div><div><Label htmlFor="address">Service address</Label><Input id="address" required placeholder="House, village, landmark" className="mt-2" /></div><div className="flex items-center justify-between rounded-xl bg-glass p-3 text-sm"><span className="text-muted-foreground">Starting price</span><strong>{booking?.price}/{booking?.unit}</strong></div><Button type="submit" size="xl" variant="kinetic">Request booking <CalendarDays /></Button></form></>}</DialogContent></Dialog>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}><DialogContent className="glass-panel max-w-md border-glass-border bg-popover text-foreground"><DialogHeader><DialogTitle>{authMode === "signin" ? "Welcome back" : "Create your account"}</DialogTitle><DialogDescription>Continue as a customer or service provider.</DialogDescription></DialogHeader><Button variant="light" size="xl" onClick={googleSignIn}>Continue with Google</Button><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div><form onSubmit={submitAuth} className="grid gap-4"><div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="mt-2" placeholder="you@example.com" /></div><div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={6} required className="mt-2" placeholder="At least 6 characters" /></div>{authMessage && <p className="text-sm text-primary">{authMessage}</p>}<Button type="submit" size="xl" variant="kinetic">{authMode === "signin" ? "Sign in" : "Create account"}</Button></form><button onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthMessage(""); }} className="text-sm text-muted-foreground hover:text-foreground">{authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button></DialogContent></Dialog>
    </div>
  );
}