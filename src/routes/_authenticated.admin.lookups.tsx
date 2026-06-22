import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Lock } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

type Lookup = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  value_count: number;
};

export const Route = createFileRoute("/_authenticated/admin/lookups")({
  head: () => ({ meta: [{ title: "Lookup Master — PPM Platform" }] }),
  component: LookupsPage,
});

function LookupsPage() {
  const q = useQuery({
    queryKey: ["lookups"],
    queryFn: async (): Promise<Lookup[]> => {
      const { data: lookups, error } = await supabase
        .from("lookups")
        .select("id, code, name, description, is_system")
        .eq("is_deleted", false)
        .order("name");
      if (error) throw error;
      const { data: counts } = await supabase
        .from("lookup_values")
        .select("lookup_id")
        .eq("is_deleted", false);
      const map = new Map<string, number>();
      (counts ?? []).forEach((r) => map.set(r.lookup_id, (map.get(r.lookup_id) ?? 0) + 1));
      return (lookups ?? []).map((l) => ({ ...l, value_count: map.get(l.id) ?? 0 }));
    },
  });

  const columns: ColumnDef<Lookup>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link
          to="/admin/lookups/$lookupId"
          params={{ lookupId: row.original.id }}
          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          {row.original.name}
          <ChevronRight className="size-3" />
        </Link>
      ),
    },
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <code className="text-xs">{String(getValue())}</code> },
    { accessorKey: "description", header: "Description", cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { accessorKey: "value_count", header: "Values", cell: ({ getValue }) => <Badge variant="secondary">{String(getValue())}</Badge> },
    {
      accessorKey: "is_system",
      header: "Type",
      cell: ({ getValue }) => (getValue() ? <Badge variant="outline" className="gap-1"><Lock className="size-3" /> System</Badge> : <Badge>Custom</Badge>),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Lookup Master"
        description="Configurable categories used across the platform. Click a lookup to manage its values."
        actions={<Button disabled title="Create lookup ships in M2 admin tools">+ New Lookup</Button>}
      />
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : q.isError ? (
        <div className="text-sm text-destructive">{(q.error as Error).message}</div>
      ) : (
        <SmartGrid<Lookup>
          data={q.data ?? []}
          columns={columns}
          searchPlaceholder="Search lookups…"
          exportFileName="lookups.csv"
        />
      )}
    </div>
  );
}