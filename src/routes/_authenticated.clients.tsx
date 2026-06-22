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
import { Plus, Pencil, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { fmtMoney } from "@/lib/format";

type ClientRow = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  region: string | null;
  country: string | null;
  currency: string | null;
  status: string;
  tier: string | null;
  email: string | null;
  phone: string | null;
  credit_limit: number | null;
  is_deleted: boolean;
  created_at: string;
};

const EMPTY: Partial<ClientRow> & { tax_id?: string; payment_terms?: string; website?: string; notes?: string } = {
  code: "", name: "", currency: "USD", status: "active",
};

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — PPM Platform" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "project_manager", "finance_manager"]);
  const canSeeDeleted = hasAnyRole(["super_admin", "pmo_admin", "auditor"]);
  const canHardDelete = hasAnyRole(["super_admin"]);

  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ClientRow> | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", showDeleted],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").order("name");
      if (!showDeleted) q = q.eq("is_deleted", false);
      const { data, error } = await q;
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<ClientRow> & Record<string, unknown>) => {
      const { id, ...rest } = row;
      const uid = await currentUserId();
      const payload: Record<string, unknown> = { ...rest, updated_by: uid };
      if (id) {
        const { error } = await tbl("clients").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        payload.created_by = uid;
        const { error } = await tbl("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing?.id ? "Client updated" : "Client created");
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const uid = await currentUserId();
      const { error } = await tbl("clients")
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: uid })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Client archived"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl("clients")
        .update({ is_deleted: false, deleted_at: null, deleted_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Client restored"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<ClientRow, unknown>[] = [
    {
      id: "code", header: "Code", accessorKey: "code",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      id: "name", header: "Name", accessorKey: "name",
      cell: ({ row }) => (
        <button
          className="text-left font-medium hover:underline inline-flex items-center gap-1"
          onClick={() => navigate({ to: "/clients/$id", params: { id: row.original.id } })}
        >
          {row.original.name}
          <ExternalLink className="size-3 opacity-50" />
        </button>
      ),
    },
    { id: "industry", header: "Industry", accessorKey: "industry" },
    { id: "region", header: "Region", accessorKey: "region" },
    { id: "country", header: "Country", accessorKey: "country" },
    { id: "currency", header: "Currency", accessorKey: "currency" },
    { id: "tier", header: "Tier", accessorKey: "tier" },
    {
      id: "credit_limit", header: "Credit Limit",
      accessorFn: (r) => r.credit_limit ?? 0,
      cell: ({ row }) => fmtMoney(row.original.credit_limit, row.original.currency ?? "USD"),
    },
    {
      id: "status", header: "Status", accessorKey: "status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variant = row.original.is_deleted ? "destructive" : s === "active" ? "default" : "secondary";
        return <Badge variant={variant as "default"}>{row.original.is_deleted ? "Archived" : s}</Badge>;
      },
    },
    {
      id: "actions", header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canManage && !row.original.is_deleted && (
            <Button size="icon" variant="ghost" className="size-7"
              onClick={() => { setEditing(row.original); setDialogOpen(true); }}
              title="Edit">
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
                  <AlertDialogTitle>Archive {row.original.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The client will be hidden from active views. Administrators can restore it later.
                    {canHardDelete && " To permanently delete, contact a super administrator."}
                  </AlertDialogDescription>
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
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        description="Manage your customer accounts and contracting parties."
        actions={
          <div className="flex items-center gap-3">
            {canSeeDeleted && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
                Show archived
              </label>
            )}
            {canManage && (
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditing(EMPTY)}>
                    <Plus className="size-4 mr-1" /> New Client
                  </Button>
                </DialogTrigger>
                <ClientFormDialog
                  initial={editing}
                  saving={upsert.isPending}
                  onSubmit={(v) => upsert.mutate({ ...editing, ...v } as never)}
                />
              </Dialog>
            )}
          </div>
        }
      />
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading clients…</div>
      ) : (
        <SmartGrid<ClientRow>
          data={clients}
          columns={columns}
          searchPlaceholder="Search clients by name, code, industry…"
          exportFileName="clients.csv"
          emptyState={
            <div className="space-y-2 py-6">
              <div>No clients yet.</div>
              {canManage && <Button size="sm" onClick={() => { setEditing(EMPTY); setDialogOpen(true); }}>
                <Plus className="size-4 mr-1" /> Add the first client
              </Button>}
            </div>
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Need bulk import or to view contacts? Open a client to manage contacts and contract details. <Link to="/admin/master-data" className="underline">Master Data hub</Link>.
      </p>
    </div>
  );
}

function ClientFormDialog({
  initial,
  saving,
  onSubmit,
}: {
  initial: Partial<ClientRow> | null;
  saving: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const v = initial ?? EMPTY;
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{initial?.id ? "Edit Client" : "New Client"}</DialogTitle>
        <DialogDescription>Capture the master record for billing, project assignment and reporting.</DialogDescription>
      </DialogHeader>
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const obj: Record<string, unknown> = {};
          fd.forEach((val, key) => {
            const s = String(val).trim();
            if (s === "") return;
            if (key === "credit_limit") obj[key] = Number(s);
            else obj[key] = s;
          });
          if (obj.credit_limit === undefined && initial?.id) obj.credit_limit = null;
          onSubmit(obj);
        }}
      >
        <Field label="Code *"><Input name="code" defaultValue={v.code ?? ""} required /></Field>
        <Field label="Name *"><Input name="name" defaultValue={v.name ?? ""} required /></Field>
        <Field label="Legal name" wide><Input name="legal_name" defaultValue={v.legal_name ?? ""} /></Field>
        <Field label="Industry"><Input name="industry" defaultValue={v.industry ?? ""} /></Field>
        <Field label="Tier">
          <Select name="tier" defaultValue={v.tier ?? ""}>
            <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="strategic">Strategic</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="mid_market">Mid-Market</SelectItem>
              <SelectItem value="smb">SMB</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Region"><Input name="region" defaultValue={v.region ?? ""} /></Field>
        <Field label="Country"><Input name="country" defaultValue={v.country ?? ""} /></Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={v.currency ?? "USD"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "JPY"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={v.status ?? "active"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Email"><Input type="email" name="email" defaultValue={v.email ?? ""} /></Field>
        <Field label="Phone"><Input name="phone" defaultValue={v.phone ?? ""} /></Field>
        <Field label="Website" wide><Input name="website" defaultValue={(v as { website?: string }).website ?? ""} /></Field>
        <Field label="Tax ID"><Input name="tax_id" defaultValue={(v as { tax_id?: string }).tax_id ?? ""} /></Field>
        <Field label="Payment terms"><Input name="payment_terms" placeholder="e.g. Net 30" defaultValue={(v as { payment_terms?: string }).payment_terms ?? ""} /></Field>
        <Field label="Credit limit">
          <Input type="number" step="0.01" name="credit_limit" defaultValue={v.credit_limit ?? ""} />
        </Field>
        <Field label="Notes" wide>
          <Textarea name="notes" rows={2} defaultValue={(v as { notes?: string }).notes ?? ""} />
        </Field>
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