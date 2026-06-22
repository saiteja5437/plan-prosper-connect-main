import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { tbl, currentUserId } from "@/lib/db";
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
import { Plus, Pencil, Trash2, RotateCcw, ExternalLink, Circle } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtDate, fmtMoney } from "@/lib/format";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  project_manager_id: string | null;
  status: string;
  health: string;
  priority: string | null;
  billing_model: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  planned_budget: number | null;
  approved_budget: number | null;
  contract_value: number | null;
  fixed_price_amount: number | null;
  department: string | null;
  business_unit: string | null;
  region: string | null;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
};

const EMPTY: Partial<ProjectRow> = {
  code: "", name: "", status: "planned", health: "green", priority: "medium",
  billing_model: "time_and_material", currency: "USD",
  planned_budget: 0, approved_budget: 0, contract_value: 0,
};

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", planned: "secondary", on_hold: "outline", completed: "secondary", cancelled: "destructive",
};
const HEALTH_COLOR: Record<string, string> = {
  green: "text-success", amber: "text-warning", red: "text-destructive",
};

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — PPM Platform" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "project_manager"]);
  const canSeeDeleted = hasAnyRole(["super_admin", "pmo_admin", "auditor"]);

  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProjectRow> | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", showDeleted],
    queryFn: async () => {
      let q = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (!showDeleted) q = q.eq("is_deleted", false);
      const { data, error } = await q;
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-pick"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,code,currency").eq("is_deleted", false).order("name");
      if (error) throw error;
      return data as { id: string; name: string; code: string; currency: string | null }[];
    },
  });

  const { data: pmCandidates = [] } = useQuery({
    queryKey: ["pm-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null; email: string }[];
    },
  });

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const pmById = new Map(pmCandidates.map((p) => [p.id, p]));

  const upsert = useMutation({
    mutationFn: async (row: Partial<ProjectRow> & Record<string, unknown>) => {
      const { id, ...rest } = row;
      const uid = await currentUserId();
      const payload: Record<string, unknown> = { ...rest, updated_by: uid };
      if (id) {
        const { error } = await tbl("projects").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        payload.created_by = uid;
        const { error } = await tbl("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Project updated" : "Project created");
      setDialogOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("projects")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project archived"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl("projects")
        .update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project restored"); qc.invalidateQueries({ queryKey: ["projects"] }); },
  });

  const columns: ColumnDef<ProjectRow, unknown>[] = [
    { id: "code", header: "Code", accessorKey: "code",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { id: "name", header: "Name", accessorKey: "name",
      cell: ({ row }) => (
        <button className="text-left font-medium hover:underline inline-flex items-center gap-1"
          onClick={() => navigate({ to: "/projects/$id", params: { id: row.original.id } })}>
          {row.original.name}<ExternalLink className="size-3 opacity-50" />
        </button>
      ) },
    { id: "client", header: "Client",
      accessorFn: (r) => (r.client_id ? clientById.get(r.client_id)?.name ?? "—" : "—") },
    { id: "pm", header: "PM",
      accessorFn: (r) => (r.project_manager_id ? pmById.get(r.project_manager_id)?.full_name ?? pmById.get(r.project_manager_id)?.email ?? "—" : "—") },
    { id: "status", header: "Status", accessorKey: "status",
      cell: ({ row }) => <Badge variant={STATUS_TONE[row.original.status] ?? "secondary"}>{row.original.status}</Badge> },
    { id: "health", header: "Health", accessorKey: "health",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-xs capitalize">
          <Circle className={`size-2.5 fill-current ${HEALTH_COLOR[row.original.health] ?? ""}`} />
          {row.original.health}
        </span>
      ) },
    { id: "billing_model", header: "Billing", accessorKey: "billing_model",
      cell: ({ row }) => <span className="text-xs">{row.original.billing_model.replaceAll("_"," ")}</span> },
    { id: "approved_budget", header: "Budget",
      accessorFn: (r) => r.approved_budget ?? 0,
      cell: ({ row }) => fmtMoney(row.original.approved_budget, row.original.currency) },
    { id: "start_date", header: "Start", accessorKey: "start_date",
      cell: ({ row }) => fmtDate(row.original.start_date) },
    { id: "end_date", header: "End", accessorKey: "end_date",
      cell: ({ row }) => fmtDate(row.original.end_date) },
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
                <Button size="icon" variant="ghost" className="size-7 text-destructive" title="Archive"><Trash2 className="size-3.5" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {row.original.name}?</AlertDialogTitle>
                  <AlertDialogDescription>The project will be hidden from active views; allocations and hours are preserved.</AlertDialogDescription>
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
        title="Projects"
        description="Plan, deliver, and govern every engagement in the portfolio."
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
                  <Button onClick={() => setEditing(EMPTY)}><Plus className="size-4 mr-1" /> New Project</Button>
                </DialogTrigger>
                <ProjectFormDialog
                  initial={editing}
                  clients={clients}
                  pms={pmCandidates}
                  saving={upsert.isPending}
                  onSubmit={(v) => upsert.mutate({ ...editing, ...v } as never)}
                />
              </Dialog>
            )}
          </div>
        }
      />
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading projects…</div>
      ) : (
        <SmartGrid<ProjectRow>
          data={projects}
          columns={columns}
          searchPlaceholder="Search projects by name, code, status…"
          exportFileName="projects.csv"
          emptyState={
            <div className="space-y-2 py-6">
              <div>No projects yet.</div>
              {canManage && (
                <Button size="sm" onClick={() => { setEditing(EMPTY); setDialogOpen(true); }}>
                  <Plus className="size-4 mr-1" /> Add the first project
                </Button>
              )}
            </div>
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Open a project to manage allocations, planned hours, actual hours, and financials. <Link to="/admin/master-data" className="underline">Master Data hub</Link>.
      </p>
    </div>
  );
}

