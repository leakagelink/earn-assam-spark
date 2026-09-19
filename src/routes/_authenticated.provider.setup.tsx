import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, FileCheck2, Save, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMarketplace, getMyWorkspace, saveProviderProfile, submitKyc } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/provider/setup")({
  head: () => ({ meta: [
    { title: "Provider Setup & KYC — SkillEarn Assam" },
    { name: "description", content: "Create your provider profile and submit verification documents." },
    { property: "og:title", content: "Provider Setup & KYC — SkillEarn Assam" },
    { property: "og:description", content: "Join SkillEarn Assam as a verified local service provider." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProviderSetup,
});

type Market = Awaited<ReturnType<typeof getMarketplace>>;
type Workspace = Awaited<ReturnType<typeof getMyWorkspace>>;

function ProviderSetup() {
  const loadMarket = useServerFn(getMarketplace);
  const loadWorkspace = useServerFn(getMyWorkspace);
  const saveProfile = useServerFn(saveProviderProfile);
  const sendKyc = useServerFn(submitKyc);
  const [market, setMarket] = useState<Market | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [districtId, setDistrictId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const blocks = useMemo(() => market?.blocks.filter((item) => item.district_id === districtId) ?? [], [market, districtId]);
  const villages = useMemo(() => market?.villages.filter((item) => item.block_id === blockId) ?? [], [market, blockId]);
  useEffect(() => { Promise.all([loadMarket(), loadWorkspace()]).then(([m,w]) => { setMarket(m); setWorkspace(w); setDistrictId(w.provider?.district_id ?? ""); setBlockId(w.provider?.block_id ?? ""); }).catch(() => setMessage("Provider setup could not be loaded.")); }, [loadMarket, loadWorkspace]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await saveProfile({ data: { displayName: String(form.get("displayName")), phone: String(form.get("phone")), serviceId: String(form.get("serviceId")), skill: String(form.get("skill")), districtId, blockId, villageId: String(form.get("villageId")), experienceYears: Number(form.get("experienceYears")), startingPrice: Number(form.get("startingPrice")), priceUnit: String(form.get("priceUnit")) as "visit" | "hr" | "day" | "job", bio: String(form.get("bio")) } });
      setMessage("Provider profile saved. You can now submit KYC."); setWorkspace(await loadWorkspace());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile could not be saved."); } finally { setBusy(false); }
  }

  async function uploadDocument(file: File, name: string, userId: string) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${userId}/${name}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function saveKyc(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sign in again to upload documents.");
      const form = new FormData(event.currentTarget);
      const aadhaar = form.get("aadhaar"); const pan = form.get("pan"); const certificate = form.get("certificate");
      if (!(aadhaar instanceof File) || !aadhaar.size || !(pan instanceof File) || !pan.size) throw new Error("Aadhaar and PAN documents are required.");
      const [aadhaarPath, panPath, certificatePath] = await Promise.all([uploadDocument(aadhaar,"aadhaar",data.user.id), uploadDocument(pan,"pan",data.user.id), certificate instanceof File && certificate.size ? uploadDocument(certificate,"certificate",data.user.id) : Promise.resolve("")]);
      await sendKyc({ data: { aadhaarPath, panPath, certificatePath } });
      setMessage("KYC submitted securely for admin review."); setWorkspace(await loadWorkspace());
    } catch (error) { setMessage(error instanceof Error ? error.message : "KYC could not be submitted."); } finally { setBusy(false); }
  }

  const fieldClass = "mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <AppShell title="Provider setup" eyebrow="Earn with your skills">
    {message && <p className="mb-5 rounded-md border border-glass-border bg-glass p-3 text-sm text-primary">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <form onSubmit={save} className="glass-panel rounded-xl p-5 sm:p-7"><div className="mb-6"><p className="text-xs uppercase text-primary">Step 1</p><h2 className="font-display text-2xl font-bold">Service profile</h2></div><div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="displayName">Full name</Label><Input id="displayName" name="displayName" required defaultValue={workspace?.provider?.display_name ?? workspace?.profile?.full_name ?? ""} className="mt-2" /></div>
        <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" inputMode="tel" defaultValue={workspace?.profile?.phone ?? ""} className="mt-2" /></div>
        <div><Label htmlFor="serviceId">Service</Label><select id="serviceId" name="serviceId" required defaultValue={workspace?.provider?.service_id ?? ""} className={fieldClass}><option value="">Choose service</option>{market?.services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><Label htmlFor="skill">Skill title</Label><Input id="skill" name="skill" required defaultValue={workspace?.provider?.skill ?? ""} placeholder="e.g. Electrician" className="mt-2" /></div>
        <div><Label htmlFor="district">District</Label><select id="district" required value={districtId} onChange={(e) => { setDistrictId(e.target.value); setBlockId(""); }} className={fieldClass}><option value="">Choose district</option>{market?.districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><Label htmlFor="block">Block</Label><select id="block" required value={blockId} onChange={(e) => setBlockId(e.target.value)} className={fieldClass}><option value="">Choose block</option>{blocks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><Label htmlFor="villageId">GP / Village</Label><select id="villageId" name="villageId" required defaultValue={workspace?.provider?.village_id ?? ""} className={fieldClass}><option value="">Choose village</option>{villages.map((item) => <option key={item.id} value={item.id}>{item.gp_name} · {item.name}</option>)}</select></div>
        <div><Label htmlFor="experienceYears">Experience (years)</Label><Input id="experienceYears" name="experienceYears" type="number" min="0" required defaultValue={workspace?.provider?.experience_years ?? 0} className="mt-2" /></div>
        <div><Label htmlFor="startingPrice">Starting price ₹</Label><Input id="startingPrice" name="startingPrice" type="number" min="0" required defaultValue={workspace?.provider?.starting_price ?? 0} className="mt-2" /></div>
        <div><Label htmlFor="priceUnit">Price unit</Label><select id="priceUnit" name="priceUnit" defaultValue={workspace?.provider?.price_unit ?? "visit"} className={fieldClass}><option value="visit">Per visit</option><option value="hr">Per hour</option><option value="day">Per day</option><option value="job">Per job</option></select></div>
        <div className="sm:col-span-2"><Label htmlFor="bio">About your work</Label><Textarea id="bio" name="bio" maxLength={500} defaultValue={workspace?.provider?.bio ?? ""} className="mt-2 min-h-24" /></div>
      </div><Button disabled={busy} type="submit" variant="kinetic" size="xl" className="mt-6 w-full sm:w-auto"><Save /> Save profile</Button></form>

      <form onSubmit={saveKyc} className="glass-panel rounded-xl p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase text-primary">Step 2</p><h2 className="font-display text-2xl font-bold">KYC verification</h2></div>{workspace?.kyc?.status === "approved" ? <BadgeCheck className="text-primary" /> : <FileCheck2 className="text-primary" />}</div><Badge className="mt-4" variant={workspace?.kyc?.status === "rejected" ? "destructive" : "outline"}>{workspace?.kyc?.status ?? "not submitted"}</Badge><p className="mt-3 text-sm text-muted-foreground">Documents stay private and are visible only to you and authorized reviewers.</p>{workspace?.kyc?.rejection_reason && <p className="mt-3 text-sm text-destructive">Reason: {workspace.kyc.rejection_reason}</p>}<div className="mt-6 grid gap-4"><div><Label htmlFor="aadhaar">Aadhaar document</Label><Input id="aadhaar" name="aadhaar" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-2" /></div><div><Label htmlFor="pan">PAN document</Label><Input id="pan" name="pan" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-2" /></div><div><Label htmlFor="certificate">Skill certificate (optional)</Label><Input id="certificate" name="certificate" type="file" accept="image/jpeg,image/png,application/pdf" className="mt-2" /></div></div><Button disabled={busy || !workspace?.provider || workspace?.kyc?.status === "approved"} type="submit" variant="light" size="xl" className="mt-6 w-full"><UploadCloud /> Submit securely</Button><Button asChild variant="ghost" className="mt-2 w-full"><Link to="/account">Back to account</Link></Button></form>
    </div>
  </AppShell>;
}