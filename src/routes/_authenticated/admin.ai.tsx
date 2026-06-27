import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { ConfigToggle } from "@/components/admin/ConfigToggle";

export const Route = createFileRoute("/_authenticated/admin/ai")({
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
        title="AI controls"
        description="Enable or disable AI features platform-wide and cap usage per user."
      />
      <div className="space-y-3">
        <ConfigToggle k="ai_enabled" label="AI features enabled" description="Master switch for AI Coach, AI Toolkit, and whiteboard AI." />
        <ConfigToggle
          k="ai_token_limit_per_user"
          label="Token limit per user"
          description="Approximate monthly AI token budget per user."
        />
      </div>
    </PageContainer>
  ),
});
