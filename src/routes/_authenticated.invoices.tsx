import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { tbl, currentUserId } from "@/lib/db";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtDate, fmtMoney } from "@/lib/format";

type Invoice = {
  id: string;
  invoice_number: string;
  project_id: string;
  client_id: string;
  milestone_id: string | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  paid_on: string | null;
  notes: string | null;
};

type Line = { description: string; quantity: number; unit_price: number };

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — PPM Platform" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "finance_manager"]);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*")
        .eq("is_deleted", false).order("invoice_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-pick"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id,code,name,client_id,currency").eq("is_deleted", false).order("name");
      if (error) throw error;
      return data as { id: string; code: string; name: string; client_id: string | null; currency: string }[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-pick"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,code").eq("is_deleted", false).order("name");
      if (error) throw error;
      return data as { id: string; name: string; code: string }[];
    },
  });

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const create = useMutation({
    mutationFn: async ({ invoice, lines }: { invoice: Record<string, unknown>; lines: Line[] }) => {
      const uid = await currentUserId();
      const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
      const tax_percent = Number(invoice.tax_percent ?? 0);
      const tax_amount = +(subtotal * tax_percent / 100).toFixed(2);
      const total_amount = +(subtotal + tax_amount).toFixed(2);
      const payload = { ...invoice, subtotal, tax_amount, total_amount, created_by: uid, updated_by: uid };
      const { data, error } = await supabase.from("invoices").insert(payload as never).select("id").single();
      if (error) throw error;
      const invId = (data as { id: string }).id;
      if (lines.length) {
        const lineRows = lines.map((l, i) => ({ invoice_id: invId, description: l.description, quantity: l.quantity, unit_price: l.unit_price, sort_order: i }));
        const { error: e2 } = await tbl("invoice_lines").insert(lineRows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Invoice created"); setDialogOpen(false); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (inv: Invoice) => {
      const { error } = await tbl("invoices").update({
        status: "paid", amount_paid: inv.total_amount, paid_on: new Date().toISOString().slice(0,10),
      }).eq("id", inv.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked paid"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("invoices").update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Archived"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
  });

  const totals = useMemo(() => {
    const sum = (pred: (i: Invoice) => boolean) => invoices.filter(pred).reduce((s, i) => s + Number(i.total_amount), 0);
    return {
      outstanding: sum((i) => i.status !== "paid" && i.status !== "cancelled"),
      paid: sum((i) => i.status === "paid"),
      overdue: sum((i) => i.status !== "paid" && i.status !== "cancelled" && !!i.due_date && new Date(i.due_date) < new Date()),
      draft: sum((i) => i.status === "draft"),
    };
  }, [invoices]);

  const statusTone = (s: string): "default" | "secondary" | "destructive" | "outline" =>
    s === "paid" ? "secondary" : s === "overdue" ? "destructive" : s === "sent" ? "default" : "outline";

  const columns: ColumnDef<Invoice, unknown>[] = [
    { id: "number", header: "Invoice #", accessorKey: "invoice_number",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.invoice_number}</span> },
    { id: "date", header: "Date", accessorFn: (r) => r.invoice_date, cell: ({ row }) => fmtDate(row.original.invoice_date) },
    { id: "due", header: "Due", accessorFn: (r) => r.due_date ?? "", cell: ({ row }) => fmtDate(row.original.due_date) },
    { id: "project", header: "Project", accessorFn: (r) => projectById.get(r.project_id)?.name ?? "",
      cell: ({ row }) => projectById.get(row.original.project_id)?.name ?? "—" },
    { id: "client", header: "Client", accessorFn: (r) => clientById.get(r.client_id)?.name ?? "",
      cell: ({ row }) => clientById.get(row.original.client_id)?.name ?? "—" },
    { id: "total", header: "Total",
      accessorFn: (r) => Number(r.total_amount),
      cell: ({ row }) => <span className="tabular-nums">{fmtMoney(row.original.total_amount, row.original.currency)}</span> },
    { id: "paid", header: "Paid",
      accessorFn: (r) => Number(r.amount_paid),
      cell: ({ row }) => <span className="tabular-nums">{fmtMoney(row.original.amount_paid, row.original.currency)}</span> },
    { id: "status", header: "Status",
      cell: ({ row }) => <Badge variant={statusTone(row.original.status)} className="capitalize">{row.original.status}</Badge> },
    { id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canManage && row.original.status !== "paid" && (
            <Button size="sm" variant="outline" onClick={() => markPaid.mutate(row.original)}>Mark paid</Button>
          )}
          {canManage && (
            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => archive.mutate(row.original.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      ) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Billing across projects with line items, tax and payment status."
        actions={
          canManage ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Invoice</Button></DialogTrigger>
              <NewInvoiceDialog projects={projects} clients={clients} saving={create.isPending}
                onSubmit={(invoice, lines) => create.mutate({ invoice, lines })} />
            </Dialog>
          ) : null
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Outstanding" value={fmtMoney(totals.outstanding, "USD")} tone="warning" />
        <KpiCard label="Overdue" value={fmtMoney(totals.overdue, "USD")} tone="destructive" />
        <KpiCard label="Paid (all time)" value={fmtMoney(totals.paid, "USD")} tone="success" />
        <KpiCard label="Drafts" value={fmtMoney(totals.draft, "USD")} tone="info" />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading invoices…</div>
      ) : (
        <SmartGrid<Invoice>
          data={invoices}
          columns={columns}
          searchPlaceholder="Search by number, project, client…"
          exportFileName="invoices.csv"
          emptyState={
            <div className="space-y-2 py-6">
              <div>No invoices yet.</div>
              {canManage && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="size-4 mr-1" /> Create first invoice</Button>}
            </div>
          }
        />
      )}
    </div>
  );
}

function NewInvoiceDialog({
  projects, clients, saving, onSubmit,
}: {
  projects: { id: string; code: string; name: string; client_id: string | null; currency: string }[];
  clients: { id: string; name: string; code: string }[];
  saving: boolean;
  onSubmit: (invoice: Record<string, unknown>, lines: Line[]) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const onProjectChange = (pid: string) => {
    setProjectId(pid);
    const p = projects.find((x) => x.id === pid);
    if (p?.client_id) setClientId(p.client_id);
    if (p?.currency) setCurrency(p.currency);
  };

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>New Invoice</DialogTitle>
        <DialogDescription>Capture header, line items, and tax. Totals compute automatically.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (!projectId || !clientId) { toast.error("Project and client required"); return; }
          const cleaned = lines.filter((l) => l.description.trim() && l.quantity > 0);
          if (!cleaned.length) { toast.error("Add at least one line"); return; }
          onSubmit({
            invoice_number: fd.get("invoice_number"),
            project_id: projectId,
            client_id: clientId,
            invoice_date: fd.get("invoice_date"),
            due_date: (fd.get("due_date") as string) || null,
            period_start: (fd.get("period_start") as string) || null,
            period_end: (fd.get("period_end") as string) || null,
            currency,
            tax_percent: Number(fd.get("tax_percent") || 0),
            status: fd.get("status") || "draft",
            notes: (fd.get("notes") as string) || null,
          }, cleaned);
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Project *</Label>
            <Select value={projectId} onValueChange={onProjectChange}>
              <SelectTrigger><SelectValue placeholder="Pick project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Pick client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invoice # *</Label>
            <Input name="invoice_number" required defaultValue={`INV-${Date.now().toString().slice(-6)}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invoice date *</Label>
            <Input type="date" name="invoice_date" defaultValue={new Date().toISOString().slice(0,10)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due date</Label>
            <Input type="date" name="due_date" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["USD","EUR","GBP","INR","AUD","CAD","SGD","JPY"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period start</Label>
            <Input type="date" name="period_start" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Period end</Label>
            <Input type="date" name="period_end" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select name="status" defaultValue="draft">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Line items</Label>
            <Button type="button" size="sm" variant="outline"
              onClick={() => setLines([...lines, { description: "", quantity: 1, unit_price: 0 }])}>
              <Plus className="size-3.5 mr-1" /> Add line
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <Input className="col-span-6" placeholder="Description" value={l.description}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <Input className="col-span-2" type="number" step="0.25" placeholder="Qty" value={l.quantity}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                <Input className="col-span-3" type="number" step="0.01" placeholder="Unit price" value={l.unit_price}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
                <Button type="button" size="icon" variant="ghost" className="col-span-1 size-9 text-destructive"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tax %</Label>
            <Input type="number" step="0.01" name="tax_percent" defaultValue={0} />
          </div>
          <div className="col-span-2 text-right text-sm">
            <div>Subtotal: <span className="font-medium tabular-nums">{fmtMoney(subtotal, currency)}</span></div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea name="notes" rows={2} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Invoice"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}