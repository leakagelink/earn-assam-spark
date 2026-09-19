ALTER TABLE public.bookings ADD COLUMN coupon_id uuid REFERENCES public.coupons(id), ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0), ADD COLUMN emergency_contact_id uuid;
ALTER TABLE public.reviews ADD COLUMN provider_reply text, ADD COLUMN replied_at timestamptz;
CREATE UNIQUE INDEX payments_transaction_reference_unique ON public.payments (lower(transaction_reference)) WHERE transaction_reference IS NOT NULL AND status <> 'failed';

CREATE TABLE public.refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES public.payments(id), booking_id uuid NOT NULL REFERENCES public.bookings(id), customer_id uuid NOT NULL, amount numeric NOT NULL CHECK (amount > 0), reason text NOT NULL, status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processed','rejected')), admin_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refunds TO authenticated; GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_owner_admin_read ON public.refunds FOR SELECT TO authenticated USING (customer_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY refunds_owner_request ON public.refunds FOR INSERT TO authenticated WITH CHECK (customer_id=auth.uid() AND status='requested');
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.emergency_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 80), phone text NOT NULL CHECK(length(trim(phone)) BETWEEN 6 AND 20), relation text NOT NULL DEFAULT '', is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated; GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY emergency_contacts_owner ON public.emergency_contacts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TRIGGER emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.bookings ADD CONSTRAINT bookings_emergency_contact_fk FOREIGN KEY (emergency_contact_id) REFERENCES public.emergency_contacts(id) ON DELETE SET NULL;

CREATE TABLE public.referral_codes (
 user_id uuid PRIMARY KEY, code text NOT NULL UNIQUE, uses integer NOT NULL DEFAULT 0, rewards_earned numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_codes TO authenticated; GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_codes_owner ON public.referral_codes FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY referral_codes_owner_create ON public.referral_codes FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());

CREATE TABLE public.referral_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_reward numeric NOT NULL DEFAULT 50 CHECK(customer_reward>=0), provider_reward numeric NOT NULL DEFAULT 100 CHECK(provider_reward>=0), is_active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_settings TO authenticated; GRANT INSERT, UPDATE, DELETE ON public.referral_settings TO authenticated; GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_settings_read ON public.referral_settings FOR SELECT TO authenticated USING(true);
CREATE POLICY referral_settings_admin ON public.referral_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
INSERT INTO public.referral_settings DEFAULT VALUES;

CREATE TABLE public.coupon_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL REFERENCES public.coupons(id), booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id), user_id uuid NOT NULL, discount_amount numeric NOT NULL CHECK(discount_amount>=0), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupon_usage TO authenticated; GRANT ALL ON public.coupon_usage TO service_role;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupon_usage_owner_admin_read ON public.coupon_usage FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.featured_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id uuid NOT NULL REFERENCES public.provider_profiles(id), plan_id uuid REFERENCES public.subscription_plans(id), starts_at timestamptz, expires_at timestamptz, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')), admin_note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.featured_requests TO authenticated; GRANT ALL ON public.featured_requests TO service_role;
ALTER TABLE public.featured_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY featured_requests_owner_admin_read ON public.featured_requests FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.provider_profiles p WHERE p.id=provider_id AND p.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY featured_requests_owner_create ON public.featured_requests FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.provider_profiles p WHERE p.id=provider_id AND p.user_id=auth.uid()) AND status='pending');
CREATE TRIGGER featured_requests_updated_at BEFORE UPDATE ON public.featured_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.admin_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, message text NOT NULL, audience text NOT NULL DEFAULT 'all' CHECK(audience IN ('all','customer','provider')), is_active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_announcements TO authenticated; GRANT INSERT, UPDATE, DELETE ON public.admin_announcements TO authenticated; GRANT ALL ON public.admin_announcements TO service_role;
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_read ON public.admin_announcements FOR SELECT TO authenticated USING(is_active=true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY announcements_admin ON public.admin_announcements FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));

