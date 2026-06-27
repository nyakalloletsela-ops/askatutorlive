import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns a short-lived signed URL for a course material file.
 * Access rules: the owning tutor, an admin, or a student with an access grant.
 */
export const getCourseMaterialUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ materialId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: material, error: mErr } = await supabase
      .from("course_materials")
      .select("id, tutor_id, storage_path, external_url, kind")
      .eq("id", data.materialId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!material) throw new Error("Material not found");

    if (material.kind === "link" || !material.storage_path) {
      return { url: material.external_url ?? "" };
    }

    // RLS on course_materials already enforces access, but double-check explicitly.
    let allowed = material.tutor_id === userId;
    if (!allowed) {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      allowed = !!role;
    }
    if (!allowed) {
      const { data: grant } = await supabase
        .from("course_material_access")
        .select("id")
        .eq("material_id", data.materialId)
        .eq("student_id", userId)
        .maybeSingle();
      allowed = !!grant;
    }
    if (!allowed) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("course-materials")
      .createSignedUrl(material.storage_path, 60 * 10);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Could not sign URL");
    return { url: signed.signedUrl };
  });
