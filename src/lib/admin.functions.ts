import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateUserSchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(72),
  role: z.enum(["student", "tutor"]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify the caller is an admin
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRows || roleRows.length === 0) throw new Error("Forbidden");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Create failed");

    // handle_new_user trigger inserts a 'student' role by default.
    // If the requested role is tutor, add tutor as well.
    if (data.role === "tutor") {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "tutor" });
      if (rErr) throw new Error(rErr.message);
    }
    return { id: created.user.id, email: created.user.email };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
    const rolesById = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesById.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesById.set(r.user_id, arr);
    });

    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      full_name: nameById.get(u.id) ?? null,
      roles: rolesById.get(u.id) ?? [],
    }));
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

