
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'tutor', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "anyone view roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  bio text,
  subjects text[] DEFAULT '{}',
  availability jsonb DEFAULT '{}'::jsonb,
  hourly_rate numeric,
  phone text,
  avatar_url text,
  is_featured boolean NOT NULL DEFAULT false,
  featured_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "admins update any profile" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Subscriptions
CREATE TYPE public.sub_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.pay_method AS ENUM ('mpesa', 'ecocash');

CREATE TABLE public.tutor_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_ref text NOT NULL,
  payment_method pay_method NOT NULL,
  amount numeric NOT NULL DEFAULT 100,
  status sub_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  notes text
);
ALTER TABLE public.tutor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor view own sub" ON public.tutor_subscriptions FOR SELECT USING (auth.uid() = tutor_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tutor insert own sub" ON public.tutor_subscriptions FOR INSERT WITH CHECK (auth.uid() = tutor_id);
CREATE POLICY "admin update sub" ON public.tutor_subscriptions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Sessions
CREATE TYPE public.session_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text,
  scheduled_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  room_id text NOT NULL DEFAULT ('aat-' || gen_random_uuid()::text),
  status session_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants view session" ON public.sessions FOR SELECT USING (auth.uid() = tutor_id OR auth.uid() = student_id);
CREATE POLICY "student book session" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "participants update session" ON public.sessions FOR UPDATE USING (auth.uid() = tutor_id OR auth.uid() = student_id);

-- Trigger: auto profile + student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
