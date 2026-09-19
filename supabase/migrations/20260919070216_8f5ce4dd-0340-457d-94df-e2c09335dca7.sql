ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK (method IN ('qr','upi','card','net_banking','bank','paypal'));
CREATE UNIQUE INDEX IF NOT EXISTS wallet_one_earning_per_booking ON public.wallet_transactions(booking_id) WHERE kind='earning';
CREATE TABLE public.blocked_providers (user_id uuid NOT NULL, provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,provider_id));
GRANT SELECT,INSERT,DELETE ON public.blocked_providers TO authenticated;
GRANT ALL ON public.blocked_providers TO service_role;
ALTER TABLE public.blocked_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_own" ON public.blocked_providers FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.settle_paid_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_provider uuid; v_percent numeric; v_net numeric;
BEGIN
  IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT provider_id INTO v_provider FROM public.bookings WHERE id=NEW.booking_id;
    SELECT COALESCE(commission_percent,10) INTO v_percent FROM public.commission_settings WHERE is_active=true ORDER BY created_at DESC LIMIT 1;
    v_net := ROUND(NEW.amount * (100-COALESCE(v_percent,10))/100,2);
    NEW.receipt_number := COALESCE(NEW.receipt_number,'SEA-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(NEW.id::text,'-',''),1,8)));
    NEW.verified_at := COALESCE(NEW.verified_at,now());
    UPDATE public.bookings SET payment_status='paid' WHERE id=NEW.booking_id;
    INSERT INTO public.wallets(provider_id,balance,lifetime_earnings) VALUES(v_provider,v_net,v_net) ON CONFLICT(provider_id) DO UPDATE SET balance=public.wallets.balance+EXCLUDED.balance,lifetime_earnings=public.wallets.lifetime_earnings+EXCLUDED.lifetime_earnings,updated_at=now();
    INSERT INTO public.wallet_transactions(provider_id,booking_id,kind,amount,description) VALUES(v_provider,NEW.booking_id,'earning',v_net,'Booking earning after platform commission') ON CONFLICT DO NOTHING;
  ELSIF NEW.status='refunded' AND OLD.status='paid' THEN
    UPDATE public.bookings SET payment_status='refunded' WHERE id=NEW.booking_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payments_settlement BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.settle_paid_booking();
CREATE OR REPLACE FUNCTION public.refresh_provider_rating() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_provider uuid;
BEGIN
  v_provider := COALESCE(NEW.provider_id,OLD.provider_id);
  UPDATE public.provider_profiles p SET rating=COALESCE((SELECT ROUND(AVG(r.rating)::numeric,2) FROM public.reviews r WHERE r.provider_id=v_provider),0),review_count=(SELECT COUNT(*) FROM public.reviews r WHERE r.provider_id=v_provider) WHERE p.id=v_provider;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER reviews_refresh_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_provider_rating();
CREATE OR REPLACE FUNCTION public.process_withdrawal_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    UPDATE public.wallets SET balance=balance-NEW.amount,updated_at=now() WHERE provider_id=NEW.provider_id AND balance>=NEW.amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
    INSERT INTO public.wallet_transactions(provider_id,kind,amount,description) VALUES(NEW.provider_id,'withdrawal',-NEW.amount,'Approved withdrawal');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER withdrawals_balance BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.process_withdrawal_balance();