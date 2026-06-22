import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { tbl, currentUserId } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";

type Rate = {
  id: string;
  resource_id: string;
  cost_rate: number | null;
  billing_rate: number | null;
  cost_currency: string | null;
  billing_currency: string | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

export const Route = createFileRoute("/_authenticated/resources/$id")({
  head: () => ({ meta: [{ title: "Resource — PPM Platform" }] }),
  component: ResourceDetail,
});

function ResourceDetail() {
  const { id } = Route.useParams();
  const { hasAnyRole } = useAuth();
  const canSeeRates = hasAnyRole(["super_admin", "pmo_admin", "resource_manager", "finance_manager", "leadership", "auditor"]);
  const canManageRates = hasAnyRole(["super_admin", "pmo_admin", "resource_manager", "finance_manager"]);
  const qc = useQueryClient();
  const [rateDialog, setRateDialog] = useState(false);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rates = [] } = useQuery({
    queryKey: ["resource-rates", id],
    enabled: canSeeRates,
    queryFn: async () => {
      const { data, error } = await supabase.from("resource_rates")
        .select("*").eq("resource_id", id).order("effective_from", { ascending: false });
      if (error) throw error;
      return data as Rate[];
    },
  });

  const addRate = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const { error } = await tbl("resource_rates").insert({ ...v, resource_id: id, created_by: uid, updated_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rate added"); setRateDialog(false); qc.invalidateQueries({ queryKey: ["resource-rates", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRate = useMutation({
    mutationFn: async (rid: string) => {
      const { error } = await tbl("resource_rates").delete().eq("id", rid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rate removed"); qc.invalidateQueries({ queryKey: ["resource-rates", id] }); },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading resource…</div>;
  if (!resource) {
    return (
      <div className="space-y-3">
        <PageHeader title="Resource not found" description="This resource may have been deleted or you may lack access." />
        <Button asChild variant="outline"><Link to="/resources"><ArrowLeft className="size-4 mr-1" />Back to resources</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="w-fit"><Link to="/resources"><ArrowLeft className="size-4 mr-1" />Resources</Link></Button>
      <PageHeader
        title={resource.full_name ?? `${resource.first_name} ${resource.last_name}`}
        description={`${resource.employee_code} • ${resource.designation ?? "—"} • ${resource.department ?? "—"}`}
        actions={<Badge variant={resource.is_deleted ? "destructive" : "default"}>{resource.is_deleted ? "Archived" : resource.availability_status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <FieldRow label="Email" value={resource.email} />
            <FieldRow label="Phone" value={resource.phone} />
            <FieldRow label="Type" value={resource.resource_type} />
            <FieldRow label="Designation" value={resource.designation} />
            <FieldRow label="Department" value={resource.department} />
            <FieldRow label="Practice" value={resource.practice} />
            <FieldRow label="Competency" value={resource.competency} />
            <FieldRow label="Location" value={resource.location} />
            <FieldRow label="Country" value={resource.country} />
            <FieldRow label="Timezone" value={resource.timezone} />
            <FieldRow label="Hire date" value={fmtDate(resource.hire_date)} />
            <FieldRow label="Exit date" value={fmtDate(resource.exit_date)} />
            <FieldRow label="Weekly capacity" value={`${resource.weekly_capacity_hours} hrs`} />
            <FieldRow label="Employment status" value={resource.employment_status} />
            {canSeeRates && (
              <>
                <FieldRow label="Default cost rate" value={fmtMoney(resource.default_cost_rate, resource.cost_currency ?? "USD")} />
                <FieldRow label="Default billing rate" value={fmtMoney(resource.default_billing_rate, resource.billing_currency ?? "USD")} />
              </>
            )}
            {(resource.primary_skills?.length ?? 0) > 0 && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Primary skills</div>
                <div className="flex flex-wrap gap-1">
                  {(resource.primary_skills ?? []).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              </div>
            )}
            {(resource.certifications?.length ?? 0) > 0 && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Certifications</div>
                <div className="flex flex-wrap gap-1">
                  {(resource.certifications ?? []).map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {canSeeRates && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rate history</CardTitle>
              {canManageRates && (
                <Dialog open={rateDialog} onOpenChange={setRateDialog}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="size-4 mr-1" />Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New rate entry</DialogTitle></DialogHeader>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const obj: Record<string, unknown> = {};
                        fd.forEach((v, k) => {
                          const s = String(v).trim();
                          if (!s) return;
                          if (k === "cost_rate" || k === "billing_rate") obj[k] = Number(s);
                          else obj[k] = s;
                        });
                        addRate.mutate(obj);
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Effective from *</Label><Input type="date" name="effective_from" required /></div>
                        <div><Label className="text-xs">Effective to</Label><Input type="date" name="effective_to" /></div>
                        <div><Label className="text-xs">Cost rate</Label><Input type="number" step="0.01" name="cost_rate" /></div>
                        <div><Label className="text-xs">Cost currency</Label><Input name="cost_currency" defaultValue="USD" /></div>
                        <div><Label className="text-xs">Billing rate</Label><Input type="number" step="0.01" name="billing_rate" /></div>
                        <div><Label className="text-xs">Billing currency</Label><Input name="billing_currency" defaultValue="USD" /></div>
                      </div>
                      <div><Label className="text-xs">Notes</Label><Input name="notes" /></div>
                      <DialogFooter><Button type="submit" disabled={addRate.isPending}>Save</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {rates.length === 0 && <div className="text-sm text-muted-foreground">No history yet.</div>}
              {rates.map((r) => (
                <div key={r.id} className="border rounded-md p-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{fmtDate(r.effective_from)} → {r.effective_to ? fmtDate(r.effective_to) : "open"}</div>
                    {canManageRates && (
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => removeRate.mutate(r.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div>Cost: {fmtMoney(r.cost_rate, r.cost_currency ?? "USD")} • Bill: {fmtMoney(r.billing_rate, r.billing_currency ?? "USD")}</div>
                  {r.notes && <div className="text-muted-foreground">{r.notes}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}