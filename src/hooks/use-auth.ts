import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "pmo_admin"
  | "project_manager"
  | "resource_manager"
  | "finance_manager"
  | "leadership"
  | "auditor"
  | "team_member";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
};

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
} {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    roles: [],
  });

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (userId: string): Promise<AppRole[]> => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return (data ?? []).map((r) => r.role as AppRole);
    };

    const hydrate = async (session: Session | null) => {
      if (!session?.user) {
        if (mounted) setState({ loading: false, session: null, user: null, roles: [] });
        return;
      }
      const roles = await loadRoles(session.user.id);
      if (mounted) setState({ loading: false, session, user: session.user, roles });
    };

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        hydrate(session);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    ...state,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    hasRole: (r) => state.roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => state.roles.includes(r)),
  };
}