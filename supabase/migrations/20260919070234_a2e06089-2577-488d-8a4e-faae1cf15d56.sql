REVOKE EXECUTE ON FUNCTION public.settle_paid_booking() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_provider_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_balance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paid_booking() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_provider_rating() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_balance() TO service_role;