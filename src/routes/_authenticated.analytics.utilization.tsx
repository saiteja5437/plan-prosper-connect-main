import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/analytics/utilization")({
  head: () => ({ meta: [{ title: "Resource Utilization — PPM Platform" }] }),
  component: UtilizationAnalytics,
});

type WeekKey = string; // YYYY-MM-DD (Monday)

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

type ResourceRow = {
  id: string;
  full_name: string;
  weekly_capacity_hours: number;
  totalPlanned: number;
  totalActual: number;
  totalCapacity: number;
  utilizationPct: number;
  weekly: Record<WeekKey, { planned: number; actual: number; capacity: number }>;
};

function heatTone(pct: number) {
  if (pct === 0) return "bg-muted text-muted-foreground";
  if (pct < 50) return "bg-info/15 text-info";
  if (pct < 80) return "bg-success/15 text-success";
  if (pct <= 100) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive font-medium";
}

function UtilizationAnalytics() {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => isoDate(startOfWeek(today)), [today]);
  const defaultEnd = useMemo(() => isoDate(addDays(startOfWeek(today), 7 * 7 - 1)), [today]); // 8 weeks

  const [from, setFrom] = useState(defaultStart);
  const [to, setTo] = useState(defaultEnd);

  const weeks: WeekKey[] = useMemo(() => {
    const out: WeekKey[] = [];
    let cur = startOfWeek(new Date(from));
    const end = new Date(to);
    while (cur <= end) {
      out.push(isoDate(cur));
      cur = addDays(cur, 7);
    }
    return out;
  }, [from, to]);

  const q = useQuery({
    queryKey: ["utilization", from, to],
    queryFn: async () => {
      const [resources, planned, actual] = await Promise.all([
        supabase
          .from("resources")
          .select("id,full_name,first_name,last_name,weekly_capacity_hours")
          .eq("is_deleted", false)
          .eq("employment_status", "active"),
        supabase
          .from("planned_hours")
          .select("resource_id,week_start,hours")
          .gte("week_start", from)
          .lte("week_start", to),
        supabase
          .from("actual_hours")
          .select("resource_id,work_date,hours")
          .gte("work_date", from)
          .lte("work_date", to),
      ]);
      return {
        resources: resources.data ?? [],
        planned: planned.data ?? [],
        actual: actual.data ?? [],
      };
    },
  });

  const rows: ResourceRow[] = useMemo(() => {
    if (!q.data) return [];
    const numWeeks = weeks.length;
    return q.data.resources.map((r) => {
      const cap = Number(r.weekly_capacity_hours ?? 40);
      const weekly: ResourceRow["weekly"] = {};
      weeks.forEach((w) => (weekly[w] = { planned: 0, actual: 0, capacity: cap }));

      q.data.planned
        .filter((p) => p.resource_id === r.id)
        .forEach((p) => {
          const wk = isoDate(startOfWeek(new Date(p.week_start as string)));
          if (weekly[wk]) weekly[wk].planned += Number(p.hours ?? 0);
        });
      q.data.actual
        .filter((a) => a.resource_id === r.id)
        .forEach((a) => {
          const wk = isoDate(startOfWeek(new Date(a.work_date as string)));
          if (weekly[wk]) weekly[wk].actual += Number(a.hours ?? 0);
        });

      const totalPlanned = Object.values(weekly).reduce((s, w) => s + w.planned, 0);
      const totalActual = Object.values(weekly).reduce((s, w) => s + w.actual, 0);
      const totalCapacity = cap * numWeeks;
      return {
        id: r.id,
        full_name: r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        weekly_capacity_hours: cap,
        totalPlanned,
        totalActual,
        totalCapacity,
        utilizationPct: totalCapacity > 0 ? (totalPlanned / totalCapacity) * 100 : 0,
        weekly,
      };
    });
  }, [q.data, weeks]);

  const totals = rows.reduce(
    (s, r) => ({
      capacity: s.capacity + r.totalCapacity,
      planned: s.planned + r.totalPlanned,
      actual: s.actual + r.totalActual,
      over: s.over + (r.utilizationPct > 100 ? 1 : 0),
      bench: s.bench + (r.utilizationPct < 50 ? 1 : 0),
    }),
    { capacity: 0, planned: 0, actual: 0, over: 0, bench: 0 },
  );
  const portfolioUtil = totals.capacity > 0 ? (totals.planned / totals.capacity) * 100 : 0;

  const columns: ColumnDef<ResourceRow, unknown>[] = [
    {
      id: "full_name",
      header: "Resource",
      accessorKey: "full_name",
      cell: ({ row }) => (
        <Link to="/resources/$id" params={{ id: row.original.id }} className="text-primary hover:underline font-medium">
          {row.original.full_name}
        </Link>
      ),
    },
    { id: "weekly_capacity_hours", header: "Capacity/wk", accessorKey: "weekly_capacity_hours", cell: ({ getValue }) => `${Number(getValue())}h` },
    { id: "totalPlanned", header: "Planned", accessorKey: "totalPlanned", cell: ({ getValue }) => `${Number(getValue()).toFixed(1)}h` },
    { id: "totalActual", header: "Actual", accessorKey: "totalActual", cell: ({ getValue }) => `${Number(getValue()).toFixed(1)}h` },
    {
      id: "utilizationPct",
      header: "Utilization",
      accessorKey: "utilizationPct",
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return <span className={cn("px-2 py-0.5 rounded text-xs", heatTone(v))}>{v.toFixed(1)}%</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Resource Utilization"
        description="Planned hours vs weekly capacity across the resource pool, with a heatmap of demand."
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Date range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-44" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-44" />
          </div>
          <p className="text-xs text-muted-foreground ml-2">{weeks.length} week(s) shown</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Resources" value={rows.length} />
        <KpiCard label="Capacity (hrs)" value={totals.capacity.toFixed(0)} tone="default" />
        <KpiCard label="Planned (hrs)" value={totals.planned.toFixed(0)} tone="info" />
        <KpiCard label="Portfolio Utilization" value={`${portfolioUtil.toFixed(1)}%`} tone={portfolioUtil > 100 ? "destructive" : portfolioUtil > 80 ? "success" : "warning"} />
        <KpiCard label="Over / Bench" value={`${totals.over} / ${totals.bench}`} hint="Over 100% / under 50%" tone={totals.over > 0 ? "destructive" : "default"} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Demand heatmap</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left p-2 sticky left-0 bg-card z-10 min-w-[180px]">Resource</th>
                {weeks.map((w) => (
                  <th key={w} className="p-2 text-center font-normal text-muted-foreground whitespace-nowrap">
                    {new Date(w).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={weeks.length + 1} className="text-center p-6 text-muted-foreground">{q.isLoading ? "Loading…" : "No resource activity in this window."}</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2 sticky left-0 bg-card font-medium">{r.full_name}</td>
                  {weeks.map((w) => {
                    const cell = r.weekly[w];
                    const pct = cell.capacity > 0 ? (cell.planned / cell.capacity) * 100 : 0;
                    return (
                      <td key={w} className="p-1">
                        <div
                          className={cn("rounded text-center py-1 px-1", heatTone(pct))}
                          title={`Planned ${cell.planned.toFixed(1)}h / ${cell.capacity}h • Actual ${cell.actual.toFixed(1)}h`}
                        >
                          {pct === 0 ? "—" : `${pct.toFixed(0)}%`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SmartGrid<ResourceRow>
        data={rows}
        columns={columns}
        searchPlaceholder="Search resources…"
        exportFileName="utilization.csv"
        emptyState={q.isLoading ? "Loading…" : "No resources found."}
      />
    </div>
  );
}