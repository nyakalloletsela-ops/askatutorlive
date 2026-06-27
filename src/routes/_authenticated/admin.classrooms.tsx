import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { ConfigToggle } from "@/components/admin/ConfigToggle";

export const Route = createFileRoute("/_authenticated/admin/classrooms")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => (
    <PageContainer>
      <SectionHeader
        title="Classroom controls"
        description="Enable live classrooms and manage recording permissions."
      />
      <div className="space-y-3">
        <ConfigToggle k="classrooms_enabled" label="Live classrooms enabled" description="When off, students and tutors cannot join classrooms." />
      </div>
    </PageContainer>
  ),
});
