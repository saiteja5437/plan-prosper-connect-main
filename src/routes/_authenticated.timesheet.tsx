import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { tbl, currentUserId } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/timesheet")({
  head: () => ({ meta: [{ title: "My Timesheet — PPM Platform" }] }),
  component: TimesheetPage,
});

function TimesheetPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: myResource } = useQuery({
    queryKey: ["my-resource", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("resources").select("id,full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["my-allocations", myResource?.id],
    enabled: !!myResource?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("allocations")
        .select("id, project_id, role, start_date, end_date, planned_hours, status")
        .eq("resource_id", myResource!.id).eq("is_deleted", false).order("start_date", { ascending: false });
      if (error) throw error;
      return data as { id: string; project_id: string; role: string | null; start_date: string; end_date: string; planned_hours: number; status: string }[];
    },
  });

  const projectIds = useMemo(() => Array.from(new Set(allocations.map((a) => a.project_id))), [allocations]);

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name,code").in("id", projectIds);
      if (error) throw error;
      return data as { id: string; name: string; code: string }[];
    },
  });
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const { data: actuals = [] } = useQuery({
    queryKey: ["my-actuals", myResource?.id],
    enabled: !!myResource?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("actual_hours")
        .select("id, allocation_id, project_id, work_date, hours, description, status")
        .eq("resource_id", myResource!.id).order("work_date", { ascending: false }).limit(100);
      if (error) throw error;
      return data as { id: string; allocation_id: string; project_id: string; work_date: string; hours: number; description: string | null; status: string }[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const uid = await currentUserId();
      const alloc = allocations.find((a) => a.id === v.allocation_id);
      if (!alloc) throw new Error("Allocation required");
      const { error } = await tbl("actual_hours").insert({
        ...v, project_id: alloc.project_id, resource_id: myResource!.id,
        created_by: uid, updated_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Hours logged"); setOpen(false); qc.invalidateQueries({ queryKey: ["my-actuals", myResource?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tbl("actual_hours").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-actuals", myResource?.id] }); },
  });

  if (!myResource) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Timesheet" description="Log delivery effort against your project allocations." />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No resource profile is linked to your user. Ask a Resource Manager to <Link to="/resources" className="underline">link your account</Link> to a resource record.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Timesheet"
        description={`Hello ${myResource.full_name ?? ""}. Log effort against your active allocations.`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={allocations.length === 0}><Plus className="size-4 mr-1" />Log Hours</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Log Hours</DialogTitle></DialogHeader>
              <form
                className="grid grid-cols-2 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  addEntry.mutate({
                    allocation_id: fd.get("allocation_id"),
                    work_date: fd.get("work_date"),
                    hours: Number(fd.get("hours") || 0),
                    description: (fd.get("description") as string) || null,
                    status: "submitted",
                  });
                }}
              >
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Allocation *</Label>
                  <Select name="allocation_id" defaultValue={allocations[0]?.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allocations.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {projectById.get(a.project_id)?.name ?? a.project_id} · {a.role ?? "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date *</Label>
                  <Input type="date" name="work_date" defaultValue={new Date().toISOString().slice(0,10)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hours *</Label>
                  <Input type="number" step="0.25" name="hours" defaultValue={8} required />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea name="description" rows={2} />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="submit" disabled={addEntry.isPending}>Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader><CardTitle>My Allocations</CardTitle></CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">You have no active allocations yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Project</TableHead><TableHead>Role</TableHead>
                <TableHead>Dates</TableHead><TableHead className="text-right">Planned Hrs</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link to="/projects/$id" params={{ id: a.project_id }} className="font-medium hover:underline">
                        {projectById.get(a.project_id)?.name ?? a.project_id}
                      </Link>
                    </TableCell>
                    <TableCell>{a.role ?? "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(a.planned_hours).toFixed(1)}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{a.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Entries</CardTitle></CardHeader>
        <CardContent>
          {actuals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No hours logged yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Project</TableHead>
                <TableHead className="text-right">Hours</TableHead><TableHead>Description</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {actuals.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{fmtDate(h.work_date)}</TableCell>
                    <TableCell>{projectById.get(h.project_id)?.name ?? h.project_id}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(h.hours).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">{h.description}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{h.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeEntry.mutate(h.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}