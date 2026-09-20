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
    import.meta.env["VITE_SUPABASE_URL"],
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
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
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error("Admin access could not be created.");
    return { claimed: Boolean(data) };
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
    const [{ data: roles }, { data: provider }, { data: customerBookings }, { data: payments }, { data: favourites }, { data: notifications }, { data: paymentMethods }, { data: commission }, { data: plans }, { data: referrals }, { data: reports }, { data: disputes }, { data: emergencyContacts }, { data: refunds }, { data: announcements }, { data: settings }, { data: reviews }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("provider_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("bookings").select("*,provider_profiles(display_name,skill,phone),services(name)").eq("customer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("payments").select("*").eq("customer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("favourites").select("*,provider_profiles(display_name,skill,district,rating)").eq("user_id", context.userId),
      context.supabase.from("notifications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20),
      context.supabase.from("payment_methods").select("id,method,label,demo_mode").eq("is_enabled", true),
      context.supabase.from("commission_settings").select("commission_percent,minimum_withdrawal").eq("is_active", true).maybeSingle(),
      context.supabase.from("subscription_plans").select("*").eq("is_active", true).order("price"),
      context.supabase.from("referrals").select("*").or(`referrer_id.eq.${context.userId},referred_id.eq.${context.userId}`).order("created_at", { ascending: false }),
      context.supabase.from("user_reports").select("*").eq("reporter_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("booking_disputes").select("*").eq("raised_by", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("emergency_contacts").select("*").eq("user_id", context.userId).order("is_primary", { ascending: false }),
      context.supabase.from("refunds").select("*").eq("customer_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("admin_announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(10),
      context.supabase.from("marketplace_settings").select("key,value"),
      context.supabase.from("reviews").select("*").eq("customer_id", context.userId).order("created_at", { ascending: false }),
    ]);
    let providerBookings: Database["public"]["Tables"]["bookings"]["Row"][] = [];
    let wallet: Database["public"]["Tables"]["wallets"]["Row"] | null = null;
    let withdrawals: Database["public"]["Tables"]["withdrawal_requests"]["Row"][] = [];
    let subscriptions: Database["public"]["Tables"]["provider_subscriptions"]["Row"][] = [];
    let featuredRequests: Database["public"]["Tables"]["featured_requests"]["Row"][] = [];
    if (provider) {
      const results = await Promise.all([
        context.supabase.from("bookings").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
        context.supabase.from("wallets").select("*").eq("provider_id", provider.id).maybeSingle(),
        context.supabase.from("withdrawal_requests").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
        context.supabase.from("provider_subscriptions").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
        context.supabase.from("featured_requests").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }),
      ]);
      providerBookings = results[0].data ?? []; wallet = results[1].data; withdrawals = results[2].data ?? []; subscriptions = results[3].data ?? []; featuredRequests = results[4].data ?? [];
    }
    return { roles: (roles ?? []).map((row) => row.role), provider, customerBookings: customerBookings ?? [], providerBookings, payments: payments ?? [], favourites: favourites ?? [], notifications: notifications ?? [], paymentMethods: paymentMethods ?? [], commission, wallet, withdrawals, plans: plans ?? [], subscriptions, featuredRequests, referrals: referrals ?? [], reports: reports ?? [], disputes: disputes ?? [], emergencyContacts: emergencyContacts ?? [], refunds: refunds ?? [], announcements: announcements ?? [], settings: settings ?? [], reviews: reviews ?? [] };
  });

