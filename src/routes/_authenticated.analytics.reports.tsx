import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Clock,
  DollarSign,
  Download,
  FileBarChart,
  Layers,
  Receipt,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/analytics/reports")({
  head: () => ({ meta: [{ title: "Report Center — PPM Platform" }] }),
  component: ReportCenter,
});

type Report = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  build: () => Promise<{ rows: Record<string, unknown>[]; filename: string }>;
};

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const reports: Report[] = [
  {
    id: "project-financials",
    title: "Project Financials",
    description: "Planned vs actual cost, revenue, margin and budget consumption for every project.",
    icon: DollarSign,
    build: async () => {
      const { data } = await supabase.from("project_financials").select("*");
      return { rows: data ?? [], filename: "project-financials.csv" };
    },
  },
  {
    id: "active-projects",
    title: "Active Projects",
    description: "Master list of projects with status, health, manager and key dates.",
    icon: Briefcase,
    build: async () => {
      const { data } = await supabase
        .from("projects")
        .select("code,name,status,health,billing_model,currency,start_date,end_date,planned_budget,approved_budget,contract_value")
        .eq("is_deleted", false)
        .order("code");
      return { rows: data ?? [], filename: "projects.csv" };
    },
  },
  {
    id: "resource-roster",
    title: "Resource Roster",
    description: "Active resources with role, skills, location, capacity and rate posture.",
    icon: Users,
    build: async () => {
      const { data } = await supabase
        .from("resources")
        .select("employee_code,full_name,email,job_title,department,location,resource_type,weekly_capacity_hours,default_cost_rate,default_billing_rate,availability_status")
        .eq("is_deleted", false)
        .order("employee_code");
      return { rows: data ?? [], filename: "resources.csv" };
    },
  },
  {
    id: "allocations",
    title: "Allocations",
    description: "Resource-to-project assignments with allocation %, dates, billable flag and rates.",
    icon: Layers,
    build: async () => {
      const { data } = await supabase
        .from("allocations")
        .select("project_id,resource_id,role,allocation_percent,start_date,end_date,planned_hours,cost_rate,billing_rate,currency,is_billable,status")
        .eq("is_deleted", false);
      return { rows: data ?? [], filename: "allocations.csv" };
    },
  },
  {
    id: "timesheet",
    title: "Timesheet Export",
    description: "Actual hours logged across projects — feed to payroll or billing.",
    icon: Clock,
    build: async () => {
      const { data } = await supabase
        .from("actual_hours")
        .select("work_date,resource_id,project_id,allocation_id,hours,description,status")
        .order("work_date", { ascending: false })
        .limit(10000);
      return { rows: data ?? [], filename: "timesheet.csv" };
    },
  },
  {
    id: "invoices",
    title: "Invoice Ledger",
    description: "All invoices with totals, taxes, payment status and aging.",
    icon: Receipt,
    build: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number,client_id,project_id,status,invoice_date,due_date,subtotal,tax_amount,total_amount,amount_paid,currency,paid_on")
        .eq("is_deleted", false)
        .order("invoice_date", { ascending: false });
      return { rows: data ?? [], filename: "invoices.csv" };
    },
  },
  {
    id: "risks",
    title: "Risk Register",
    description: "Open and closed risks with probability, impact, score and mitigation.",
    icon: AlertTriangle,
    build: async () => {
      const { data } = await supabase
        .from("risks")
        .select("project_id,code,title,category,status,probability,impact,risk_score,response_strategy,owner_id,target_close_date,closed_on")
        .eq("is_deleted", false)
        .order("risk_score", { ascending: false });
      return { rows: data ?? [], filename: "risks.csv" };
    },
  },
];

function ReportCenter() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (r: Report) => {
    setBusy(r.id);
    try {
      const { rows, filename } = await r.build();
      if (rows.length === 0) {
        toast.warning(`${r.title}: no data to export.`);
        return;
      }
      download(filename, toCsv(rows));
      toast.success(`${r.title}: exported ${rows.length} row(s).`);
    } catch (e) {
      toast.error(`${r.title} failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Report Center"
        description="Prebuilt operational and financial reports — exportable as CSV for downstream tooling."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="size-9 rounded-md bg-primary/10 grid place-items-center">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <FileBarChart className="size-3 text-muted-foreground" />
                </div>
                <CardTitle className="text-base mt-2">{r.title}</CardTitle>
                <CardDescription className="text-xs">{r.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={busy === r.id}
                  onClick={() => run(r)}
                >
                  <Download className="size-3 mr-1" />
                  {busy === r.id ? "Building…" : "Export CSV"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}