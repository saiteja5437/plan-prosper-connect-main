import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtMoney } from "@/lib/format";
import { tbl, currentUserId } from "@/lib/db";

type ResourceRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  resource_type: string;
  designation: string | null;
  department: string | null;
  practice: string | null;
  competency: string | null;
  location: string | null;
  employment_status: string;
  availability_status: string;
  weekly_capacity_hours: number;
  default_cost_rate: number | null;
  default_billing_rate: number | null;
  cost_currency: string | null;
  billing_currency: string | null;
  is_deleted: boolean;
};

const EMPTY: Partial<ResourceRow> = {
  employee_code: "", first_name: "", last_name: "", email: "",
  resource_type: "employee", employment_status: "active", availability_status: "available",
  weekly_capacity_hours: 40, cost_currency: "USD", billing_currency: "USD",
};

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({ meta: [{ title: "Resources — PPM Platform" }] }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "resource_manager"]);
  const canSeeRates = hasAnyRole(["super_admin", "pmo_admin", "resource_manager", "finance_manager", "leadership", "auditor"]);
  const canSeeDeleted = hasAnyRole(["super_admin", "pmo_admin", "auditor"]);

  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ResourceRow> | null>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources", showDeleted],
    queryFn: async () => {
      let q = supabase.from("resources").select("*").order("full_name");
      if (!showDeleted) q = q.eq("is_deleted", false);
      const { data, error } = await q;
      if (error) throw error;
      return data as ResourceRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<ResourceRow> & Record<string, unknown>) => {
      const { id, ...rest } = row;
      const uid = await currentUserId();
      const payload: Record<string, unknown> = { ...rest, updated_by: uid };
      if (id) {
        const { error } = await tbl("resources").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        payload.created_by = uid;
        const { error } = await tbl("resources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Resource updated" : "Resource created");
      setDialogOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("resources")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resource archived"); qc.invalidateQueries({ queryKey: ["resources"] }); },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl("resources").update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Restored"); qc.invalidateQueries({ queryKey: ["resources"] }); },
  });

  const columns: ColumnDef<ResourceRow, unknown>[] = [
    { id: "code", header: "Code", accessorKey: "employee_code",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.employee_code}</span> },
    { id: "name", header: "Name",
      accessorFn: (r) => r.full_name,
      cell: ({ row }) => (
        <button className="text-left font-medium hover:underline inline-flex items-center gap-1"
          onClick={() => navigate({ to: "/resources/$id", params: { id: row.original.id } })}>
          {row.original.full_name}
          <ExternalLink className="size-3 opacity-50" />
        </button>
      ) },
    { id: "email", header: "Email", accessorKey: "email" },
    { id: "type", header: "Type", accessorKey: "resource_type" },
    { id: "designation", header: "Designation", accessorKey: "designation" },
    { id: "department", header: "Department", accessorKey: "department" },
    { id: "practice", header: "Practice", accessorKey: "practice" },
    { id: "location", header: "Location", accessorKey: "location" },
    { id: "capacity", header: "Weekly hrs", accessorKey: "weekly_capacity_hours" },
    ...(canSeeRates ? [
      { id: "cost_rate", header: "Cost rate",
        accessorFn: (r: ResourceRow) => r.default_cost_rate ?? 0,
        cell: ({ row }: { row: { original: ResourceRow } }) => fmtMoney(row.original.default_cost_rate, row.original.cost_currency ?? "USD") } as ColumnDef<ResourceRow, unknown>,
      { id: "billing_rate", header: "Billing rate",
        accessorFn: (r: ResourceRow) => r.default_billing_rate ?? 0,
        cell: ({ row }: { row: { original: ResourceRow } }) => fmtMoney(row.original.default_billing_rate, row.original.billing_currency ?? "USD") } as ColumnDef<ResourceRow, unknown>,
    ] : []),
    { id: "status", header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        if (r.is_deleted) return <Badge variant="destructive">Archived</Badge>;
        const tone = r.availability_status === "available" ? "default" : r.availability_status === "bench" ? "secondary" : "outline";
        return <Badge variant={tone as "default"}>{r.availability_status}</Badge>;
      } },
    { id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canManage && !row.original.is_deleted && (
            <Button size="icon" variant="ghost" className="size-7"
              onClick={() => { setEditing(row.original); setDialogOpen(true); }} title="Edit">
              <Pencil className="size-3.5" />
            </Button>
          )}
          {canManage && !row.original.is_deleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Archive">
                  <Trash2 className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {row.original.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>The resource will be hidden from active rosters. Administrators can restore it.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => softDelete.mutate(row.original.id)}>Archive</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canManage && row.original.is_deleted && (
            <Button size="icon" variant="ghost" className="size-7" onClick={() => restore.mutate(row.original.id)} title="Restore">
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resources"
        description="Employees, contractors and vendor staff available for project allocation."
        actions={
          <div className="flex items-center gap-3">
            {canSeeDeleted && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={showDeleted} onCheckedChange={setShowDeleted} /> Show archived
              </label>
            )}
            {canManage && (
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditing(EMPTY)}><Plus className="size-4 mr-1" /> New Resource</Button>
                </DialogTrigger>
                <ResourceFormDialog initial={editing} saving={upsert.isPending} canSeeRates={canSeeRates}
                  onSubmit={(v) => upsert.mutate({ ...editing, ...v } as never)} />
              </Dialog>
            )}
          </div>
        }
      />
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading resources…</div>
      ) : (
        <SmartGrid<ResourceRow>
          data={resources}
          columns={columns}
          searchPlaceholder="Search by name, code, skill, department…"
          exportFileName="resources.csv"
          emptyState={
            <div className="space-y-2 py-6">
              <div>No resources yet.</div>
              {canManage && <Button size="sm" onClick={() => { setEditing(EMPTY); setDialogOpen(true); }}><Plus className="size-4 mr-1" /> Add the first resource</Button>}
            </div>
          }
        />
      )}
    </div>
  );
}

