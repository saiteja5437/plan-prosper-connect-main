import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SmartGrid } from "@/components/smart-grid/SmartGrid";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type LookupValue = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  color: string | null;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/lookups/$lookupId")({
  head: () => ({ meta: [{ title: "Lookup values — PPM Platform" }] }),
  component: LookupDetail,
});

function LookupDetail() {
  const { lookupId } = Route.useParams();
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "pmo_admin"]);

  const lookupQ = useQuery({
    queryKey: ["lookup", lookupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lookups").select("*").eq("id", lookupId).single();
      if (error) throw error;
      return data;
    },
  });

  const valuesQ = useQuery({
    queryKey: ["lookup-values", lookupId],
    queryFn: async (): Promise<LookupValue[]> => {
      const { data, error } = await supabase
        .from("lookup_values")
        .select("id, code, label, sort_order, color, is_active")
        .eq("lookup_id", lookupId)
        .eq("is_deleted", false)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [editing, setEditing] = useState<LookupValue | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LookupValue>({ id: "", code: "", label: "", sort_order: 0, color: "", is_active: true });

  const startCreate = () => {
    setEditing(null);
    setForm({ id: "", code: "", label: "", sort_order: (valuesQ.data?.length ?? 0) * 10 + 10, color: "", is_active: true });
    setOpen(true);
  };
  const startEdit = (v: LookupValue) => {
    setEditing(v);
    setForm(v);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.label.trim()) throw new Error("Code and label are required");
      const payload = {
        lookup_id: lookupId,
        code: form.code.trim(),
        label: form.label.trim(),
        sort_order: Number(form.sort_order) || 0,
        color: form.color?.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("lookup_values").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lookup_values").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Value updated" : "Value created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["lookup-values", lookupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lookup_values")
        .update({ is_deleted: true, deleted_on: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Value deleted");
      qc.invalidateQueries({ queryKey: ["lookup-values", lookupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<LookupValue>[] = useMemo(() => [
    { accessorKey: "sort_order", header: "Order" },
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <code className="text-xs">{String(getValue())}</code> },
    { accessorKey: "label", header: "Label", cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span> },
    {
      accessorKey: "color",
      header: "Color",
      cell: ({ getValue }) => {
        const c = getValue() as string | null;
        return c ? (
          <div className="flex items-center gap-2">
            <span className="size-4 rounded border" style={{ backgroundColor: c }} />
            <code className="text-xs">{c}</code>
          </div>
        ) : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ getValue }) => (getValue() ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => startEdit(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete value?</AlertDialogTitle>
                <AlertDialogDescription>This is a soft delete. The record can be restored by an administrator.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => softDelete.mutate(row.original.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [canEdit, softDelete]);

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
        <Link to="/admin/lookups"><ArrowLeft className="size-4 mr-1" /> Back to lookups</Link>
      </Button>
      <PageHeader
        title={lookupQ.data?.name ?? "Lookup"}
        description={lookupQ.data?.description ?? `Code: ${lookupQ.data?.code ?? ""}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canEdit} onClick={startCreate}><Plus className="size-4 mr-1" /> Add value</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit value" : "New value"}</DialogTitle>
                <DialogDescription>Codes are immutable identifiers. Labels appear in the UI.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Code</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. high" />
                  </div>
                  <div className="space-y-1">
                    <Label>Sort order</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. High" />
                </div>
                <div className="space-y-1">
                  <Label>Color (optional)</Label>
                  <div className="flex gap-2">
                    <Input value={form.color ?? ""} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#10b981" />
                    {form.color && <div className="size-9 rounded border shrink-0" style={{ backgroundColor: form.color }} />}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive values are hidden from dropdowns.</p>
                  </div>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {!canEdit && (
        <div className="mb-4 text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
          You have read-only access to lookup values. Super Admin or PMO Admin role required to edit.
        </div>
      )}
      {valuesQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <SmartGrid<LookupValue>
          data={valuesQ.data ?? []}
          columns={columns}
          searchPlaceholder="Search values…"
          exportFileName={`${lookupQ.data?.code ?? "lookup"}-values.csv`}
        />
      )}
    </div>
  );
}