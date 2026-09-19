CREATE TABLE public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.districts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "districts_public_read" ON public.districts FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "districts_admin_manage" ON public.districts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (district_id, name)
);
GRANT SELECT ON public.blocks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks_public_read" ON public.blocks FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "blocks_admin_manage" ON public.blocks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.villages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  name text NOT NULL,
  gp_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, gp_name, name)
);
GRANT SELECT ON public.villages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.villages TO authenticated;
GRANT ALL ON public.villages TO service_role;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "villages_public_read" ON public.villages FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "villages_admin_manage" ON public.villages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.provider_profiles ADD COLUMN district_id uuid REFERENCES public.districts(id), ADD COLUMN block_id uuid REFERENCES public.blocks(id), ADD COLUMN village_id uuid REFERENCES public.villages(id);
ALTER TABLE public.profiles ADD COLUMN district_id uuid REFERENCES public.districts(id), ADD COLUMN block_id uuid REFERENCES public.blocks(id), ADD COLUMN village_id uuid REFERENCES public.villages(id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, account_type)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(NEW.email, 'Member'), '@', 1)), 'customer')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, full_name, account_type)
SELECT u.id, COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), split_part(COALESCE(u.email, 'Member'), '@', 1)), 'customer'
FROM auth.users u ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'customer'::public.app_role FROM auth.users ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(90261019);
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.become_provider(
  _display_name text, _phone text, _service_id uuid, _skill text, _district_id uuid,
  _block_id uuid, _village_id uuid, _experience_years integer, _starting_price numeric,
  _price_unit text, _bio text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _provider_id uuid; _district text; _block text; _village text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(trim(_display_name)) < 2 OR _experience_years < 0 OR _starting_price < 0 THEN RAISE EXCEPTION 'Invalid provider details'; END IF;
  SELECT d.name, b.name, v.name INTO _district, _block, _village
  FROM public.districts d JOIN public.blocks b ON b.district_id = d.id JOIN public.villages v ON v.block_id = b.id
  WHERE d.id = _district_id AND b.id = _block_id AND v.id = _village_id AND d.is_active AND b.is_active AND v.is_active;
  IF _district IS NULL THEN RAISE EXCEPTION 'Invalid Assam location'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'provider') ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET full_name = trim(_display_name), phone = nullif(trim(_phone), ''), account_type = 'provider', district = _district, block_name = _block, village = _village, district_id = _district_id, block_id = _block_id, village_id = _village_id WHERE id = auth.uid();
  INSERT INTO public.provider_profiles (user_id, display_name, service_id, skill, district, block_name, village, district_id, block_id, village_id, experience_years, starting_price, price_unit, bio, is_available, is_verified, is_featured)
  VALUES (auth.uid(), trim(_display_name), _service_id, trim(_skill), _district, _block, _village, _district_id, _block_id, _village_id, _experience_years, _starting_price, _price_unit, nullif(trim(_bio), ''), false, false, false)
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, service_id = EXCLUDED.service_id, skill = EXCLUDED.skill, district = EXCLUDED.district, block_name = EXCLUDED.block_name, village = EXCLUDED.village, district_id = EXCLUDED.district_id, block_id = EXCLUDED.block_id, village_id = EXCLUDED.village_id, experience_years = EXCLUDED.experience_years, starting_price = EXCLUDED.starting_price, price_unit = EXCLUDED.price_unit, bio = EXCLUDED.bio
  RETURNING id INTO _provider_id;
  RETURN _provider_id;
