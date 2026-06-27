import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listSchedulableStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["tutor", "admin"]);

    if (roleError) throw new Error(roleError.message);
    if (!roles?.length) throw new Error("Only tutors can schedule students");

    const { data: studentRoles, error: studentRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");

    if (studentRoleError) throw new Error(studentRoleError.message);

    const ids = Array.from(
      new Set((studentRoles ?? []).map((row) => row.user_id).filter((id) => id !== context.userId)),
    );

    if (ids.length === 0) return [];

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .order("full_name", { ascending: true, nullsFirst: false });

    if (profileError) throw new Error(profileError.message);

    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name ?? "Student",
    }));
  });
