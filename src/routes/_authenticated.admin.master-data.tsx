import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Tags, Briefcase, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/master-data")({
  head: () => ({ meta: [{ title: "Master Data — PPM Platform" }] }),
  component: MasterDataHub,
});

function MasterDataHub() {
  const { data: counts } = useQuery({
    queryKey: ["mdm-counts"],
    queryFn: async () => {
      const [c, r, l, lv, p] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_deleted", false),
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("is_deleted", false),
        supabase.from("lookups").select("id", { count: "exact", head: true }),
        supabase.from("lookup_values").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_deleted", false),
      ]);
      return { clients: c.count ?? 0, resources: r.count ?? 0, lookups: l.count ?? 0, lookupValues: lv.count ?? 0, projects: p.count ?? 0 };
    },
  });

  const tiles = [
    { to: "/projects", icon: Briefcase, title: "Project Master", desc: "Projects, allocations, hours & financials.", count: counts?.projects },
    { to: "/clients", icon: Building2, title: "Client Master", desc: "Customer & contracting party records.", count: counts?.clients },
    { to: "/resources", icon: Users, title: "Resource Master", desc: "Employees, contractors & vendor staff.", count: counts?.resources },
    { to: "/admin/lookups", icon: Tags, title: "Lookup Master", desc: "Practices, departments, statuses, currencies and other reference data.", count: counts?.lookups },
  ] as const;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Master Data"
        description="Central hub for all reference and master data used across the platform."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="hover:border-primary/50 hover:shadow-md transition cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <t.icon className="size-5" />
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                <CardTitle className="mt-2">{t.title}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{t.count ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Active records</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Lookup catalogue currently has {counts?.lookupValues ?? 0} values across {counts?.lookups ?? 0} categories.
      </div>
    </div>
  );
}