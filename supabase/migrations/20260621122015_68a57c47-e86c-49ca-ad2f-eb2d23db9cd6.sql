
-- M4: Execution & Financials — Risks, Milestones, Invoices

-- =========================
-- RISKS
-- =========================
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text,
  title text NOT NULL,
  description text,
  category text,
  probability int NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact int NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score int GENERATED ALWAYS AS (probability * impact) STORED,
  status text NOT NULL DEFAULT 'open',
  response_strategy text,
  mitigation_plan text,
  contingency_plan text,
  owner_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  identified_on date NOT NULL DEFAULT current_date,
  target_close_date date,
  closed_on date,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_risks_project ON public.risks(project_id) WHERE is_deleted = false;
CREATE INDEX idx_risks_status ON public.risks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.risks TO authenticated;
GRANT ALL ON public.risks TO service_role;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view risks" ON public.risks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage risks" ON public.risks
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]));

CREATE TRIGGER trg_risks_updated_at BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- MILESTONES
-- =========================
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  planned_date date NOT NULL,
  actual_date date,
  status text NOT NULL DEFAULT 'planned',
  is_billing_milestone boolean NOT NULL DEFAULT false,
  billing_amount numeric(14,2),
  billing_currency text DEFAULT 'USD',
  sort_order int NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_milestones_project ON public.milestones(project_id) WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view milestones" ON public.milestones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage milestones" ON public.milestones
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager']::app_role[]));

CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- INVOICES
-- =========================
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  period_start date,
  period_end date,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  paid_on date,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);
CREATE INDEX idx_invoices_project ON public.invoices(project_id) WHERE is_deleted = false;
CREATE INDEX idx_invoices_client ON public.invoices(client_id) WHERE is_deleted = false;
CREATE INDEX idx_invoices_status ON public.invoices(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager','leadership','auditor']::app_role[])
  );
CREATE POLICY "Finance roles can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','finance_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','finance_manager']::app_role[]));

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- INVOICE LINES
-- =========================
CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance roles can view invoice lines" ON public.invoice_lines
  FOR SELECT TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','project_manager','finance_manager','leadership','auditor']::app_role[])
  );
CREATE POLICY "Finance roles can manage invoice lines" ON public.invoice_lines
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','finance_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','pmo_admin','finance_manager']::app_role[]));