export const createPaymentReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid(), method: z.enum(["qr", "upi", "card", "net_banking", "bank", "paypal"]), reference: z.string().trim().min(3).max(100) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: booking } = await context.supabase.from("bookings").select("id,customer_id,quoted_price,status,payment_status").eq("id", data.bookingId).eq("customer_id", context.userId).maybeSingle();
    if (!booking || !["accepted", "in_progress", "completed"].includes(booking.status) || booking.payment_status === "paid") throw new Error("This booking is not ready for payment.");
    const { data: method } = await context.supabase.from("payment_methods").select("method,is_enabled,demo_mode").eq("method", data.method).eq("is_enabled", true).maybeSingle();
    if (!method) throw new Error("This payment option is not enabled.");
    const { data: duplicate } = await context.supabase.from("payments").select("id").ilike("transaction_reference", data.reference).neq("status", "failed").maybeSingle();
    if (duplicate) throw new Error("This payment reference has already been submitted.");
    const { error } = await context.supabase.from("payments").insert({ booking_id: booking.id, customer_id: context.userId, amount: booking.quoted_price, method: data.method, transaction_reference: data.reference, expires_at: data.method === "qr" ? new Date(Date.now() + 10 * 60_000).toISOString() : null });
    if (error) throw new Error("Payment reference could not be submitted.");
    return { pendingVerification: true, demoMode: method.demo_mode };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ amount: z.number().positive(), method: z.enum(["upi", "bank"]), details: z.string().trim().min(3).max(200) }).parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: provider }, { data: settings }] = await Promise.all([context.supabase.from("provider_profiles").select("id").eq("user_id", context.userId).maybeSingle(), context.supabase.from("commission_settings").select("minimum_withdrawal").eq("is_active", true).maybeSingle()]);
    if (!provider) throw new Error("Provider account is required.");
    if (data.amount < Number(settings?.minimum_withdrawal ?? 500)) throw new Error(`Minimum withdrawal is ₹${settings?.minimum_withdrawal ?? 500}.`);
    const { data: wallet } = await context.supabase.from("wallets").select("balance").eq("provider_id", provider.id).maybeSingle();
    if (data.amount > Number(wallet?.balance ?? 0)) throw new Error("Withdrawal amount exceeds your available balance.");
    const { error } = await context.supabase.from("withdrawal_requests").insert({ provider_id: provider.id, amount: data.amount, method: data.method, payout_details: { value: data.details } });
    if (error) throw new Error("Withdrawal request could not be submitted.");
    return { ok: true };
  });

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ paymentId: z.string().uuid(), approved: z.boolean(), note: z.string().trim().max(300) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").update({ status: data.approved ? "paid" : "failed", verification_note: data.note || null, verified_by: context.userId, verified_at: new Date().toISOString() }).eq("id", data.paymentId).eq("status", "pending");
    if (error) throw new Error("Payment review could not be saved.");
    return { ok: true };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ withdrawalId: z.string().uuid(), status: z.enum(["approved", "paid", "rejected"]), note: z.string().trim().max(300) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("withdrawal_requests").update({ status: data.status, admin_note: data.note || null, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", data.withdrawalId);
    if (error) throw new Error("Withdrawal review could not be saved.");
    return { ok: true };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: z.string().uuid(), status: z.enum(["accepted", "rejected", "in_progress", "completed", "cancelled"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: booking } = await context.supabase.from("bookings").select("customer_id,provider_id,status").eq("id", data.bookingId).maybeSingle();
    if (!booking) throw new Error("Booking not found.");
    const { data: provider } = await context.supabase.from("provider_profiles").select("id").eq("id", booking.provider_id).eq("user_id", context.userId).maybeSingle();
    if (booking.customer_id !== context.userId && !provider) throw new Error("Booking access required.");
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
    const [profiles, providers, kyc, bookings, payments, withdrawals, reports, disputes, coupons, plans, methods, commission, refunds, announcements, services, locations, featured, reviews, referrals] = await Promise.all([
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
      supabaseAdmin.from("refunds").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("admin_announcements").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("services").select("*").order("name"),
      supabaseAdmin.from("districts").select("*").order("name"),
      supabaseAdmin.from("featured_requests").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("reviews").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("referrals").select("*").order("created_at", { ascending: false }),
    ]);
    return { profiles: profiles.data ?? [], providers: providers.data ?? [], kyc: kyc.data ?? [], bookings: bookings.data ?? [], payments: payments.data ?? [], withdrawals: withdrawals.data ?? [], reports: reports.data ?? [], disputes: disputes.data ?? [], coupons: coupons.data ?? [], plans: plans.data ?? [], methods: methods.data ?? [], commission: commission.data, refunds: refunds.data ?? [], announcements: announcements.data ?? [], services: services.data ?? [], locations: locations.data ?? [], featured: featured.data ?? [], reviews: reviews.data ?? [], referrals: referrals.data ?? [] };
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

const memberActionSchema = z.object({
  action: z.enum(["review", "report", "dispute", "block", "unblock", "message", "notification", "emergency", "coupon", "referral", "subscription", "featured", "refund"]),
  bookingId: z.string().uuid().optional(), providerId: z.string().uuid().optional(), paymentId: z.string().uuid().optional(), planId: z.string().uuid().optional(), notificationId: z.string().uuid().optional(), contactId: z.string().uuid().optional(),
  text: z.string().trim().max(1000).optional(), secondary: z.string().trim().max(300).optional(), rating: z.number().int().min(1).max(5).optional(),
});

export const runMemberAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => memberActionSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "notification" && data.notificationId) {
      const { error } = await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", data.notificationId).eq("user_id", context.userId); if (error) throw error;
    } else if (data.action === "emergency") {
      if (!data.text || !data.secondary) throw new Error("Contact name and phone are required.");
      const contact = { user_id: context.userId, name: data.text, phone: data.secondary, relation: "Emergency", is_primary: true, ...(data.contactId ? { id: data.contactId } : {}) };
      const { error } = await context.supabase.from("emergency_contacts").upsert(contact); if (error) throw error;
    } else if (data.action === "coupon" && data.bookingId && data.text) {
      const { data: booking } = await context.supabase.from("bookings").select("*").eq("id", data.bookingId).eq("customer_id", context.userId).maybeSingle();
      const { data: coupon } = await context.supabase.from("coupons").select("*").ilike("code", data.text).eq("is_active", true).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!booking || !coupon || Number(booking.quoted_price) < Number(coupon.minimum_booking) || (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit)) throw new Error("Coupon is invalid or unavailable.");
      const discount = coupon.discount_type === "percent" ? Number(booking.quoted_price) * Math.min(Number(coupon.discount_value), 100) / 100 : Math.min(Number(coupon.discount_value), Number(booking.quoted_price));
      await supabaseAdmin.from("coupon_usage").upsert({ coupon_id: coupon.id, booking_id: booking.id, user_id: context.userId, discount_amount: discount }, { onConflict: "booking_id" });
      await supabaseAdmin.from("bookings").update({ coupon_id: coupon.id, discount_amount: discount }).eq("id", booking.id); await supabaseAdmin.from("coupons").update({ used_count: coupon.used_count + 1 }).eq("id", coupon.id);
    } else if (data.action === "review" && data.bookingId && data.rating) {
      const { data: booking } = await context.supabase.from("bookings").select("id,provider_id,status").eq("id", data.bookingId).eq("customer_id", context.userId).eq("status", "completed").maybeSingle(); if (!booking) throw new Error("Only completed bookings can be reviewed.");
      const { error } = await context.supabase.from("reviews").insert({ booking_id: booking.id, customer_id: context.userId, provider_id: booking.provider_id, rating: data.rating, comment: data.text || null }); if (error) throw new Error("Review already submitted or unavailable.");
    } else if (data.action === "message" && data.bookingId && data.text) {
      const { data: booking } = await context.supabase.from("bookings").select("id,customer_id,provider_id").eq("id", data.bookingId).maybeSingle(); const { data: provider } = booking ? await context.supabase.from("provider_profiles").select("id").eq("id", booking.provider_id).eq("user_id", context.userId).maybeSingle() : { data: null }; if (!booking || (booking.customer_id !== context.userId && !provider)) throw new Error("Booking access required.");
      const { error } = await context.supabase.from("booking_messages").insert({ booking_id: booking.id, sender_id: context.userId, message: data.text }); if (error) throw error;
    } else if (data.action === "dispute" && data.bookingId && data.text) {
      const { data: booking } = await context.supabase.from("bookings").select("id,customer_id,provider_id").eq("id", data.bookingId).maybeSingle(); const { data: provider } = booking ? await context.supabase.from("provider_profiles").select("id").eq("id", booking.provider_id).eq("user_id", context.userId).maybeSingle() : { data: null }; if (!booking || (booking.customer_id !== context.userId && !provider)) throw new Error("Booking access required.");
      const { error } = await context.supabase.from("booking_disputes").insert({ booking_id: booking.id, raised_by: context.userId, reason: data.text }); if (error) throw error;
    } else if (data.action === "report" && data.providerId && data.text) {
      const { error } = await context.supabase.from("user_reports").insert({ reporter_id: context.userId, target_provider_id: data.providerId, booking_id: data.bookingId || null, reason: data.text, details: data.secondary || null }); if (error) throw error;
    } else if (["block", "unblock"].includes(data.action) && data.providerId) {
      const result = data.action === "block" ? await context.supabase.from("blocked_providers").insert({ user_id: context.userId, provider_id: data.providerId }) : await context.supabase.from("blocked_providers").delete().eq("user_id", context.userId).eq("provider_id", data.providerId); if (result.error) throw result.error;
    } else if (data.action === "referral" && data.text) {
      const { data: codeOwner } = await supabaseAdmin.from("referral_codes").select("*").ilike("code", data.text).maybeSingle(); if (!codeOwner || codeOwner.user_id === context.userId) throw new Error("Referral code cannot be used."); const { count } = await supabaseAdmin.from("referrals").select("id", { count: "exact", head: true }).eq("referred_id", context.userId); if (count) throw new Error("A referral has already been applied.");
      await supabaseAdmin.from("referrals").insert({ referrer_id: codeOwner.user_id, referred_id: context.userId, reward_amount: 50, status: "rewarded" }); await supabaseAdmin.from("referral_codes").update({ uses: codeOwner.uses + 1, rewards_earned: Number(codeOwner.rewards_earned) + 50 }).eq("user_id", codeOwner.user_id);
    } else if (data.action === "subscription" && data.planId) {
      const { data: provider } = await context.supabase.from("provider_profiles").select("id").eq("user_id", context.userId).maybeSingle(); if (!provider) throw new Error("Provider account required."); await supabaseAdmin.from("provider_subscriptions").insert({ provider_id: provider.id, plan_id: data.planId, status: "pending" });
    } else if (data.action === "featured") {
      const { data: provider } = await context.supabase.from("provider_profiles").select("id").eq("user_id", context.userId).maybeSingle(); if (!provider) throw new Error("Provider account required."); await context.supabase.from("featured_requests").insert({ provider_id: provider.id, plan_id: data.planId || null });
    } else if (data.action === "refund" && data.paymentId && data.text) {
      const { data: payment } = await context.supabase.from("payments").select("*").eq("id", data.paymentId).eq("customer_id", context.userId).eq("status", "paid").maybeSingle(); if (!payment) throw new Error("Paid payment required."); await context.supabase.from("refunds").insert({ payment_id: payment.id, booking_id: payment.booking_id, customer_id: context.userId, amount: payment.amount, reason: data.text });
    } else throw new Error("Action details are incomplete.");
    return { ok: true };
  });