CREATE TABLE public.marketplace_settings (
 key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
GRANT SELECT ON public.marketplace_settings TO authenticated; GRANT INSERT, UPDATE, DELETE ON public.marketplace_settings TO authenticated; GRANT ALL ON public.marketplace_settings TO service_role;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_settings_read ON public.marketplace_settings FOR SELECT TO authenticated USING(true);
CREATE POLICY marketplace_settings_admin ON public.marketplace_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
INSERT INTO public.marketplace_settings(key,value) VALUES ('support',jsonb_build_object('emergency_phone','112','cancellation_policy','Free cancellation while pending; refunds require admin review.')) ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_booking_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE provider_user uuid;
BEGIN
 SELECT user_id INTO provider_user FROM public.provider_profiles WHERE id=NEW.provider_id;
 IF TG_OP='INSERT' THEN
  INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(provider_user,'booking','New booking request','A customer requested your service.',jsonb_build_object('booking_id',NEW.id));
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(NEW.customer_id,'booking','Booking status updated','Your booking is now '||replace(NEW.status::text,'_',' ')||'.',jsonb_build_object('booking_id',NEW.id,'status',NEW.status));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_booking_change() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.notify_booking_change() TO service_role;
CREATE TRIGGER notify_booking_change AFTER INSERT OR UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_booking_change();

CREATE OR REPLACE FUNCTION public.notify_payment_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.notifications(user_id,type,title,message,data) VALUES(NEW.customer_id,'payment','Payment status updated','Your payment is now '||NEW.status::text||'.',jsonb_build_object('payment_id',NEW.id,'booking_id',NEW.booking_id,'status',NEW.status)); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_payment_change() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.notify_payment_change() TO service_role;
CREATE TRIGGER notify_payment_change AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_payment_change();

CREATE OR REPLACE FUNCTION public.apply_booking_coupon(_booking_id uuid,_code text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; c public.coupons%ROWTYPE; discount numeric;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id AND customer_id=auth.uid() FOR UPDATE; IF b.id IS NULL OR b.status NOT IN ('pending','accepted') THEN RAISE EXCEPTION 'Booking cannot use a coupon'; END IF;
 SELECT * INTO c FROM public.coupons WHERE upper(code)=upper(trim(_code)) AND is_active AND expires_at>now() FOR UPDATE; IF c.id IS NULL OR b.quoted_price<c.minimum_booking OR (c.usage_limit IS NOT NULL AND c.used_count>=c.usage_limit) THEN RAISE EXCEPTION 'Coupon is invalid or unavailable'; END IF;
 discount:=CASE WHEN c.discount_type='percent' THEN round(b.quoted_price*least(c.discount_value,100)/100,2) ELSE least(c.discount_value,b.quoted_price) END;
 UPDATE public.bookings SET coupon_id=c.id,discount_amount=discount WHERE id=b.id; INSERT INTO public.coupon_usage(coupon_id,booking_id,user_id,discount_amount) VALUES(c.id,b.id,auth.uid(),discount) ON CONFLICT(booking_id) DO UPDATE SET coupon_id=excluded.coupon_id,discount_amount=excluded.discount_amount; UPDATE public.coupons SET used_count=used_count+1 WHERE id=c.id; RETURN discount;
END $$;
REVOKE ALL ON FUNCTION public.apply_booking_coupon(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.apply_booking_coupon(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_completed_review(_booking_id uuid,_rating int,_comment text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings%ROWTYPE; result uuid;
BEGIN IF _rating<1 OR _rating>5 THEN RAISE EXCEPTION 'Rating must be 1 to 5'; END IF; SELECT * INTO b FROM public.bookings WHERE id=_booking_id AND customer_id=auth.uid() AND status='completed'; IF b.id IS NULL THEN RAISE EXCEPTION 'Only completed bookings can be reviewed'; END IF; INSERT INTO public.reviews(booking_id,customer_id,provider_id,rating,comment) VALUES(b.id,auth.uid(),b.provider_id,_rating,nullif(trim(_comment),'')) RETURNING id INTO result; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.create_completed_review(uuid,int,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.create_completed_review(uuid,int,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_booking_dispute(_booking_id uuid,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN IF NOT EXISTS(SELECT 1 FROM public.bookings b LEFT JOIN public.provider_profiles p ON p.id=b.provider_id WHERE b.id=_booking_id AND (b.customer_id=auth.uid() OR p.user_id=auth.uid())) THEN RAISE EXCEPTION 'Booking access required'; END IF; INSERT INTO public.booking_disputes(booking_id,raised_by,reason) VALUES(_booking_id,auth.uid(),trim(_reason)) RETURNING id INTO result; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.create_booking_dispute(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.create_booking_dispute(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.send_booking_message(_booking_id uuid,_message text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN IF length(trim(_message))<1 OR length(_message)>1000 OR NOT EXISTS(SELECT 1 FROM public.bookings b LEFT JOIN public.provider_profiles p ON p.id=b.provider_id WHERE b.id=_booking_id AND (b.customer_id=auth.uid() OR p.user_id=auth.uid())) THEN RAISE EXCEPTION 'Booking access required'; END IF; INSERT INTO public.booking_messages(booking_id,sender_id,message) VALUES(_booking_id,auth.uid(),trim(_message)) RETURNING id INTO result; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.send_booking_message(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.send_booking_message(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; result uuid; reward numeric;
BEGIN SELECT user_id INTO owner_id FROM public.referral_codes WHERE upper(code)=upper(trim(_code)); IF owner_id IS NULL OR owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.referrals WHERE referred_id=auth.uid()) THEN RAISE EXCEPTION 'Referral code cannot be used'; END IF; SELECT CASE WHEN EXISTS(SELECT 1 FROM public.provider_profiles WHERE user_id=owner_id) THEN provider_reward ELSE customer_reward END INTO reward FROM public.referral_settings WHERE is_active LIMIT 1; INSERT INTO public.referrals(referrer_id,referred_id,reward_amount,status) VALUES(owner_id,auth.uid(),coalesce(reward,50),'rewarded') RETURNING id INTO result; UPDATE public.referral_codes SET uses=uses+1,rewards_earned=rewards_earned+coalesce(reward,50) WHERE user_id=owner_id; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.redeem_referral(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.redeem_referral(text) TO authenticated,service_role;

REVOKE EXECUTE ON FUNCTION public.settle_paid_booking() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_balance() FROM PUBLIC,anon,authenticated;