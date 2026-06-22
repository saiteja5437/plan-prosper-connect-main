import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — PPM Platform" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] = useState("");
  const [practice, setPractice] = useState("");

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile.data) {
      setFirstName(profile.data.first_name ?? "");
      setLastName(profile.data.last_name ?? "");
      setDepartment(profile.data.department ?? "");
      setPractice(profile.data.practice ?? "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const full_name = `${firstName} ${lastName}`.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName, last_name: lastName, full_name, department, practice })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="My Profile" description="Your account details and roles." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div className="space-y-1"><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
                <div className="space-y-1"><Label>Practice</Label><Input value={practice} onChange={(e) => setPractice(e.target.value)} /></div>
              </div>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Access</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Assigned roles</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {roles.map((r) => (
                  <span key={r} className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
                    {r.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Only a Super Admin can change role assignments.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}