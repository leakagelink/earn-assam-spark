ALTER TABLE public.provider_subscriptions DROP CONSTRAINT IF EXISTS provider_subscriptions_status_check;
ALTER TABLE public.provider_subscriptions ADD CONSTRAINT provider_subscriptions_status_check CHECK (status IN ('pending','active','expired','cancelled','rejected'));
ALTER TABLE public.provider_subscriptions ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_read ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.process_refund_financials() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_provider uuid; v_earning numeric; v_existing boolean;
BEGIN
  IF NEW.status='processed' AND OLD.status IS DISTINCT FROM 'processed' THEN
    SELECT b.provider_id INTO v_provider FROM public.bookings b WHERE b.id=NEW.booking_id;
    SELECT abs(wt.amount) INTO v_earning FROM public.wallet_transactions wt WHERE wt.booking_id=NEW.booking_id AND wt.kind='earning' LIMIT 1;
    SELECT EXISTS(SELECT 1 FROM public.wallet_transactions wt WHERE wt.booking_id=NEW.booking_id AND wt.kind='refund') INTO v_existing;
    IF NOT v_existing AND coalesce(v_earning,0)>0 THEN
      IF NOT EXISTS(SELECT 1 FROM public.wallets w WHERE w.provider_id=v_provider AND w.balance>=v_earning) THEN RAISE EXCEPTION 'Provider wallet has insufficient balance for this refund'; END IF;
      UPDATE public.wallets SET balance=balance-v_earning,lifetime_earnings=greatest(lifetime_earnings-v_earning,0),updated_at=now() WHERE provider_id=v_provider;
      INSERT INTO public.wallet_transactions(provider_id,booking_id,kind,amount,description) VALUES(v_provider,NEW.booking_id,'refund',-v_earning,'Earning reversed after processed refund');
    END IF;
    UPDATE public.payments SET status='refunded' WHERE id=NEW.payment_id AND status='paid';
    UPDATE public.bookings SET payment_status='refunded' WHERE id=NEW.booking_id;
    INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(NEW.customer_id,'refund','Refund processed','Your refund request has been processed.',jsonb_build_object('refund_id',NEW.id,'booking_id',NEW.booking_id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(NEW.customer_id,'refund','Refund status updated','Your refund request is now '||NEW.status||'.',jsonb_build_object('refund_id',NEW.id,'booking_id',NEW.booking_id));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.process_refund_financials() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund_financials() TO service_role;
CREATE TRIGGER refund_financials AFTER UPDATE OF status ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.process_refund_financials();

CREATE OR REPLACE FUNCTION public.expire_pending_payments() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
  UPDATE public.payments SET status='failed',verification_note='Payment reference expired' WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<now();
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.expire_pending_payments() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_payments() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_kyc_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(NEW.provider_user_id,'kyc','KYC status updated','Your KYC is now '||NEW.status::text||'.',jsonb_build_object('status',NEW.status,'reason',NEW.rejection_reason)); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_kyc_change() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.notify_kyc_change() TO service_role;
CREATE TRIGGER notify_kyc_change AFTER UPDATE OF status ON public.provider_kyc FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_change();

CREATE OR REPLACE FUNCTION public.notify_withdrawal_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid;
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN SELECT user_id INTO owner_id FROM public.provider_profiles WHERE id=NEW.provider_id; INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(owner_id,'withdrawal','Withdrawal status updated','Your withdrawal request is now '||NEW.status||'.',jsonb_build_object('withdrawal_id',NEW.id,'status',NEW.status)); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_withdrawal_change() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.notify_withdrawal_change() TO service_role;
CREATE TRIGGER notify_withdrawal_change AFTER UPDATE OF status ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_change();