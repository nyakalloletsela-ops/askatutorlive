import { createFileRoute, redirect } from "@tanstack/react-router";
import { checkIsAdmin } from "@/lib/access.functions";
import { PageContainer, SectionHeader } from "@/components/dashboard/primitives";
import { ConfigToggle } from "@/components/admin/ConfigToggle";

export const Route = createFileRoute("/_authenticated/admin/whiteboard")({
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
        title="Whiteboard controls"
        description="Toggle specific whiteboard tools and export permissions."
      />
      <div className="space-y-3">
        <ConfigToggle k="whiteboard_graphing_enabled" label="Graphing tools" description="Function plotter and coordinate plane." />
        <ConfigToggle k="whiteboard_latex_enabled" label="LaTeX editor" description="Equation editor and LaTeX preview." />
        <ConfigToggle k="whiteboard_ocr_enabled" label="Handwriting to LaTeX (AI OCR)" description="Convert handwritten math into LaTeX." />
        <ConfigToggle k="whiteboard_export_enabled" label="Export whiteboard" description="Allow exporting whiteboard pages as PNG/PDF." />
      </div>
    </PageContainer>
  ),
});
