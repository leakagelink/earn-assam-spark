# SkillEarn Assam — Remaining Modules Plan

## Goal
Complete the marketplace in priority phases while preserving the current mobile-first dark design. Every user-owned feature will require sign-in, enforce role permissions, and persist in Lovable Cloud.

## Phase 1 — Secure foundation, live listings, and Assam locations
- Create customer profiles and default roles after registration; provide a secure one-time path to make the current signed-in account the first admin.
- Harden provider and booking permissions so providers cannot self-verify, self-feature, change ratings, or bypass booking/payment states.
- Add District → Block → GP/Village data and cascading selectors.
- Replace hardcoded provider cards and services with live approved records, including advanced filters for service, location, price, rating, experience, and availability.
- Add provider detail view with Call, Chat, Favourite, Report, and Book actions.

## Phase 2 — Provider onboarding and KYC
- Add provider onboarding for profile, skill, pricing, service area, experience, availability, and plan.
- Add secure private uploads for Aadhaar, PAN, and certificate documents.
- Add KYC submission states: draft, pending, approved, rejected; only admins can approve and grant the verified badge.
- Add an admin review queue with document access, approval/rejection, reason, and audit history.

## Phase 3 — Booking lifecycle and customer/provider dashboards
- Save real booking requests with service, date, time, address, notes, price, and confirmation.
- Enforce valid transitions: pending → accepted/rejected → in progress → completed; customer cancellation follows policy.
- Build customer dashboard sections for pending/completed/cancelled bookings, favourites, payments, receipts, and reviews.
- Build provider dashboard sections for today's bookings, pending/completed jobs, availability, earnings, reviews, analytics, and KYC status.
- Add in-app chat linked to a booking and emergency contact information.

## Phase 4 — Hybrid payment, commission, wallet, and withdrawals
- Add admin-configurable payment methods: QR, UPI, bank transfer, PayPal, and optional future payment-gateway settings.
- QR flow shows a 10-minute expiry countdown and transaction/reference ID submission.
- A clearly labelled demo mode may show simulated success at 4:30 for testing. Production paid status requires admin or payment-provider verification and can never be set by the customer timer alone.
- Generate a payment record and downloadable receipt after verification.
- Automatically calculate platform commission and provider earnings from completed paid bookings.
- Add provider wallet ledger, bank/UPI payout details, minimum withdrawal, withdrawal requests, and admin approval/rejection.
- Add cancellation, refund, and dispute handling with auditable status changes.

## Phase 5 — Business growth modules
- Add Free, Basic, and Premium plans with admin-managed benefits and provider subscriptions.
- Add sponsored/featured listing scheduling and labels.
- Add customer/provider referral codes, rewards, history, and leaderboard-ready totals.
- Add admin-created coupons with discount type/value, expiry, minimum booking, usage limits, and redemption history.
- Add booking-linked ratings/reviews, aggregate ratings, report/block provider, and complaint/dispute workflows.

## Phase 6 — Complete admin control
- Build role-protected admin pages for dashboard metrics, customers, providers, KYC, services, Assam locations, bookings, payments, commissions, withdrawals, plans, featured listings, coupons, referrals, reviews, complaints, notifications, banners, reports, and settings.
- Add notification records for booking, KYC, payment, withdrawal, review, and complaint events.
- Record privileged admin actions in an audit log.

## Technical details
- Use TanStack protected routes for customer, provider, and admin workspaces; public discovery remains server-rendered.
- Use authenticated server functions and row-level policies for all personal and financial data.
- Store KYC files privately and expose them only through short-lived authorized access.
- Use transactional database functions for booking transitions, payment verification, commission, wallet credits, refunds, and withdrawal decisions.
- Keep real-payment credentials out of source code. External gateway activation can be added later without changing the hybrid manual-payment flow.
- Verify each phase on desktop and 392px mobile, including loading, empty, error, and permission states.

## Delivery order
1. Phase 1 + Phase 2
2. Phase 3
3. Phase 4
4. Phase 5
5. Phase 6 and full regression/security checks