function ProjectFormDialog({
  initial, clients, pms, saving, onSubmit,
}: {
  initial: Partial<ProjectRow> | null;
  clients: { id: string; name: string; code: string; currency: string | null }[];
  pms: { id: string; full_name: string | null; email: string }[];
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const v = initial ?? EMPTY;
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{initial?.id ? "Edit Project" : "New Project"}</DialogTitle>
        <DialogDescription>Define the project master record. Allocations and financials are managed inside the project workspace.</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const obj: Record<string, unknown> = {};
          fd.forEach((val, key) => {
            const s = String(val).trim();
            if (s === "") { if (initial?.id) obj[key] = null; return; }
            if (["planned_budget","approved_budget","contract_value","fixed_price_amount"].includes(key)) obj[key] = Number(s);
            else obj[key] = s;
          });
          if (obj.client_id === "none") obj.client_id = null;
          if (obj.project_manager_id === "none") obj.project_manager_id = null;
          onSubmit(obj);
        }}
      >
        <Field label="Code *"><Input name="code" defaultValue={v.code ?? ""} required /></Field>
        <Field label="Name *"><Input name="name" defaultValue={v.name ?? ""} required /></Field>
        <Field label="Client">
          <Select name="client_id" defaultValue={v.client_id ?? "none"}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Project Manager">
          <Select name="project_manager_id" defaultValue={v.project_manager_id ?? "none"}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Unassigned —</SelectItem>
              {pms.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={v.status ?? "planned"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["planned","active","on_hold","completed","cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Health">
          <Select name="health" defaultValue={v.health ?? "green"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="amber">Amber</SelectItem>
              <SelectItem value="red">Red</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select name="priority" defaultValue={v.priority ?? "medium"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["low","medium","high","critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Billing model">
          <Select name="billing_model" defaultValue={v.billing_model ?? "time_and_material"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="time_and_material">Time & Material</SelectItem>
              <SelectItem value="fixed_price">Fixed Price</SelectItem>
              <SelectItem value="milestone">Milestone</SelectItem>
              <SelectItem value="retainer">Retainer</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={v.currency ?? "USD"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start date"><Input type="date" name="start_date" defaultValue={v.start_date ?? ""} /></Field>
        <Field label="End date"><Input type="date" name="end_date" defaultValue={v.end_date ?? ""} /></Field>
        <Field label="Planned budget"><Input type="number" step="0.01" name="planned_budget" defaultValue={v.planned_budget ?? ""} /></Field>
        <Field label="Approved budget"><Input type="number" step="0.01" name="approved_budget" defaultValue={v.approved_budget ?? ""} /></Field>
        <Field label="Contract value"><Input type="number" step="0.01" name="contract_value" defaultValue={v.contract_value ?? ""} /></Field>
        <Field label="Fixed price amount"><Input type="number" step="0.01" name="fixed_price_amount" defaultValue={v.fixed_price_amount ?? ""} /></Field>
        <Field label="Department"><Input name="department" defaultValue={v.department ?? ""} /></Field>
        <Field label="Business unit"><Input name="business_unit" defaultValue={v.business_unit ?? ""} /></Field>
        <Field label="Region"><Input name="region" defaultValue={v.region ?? ""} /></Field>
        <Field label="Description" wide><Textarea name="description" rows={2} defaultValue={v.description ?? ""} /></Field>
        <DialogFooter className="col-span-2 mt-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1 ${wide ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}