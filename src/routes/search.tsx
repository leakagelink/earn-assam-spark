import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, MapPin, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { getMarketplace } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [
    { title: "Search Local Services — SkillEarn Assam" },
    { name: "description", content: "Search verified local service providers across Assam." },
    { property: "og:title", content: "Search Local Services — SkillEarn Assam" },
    { property: "og:description", content: "Find verified local professionals by service and district." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SearchPage,
});

type Marketplace = Awaited<ReturnType<typeof getMarketplace>>;

function SearchPage() {
  const load = useServerFn(getMarketplace);
  const [market, setMarket] = useState<Marketplace | null>(null);
  const [term, setTerm] = useState("");
  const [district, setDistrict] = useState("all");

  useEffect(() => {
    load().then(setMarket).catch(() => setMarket({ providers: [], services: [], districts: [], blocks: [], villages: [] }));
  }, [load]);

  const providers = useMemo(() => (market?.providers ?? []).filter((provider) => {
    const query = term.trim().toLowerCase();
    return (district === "all" || provider.district_id === district)
      && (!query || `${provider.display_name} ${provider.skill} ${provider.service_name}`.toLowerCase().includes(query));
  }), [district, market, term]);

  return (
    <div className="kinetic-bg min-h-dvh text-foreground">
      <MobilePageHeader title="Find services" />
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-8 sm:py-8">
        <section className="glass-panel grid gap-3 rounded-xl p-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <input value={term} onChange={(event) => setTerm(event.target.value)} className="field pl-10" placeholder="Electrician, plumber, name…" aria-label="Search service or provider" />
          </label>
          <label className="relative min-w-0">
            <MapPin className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <select value={district} onChange={(event) => setDistrict(event.target.value)} className="field pl-10" aria-label="Choose district">
              <option value="all">All districts</option>
              {(market?.districts ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </section>

        <div className="mb-4 mt-6 flex items-end justify-between gap-3"><div><p className="text-xs uppercase text-primary">Verified professionals</p><h1 className="font-display text-2xl font-bold">Search results</h1></div><span className="text-sm text-muted-foreground">{providers.length} found</span></div>
        <section className="grid gap-3 sm:grid-cols-2">
          {providers.map((provider) => <article key={provider.id} className="glass-panel rounded-xl p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="flex items-center gap-1 truncate font-display font-bold">{provider.display_name}<BadgeCheck className="size-4 shrink-0 text-primary" /></h2><p className="truncate text-sm text-muted-foreground">{provider.skill} · {provider.district}</p></div><span className="flex shrink-0 items-center gap-1 text-sm"><Star className="size-4 fill-primary text-primary" />{provider.rating}</span></div><div className="mt-4 flex items-center justify-between border-t border-glass-border pt-3"><span className={provider.is_available ? "text-xs text-primary" : "text-xs text-muted-foreground"}>{provider.is_available ? "● Available now" : "Unavailable"}</span><strong>₹{Number(provider.starting_price).toLocaleString("en-IN")}/{provider.price_unit}</strong></div></article>)}
          {!providers.length && <div className="glass-panel rounded-xl p-8 text-center text-sm text-muted-foreground sm:col-span-2">No matching providers found.</div>}
        </section>
      </main>
    </div>
  );
}