CREATE TYPE public.app_role AS ENUM ('admin', 'provider', 'customer');
CREATE TYPE public.kyc_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE public.booking_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  account_type public.app_role NOT NULL DEFAULT 'customer',
  avatar_url text,
  district text,
  block_name text,
  village text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_provider_read" ON public.profiles FOR SELECT TO anon, authenticated USING (account_type = 'provider' OR id = auth.uid());
CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_own_delete" ON public.profiles FOR DELETE TO authenticated USING (id = auth.uid());
GRANT SELECT ON public.profiles TO anon;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_own_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "services_admin_manage" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  display_name text NOT NULL,
  photo_url text,
  service_id uuid REFERENCES public.services(id),
  skill text NOT NULL,
  district text NOT NULL,
  block_name text,
  village text,
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  starting_price numeric(10,2) NOT NULL CHECK (starting_price >= 0),
  price_unit text NOT NULL DEFAULT 'visit',
  rating numeric(2,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  review_count integer NOT NULL DEFAULT 0,
  completed_jobs integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.provider_profiles TO authenticated;
GRANT ALL ON public.provider_profiles TO service_role;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_public_read" ON public.provider_profiles FOR SELECT TO anon, authenticated USING (is_verified = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "providers_own_insert" ON public.provider_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "providers_own_update" ON public.provider_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.provider_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL UNIQUE,
  aadhaar_document_path text,
  pan_document_path text,
  certificate_path text,
  status public.kyc_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.provider_kyc TO authenticated;
GRANT ALL ON public.provider_kyc TO service_role;
ALTER TABLE public.provider_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_owner_admin_read" ON public.provider_kyc FOR SELECT TO authenticated USING (provider_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kyc_owner_insert" ON public.provider_kyc FOR INSERT TO authenticated WITH CHECK (provider_user_id = auth.uid());
CREATE POLICY "kyc_owner_admin_update" ON public.provider_kyc FOR UPDATE TO authenticated USING (provider_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (provider_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  service_id uuid NOT NULL REFERENCES public.services(id),
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  service_address text NOT NULL,
  quoted_price numeric(10,2) NOT NULL CHECK (quoted_price >= 0),
  status public.booking_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_participant_read" ON public.bookings FOR SELECT TO authenticated USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.provider_profiles p WHERE p.id = provider_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_customer_create" ON public.bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings_participant_update" ON public.bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.provider_profiles p WHERE p.id = provider_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "bookings_customer_delete" ON public.bookings FOR DELETE TO authenticated USING (customer_id = auth.uid() AND status = 'pending');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  customer_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  method text NOT NULL CHECK (method IN ('upi', 'card', 'net_banking')),
  status public.payment_status NOT NULL DEFAULT 'pending',
  receipt_number text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_owner_admin_read" ON public.payments FOR SELECT TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "payments_owner_create" ON public.payments FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

CREATE TABLE public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (commission_percent BETWEEN 0 AND 100),
  minimum_withdrawal numeric(10,2) NOT NULL DEFAULT 500 CHECK (minimum_withdrawal >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commission_settings TO authenticated;
GRANT ALL ON public.commission_settings TO service_role;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_authenticated_read" ON public.commission_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "commission_admin_manage" ON public.commission_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER providers_updated_at BEFORE UPDATE ON public.provider_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER kyc_updated_at BEFORE UPDATE ON public.provider_kyc FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER commission_updated_at BEFORE UPDATE ON public.commission_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.services (name, icon) VALUES
('Electrician','zap'),('Plumber','wrench'),('Photography','camera'),('Carpenter','hammer'),('Tuition','graduation-cap'),('AC Repair','snowflake'),('Beauty & Makeup','sparkles'),('Home Cleaning','home');

INSERT INTO public.provider_profiles (display_name, service_id, skill, district, block_name, village, experience_years, starting_price, price_unit, rating, review_count, completed_jobs, is_available, is_verified, is_featured, bio)
SELECT 'Bikash Das', id, 'Plumbing', 'Lakhimpur', 'North Lakhimpur', 'Khelmati', 8, 350, 'hr', 4.8, 86, 142, true, true, true, 'Leak repair, pipes and bathroom fittings.' FROM public.services WHERE name='Plumber';
INSERT INTO public.provider_profiles (display_name, service_id, skill, district, block_name, village, experience_years, starting_price, price_unit, rating, review_count, completed_jobs, is_available, is_verified, bio)
SELECT 'Mira Phukan', id, 'Photography', 'Dibrugarh', 'Lahoal', 'Ghoramara', 6, 2500, 'day', 5.0, 64, 98, true, true, 'Wedding and event photography.' FROM public.services WHERE name='Photography';
INSERT INTO public.provider_profiles (display_name, service_id, skill, district, block_name, village, experience_years, starting_price, price_unit, rating, review_count, completed_jobs, is_available, is_verified, bio)
SELECT 'Jiten Sharma', id, 'Carpentry', 'Jorhat', 'Jorhat East', 'Chinamara', 11, 400, 'hr', 4.7, 51, 126, false, true, 'Furniture repair and custom woodwork.' FROM public.services WHERE name='Carpenter';
INSERT INTO public.commission_settings (commission_percent, minimum_withdrawal) VALUES (10, 500);