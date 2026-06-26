import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * One-tap "Save to Notes" button. Persists AI output to the notes table,
 * tagged with a `kind` so the Notes page can filter by source folder.
 * Suggested kinds: "ai-coach", "ai-tool:explain", "ai-tool:quiz", "whiteboard", etc.
 */
export function SaveToNotes({
  content,
  title,
  kind,
  size = "sm",
}: {
  content: string;
  title: string;
  kind: string;
  size?: "sm" | "xs";
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    const safeTitle = title.trim().slice(0, 120) || "Untitled";
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      title: safeTitle,
      body: content,
      kind,
    });
    setSaving(false);
    if (error) {
      toast.error(`Could not save: ${error.message}`);
      return;
    }
    setSaved(true);
    toast.success("Saved to Notes");
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Button
      type="button"
      size={size === "xs" ? "sm" : "sm"}
      variant="ghost"
      onClick={save}
      disabled={saving}
      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : saved ? (
        <Check className="h-3.5 w-3.5 text-neon" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      {saved ? "Saved" : "Save to Notes"}
    </Button>
  );
}
