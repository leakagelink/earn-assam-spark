import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const providerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20),
  serviceId: z.string().uuid(),
  skill: z.string().trim().min(2).max(80),
  districtId: z.string().uuid(),
  blockId: z.string().uuid(),
  villageId: z.string().uuid(),
  experienceYears: z.number().int().min(0).max(70),
  startingPrice: z.number().min(0).max(1_000_000),
  priceUnit: z.enum(["visit", "hr", "day", "job"]),
  bio: z.string().trim().max(500),
});

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getMarketplace = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [providers, services, districts, blocks, villages] = await Promise.all([
    client.from("public_provider_listings").select("*").order("is_featured", { ascending: false }).order("rating", { ascending: false }),
    client.from("services").select("id,name,icon").eq("is_active", true).order("name"),
    client.from("districts").select("id,name").eq("is_active", true).order("name"),
    client.from("blocks").select("id,district_id,name").eq("is_active", true).order("name"),
    client.from("villages").select("id,block_id,name,gp_name").eq("is_active", true).order("name"),
  ]);
  const error = providers.error ?? services.error ?? districts.error ?? blocks.error ?? villages.error;
  if (error) throw new Error("Marketplace data is temporarily unavailable.");
  return {
    providers: providers.data ?? [], services: services.data ?? [], districts: districts.data ?? [],
    blocks: blocks.data ?? [], villages: villages.data ?? [],
  };
});

export const getMyWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, roles, provider, kyc] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("provider_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("provider_kyc").select("*").eq("provider_user_id", context.userId).maybeSingle(),
    ]);
    return { profile: profile.data, roles: (roles.data ?? []).map((row) => row.role), provider: provider.data, kyc: kyc.data };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (countError) throw new Error("Admin access could not be checked.");
    if ((count ?? 0) > 0) return { claimed: false };
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error("Admin access could not be created.");
    return { claimed: true };
  });

export const saveProviderProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => providerSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: district }, { data: block }, { data: village }, { data: service }] = await Promise.all([
      supabaseAdmin.from("districts").select("name").eq("id", data.districtId).eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("blocks").select("name,district_id").eq("id", data.blockId).eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("villages").select("name,block_id").eq("id", data.villageId).eq("is_active", true).maybeSingle(),
      supabaseAdmin.from("services").select("name").eq("id", data.serviceId).eq("is_active", true).maybeSingle(),
    ]);
    if (!district || !block || !village || !service || block.district_id !== data.districtId || village.block_id !== data.blockId) throw new Error("Choose a valid service location.");
    await supabaseAdmin.from("user_roles").upsert({ user_id: context.userId, role: "provider" }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("profiles").update({ full_name: data.displayName, phone: data.phone || null, account_type: "provider", district: district.name, block_name: block.name, village: village.name, district_id: data.districtId, block_id: data.blockId, village_id: data.villageId }).eq("id", context.userId);
    const { error } = await supabaseAdmin.from("provider_profiles").upsert({ user_id: context.userId, display_name: data.displayName, service_id: data.serviceId, skill: data.skill || service.name, district: district.name, block_name: block.name, village: village.name, district_id: data.districtId, block_id: data.blockId, village_id: data.villageId, experience_years: data.experienceYears, starting_price: data.startingPrice, price_unit: data.priceUnit, bio: data.bio || null }, { onConflict: "user_id" });
    if (error) throw new Error("Provider profile could not be saved.");
    return { ok: true };
  });

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ aadhaarPath: z.string().min(3), panPath: z.string().min(3), certificatePath: z.string() }).parse(input))
  .handler(async ({ context, data }) => {
    const prefix = `${context.userId}/`;
    if (!data.aadhaarPath.startsWith(prefix) || !data.panPath.startsWith(prefix) || (data.certificatePath && !data.certificatePath.startsWith(prefix))) throw new Error("Invalid document upload.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: provider } = await supabaseAdmin.from("provider_profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!provider) throw new Error("Complete your provider profile first.");
    const { error } = await supabaseAdmin.from("provider_kyc").upsert({ provider_user_id: context.userId, aadhaar_document_path: data.aadhaarPath, pan_document_path: data.panPath, certificate_path: data.certificatePath || null, status: "pending", rejection_reason: null, reviewed_by: null, reviewed_at: null }, { onConflict: "provider_user_id" });
    if (error) throw new Error("KYC could not be submitted.");
    return { ok: true };
  });