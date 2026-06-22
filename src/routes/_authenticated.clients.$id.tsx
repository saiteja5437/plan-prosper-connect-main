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
import { ArrowLeft, Plus, Star, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { tbl, currentUserId } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";

type Contact = {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_deleted: boolean;
};

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({ meta: [{ title: "Client — PPM Platform" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["super_admin", "pmo_admin", "project_manager", "finance_manager"]);
  const qc = useQueryClient();
  const [contactDialog, setContactDialog] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["client-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_contacts")
        .select("*").eq("client_id", id).eq("is_deleted", false).order("is_primary", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const addContact = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const { error } = await tbl("client_contacts").insert({ ...v, client_id: id, created_by: uid, updated_by: uid });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contact added"); setContactDialog(false); qc.invalidateQueries({ queryKey: ["client-contacts", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeContact = useMutation({
    mutationFn: async (cid: string) => {
      const { error } = await tbl("client_contacts").update({ is_deleted: true }).eq("id", cid);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contact removed"); qc.invalidateQueries({ queryKey: ["client-contacts", id] }); },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading client…</div>;
  if (!client) {
    return (
      <div className="space-y-3">
        <PageHeader title="Client not found" description="This client may have been deleted or you may lack access." />
        <Button asChild variant="outline"><Link to="/clients"><ArrowLeft className="size-4 mr-1" />Back to clients</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/clients"><ArrowLeft className="size-4 mr-1" />Clients</Link></Button>
      </div>
      <PageHeader
        title={client.name}
        description={`${client.code} • ${client.industry ?? "—"} • ${client.region ?? "—"}`}
        actions={<Badge variant={client.is_deleted ? "destructive" : "default"}>{client.is_deleted ? "Archived" : client.status}</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Legal name" value={client.legal_name} />
            <Field label="Industry" value={client.industry} />
            <Field label="Segment" value={client.segment} />
            <Field label="Tier" value={client.tier} />
            <Field label="Region" value={client.region} />
            <Field label="Country" value={client.country} />
            <Field label="Currency" value={client.currency} />
            <Field label="Status" value={client.status} />
            <Field label="Email" value={client.email} />
            <Field label="Phone" value={client.phone} />
            <Field label="Website" value={client.website} />
            <Field label="Tax ID" value={client.tax_id} />
            <Field label="Payment terms" value={client.payment_terms} />
            <Field label="Credit limit" value={fmtMoney(client.credit_limit, client.currency ?? "USD")} />
            <Field label="Created" value={fmtDate(client.created_at)} />
            <Field label="Last updated" value={fmtDate(client.updated_at)} />
            {client.notes && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="whitespace-pre-wrap">{client.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            {canManage && (
              <Dialog open={contactDialog} onOpenChange={setContactDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="size-4 mr-1" />Add</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const obj: Record<string, unknown> = {};
                      fd.forEach((v, k) => { const s = String(v).trim(); if (s) obj[k] = s; });
                      obj.is_primary = fd.get("is_primary") === "on";
                      addContact.mutate(obj);
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">First name *</Label><Input name="first_name" required /></div>
                      <div><Label className="text-xs">Last name</Label><Input name="last_name" /></div>
                    </div>
                    <div><Label className="text-xs">Title</Label><Input name="title" /></div>
                    <div><Label className="text-xs">Email</Label><Input type="email" name="email" /></div>
                    <div><Label className="text-xs">Phone</Label><Input name="phone" /></div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_primary" /> Primary contact</label>
                    <DialogFooter><Button type="submit" disabled={addContact.isPending}>Save</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {contacts.length === 0 && <div className="text-sm text-muted-foreground">No contacts yet.</div>}
            {contacts.map((c) => (
              <div key={c.id} className="border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">
                    {c.first_name} {c.last_name}
                    {c.is_primary && <Star className="inline size-3 ml-1 fill-current text-amber-500" />}
                  </div>
                  {canManage && (
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => removeContact.mutate(c.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                {c.email && <div className="text-xs flex items-center gap-1"><Mail className="size-3" />{c.email}</div>}
                {c.phone && <div className="text-xs flex items-center gap-1"><Phone className="size-3" />{c.phone}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}