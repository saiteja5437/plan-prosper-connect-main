import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Briefcase, DollarSign, Receipt, TrendingDown, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Executive Dashboard — PPM Platform" }] }),
  component: Dashboard,
});

const HEALTH_TONES: Record<string, string> = {
  green: "hsl(var(--success))",
  amber: "hsl(var(--warning))",
  red: "hsl(var(--destructive))",
  blue: "hsl(var(--info))",
};

function Dashboard() {
  const { user } = useAuth();

  const portfolio = useQuery({
    queryKey: ["exec-portfolio"],
    queryFn: async () => {
      const [projects, resources, risks, invoices, fin] = await Promise.all([
        supabase.from("projects").select("id,status,health,currency").eq("is_deleted", false),
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("is_deleted", false),
        supabase.from("risks").select("id,status,risk_score").eq("is_deleted", false),
        supabase.from("invoices").select("status,total_amount,amount_paid,currency").eq("is_deleted", false),
        supabase.from("project_financials").select("*"),
      ]);
      return {
        projects: projects.data ?? [],
        resourceCount: resources.count ?? 0,
        risks: risks.data ?? [],
        invoices: invoices.data ?? [],
        financials: fin.data ?? [],
      };
    },
  });

  const data = portfolio.data;
  const activeProjects = data?.projects.filter((p) => ["active", "in_progress"].includes(p.status)).length ?? 0;
  const openRisks = data?.risks.filter((r) => r.status !== "closed").length ?? 0;
  const highRisks = data?.risks.filter((r) => (r.risk_score ?? 0) >= 15 && r.status !== "closed").length ?? 0;

  const totalRevenue = data?.financials.reduce((s, r) => s + Number(r.actual_revenue ?? 0), 0) ?? 0;
  const totalCost = data?.financials.reduce((s, r) => s + Number(r.actual_cost ?? 0), 0) ?? 0;
  const totalMargin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const outstanding = data?.invoices.reduce(
    (s, i) => s + Math.max(0, Number(i.total_amount ?? 0) - Number(i.amount_paid ?? 0)),
    0,
  ) ?? 0;

  const healthCounts = ["green", "amber", "red", "blue"].map((h) => ({
    name: h.toUpperCase(),
    value: data?.projects.filter((p) => p.health === h).length ?? 0,
    fill: HEALTH_TONES[h],
  })).filter((d) => d.value > 0);

  const topProjects = [...(data?.financials ?? [])]
    .sort((a, b) => Number(b.actual_revenue ?? 0) - Number(a.actual_revenue ?? 0))
    .slice(0, 8)
    .map((p) => ({
      name: p.code ?? p.name ?? "—",
      revenue: Number(p.actual_revenue ?? 0),
      cost: Number(p.actual_cost ?? 0),
      margin: Number(p.actual_margin ?? 0),
    }));

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "there";

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${userName.split(" ")[0]}`}
        description="Executive view across portfolio, financials, delivery health and risk."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Active Projects" value={activeProjects} hint={`${data?.projects.length ?? 0} total`} icon={<Briefcase className="size-5" />} tone="info" />
        <KpiCard label="Resources" value={data?.resourceCount ?? "—"} hint="Available pool" icon={<Users className="size-5" />} tone="default" />
        <KpiCard
          label="Revenue (Actual)"
          value={fmtMoney(totalRevenue)}
          hint={<span className={marginPct >= 0 ? "text-success" : "text-destructive"}>Margin {marginPct.toFixed(1)}%</span>}
          icon={<DollarSign className="size-5" />}
          tone="success"
        />
        <KpiCard
          label="Open Risks"
          value={openRisks}
          hint={<span className={highRisks > 0 ? "text-destructive" : ""}>{highRisks} high severity</span>}
          icon={<AlertTriangle className="size-5" />}
          tone={highRisks > 0 ? "destructive" : "warning"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Actual Cost" value={fmtMoney(totalCost)} icon={<TrendingDown className="size-5" />} tone="warning" />
        <KpiCard label="Margin (Actual)" value={fmtMoney(totalMargin)} icon={<TrendingUp className="size-5" />} tone={totalMargin >= 0 ? "success" : "destructive"} />
        <KpiCard label="AR Outstanding" value={fmtMoney(outstanding)} icon={<Receipt className="size-5" />} tone="info" />
        <KpiCard label="Projects Tracked" value={data?.financials.length ?? "—"} hint="With financial data" tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top projects by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topProjects.length === 0 ? (
              <div className="h-72 grid place-items-center text-sm text-muted-foreground">
                No financial data yet. <Link to="/projects" className="text-primary underline ml-1">Create a project</Link>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProjects}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => fmtMoney(v)}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" />
                    <Bar dataKey="cost" name="Cost" fill="hsl(var(--warning))" />
                    <Bar dataKey="margin" name="Margin" fill="hsl(var(--success))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio health</CardTitle>
          </CardHeader>
          <CardContent>
            {healthCounts.length === 0 ? (
              <div className="h-72 grid place-items-center text-sm text-muted-foreground">No projects yet.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthCounts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {healthCounts.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}