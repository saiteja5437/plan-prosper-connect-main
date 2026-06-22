
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'pmo_admin',
  'project_manager',
  'resource_manager',
  'finance_manager',
  'leadership',
  'auditor',
  'team_member'
);

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  department TEXT,
  practice TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- =========================================================
-- updated_at trigger helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'given_name'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'family_name'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  -- First user becomes super_admin automatically
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'team_member')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile RLS
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::public.app_role[])
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  );

-- user_roles RLS
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::public.app_role[])
  );
CREATE POLICY "Super admin manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- LOOKUPS (categories) & LOOKUP VALUES
-- =========================================================
CREATE TABLE public.lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_by UUID,
  deleted_on TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookups TO authenticated;
GRANT ALL ON public.lookups TO service_role;
ALTER TABLE public.lookups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lookups_updated BEFORE UPDATE ON public.lookups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lookup_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_id UUID NOT NULL REFERENCES public.lookups(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  metadata JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_by UUID,
  deleted_on TIMESTAMPTZ,
  delete_reason TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lookup_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_values TO authenticated;
GRANT ALL ON public.lookup_values TO service_role;
ALTER TABLE public.lookup_values ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lookup_values_updated BEFORE UPDATE ON public.lookup_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Auth read lookups" ON public.lookups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lookups" ON public.lookups
  FOR ALL TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  );

CREATE POLICY "Auth read lookup values" ON public.lookup_values
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage lookup values" ON public.lookup_values
  FOR ALL TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  );

-- =========================================================
-- BUSINESS RULES
-- =========================================================
CREATE TABLE public.business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  value JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_rules TO authenticated;
GRANT ALL ON public.business_rules TO service_role;
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_business_rules_updated BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read business rules" ON public.business_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage business rules" ON public.business_rules
  FOR ALL TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
  );

-- =========================================================
-- SECURITY RULES
-- =========================================================
CREATE TABLE public.security_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_name TEXT NOT NULL,
  filter_expression TEXT,
  is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_rules TO authenticated;
GRANT ALL ON public.security_rules TO service_role;
ALTER TABLE public.security_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_security_rules_updated BEFORE UPDATE ON public.security_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read security rules" ON public.security_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manage security rules" ON public.security_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- SAVED VIEWS
-- =========================================================
CREATE TABLE public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  view_name TEXT NOT NULL,
  config JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_saved_views_updated BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Users manage own views" ON public.saved_views
  FOR ALL TO authenticated USING (auth.uid() = user_id OR is_shared = TRUE)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  priority TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT,
  module_name TEXT,
  record_id UUID,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::public.app_role[])
    OR auth.uid() = user_id
  );

-- =========================================================
-- COMMENTS
-- =========================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  reply_to_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_users UUID[],
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Auth read comments" ON public.comments
  FOR SELECT TO authenticated USING (is_deleted = FALSE);
CREATE POLICY "Auth create comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comments" ON public.comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- ATTACHMENTS
-- =========================================================
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL DEFAULT auth.uid(),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read attachments" ON public.attachments
  FOR SELECT TO authenticated USING (is_deleted = FALSE);
