import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });

export const checkRoomMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ context, data }) => {
    // Demo rooms are accessible to any signed-in user (room id encodes their own uid prefix)
    if (data.roomId.startsWith("demo-")) {
      return { isMember: true };
    }
    const { data: row, error } = await context.supabase
      .from("sessions")
      .select("id, tutor_id, student_id")
      .eq("room_id", data.roomId)
      .or(`tutor_id.eq.${context.userId},student_id.eq.${context.userId}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isMember: !!row };
  });

