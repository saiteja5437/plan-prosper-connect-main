import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { tbl, currentUserId } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Circle, AlertTriangle, Flag } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtMoney } from "@/lib/format";
import { KpiCard } from "@/components/kpi-card";

type Allocation = {
  id: string;
  project_id: string;
  resource_id: string;
  role: string | null;
  allocation_percent: number;
  planned_hours: number;
  start_date: string;
  end_date: string;
  cost_rate: number;
  billing_rate: number;
  currency: string;
  is_billable: boolean;
  status: string;
  notes: string | null;
  is_deleted: boolean;
};

type Actual = {
  id: string;
  allocation_id: string;
  resource_id: string;
  project_id: string;
  work_date: string;
  hours: number;
  description: string | null;
  status: string;
};

type Financials = {
  project_id: string;
  currency: string;
  planned_budget: number | null;
  approved_budget: number | null;
  contract_value: number | null;
  planned_hours: number;
  planned_cost: number;
  planned_revenue: number;
  actual_hours: number;
  actual_cost: number;
  actual_revenue: number;
  actual_margin: number;
  actual_margin_percent: number;
  budget_remaining: number;
  budget_consumed_percent: number;
};

type Risk = {
  id: string;
  project_id: string;
  code: string | null;
  title: string;
  description: string | null;
  category: string | null;
  probability: number;
  impact: number;
  risk_score: number;
  status: string;
  response_strategy: string | null;
  mitigation_plan: string | null;
  owner_id: string | null;
  identified_on: string;
  target_close_date: string | null;
  closed_on: string | null;
};