function ResourceFormDialog({
  initial, saving, canSeeRates, onSubmit,
}: {
  initial: Partial<ResourceRow> | null;
  saving: boolean;
  canSeeRates: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const v = initial ?? EMPTY;
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{initial?.id ? "Edit Resource" : "New Resource"}</DialogTitle>
        <DialogDescription>Capture identity, skills and (for authorised roles) financial rates.</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const obj: Record<string, unknown> = {};
          fd.forEach((val, key) => {
            const s = String(val).trim();
            if (s === "") return;
            if (["weekly_capacity_hours", "default_cost_rate", "default_billing_rate"].includes(key)) obj[key] = Number(s);
            else if (["primary_skills", "secondary_skills", "certifications"].includes(key)) {
              obj[key] = s.split(",").map((x) => x.trim()).filter(Boolean);
            } else obj[key] = s;
          });
          onSubmit(obj);
        }}
      >
        <F label="Employee code *"><Input name="employee_code" defaultValue={v.employee_code ?? ""} required /></F>
        <F label="First name *"><Input name="first_name" defaultValue={v.first_name ?? ""} required /></F>
        <F label="Last name *"><Input name="last_name" defaultValue={v.last_name ?? ""} required /></F>
        <F label="Email *"><Input type="email" name="email" defaultValue={v.email ?? ""} required /></F>
        <F label="Phone"><Input name="phone" defaultValue={(v as { phone?: string }).phone ?? ""} /></F>
        <F label="Type">
          <Select name="resource_type" defaultValue={v.resource_type ?? "employee"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Designation"><Input name="designation" defaultValue={v.designation ?? ""} /></F>
        <F label="Department"><Input name="department" defaultValue={v.department ?? ""} /></F>
        <F label="Practice"><Input name="practice" defaultValue={v.practice ?? ""} /></F>
        <F label="Competency"><Input name="competency" defaultValue={v.competency ?? ""} /></F>
        <F label="Location"><Input name="location" defaultValue={v.location ?? ""} /></F>
        <F label="Country"><Input name="country" defaultValue={(v as { country?: string }).country ?? ""} /></F>
        <F label="Employment status">
          <Select name="employment_status" defaultValue={v.employment_status ?? "active"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On leave</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Availability">
          <Select name="availability_status" defaultValue={v.availability_status ?? "available"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="allocated">Allocated</SelectItem>
              <SelectItem value="bench">Bench</SelectItem>
              <SelectItem value="leave">On leave</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Weekly capacity (hrs)"><Input type="number" step="0.5" name="weekly_capacity_hours" defaultValue={v.weekly_capacity_hours ?? 40} /></F>
        <F label="Primary skills (comma-sep)" wide>
          <Input name="primary_skills" defaultValue={((v as { primary_skills?: string[] }).primary_skills ?? []).join(", ")} />
        </F>
        <F label="Certifications (comma-sep)" wide>
          <Input name="certifications" defaultValue={((v as { certifications?: string[] }).certifications ?? []).join(", ")} />
        </F>
        {canSeeRates && (
          <>
            <F label="Default cost rate"><Input type="number" step="0.01" name="default_cost_rate" defaultValue={v.default_cost_rate ?? ""} /></F>
            <F label="Cost currency">
              <Select name="cost_currency" defaultValue={v.cost_currency ?? "USD"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Default billing rate"><Input type="number" step="0.01" name="default_billing_rate" defaultValue={v.default_billing_rate ?? ""} /></F>
            <F label="Billing currency">
              <Select name="billing_currency" defaultValue={v.billing_currency ?? "USD"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          </>
        )}
        <F label="Notes" wide><Textarea name="notes" rows={2} defaultValue={(v as { notes?: string }).notes ?? ""} /></F>
        <DialogFooter className="col-span-3 mt-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1 ${wide ? "col-span-3" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}