const adminActionSchema = z.object({ action: z.enum(["method", "commission", "feature", "report", "dispute", "refund", "coupon", "plan", "service", "announcement"]), id: z.string().optional(), status: z.string().optional(), name: z.string().trim().max(100).optional(), value: z.number().optional(), secondary: z.number().optional(), text: z.string().trim().max(1000).optional(), enabled: z.boolean().optional() });
export const runAdminAction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => adminActionSchema.parse(input)).handler(async ({ context, data }) => {
  await requireAdmin(context); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); let error: unknown = null;
  if (data.action === "method" && data.id) ({ error } = await supabaseAdmin.from("payment_methods").update({ is_enabled: Boolean(data.enabled) }).eq("id", data.id));
  else if (data.action === "commission" && data.id && data.value !== undefined && data.secondary !== undefined) ({ error } = await supabaseAdmin.from("commission_settings").update({ commission_percent: data.value, minimum_withdrawal: data.secondary }).eq("id", data.id));
  else if (data.action === "feature" && data.id) { ({ error } = await supabaseAdmin.from("provider_profiles").update({ is_featured: Boolean(data.enabled) }).eq("id", data.id)); await supabaseAdmin.from("featured_requests").update({ status: data.enabled ? "approved" : "rejected", starts_at: data.enabled ? new Date().toISOString() : null }).eq("provider_id", data.id).eq("status", "pending"); }
  else if (data.action === "report" && data.id && data.status) ({ error } = await supabaseAdmin.from("user_reports").update({ status: data.status, details: data.text || null }).eq("id", data.id));
  else if (data.action === "dispute" && data.id && data.status) ({ error } = await supabaseAdmin.from("booking_disputes").update({ status: data.status, resolution: data.text || null, reviewed_by: context.userId }).eq("id", data.id));
  else if (data.action === "refund" && data.id && data.status) { ({ error } = await supabaseAdmin.from("refunds").update({ status: data.status, admin_note: data.text || null, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", data.id)); if (data.status === "processed") { const { data: refund } = await supabaseAdmin.from("refunds").select("payment_id,booking_id").eq("id", data.id).single(); if (refund) { await supabaseAdmin.from("payments").update({ status: "refunded" }).eq("id", refund.payment_id); await supabaseAdmin.from("bookings").update({ payment_status: "refunded" }).eq("id", refund.booking_id); } } }
  else if (data.action === "coupon" && data.name) ({ error } = await supabaseAdmin.from("coupons").insert({ code: data.name.toUpperCase(), discount_type: "percent", discount_value: data.value || 10, minimum_booking: data.secondary || 0, expires_at: data.text || new Date(Date.now()+30*86400000).toISOString() }));
  else if (data.action === "plan" && data.name) ({ error } = await supabaseAdmin.from("subscription_plans").insert({ name: data.name, price: data.value || 0, benefits: { description: data.text || "Provider plan" } }));
  else if (data.action === "service" && data.name) ({ error } = await supabaseAdmin.from("services").insert({ name: data.name, icon: data.text || "BriefcaseBusiness" }));
  else if (data.action === "announcement" && data.name && data.text) ({ error } = await supabaseAdmin.from("admin_announcements").insert({ title: data.name, message: data.text, audience: data.status || "all", created_by: context.userId }));
  else throw new Error("Admin action details are incomplete."); if (error) throw new Error("Admin change could not be saved."); return { ok: true };
});