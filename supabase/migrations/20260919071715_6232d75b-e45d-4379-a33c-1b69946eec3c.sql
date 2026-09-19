ALTER FUNCTION public.apply_booking_coupon(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.create_completed_review(uuid,int,text) SECURITY INVOKER;
ALTER FUNCTION public.create_booking_dispute(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.send_booking_message(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.redeem_referral(text) SECURITY INVOKER;