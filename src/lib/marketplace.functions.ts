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

const bookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  bookingDate: z.string().date(),
  bookingTime: z.string().regex(/^\d{2}:\d{2}$/),
  serviceAddress: z.string().trim().min(5).max(300),
  notes: z.string().trim().max(500),
});

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("user_roles").select("id").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access is required.");
}

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

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bookingSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: provider } = await context.supabase.from("provider_profiles").select("id,service_id,starting_price,is_verified,is_available").eq("id", data.providerId).maybeSingle();
    if (!provider?.is_verified || !provider.is_available || provider.service_id !== data.serviceId) throw new Error("This provider is not available for booking.");
    const { data: booking, error } = await context.supabase.from("bookings").insert({ customer_id: context.userId, provider_id: provider.id, service_id: data.serviceId, booking_date: data.bookingDate, booking_time: data.bookingTime, service_address: data.serviceAddress, quoted_price: provider.starting_price, notes: data.notes || null }).select("id").single();
    if (error || !booking) throw new Error("Booking request could not be created.");
    return booking;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: provider }, { data: customerBookings }, { data: payments }, { data: favourites }, { data: notifications }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("provider_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("bookings").select("*,provider_profiles(display_name,skill,phone),services(name)").eq("customer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("payments").select("*").eq("customer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("favourites").select("*,provider_profiles(display_name,skill,district,rating)").eq("user_id", context.userId),
      context.supabase.from("notifications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20),
    ]);
    let providerBookings: Database["public"]["Tables"]["bookings"]["Row"][] = [];
    let wallet: Database["public"]["Tables"]["wallets"]["Row"] | null = null;
    let withdrawals: Database["public"]["Tables"]["withdrawal_requests"]["Row"][] = [];
    if (provider) {
      const results = await Promise.all([
        context.supabase.from("bookings").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
        context.supabase.from("wallets").select("*").eq("provider_id", provider.id).maybeSingle(),
        context.supabase.from("withdrawal_requests").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
      ]);
      providerBookings = results[0].data ?? []; wallet = results[1].data; withdrawals = results[2].data ?? [];
    }
    return { roles: (roles ?? []).map((row) => row.role), provider, customerBookings: customerBookings ?? [], providerBookings, payments: payments ?? [], favourites: favourites ?? [], notifications: notifications ?? [], wallet, withdrawals };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid(), status: z.enum(["accepted", "rejected", "in_progress", "completed", "cancelled"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("bookings").update({ status: data.status }).eq("id", data.bookingId);
    if (error) throw new Error("Booking status could not be updated.");
    return { ok: true };
  });

export const setProviderAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ available: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("provider_profiles").update({ is_available: data.available }).eq("user_id", context.userId);
    if (error) throw new Error("Availability could not be changed.");
    return { ok: true };
  });

export const toggleFavourite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ providerId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: current } = await context.supabase.from("favourites").select("provider_id").eq("user_id", context.userId).eq("provider_id", data.providerId).maybeSingle();
    const result = current ? await context.supabase.from("favourites").delete().eq("user_id", context.userId).eq("provider_id", data.providerId) : await context.supabase.from("favourites").insert({ user_id: context.userId, provider_id: data.providerId });
    if (result.error) throw new Error("Favourite could not be updated.");
    return { saved: !current };
  });

export const getAdminWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, providers, kyc, bookings, payments, withdrawals, reports, disputes, coupons, plans, methods, commission] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,phone,district,account_type,created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("provider_profiles").select("id,display_name,skill,district,is_verified,is_featured,is_available,rating").order("created_at", { ascending: false }),
      supabaseAdmin.from("provider_kyc").select("id,provider_user_id,status,rejection_reason,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("bookings").select("id,status,payment_status,quoted_price,booking_date,created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_reports").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("booking_disputes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscription_plans").select("*").order("price"),
      supabaseAdmin.from("payment_methods").select("*").order("method"),
      supabaseAdmin.from("commission_settings").select("*").eq("is_active", true).maybeSingle(),
    ]);
    return { profiles: profiles.data ?? [], providers: providers.data ?? [], kyc: kyc.data ?? [], bookings: bookings.data ?? [], payments: payments.data ?? [], withdrawals: withdrawals.data ?? [], reports: reports.data ?? [], disputes: disputes.data ?? [], coupons: coupons.data ?? [], plans: plans.data ?? [], methods: methods.data ?? [], commission: commission.data };
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ providerUserId: z.string().uuid(), approved: z.boolean(), reason: z.string().trim().max(300) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.approved ? "approved" : "rejected";
    const { error } = await supabaseAdmin.from("provider_kyc").update({ status, rejection_reason: data.approved ? null : data.reason || "Documents need correction.", reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("provider_user_id", data.providerUserId);
    if (error) throw new Error("KYC review could not be saved.");
    await supabaseAdmin.from("provider_profiles").update({ is_verified: data.approved }).eq("user_id", data.providerUserId);
    return { ok: true };
  });