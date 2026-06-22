import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio Health — PPM Platform" }] }),
  component: PortfolioAnalytics,
});

type Row = {
  project_id: string;
  code: string;
  name: string;
  status: string;
  health: string;
  currency: string;
  planned_cost: number;
  actual_cost: number;
  planned_revenue: number;
  actual_revenue: number;
  actual_margin: number;
  margin_pct: number;
  planned_hours: number;
  actual_hours: number;
  budget_consumed_percent: number;
  pv: number;
  ev: number;
  ac: number;
  spi: number;
  cpi: number;
};

const healthColor: Record<string, string> = {
  green: "bg-success/15 text-success border-success/30",
  amber: "bg-warning/15 text-warning border-warning/30",
  red: "bg-destructive/15 text-destructive border-destructive/30",
  blue: "bg-info/15 text-info border-info/30",
};

function PortfolioAnalytics() {
  const projectsQ = useQuery({
    queryKey: ["analytics-portfolio"],
    queryFn: async () => {
      const [projects, fin] = await Promise.all([
        supabase.from("projects").select("id,code,name,status,health,currency").eq("is_deleted", false),
        supabase.from("project_financials").select("*"),
      ]);
      const finByProject = new Map<string, typeof fin.data extends (infer T)[] | null ? T : never>();
      (fin.data ?? []).forEach((f) => f.project_id && finByProject.set(f.project_id, f));
      const rows: Row[] = (projects.data ?? []).map((p) => {
        const f = finByProject.get(p.id);
        const plannedCost = Number(f?.planned_cost ?? 0);
        const actualCost = Number(f?.actual_cost ?? 0);
        const plannedRev = Number(f?.planned_revenue ?? 0);
        const actualRev = Number(f?.actual_revenue ?? 0);
        const plannedHours = Number(f?.planned_hours ?? 0);
        const actualHours = Number(f?.actual_hours ?? 0);
        const margin = actualRev - actualCost;
        const pv = plannedCost;
        const progress = plannedHours > 0 ? Math.min(actualHours / plannedHours, 1) : 0;
        const ev = plannedCost * progress;
        const ac = actualCost;
        return {
          project_id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          health: p.health,
          currency: p.currency ?? f?.currency ?? "USD",
          planned_cost: plannedCost,
          actual_cost: actualCost,
          planned_revenue: plannedRev,
          actual_revenue: actualRev,
          actual_margin: margin,
          margin_pct: actualRev > 0 ? (margin / actualRev) * 100 : 0,
          planned_hours: plannedHours,
          actual_hours: actualHours,
          budget_consumed_percent: Number(f?.budget_consumed_percent ?? 0),
          pv,
          ev,
          ac,
          spi: pv > 0 ? ev / pv : 0,
          cpi: ac > 0 ? ev / ac : 0,
        };
      });
      return rows;
    },
  });

  const rows = projectsQ.data ?? [];

  const totals = useMemo(() => {
    const t = rows.reduce(
      (s, r) => ({
        revenue: s.revenue + r.actual_revenue,
        cost: s.cost + r.actual_cost,
        margin: s.margin + r.actual_margin,
        pv: s.pv + r.pv,
        ev: s.ev + r.ev,
        ac: s.ac + r.ac,
      }),
      { revenue: 0, cost: 0, margin: 0, pv: 0, ev: 0, ac: 0 },
    );
    return { ...t, spi: t.pv > 0 ? t.ev / t.pv : 0, cpi: t.ac > 0 ? t.ev / t.ac : 0 };
  }, [rows]);

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "code",
      header: "Project",
      accessorKey: "code",
      cell: ({ row }) => (
        <Link to="/projects/$id" params={{ id: row.original.project_id }} className="text-primary hover:underline">
          <div className="font-medium">{row.original.code}</div>
          <div className="text-xs text-muted-foreground truncate max-w-xs">{row.original.name}</div>
        </Link>
      ),
    },
    {
      id: "health",
      header: "Health",
      accessorKey: "health",
      cell: ({ getValue }) => {
        const v = String(getValue() ?? "");
        return <Badge variant="outline" className={cn("uppercase text-[10px]", healthColor[v])}>{v}</Badge>;
      },
    },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue }) => <span className="capitalize text-xs">{String(getValue() ?? "").replace("_", " ")}</span> },
    { id: "actual_revenue", header: "Revenue", accessorKey: "actual_revenue", cell: ({ row, getValue }) => fmtMoney(Number(getValue()), row.original.currency) },
    { id: "actual_cost", header: "Cost", accessorKey: "actual_cost", cell: ({ row, getValue }) => fmtMoney(Number(getValue()), row.original.currency) },
    {
      id: "actual_margin",
      header: "Margin",
      accessorKey: "actual_margin",
      cell: ({ row }) => (
        <span className={row.original.actual_margin >= 0 ? "text-success" : "text-destructive"}>
          {fmtMoney(row.original.actual_margin, row.original.currency)} <span className="text-xs">({row.original.margin_pct.toFixed(1)}%)</span>
        </span>
      ),
    },
    {
      id: "budget_consumed_percent",
      header: "Budget Used",
      accessorKey: "budget_consumed_percent",
      cell: ({ getValue }) => {
        const v = Number(getValue() ?? 0);
        return (
          <span className={cn(v > 100 ? "text-destructive font-medium" : v > 80 ? "text-warning" : "")}>{v.toFixed(1)}%</span>
        );
      },
    },
    {
      id: "spi",
      header: "SPI",
      accessorKey: "spi",
      cell: ({ getValue }) => {
        const v = Number(getValue() ?? 0);
        return <span className={v < 0.95 ? "text-destructive" : v < 1 ? "text-warning" : "text-success"}>{v.toFixed(2)}</span>;
      },
    },
    {
      id: "cpi",
      header: "CPI",
      accessorKey: "cpi",
      cell: ({ getValue }) => {
        const v = Number(getValue() ?? 0);
        return <span className={v < 0.95 ? "text-destructive" : v < 1 ? "text-warning" : "text-success"}>{v.toFixed(2)}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Portfolio Health"
        description="Live financial and earned-value metrics across every active project."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Revenue" value={fmtMoney(totals.revenue)} tone="success" />
        <KpiCard label="Cost" value={fmtMoney(totals.cost)} tone="warning" />
        <KpiCard label="Margin" value={fmtMoney(totals.margin)} tone={totals.margin >= 0 ? "success" : "destructive"} />
        <KpiCard label="Portfolio SPI" value={totals.spi.toFixed(2)} hint="Schedule Performance Index" tone={totals.spi >= 1 ? "success" : "warning"} />
        <KpiCard label="Portfolio CPI" value={totals.cpi.toFixed(2)} hint="Cost Performance Index" tone={totals.cpi >= 1 ? "success" : "warning"} />
      </div>

      <SmartGrid<Row>
        data={rows}
        columns={columns}
        searchPlaceholder="Search projects…"
        exportFileName="portfolio-health.csv"
        emptyState={projectsQ.isLoading ? "Loading…" : "No projects to analyze yet."}
      />
    </div>
  );
}