END;
$$;
REVOKE ALL ON FUNCTION public.become_provider(text,text,uuid,text,uuid,uuid,uuid,integer,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.become_provider(text,text,uuid,text,uuid,uuid,uuid,integer,numeric,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_provider_system_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_verified := OLD.is_verified; NEW.is_featured := OLD.is_featured; NEW.rating := OLD.rating;
    NEW.review_count := OLD.review_count; NEW.completed_jobs := OLD.completed_jobs; NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_provider_system_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_provider_system_fields() TO service_role;
CREATE TRIGGER protect_provider_system_fields BEFORE UPDATE ON public.provider_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_provider_system_fields();

CREATE OR REPLACE FUNCTION public.protect_booking_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_provider boolean; _is_admin boolean;
BEGIN
  _is_provider := EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = OLD.provider_id AND user_id = auth.uid());
  _is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT _is_admin THEN
    NEW.customer_id := OLD.customer_id; NEW.provider_id := OLD.provider_id; NEW.service_id := OLD.service_id; NEW.quoted_price := OLD.quoted_price; NEW.payment_status := OLD.payment_status;
    IF auth.uid() = OLD.customer_id AND NEW.status NOT IN (OLD.status, 'cancelled') THEN RAISE EXCEPTION 'Customer cannot make this status change'; END IF;
    IF _is_provider AND NOT ((OLD.status = 'pending' AND NEW.status IN ('pending','accepted','rejected')) OR (OLD.status = 'accepted' AND NEW.status IN ('accepted','in_progress')) OR (OLD.status = 'in_progress' AND NEW.status IN ('in_progress','completed'))) THEN RAISE EXCEPTION 'Invalid provider status change'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_booking_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_booking_fields() TO service_role;
CREATE TRIGGER protect_booking_fields BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.protect_booking_fields();

CREATE OR REPLACE FUNCTION public.submit_kyc(_aadhaar_path text, _pan_path text, _certificate_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') THEN RAISE EXCEPTION 'Provider access required'; END IF;
  IF _aadhaar_path NOT LIKE auth.uid()::text || '/%' OR _pan_path NOT LIKE auth.uid()::text || '/%' THEN RAISE EXCEPTION 'Invalid document path'; END IF;
  INSERT INTO public.provider_kyc (provider_user_id, aadhaar_document_path, pan_document_path, certificate_path, status, rejection_reason, reviewed_by, reviewed_at)
  VALUES (auth.uid(), _aadhaar_path, _pan_path, nullif(_certificate_path, ''), 'pending', null, null, null)
  ON CONFLICT (provider_user_id) DO UPDATE SET aadhaar_document_path=EXCLUDED.aadhaar_document_path, pan_document_path=EXCLUDED.pan_document_path, certificate_path=EXCLUDED.certificate_path, status='pending', rejection_reason=null, reviewed_by=null, reviewed_at=null
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_kyc(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_kyc(_kyc_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _provider_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT provider_user_id INTO _provider_user_id FROM public.provider_kyc WHERE id = _kyc_id FOR UPDATE;
  IF _provider_user_id IS NULL THEN RAISE EXCEPTION 'KYC not found'; END IF;
  UPDATE public.provider_kyc SET status = CASE WHEN _approve THEN 'approved'::public.kyc_status ELSE 'rejected'::public.kyc_status END, rejection_reason = CASE WHEN _approve THEN NULL ELSE nullif(trim(_reason), '') END, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_kyc_id;
  UPDATE public.provider_profiles SET is_verified=_approve WHERE user_id=_provider_user_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.review_kyc(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_kyc(uuid,boolean,text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.public_provider_listings WITH (security_invoker = true) AS
SELECT p.id, p.display_name, p.photo_url, p.service_id, s.name AS service_name, p.skill, p.district, p.block_name, p.village, p.district_id, p.block_id, p.village_id, p.experience_years, p.starting_price, p.price_unit, p.rating, p.review_count, p.completed_jobs, p.is_available, p.is_verified, p.is_featured, p.bio
FROM public.provider_profiles p LEFT JOIN public.services s ON s.id=p.service_id WHERE p.is_verified = true;
GRANT SELECT ON public.public_provider_listings TO anon, authenticated, service_role;

CREATE INDEX provider_profiles_discovery_idx ON public.provider_profiles (is_verified, district_id, service_id, is_available);
CREATE INDEX blocks_district_idx ON public.blocks (district_id);
CREATE INDEX villages_block_idx ON public.villages (block_id);
CREATE INDEX bookings_customer_status_idx ON public.bookings (customer_id, status, booking_date);
CREATE INDEX bookings_provider_status_idx ON public.bookings (provider_id, status, booking_date);

CREATE TRIGGER districts_updated_at BEFORE UPDATE ON public.districts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER blocks_updated_at BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER villages_updated_at BEFORE UPDATE ON public.villages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.districts (name) VALUES ('Bongaigaon'),('Dibrugarh'),('Guwahati'),('Jorhat'),('Lakhimpur') ON CONFLICT DO NOTHING;
INSERT INTO public.blocks (district_id,name) SELECT id,'Boitamari' FROM public.districts WHERE name='Bongaigaon' ON CONFLICT DO NOTHING;
INSERT INTO public.blocks (district_id,name) SELECT id,'Lahoal' FROM public.districts WHERE name='Dibrugarh' ON CONFLICT DO NOTHING;
INSERT INTO public.blocks (district_id,name) SELECT id,'Guwahati' FROM public.districts WHERE name='Guwahati' ON CONFLICT DO NOTHING;
INSERT INTO public.blocks (district_id,name) SELECT id,'Jorhat East' FROM public.districts WHERE name='Jorhat' ON CONFLICT DO NOTHING;
INSERT INTO public.blocks (district_id,name) SELECT id,'North Lakhimpur' FROM public.districts WHERE name='Lakhimpur' ON CONFLICT DO NOTHING;
INSERT INTO public.villages (block_id,gp_name,name) SELECT b.id,'Boitamari GP','Boitamari' FROM public.blocks b JOIN public.districts d ON d.id=b.district_id WHERE d.name='Bongaigaon' AND b.name='Boitamari' ON CONFLICT DO NOTHING;
INSERT INTO public.villages (block_id,gp_name,name) SELECT b.id,'Ghoramara GP','Ghoramara' FROM public.blocks b JOIN public.districts d ON d.id=b.district_id WHERE d.name='Dibrugarh' AND b.name='Lahoal' ON CONFLICT DO NOTHING;
INSERT INTO public.villages (block_id,gp_name,name) SELECT b.id,'Dispur GP','Dispur' FROM public.blocks b JOIN public.districts d ON d.id=b.district_id WHERE d.name='Guwahati' AND b.name='Guwahati' ON CONFLICT DO NOTHING;
INSERT INTO public.villages (block_id,gp_name,name) SELECT b.id,'Chinamara GP','Chinamara' FROM public.blocks b JOIN public.districts d ON d.id=b.district_id WHERE d.name='Jorhat' AND b.name='Jorhat East' ON CONFLICT DO NOTHING;
INSERT INTO public.villages (block_id,gp_name,name) SELECT b.id,'Khelmati GP','Khelmati' FROM public.blocks b JOIN public.districts d ON d.id=b.district_id WHERE d.name='Lakhimpur' AND b.name='North Lakhimpur' ON CONFLICT DO NOTHING;

UPDATE public.provider_profiles p SET district_id=d.id FROM public.districts d WHERE p.district=d.name;
UPDATE public.provider_profiles p SET block_id=b.id FROM public.blocks b WHERE p.district_id=b.district_id AND p.block_name=b.name;
UPDATE public.provider_profiles p SET village_id=v.id FROM public.villages v WHERE p.block_id=v.block_id AND p.village=v.name;

CREATE POLICY "kyc_owner_submit_update" ON public.provider_kyc FOR UPDATE TO authenticated USING (provider_user_id=auth.uid() AND status IN ('draft','rejected')) WITH CHECK (provider_user_id=auth.uid() AND status IN ('draft','pending'));

CREATE POLICY "kyc_documents_owner_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='kyc-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "kyc_documents_owner_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='kyc-documents' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "kyc_documents_owner_replace" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='kyc-documents' AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK (bucket_id='kyc-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY "kyc_documents_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='kyc-documents' AND (storage.foldername(name))[1]=auth.uid()::text);
