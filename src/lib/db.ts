import { supabase } from "@/integrations/supabase/client";

/**
 * Loose-typed table accessor that bypasses the strict generated insert/update
 * types. The generated types reject Record<string, unknown> even when the keys
 * are valid columns, which makes dynamic-form mutations impossible without
 * massive switch statements. Use this only inside our mutation helpers where
 * we know the shape is correct at runtime.
 */
export function tbl(name: string) {
  return supabase.from(name as never) as unknown as {
    insert: (v: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error: Error | null; data: unknown }>;
    update: (v: Record<string, unknown>) => {
      eq: (c: string, val: string | number | boolean) => Promise<{ error: Error | null; data: unknown }>;
    };
    upsert: (v: Record<string, unknown>) => Promise<{ error: Error | null; data: unknown }>;
    delete: () => { eq: (c: string, val: string | number | boolean) => Promise<{ error: Error | null }> };
  };
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}