
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- CLIENTS ----------
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  industry text,
  segment text,
  region text,
  country text,
  currency text DEFAULT 'USD',
  account_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  tier text,
  website text,
  email text,
  phone text,
  billing_address jsonb,
  shipping_address jsonb,
  tax_id text,
  payment_terms text,
  credit_limit numeric(18,2),
  notes text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX clients_status_idx ON public.clients(status) WHERE is_deleted = false;
CREATE INDEX clients_owner_idx ON public.clients(account_owner_id) WHERE is_deleted = false;
CREATE INDEX clients_name_trgm ON public.clients USING gin (name gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read non-deleted clients"
  ON public.clients FOR SELECT TO authenticated
  USING (is_deleted = false OR public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::app_role[]));

CREATE POLICY "Admins/PMs can insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager']::app_role[]));

CREATE POLICY "Admins/PMs can update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager']::app_role[]));

CREATE POLICY "Only super_admin can hard delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- CLIENT CONTACTS ----------
CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX client_contacts_client_idx ON public.client_contacts(client_id) WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read client contacts" ON public.client_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage client contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager']::app_role[]));

CREATE TRIGGER client_contacts_set_updated_at BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- RESOURCES ----------
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email text NOT NULL,
  phone text,
  resource_type text NOT NULL DEFAULT 'employee',
  designation text,
  job_title text,
  department text,
  practice text,
  competency text,
  skill_level text,
  primary_skills text[] DEFAULT '{}',
  secondary_skills text[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  location text,
  country text,
  region text,
  timezone text,
  reports_to_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  hire_date date,
  exit_date date,
  employment_status text NOT NULL DEFAULT 'active',
  availability_status text NOT NULL DEFAULT 'available',
  weekly_capacity_hours numeric(6,2) NOT NULL DEFAULT 40,
  default_cost_rate numeric(18,2),
  default_billing_rate numeric(18,2),
  cost_currency text DEFAULT 'USD',
  billing_currency text DEFAULT 'USD',
  vendor_name text,
  contract_start_date date,
  contract_end_date date,
  notes text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX resources_user_idx ON public.resources(user_id);
CREATE INDEX resources_dept_idx ON public.resources(department) WHERE is_deleted = false;
CREATE INDEX resources_practice_idx ON public.resources(practice) WHERE is_deleted = false;
CREATE INDEX resources_status_idx ON public.resources(employment_status, availability_status) WHERE is_deleted = false;
CREATE INDEX resources_name_trgm ON public.resources USING gin (full_name gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read non-deleted resources"
  ON public.resources FOR SELECT TO authenticated
  USING (is_deleted = false OR public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::app_role[]));

CREATE POLICY "RM/Admins can insert resources"
  ON public.resources FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager']::app_role[]));

CREATE POLICY "RM/Admins can update resources"
  ON public.resources FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager']::app_role[]));

CREATE POLICY "Only super_admin can hard delete resources"
  ON public.resources FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- RESOURCE RATE HISTORY ----------
CREATE TABLE public.resource_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  cost_rate numeric(18,2),
  billing_rate numeric(18,2),
  cost_currency text DEFAULT 'USD',
  billing_currency text DEFAULT 'USD',
  effective_from date NOT NULL,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX resource_rates_resource_idx ON public.resource_rates(resource_id, effective_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_rates TO authenticated;
GRANT ALL ON public.resource_rates TO service_role;
ALTER TABLE public.resource_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read rates" ON public.resource_rates FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager','finance_manager','auditor','leadership']::app_role[]));

CREATE POLICY "Manage rates" ON public.resource_rates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager','finance_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','resource_manager','finance_manager']::app_role[]));

CREATE TRIGGER resource_rates_set_updated_at BEFORE UPDATE ON public.resource_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