CREATE POLICY "Auth create attachments" ON public.attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users delete own attachments" ON public.attachments
  FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  record_id UUID,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  action TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_module_record ON public.audit_logs(module_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE POLICY "Auth read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =========================================================
-- Seed core lookups & business rules
-- =========================================================
INSERT INTO public.lookups (code, name, description, is_system) VALUES
  ('practices','Practices','Delivery practices / capability areas',TRUE),
  ('departments','Departments','Organizational departments',TRUE),
  ('roles','Roles','Job roles on projects',TRUE),
  ('grades','Grades','Employee grades / bands',TRUE),
  ('locations','Locations','Office / delivery locations',TRUE),
  ('countries','Countries','Countries',TRUE),
  ('currencies','Currencies','Supported currencies',TRUE),
  ('billing_types','Billing Types','Project billing models',TRUE),
  ('priorities','Priorities','Priority levels',TRUE),
  ('project_status','Project Status','Project lifecycle status',TRUE),
  ('resource_status','Resource Status','Resource lifecycle status',TRUE),
  ('health_status','Health Status','Project / portfolio health',TRUE),
  ('risk_categories','Risk Categories','Risk categorization',TRUE),
  ('risk_severities','Risk Severities','Risk severity levels',TRUE),
  ('milestone_status','Milestone Status','Milestone state',TRUE),
  ('invoice_status','Invoice Status','Invoice lifecycle status',TRUE),
  ('issue_types','Issue Types','Issue categorization',TRUE),
  ('change_request_types','Change Request Types','CR categorization',TRUE),
  ('notification_types','Notification Types','Notification categories',TRUE);

WITH l AS (SELECT id, code FROM public.lookups)
INSERT INTO public.lookup_values (lookup_id, code, label, sort_order, color) VALUES
  ((SELECT id FROM l WHERE code='priorities'),'low','Low',10,'#10b981'),
  ((SELECT id FROM l WHERE code='priorities'),'medium','Medium',20,'#f59e0b'),
  ((SELECT id FROM l WHERE code='priorities'),'high','High',30,'#ef4444'),
  ((SELECT id FROM l WHERE code='priorities'),'critical','Critical',40,'#991b1b'),
  ((SELECT id FROM l WHERE code='project_status'),'planning','Planning',10,'#6366f1'),
  ((SELECT id FROM l WHERE code='project_status'),'in_progress','In Progress',20,'#3b82f6'),
  ((SELECT id FROM l WHERE code='project_status'),'on_hold','On Hold',30,'#f59e0b'),
  ((SELECT id FROM l WHERE code='project_status'),'completed','Completed',40,'#10b981'),
  ((SELECT id FROM l WHERE code='project_status'),'cancelled','Cancelled',50,'#6b7280'),
  ((SELECT id FROM l WHERE code='resource_status'),'active','Active',10,'#10b981'),
  ((SELECT id FROM l WHERE code='resource_status'),'on_leave','On Leave',20,'#f59e0b'),
  ((SELECT id FROM l WHERE code='resource_status'),'inactive','Inactive',30,'#6b7280'),
  ((SELECT id FROM l WHERE code='health_status'),'green','Green',10,'#10b981'),
  ((SELECT id FROM l WHERE code='health_status'),'amber','Amber',20,'#f59e0b'),
  ((SELECT id FROM l WHERE code='health_status'),'red','Red',30,'#ef4444'),
  ((SELECT id FROM l WHERE code='billing_types'),'time_and_material','Time & Material',10,NULL),
  ((SELECT id FROM l WHERE code='billing_types'),'fixed_price','Fixed Price',20,NULL),
  ((SELECT id FROM l WHERE code='billing_types'),'milestone','Milestone',30,NULL),
  ((SELECT id FROM l WHERE code='billing_types'),'retainer','Retainer',40,NULL),
  ((SELECT id FROM l WHERE code='billing_types'),'non_billable','Non-Billable',50,NULL),
  ((SELECT id FROM l WHERE code='currencies'),'USD','US Dollar',10,NULL),
  ((SELECT id FROM l WHERE code='currencies'),'EUR','Euro',20,NULL),
  ((SELECT id FROM l WHERE code='currencies'),'GBP','British Pound',30,NULL),
  ((SELECT id FROM l WHERE code='currencies'),'INR','Indian Rupee',40,NULL),
  ((SELECT id FROM l WHERE code='currencies'),'AUD','Australian Dollar',50,NULL),
  ((SELECT id FROM l WHERE code='risk_severities'),'low','Low',10,'#10b981'),
  ((SELECT id FROM l WHERE code='risk_severities'),'medium','Medium',20,'#f59e0b'),
  ((SELECT id FROM l WHERE code='risk_severities'),'high','High',30,'#ef4444'),
  ((SELECT id FROM l WHERE code='risk_severities'),'critical','Critical',40,'#991b1b'),
  ((SELECT id FROM l WHERE code='risk_categories'),'technical','Technical',10,NULL),
  ((SELECT id FROM l WHERE code='risk_categories'),'schedule','Schedule',20,NULL),
  ((SELECT id FROM l WHERE code='risk_categories'),'budget','Budget',30,NULL),
  ((SELECT id FROM l WHERE code='risk_categories'),'resource','Resource',40,NULL),
  ((SELECT id FROM l WHERE code='risk_categories'),'scope','Scope',50,NULL),
  ((SELECT id FROM l WHERE code='risk_categories'),'external','External',60,NULL),
  ((SELECT id FROM l WHERE code='milestone_status'),'planned','Planned',10,NULL),
  ((SELECT id FROM l WHERE code='milestone_status'),'in_progress','In Progress',20,NULL),
  ((SELECT id FROM l WHERE code='milestone_status'),'completed','Completed',30,NULL),
  ((SELECT id FROM l WHERE code='milestone_status'),'delayed','Delayed',40,NULL),
  ((SELECT id FROM l WHERE code='invoice_status'),'draft','Draft',10,NULL),
  ((SELECT id FROM l WHERE code='invoice_status'),'sent','Sent',20,NULL),
  ((SELECT id FROM l WHERE code='invoice_status'),'partially_paid','Partially Paid',30,NULL),
  ((SELECT id FROM l WHERE code='invoice_status'),'paid','Paid',40,'#10b981'),
  ((SELECT id FROM l WHERE code='invoice_status'),'overdue','Overdue',50,'#ef4444'),
  ((SELECT id FROM l WHERE code='invoice_status'),'cancelled','Cancelled',60,NULL),
  ((SELECT id FROM l WHERE code='practices'),'data','Data & Analytics',10,NULL),
  ((SELECT id FROM l WHERE code='practices'),'cloud','Cloud Engineering',20,NULL),
  ((SELECT id FROM l WHERE code='practices'),'ai','AI / ML',30,NULL),
  ((SELECT id FROM l WHERE code='practices'),'app_dev','Application Development',40,NULL),
  ((SELECT id FROM l WHERE code='practices'),'qa','Quality Engineering',50,NULL),
  ((SELECT id FROM l WHERE code='departments'),'engineering','Engineering',10,NULL),
  ((SELECT id FROM l WHERE code='departments'),'consulting','Consulting',20,NULL),
  ((SELECT id FROM l WHERE code='departments'),'operations','Operations',30,NULL),
  ((SELECT id FROM l WHERE code='departments'),'sales','Sales',40,NULL);

INSERT INTO public.business_rules (rule_key, category, name, description, value) VALUES
  ('utilization_thresholds','utilization','Utilization Thresholds','Color bands for resource utilization %',
    '{"blue_below":60,"green_min":70,"green_max":90,"amber_max":100}'::jsonb),
  ('health_weights','health','Project Health Weights','Weights for overall project health score',
    '{"schedule":30,"cost":30,"risk":20,"utilization":20}'::jsonb),
  ('health_thresholds','health','Project Health Thresholds','Green/Amber/Red score cutoffs',
    '{"green_min":80,"amber_min":60}'::jsonb),
  ('budget_variance_thresholds','budget','Budget Variance Thresholds','Variance % bands',
    '{"green_max":5,"amber_max":15}'::jsonb),
  ('invoice_aging_buckets','invoice','Invoice Aging Buckets','Days-overdue buckets',
    '{"buckets":[30,60,90]}'::jsonb);
