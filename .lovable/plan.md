# Complete all remaining SkillEarn Assam workflows

## Goal
Finish every remaining workflow from the approved feature brief as a polished, mobile-first app experience. Existing database tables and secure server actions will be reused wherever possible.

## Member experience
- Replace the crowded dashboard forms with clear sections/tabs for bookings, payments, activity, growth, safety, and notifications.
- Add booking chat threads with message history for both customers and providers.
- Show payment history, refund status, commission breakdown, and a printable/downloadable receipt page.
- Show available coupons and applied discounts, completed-job review submission/history, reports, disputes, and their resolution status.
- Add saved emergency-contact management and blocked-provider list with unblock controls.
- Show each user's referral code with copy/share, referral history, rewards, and leaderboard.
- Show provider subscription and featured-listing request status, expiry, and available plans.
- Surface provider reviews and allow provider replies.

## Admin experience
- Organize admin controls into focused sections for customers, providers, KYC, bookings, payments, commission, withdrawals, coupons, referrals, reviews, complaints, notifications, banners/announcements, featured providers, plans, reports, settings, and Assam locations.
- Add provider feature approval, subscription approval, active/inactive controls for services/plans/coupons, and district/block/GP-village management.
- Add searchable/filterable lists and status actions for operational queues.
- Notify affected users when KYC, payment, withdrawal, refund, report, or dispute decisions change.

## Payment and financial correctness
- Keep the current admin-verified payment-reference flow because built-in live payment providers are unavailable for this India marketplace.
- Add formatted receipt viewing/printing and clear payment/refund statuses.
- Make processed refunds reverse provider wallet earnings exactly once and preserve commission/accounting consistency.
- Add expiry handling for stale pending payment references.

## Data and server work
- Extend dashboard loading with booking messages, blocked providers, referral codes/settings, available coupons, review details, and status histories.
- Extend member/admin actions for emergency-contact deletion, provider review replies, referral-code creation, subscription/featured decisions, location management, and notification creation.
- Add only the minimum migration needed for refund safety, payment expiry, provider replies/status controls, and supporting policies/grants.

## Verification
- Test customer, provider, and admin paths with authenticated sessions: booking lifecycle, chat, coupon, payment/receipt/refund, KYC, wallet/withdrawal, subscription/featured, referral, reviews, safety cases, notifications, and admin decisions.
- Verify mobile layouts at 392×852 and desktop at 1280×1800, including navigation, no horizontal overflow, and readable forms/lists.
- Run the production build and database security checks, then update the completion roadmap with any external limitation clearly marked.

## Delivery boundary
- Live automatic gateway charging/refunds cannot be enabled because Lovable’s built-in payment providers are unavailable for this seller country and marketplace type. The app will provide a complete manual payment-verification, receipt, and refund workflow instead.
- SMS/push delivery is outside the existing brief; notifications remain inside the app.