type Milestone = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  planned_date: string;
  actual_date: string | null;
  status: string;
  is_billing_milestone: boolean;
  billing_amount: number | null;
  billing_currency: string | null;
  sort_order: number;
};

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Project — PPM Platform" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { hasAnyRole, user } = useAuth();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "project_manager", "resource_manager"]);
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["project-client", project?.client_id],
    enabled: !!project?.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,code").eq("id", project!.client_id!).maybeSingle();
      return data;
    },
  });

  const { data: allocations = [], refetch: refetchAllocations } = useQuery({
    queryKey: ["allocations", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("allocations")
        .select("*").eq("project_id", id).eq("is_deleted", false)
        .order("start_date");
      if (error) throw error;
      return data as Allocation[];
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources-pick"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources")
        .select("id,full_name,employee_code,default_cost_rate,default_billing_rate,cost_currency,user_id")
        .eq("is_deleted", false).order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null; employee_code: string | null; default_cost_rate: number | null; default_billing_rate: number | null; cost_currency: string | null; user_id: string | null }[];
    },
  });

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const { data: actuals = [] } = useQuery({
    queryKey: ["actuals", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("actual_hours")
        .select("*").eq("project_id", id).order("work_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data as Actual[];
    },
  });

  const { data: financials } = useQuery({
    queryKey: ["project-financials", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_financials").select("*").eq("project_id", id).maybeSingle();
      if (error) throw error;
      return data as Financials | null;
    },
  });

  const [allocDialog, setAllocDialog] = useState(false);
  const [actualDialog, setActualDialog] = useState(false);
  const [riskDialog, setRiskDialog] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState(false);

  const { data: risks = [] } = useQuery({
    queryKey: ["risks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("*")
        .eq("project_id", id).eq("is_deleted", false)
        .order("risk_score", { ascending: false });
      if (error) throw error;
      return data as Risk[];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*")
        .eq("project_id", id).eq("is_deleted", false)
        .order("planned_date");
      if (error) throw error;
      return data as Milestone[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["allocations", id] });
    qc.invalidateQueries({ queryKey: ["actuals", id] });
    qc.invalidateQueries({ queryKey: ["project-financials", id] });
  };

  const addRisk = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const { error } = await tbl("risks").insert({ ...v, project_id: id, created_by: uid, updated_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Risk added"); setRiskDialog(false); qc.invalidateQueries({ queryKey: ["risks", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRisk = useMutation({
    mutationFn: async (rid: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("risks").update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid }).eq("id", rid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Risk archived"); qc.invalidateQueries({ queryKey: ["risks", id] }); },
  });

  const addMilestone = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const { error } = await tbl("milestones").insert({ ...v, project_id: id, created_by: uid, updated_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Milestone added"); setMilestoneDialog(false); qc.invalidateQueries({ queryKey: ["milestones", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMilestone = useMutation({
    mutationFn: async ({ mid, v }: { mid: string; v: Record<string, unknown> }) => {
      const uid = await currentUserId();
      const { error } = await tbl("milestones").update({ ...v, updated_by: uid }).eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones", id] }); },
  });

  const removeMilestone = useMutation({
    mutationFn: async (mid: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("milestones").update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid }).eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Milestone removed"); qc.invalidateQueries({ queryKey: ["milestones", id] }); },
  });

  const addAllocation = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const { error } = await tbl("allocations").insert({ ...v, project_id: id, created_by: uid, updated_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Allocation added"); setAllocDialog(false); invalidateAll(); refetchAllocations(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAllocation = useMutation({
    mutationFn: async (aid: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("allocations")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid }).eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Allocation removed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addActual = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const alloc = allocations.find((a) => a.id === v.allocation_id);
      if (!alloc) throw new Error("Allocation required");
      const { error } = await tbl("actual_hours").insert({
        ...v,
        project_id: id,
        resource_id: alloc.resource_id,
        created_by: uid, updated_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Hours logged"); setActualDialog(false); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeActual = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await tbl("actual_hours").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry removed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading project…</div>;
  if (!project) {
    return (
      <div className="space-y-3">
        <PageHeader title="Project not found" />
        <Button asChild variant="outline"><Link to="/projects"><ArrowLeft className="size-4 mr-1" />Back to projects</Link></Button>
      </div>
    );
  }

  const currency = project.currency ?? "USD";
  const healthColor: Record<string, string> = { green: "text-success", amber: "text-warning", red: "text-destructive" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/projects"><ArrowLeft className="size-4 mr-1" />Projects</Link></Button>
      </div>
      <PageHeader
        title={project.name}
        description={
          <>
            <span className="font-mono">{project.code}</span>
            {client ? <> • <Link to="/clients/$id" params={{ id: client.id }} className="underline">{client.name}</Link></> : null}
            {" • "}{project.billing_model?.replaceAll?.("_", " ")}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{project.status}</Badge>
            <span className="inline-flex items-center gap-1 text-xs capitalize">
              <Circle className={`size-2.5 fill-current ${healthColor[project.health] ?? ""}`} />
              {project.health}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Approved Budget" value={fmtMoney(financials?.approved_budget ?? project.approved_budget, currency)} tone="info" />
        <KpiCard label="Actual Cost" value={fmtMoney(financials?.actual_cost ?? 0, currency)} hint={`${financials?.budget_consumed_percent ?? 0}% of budget`} tone="warning" />
        <KpiCard label="Actual Revenue" value={fmtMoney(financials?.actual_revenue ?? 0, currency)} tone="success" />
        <KpiCard label="Margin" value={fmtMoney(financials?.actual_margin ?? 0, currency)} hint={`${financials?.actual_margin_percent ?? 0}% margin`} tone={(financials?.actual_margin ?? 0) >= 0 ? "success" : "destructive"} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="actuals">Actual Hours</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <Info label="Start date" value={fmtDate(project.start_date)} />
              <Info label="End date" value={fmtDate(project.end_date)} />
              <Info label="Priority" value={project.priority} />
              <Info label="Currency" value={project.currency} />
              <Info label="Department" value={project.department} />
              <Info label="Business Unit" value={project.business_unit} />
              <Info label="Region" value={project.region} />
              <Info label="Planned Budget" value={fmtMoney(project.planned_budget, currency)} />
              <Info label="Contract Value" value={fmtMoney(project.contract_value, currency)} />
              <Info label="Fixed Price" value={fmtMoney(project.fixed_price_amount, currency)} />
              <Info label="Created" value={fmtDate(project.created_at)} />
              <Info label="Last updated" value={fmtDate(project.updated_at)} />
              {project.description && (
                <div className="col-span-full">
                  <div className="text-xs text-muted-foreground mb-1">Description</div>
                  <div className="whitespace-pre-wrap">{project.description}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Resource Allocations</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Per-allocation cost and billing rates feed the financial engine.</p>
              </div>
              {canManage && (
                <Dialog open={allocDialog} onOpenChange={setAllocDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="size-4 mr-1" />Add Allocation</Button>
                  </DialogTrigger>
                  <AllocationDialog
                    resources={resources}
                    defaultStart={project.start_date}
                    defaultEnd={project.end_date}
                    defaultCurrency={currency}
                    saving={addAllocation.isPending}
                    onSubmit={(v) => addAllocation.mutate(v)}
                  />
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {allocations.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No allocations yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Alloc %</TableHead>
                      <TableHead className="text-right">Planned Hrs</TableHead>
                      <TableHead className="text-right">Cost Rate</TableHead>
                      <TableHead className="text-right">Bill Rate</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((a) => {
                      const r = resourceById.get(a.resource_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{r?.full_name ?? "—"}<div className="text-xs text-muted-foreground font-mono">{r?.employee_code}</div></TableCell>
                          <TableCell>{a.role ?? "—"}</TableCell>
                          <TableCell className="text-xs">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(a.allocation_percent).toFixed(0)}%</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(a.planned_hours).toFixed(1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(a.cost_rate, a.currency)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtMoney(a.billing_rate, a.currency)}</TableCell>
                          <TableCell>{a.is_billable ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                          <TableCell>
                            {canManage && (
                              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeAllocation.mutate(a.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actuals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Actual Hours</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Log delivery effort by allocation. Cost and revenue auto-roll up via per-allocation rates.</p>
              </div>
              <Dialog open={actualDialog} onOpenChange={setActualDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={allocations.length === 0}><Plus className="size-4 mr-1" />Log Hours</Button>
                </DialogTrigger>
                <ActualHoursDialog
                  allocations={allocations}
                  resourceById={resourceById}
                  saving={addActual.isPending}
                  currentUserId={user?.id}
                  onSubmit={(v) => addActual.mutate(v)}
                />
              </Dialog>
            </CardHeader>
            <CardContent>
              {actuals.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No hours logged yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actuals.map((h) => {
                      const r = resourceById.get(h.resource_id);
                      return (
                        <TableRow key={h.id}>
                          <TableCell>{fmtDate(h.work_date)}</TableCell>
                          <TableCell>{r?.full_name ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(h.hours).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">{h.description}</TableCell>
                          <TableCell><Badge variant="secondary" className="capitalize">{h.status}</Badge></TableCell>
                          <TableCell>
                            {canManage && (
                              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeActual.mutate(h.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <FinRow label="Planned Budget" value={fmtMoney(financials?.planned_budget, currency)} />
                  <FinRow label="Approved Budget" value={fmtMoney(financials?.approved_budget, currency)} />
                  <FinRow label="Contract Value" value={fmtMoney(financials?.contract_value, currency)} />
                  <FinRow label="Planned Hours" value={(financials?.planned_hours ?? 0).toFixed(1)} />
                  <FinRow label="Planned Cost" value={fmtMoney(financials?.planned_cost, currency)} />
                  <FinRow label="Planned Revenue" value={fmtMoney(financials?.planned_revenue, currency)} />
                  <FinRow label="Actual Hours" value={(financials?.actual_hours ?? 0).toFixed(1)} />
                  <FinRow label="Actual Cost" value={fmtMoney(financials?.actual_cost, currency)} />
                  <FinRow label="Actual Revenue" value={fmtMoney(financials?.actual_revenue, currency)} />
                  <FinRow label="Actual Margin" value={`${fmtMoney(financials?.actual_margin, currency)} (${financials?.actual_margin_percent ?? 0}%)`} />
                  <FinRow label="Budget Remaining" value={`${fmtMoney(financials?.budget_remaining, currency)} (${financials?.budget_consumed_percent ?? 0}% consumed)`} />
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Planned values come from allocations (planned hours × rates). Actuals come from logged actual hours × per-allocation rates. Margin = revenue − cost.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <MilestonesTab
            milestones={milestones}
            canManage={canManage}
            currency={currency}
            projectStart={project.start_date}
            projectEnd={project.end_date}
            dialogOpen={milestoneDialog}
            setDialogOpen={setMilestoneDialog}
            onAdd={(v) => addMilestone.mutate(v)}
            onToggleComplete={(m) => updateMilestone.mutate({ mid: m.id, v: m.status === "completed"
              ? { status: "planned", actual_date: null }
              : { status: "completed", actual_date: new Date().toISOString().slice(0,10) } })}
            onRemove={(rid) => removeMilestone.mutate(rid)}
            saving={addMilestone.isPending}
          />
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <RisksTab
            risks={risks}
            canManage={canManage}
            resources={resources}
            dialogOpen={riskDialog}
            setDialogOpen={setRiskDialog}
            onAdd={(v) => addRisk.mutate(v)}
            onRemove={(rid) => removeRisk.mutate(rid)}
            saving={addRisk.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MilestonesTab({
  milestones, canManage, currency, projectStart, projectEnd, dialogOpen, setDialogOpen, onAdd, onToggleComplete, onRemove, saving,
}: {
  milestones: Milestone[];
  canManage: boolean;
  currency: string;
  projectStart: string | null;
  projectEnd: string | null;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  onAdd: (v: Record<string, unknown>) => void;
  onToggleComplete: (m: Milestone) => void;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Flag className="size-4" /> Milestones</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Track delivery checkpoints and billing milestones.</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Add Milestone</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Milestone</DialogTitle>
                <DialogDescription>Define a checkpoint, optionally tied to billing.</DialogDescription>
              </DialogHeader>
              <form
                className="grid grid-cols-2 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  onAdd({
                    name: fd.get("name"),
                    description: (fd.get("description") as string) || null,
                    planned_date: fd.get("planned_date"),
                    status: fd.get("status") || "planned",
                    is_billing_milestone: fd.get("is_billing_milestone") === "on",
                    billing_amount: fd.get("billing_amount") ? Number(fd.get("billing_amount")) : null,
                    billing_currency: currency,
                  });
                }}
              >
                <Field label="Name *" wide><Input name="name" required /></Field>
                <Field label="Planned date *"><Input type="date" name="planned_date" defaultValue={projectStart ?? ""} required /></Field>
                <Field label="Status">
                  <Select name="status" defaultValue="planned">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Billing amount"><Input type="number" step="0.01" name="billing_amount" /></Field>
                <div className="space-y-1">
                  <Label className="text-xs">Billing milestone?</Label>
                  <div className="h-9 flex items-center"><Switch name="is_billing_milestone" /></div>
                </div>
                <Field label="Description" wide><Textarea name="description" rows={2} /></Field>
                <DialogFooter className="col-span-2 mt-2">
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Milestone"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No milestones yet. {projectEnd ? "" : ""}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Billing</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.name}
                    {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                  </TableCell>
                  <TableCell>{fmtDate(m.planned_date)}</TableCell>
                  <TableCell>{fmtDate(m.actual_date)}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{m.status.replaceAll("_"," ")}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.is_billing_milestone ? fmtMoney(m.billing_amount ?? 0, m.billing_currency ?? currency) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => onToggleComplete(m)}>
                          {m.status === "completed" ? "Reopen" : "Mark done"}
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => onRemove(m.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RisksTab({
  risks, canManage, resources, dialogOpen, setDialogOpen, onAdd, onRemove, saving,
}: {
  risks: Risk[];
  canManage: boolean;
  resources: { id: string; full_name: string | null }[];
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  onAdd: (v: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  saving: boolean;
}) {
  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const [ownerId, setOwnerId] = useState<string>("");
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4" /> Risk Register</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Score = probability × impact (1–25). 15+ is critical.</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setOwnerId(""); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Add Risk</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Risk</DialogTitle>
                <DialogDescription>Identify, rate and assign a response.</DialogDescription>
              </DialogHeader>
              <form
                className="grid grid-cols-2 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  onAdd({
                    code: (fd.get("code") as string) || null,
                    title: fd.get("title"),
                    description: (fd.get("description") as string) || null,
                    category: (fd.get("category") as string) || null,
                    probability: Number(fd.get("probability") || 3),
                    impact: Number(fd.get("impact") || 3),
                    status: fd.get("status") || "open",
                    response_strategy: (fd.get("response_strategy") as string) || null,
                    mitigation_plan: (fd.get("mitigation_plan") as string) || null,
                    owner_id: ownerId || null,
                    target_close_date: (fd.get("target_close_date") as string) || null,
                  });
                }}
              >
                <Field label="Code"><Input name="code" placeholder="R-001" /></Field>
                <Field label="Category"><Input name="category" placeholder="Schedule / Tech / Vendor" /></Field>
                <Field label="Title *" wide><Input name="title" required /></Field>
                <Field label="Description" wide><Textarea name="description" rows={2} /></Field>
                <Field label="Probability (1–5)"><Input type="number" min="1" max="5" name="probability" defaultValue={3} /></Field>
                <Field label="Impact (1–5)"><Input type="number" min="1" max="5" name="impact" defaultValue={3} /></Field>
                <Field label="Status">
                  <Select name="status" defaultValue="open">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="mitigating">Mitigating</SelectItem>
                      <SelectItem value="monitoring">Monitoring</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Response strategy">
                  <Select name="response_strategy" defaultValue="mitigate">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avoid">Avoid</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="mitigate">Mitigate</SelectItem>
                      <SelectItem value="accept">Accept</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="space-y-1">
                  <Label className="text-xs">Owner</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name ?? r.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Target close date"><Input type="date" name="target_close_date" /></Field>
                <Field label="Mitigation plan" wide><Textarea name="mitigation_plan" rows={2} /></Field>
                <DialogFooter className="col-span-2 mt-2">
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Risk"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {risks.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No risks logged.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">I</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code ?? "—"}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.title}</div>
                    {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{r.category ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.probability}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.impact}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={riskTone(r.risk_score)}>{r.risk_score}</Badge>
                  </TableCell>
                  <TableCell>{r.owner_id ? (resourceById.get(r.owner_id)?.full_name ?? "—") : "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell>
                    {canManage && (
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => onRemove(r.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function riskTone(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 15) return "destructive";
  if (score >= 8) return "default";
  if (score >= 4) return "secondary";
  return "outline";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}

function FinRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{label}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{value}</TableCell>
    </TableRow>
  );
}

function AllocationDialog({
  resources, defaultStart, defaultEnd, defaultCurrency, saving, onSubmit,
}: {
  resources: { id: string; full_name: string | null; employee_code: string | null; default_cost_rate: number | null; default_billing_rate: number | null; cost_currency: string | null }[];
  defaultStart: string | null;
  defaultEnd: string | null;
  defaultCurrency: string;
  saving: boolean;
  onSubmit: (v: Record<string, unknown>) => void;
}) {
  const [resourceId, setResourceId] = useState<string>("");
  const r = resources.find((x) => x.id === resourceId);
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Allocation</DialogTitle>
        <DialogDescription>Assign a resource to this project with effective dates and rates.</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const obj: Record<string, unknown> = {
            resource_id: resourceId,
            role: (fd.get("role") as string) || null,
            allocation_percent: Number(fd.get("allocation_percent") || 100),
            planned_hours: Number(fd.get("planned_hours") || 0),
            start_date: fd.get("start_date"),
            end_date: fd.get("end_date"),
            cost_rate: Number(fd.get("cost_rate") || 0),
            billing_rate: Number(fd.get("billing_rate") || 0),
            currency: fd.get("currency") || defaultCurrency,
            is_billable: fd.get("is_billable") === "on",
            notes: (fd.get("notes") as string) || null,
          };
          if (!resourceId) { toast.error("Pick a resource"); return; }
          if (!obj.start_date || !obj.end_date) { toast.error("Dates are required"); return; }
          onSubmit(obj);
        }}
      >
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Resource *</Label>
          <Select value={resourceId} onValueChange={setResourceId}>
            <SelectTrigger><SelectValue placeholder="Choose resource" /></SelectTrigger>
            <SelectContent>
              {resources.map((res) => (
                <SelectItem key={res.id} value={res.id}>
                  {res.full_name || res.employee_code || res.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="Role"><Input name="role" placeholder="e.g. Tech Lead" /></Field>
        <Field label="Allocation %"><Input type="number" step="1" min="1" max="100" name="allocation_percent" defaultValue={100} /></Field>
        <Field label="Planned hours *"><Input type="number" step="0.5" name="planned_hours" defaultValue={0} required /></Field>
        <Field label="Start date *"><Input type="date" name="start_date" defaultValue={defaultStart ?? ""} required /></Field>
        <Field label="End date *"><Input type="date" name="end_date" defaultValue={defaultEnd ?? ""} required /></Field>
        <Field label="Cost rate / hr"><Input type="number" step="0.01" name="cost_rate" defaultValue={r?.default_cost_rate ?? 0} key={resourceId + "-cost"} /></Field>
        <Field label="Billing rate / hr"><Input type="number" step="0.01" name="billing_rate" defaultValue={r?.default_billing_rate ?? 0} key={resourceId + "-bill"} /></Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={defaultCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="space-y-1">
          <Label className="text-xs">Billable</Label>
          <div className="h-9 flex items-center"><Switch name="is_billable" defaultChecked /></div>
        </div>
        <Field label="Notes" wide><Textarea name="notes" rows={2} /></Field>
        <DialogFooter className="col-span-2 mt-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Allocation"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ActualHoursDialog({
  allocations, resourceById, currentUserId, saving, onSubmit,
}: {
  allocations: Allocation[];
  resourceById: Map<string, { full_name: string | null; user_id: string | null }>;
  currentUserId?: string;
  saving: boolean;
  onSubmit: (v: Record<string, unknown>) => void;
}) {
  // Default to the current user's own allocation if any
  const defaultAlloc = allocations.find((a) => resourceById.get(a.resource_id)?.user_id === currentUserId) ?? allocations[0];
  const [allocId, setAllocId] = useState<string>(defaultAlloc?.id ?? "");
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Log Actual Hours</DialogTitle>
        <DialogDescription>Entries inherit cost and billing rates from the chosen allocation.</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!allocId) { toast.error("Pick an allocation"); return; }
          onSubmit({
            allocation_id: allocId,
            work_date: fd.get("work_date"),
            hours: Number(fd.get("hours") || 0),
            description: (fd.get("description") as string) || null,
            status: fd.get("status") || "submitted",
          });
        }}
      >
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Allocation *</Label>
          <Select value={allocId} onValueChange={setAllocId}>
            <SelectTrigger><SelectValue placeholder="Choose allocation" /></SelectTrigger>
            <SelectContent>
              {allocations.map((a) => {
                const r = resourceById.get(a.resource_id);
                return <SelectItem key={a.id} value={a.id}>{r?.full_name ?? "Resource"} · {a.role ?? "—"}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <Field label="Date *"><Input type="date" name="work_date" defaultValue={new Date().toISOString().slice(0,10)} required /></Field>
        <Field label="Hours *"><Input type="number" step="0.25" name="hours" defaultValue={8} required /></Field>
        <Field label="Status">
          <Select name="status" defaultValue="submitted">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description" wide><Textarea name="description" rows={2} /></Field>
        <DialogFooter className="col-span-2 mt-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log Hours"}</Button>
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