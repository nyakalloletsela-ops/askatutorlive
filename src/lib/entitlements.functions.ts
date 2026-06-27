import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeatureScope = "ai" | "find_tutors" | "labs";

export const getMyScopes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_scopes");
    if (error) throw new Error(error.message);
    return (data as string[] | null) ?? [];
  });
