import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { checkRoomMembership } from "@/lib/access.functions";
import { ClassroomShell } from "@/components/classroom/ClassroomShell";

export const Route = createFileRoute("/_authenticated/classroom/$roomId")({
  beforeLoad: async ({ params }) => {
    try {
      const { isMember } = await checkRoomMembership({ data: { roomId: params.roomId } });
      if (!isMember) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      console.warn("[classroom] membership check failed, allowing entry:", e);
    }
  },
  component: ClassroomPage,
});

function ClassroomPage() {
  const { roomId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const [isTutor, setIsTutor] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (roomId.startsWith("demo-")) { setIsTutor(true); return; }
    supabase
      .from("sessions")
      .select("tutor_id")
      .eq("room_id", roomId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { tutor_id: string } | null;
        setIsTutor(!!row && row.tutor_id === user.id);
      });
  }, [roomId, user]);

  if (!user) return null;
  const displayName = user.email ?? "Guest";

  return (
    <ClassroomShell
      roomId={roomId}
      userId={user.id}
      displayName={displayName}
      isTutor={isTutor}
      isAdmin={isAdmin}
    />
  );
}
