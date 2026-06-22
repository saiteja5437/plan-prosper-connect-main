
-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned', -- planned, active, on_hold, completed, cancelled
  health text NOT NULL DEFAULT 'green',   -- green, amber, red
  priority text DEFAULT 'medium',         -- low, medium, high, critical
  billing_model text NOT NULL DEFAULT 'time_and_material', -- time_and_material, fixed_price, milestone, retainer, internal
  currency text NOT NULL DEFAULT 'USD',
  start_date date,
  end_date date,
  planned_budget numeric(18,2) DEFAULT 0,
  approved_budget numeric(18,2) DEFAULT 0,
  contract_value numeric(18,2) DEFAULT 0,
  fixed_price_amount numeric(18,2),
  tags text[] DEFAULT '{}',
  department text,
  business_unit text,
  region text,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_projects_client ON public.projects(client_id) WHERE NOT is_deleted;
CREATE INDEX idx_projects_pm ON public.projects(project_manager_id) WHERE NOT is_deleted;
CREATE INDEX idx_projects_status ON public.projects(status) WHERE NOT is_deleted;
CREATE INDEX idx_projects_name_trgm ON public.projects USING gin (name extensions.gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_auth" ON public.projects FOR SELECT TO authenticated USING (NOT is_deleted OR public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::app_role[]));
CREATE POLICY "projects_insert_pm" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]));
CREATE POLICY "projects_update_pm" ON public.projects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]));
CREATE POLICY "projects_delete_admin" ON public.projects FOR DELETE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin']::app_role[]));

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ALLOCATIONS ============
CREATE TABLE public.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  role text,
  allocation_percent numeric(5,2) NOT NULL DEFAULT 100,
  planned_hours numeric(10,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  cost_rate numeric(12,2) NOT NULL DEFAULT 0,    -- internal cost / hour
  billing_rate numeric(12,2) NOT NULL DEFAULT 0, -- external billable / hour
  currency text NOT NULL DEFAULT 'USD',
  is_billable boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active', -- active, completed, cancelled
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_alloc_project ON public.allocations(project_id) WHERE NOT is_deleted;
CREATE INDEX idx_alloc_resource ON public.allocations(resource_id) WHERE NOT is_deleted;
CREATE INDEX idx_alloc_dates ON public.allocations(start_date, end_date) WHERE NOT is_deleted;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocations TO authenticated;
GRANT ALL ON public.allocations TO service_role;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alloc_select_auth" ON public.allocations FOR SELECT TO authenticated USING (NOT is_deleted OR public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','auditor']::app_role[]));
CREATE POLICY "alloc_write_managers" ON public.allocations FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[]));

CREATE TRIGGER trg_alloc_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLANNED HOURS (weekly bucket per allocation) ============
CREATE TABLE public.planned_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  week_start date NOT NULL,   -- Monday of week
  hours numeric(8,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (allocation_id, week_start)
);
CREATE INDEX idx_planned_project_week ON public.planned_hours(project_id, week_start);
CREATE INDEX idx_planned_resource_week ON public.planned_hours(resource_id, week_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_hours TO authenticated;
GRANT ALL ON public.planned_hours TO service_role;
ALTER TABLE public.planned_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planned_select_auth" ON public.planned_hours FOR SELECT TO authenticated USING (true);
CREATE POLICY "planned_write_managers" ON public.planned_hours FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[]));

CREATE TRIGGER trg_planned_updated_at BEFORE UPDATE ON public.planned_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACTUAL HOURS (daily, timesheet seed) ============
CREATE TABLE public.actual_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  work_date date NOT NULL,
  hours numeric(8,2) NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'submitted', -- draft, submitted, approved, rejected
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_actual_project_date ON public.actual_hours(project_id, work_date);
CREATE INDEX idx_actual_resource_date ON public.actual_hours(resource_id, work_date);
CREATE INDEX idx_actual_alloc ON public.actual_hours(allocation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.actual_hours TO authenticated;
GRANT ALL ON public.actual_hours TO service_role;
ALTER TABLE public.actual_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actual_select_auth" ON public.actual_hours FOR SELECT TO authenticated USING (true);
CREATE POLICY "actual_insert_managers_or_self" ON public.actual_hours FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[])
    OR EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
  );
CREATE POLICY "actual_update_managers_or_self" ON public.actual_hours FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','resource_manager']::app_role[])
    OR EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.user_id = auth.uid())
  );
CREATE POLICY "actual_delete_managers" ON public.actual_hours FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]));

CREATE TRIGGER trg_actual_updated_at BEFORE UPDATE ON public.actual_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FINANCIAL ENGINE (view) ============
CREATE OR REPLACE VIEW public.project_financials
WITH (security_invoker = true)
AS
SELECT
  p.id AS project_id,
  p.code,
  p.name,
  p.currency,
  p.planned_budget,
  p.approved_budget,
  p.contract_value,
  p.fixed_price_amount,
  p.billing_model,
  COALESCE(alloc.planned_hours_total, 0) AS planned_hours,
  COALESCE(alloc.planned_cost_total, 0)  AS planned_cost,
  COALESCE(alloc.planned_revenue_total, 0) AS planned_revenue,
  COALESCE(act.actual_hours_total, 0)    AS actual_hours,
  COALESCE(act.actual_cost_total, 0)     AS actual_cost,
  COALESCE(act.actual_revenue_total, 0)  AS actual_revenue,
  COALESCE(act.actual_revenue_total, 0) - COALESCE(act.actual_cost_total, 0) AS actual_margin,
  CASE WHEN COALESCE(act.actual_revenue_total,0) > 0
       THEN ROUND(((act.actual_revenue_total - act.actual_cost_total) / act.actual_revenue_total) * 100, 2)
       ELSE 0 END AS actual_margin_percent,
  COALESCE(p.approved_budget,0) - COALESCE(act.actual_cost_total, 0) AS budget_remaining,
  CASE WHEN COALESCE(p.approved_budget,0) > 0
       THEN ROUND((COALESCE(act.actual_cost_total,0) / p.approved_budget) * 100, 2)
       ELSE 0 END AS budget_consumed_percent
FROM public.projects p
LEFT JOIN (
  SELECT a.project_id,
    SUM(a.planned_hours)                                                AS planned_hours_total,
    SUM(a.planned_hours * a.cost_rate)                                  AS planned_cost_total,
    SUM(CASE WHEN a.is_billable THEN a.planned_hours * a.billing_rate ELSE 0 END) AS planned_revenue_total
  FROM public.allocations a
  WHERE NOT a.is_deleted
  GROUP BY a.project_id
) alloc ON alloc.project_id = p.id
LEFT JOIN (
  SELECT ah.project_id,
    SUM(ah.hours)                                                       AS actual_hours_total,
    SUM(ah.hours * a.cost_rate)                                         AS actual_cost_total,
    SUM(CASE WHEN a.is_billable THEN ah.hours * a.billing_rate ELSE 0 END) AS actual_revenue_total
  FROM public.actual_hours ah
  JOIN public.allocations a ON a.id = ah.allocation_id
  GROUP BY ah.project_id
) act ON act.project_id = p.id
WHERE NOT p.is_deleted;

GRANT SELECT ON public.project_financials TO authenticated;
GRANT SELECT ON public.project_financials TO service_role;
