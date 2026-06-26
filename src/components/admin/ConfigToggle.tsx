import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { usePlatformConfig, type PlatformConfig } from "@/hooks/use-platform-config";

type Key = keyof PlatformConfig;

export function ConfigToggle({
  k,
  label,
  description,
}: {
  k: Key;
  label: string;
  description?: string;
}) {
  const { config } = usePlatformConfig();
  const qc = useQueryClient();
  const value = config[k];
  const update = async (v: boolean | number) => {
    const patch = { [k]: v } as unknown as Record<string, never>;
    const { error } = await supabase.from("platform_config").update(patch).eq("id", 1);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["platform-config"] });
    }
  };

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border bg-card/40 p-3">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Switch checked={value} onCheckedChange={update} />
      </div>
    );
  }

  // number
  return <NumberRow k={k} label={label} description={description} initial={value as number} onSave={update} />;
}

function NumberRow({
  label,
  description,
  initial,
  onSave,
}: {
  k: Key;
  label: string;
  description?: string;
  initial: number;
  onSave: (n: number) => void;
}) {
  const [val, setVal] = useState(String(initial));
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-card/40 p-3">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-32"
      />
      <Button size="sm" onClick={() => onSave(Number(val))}>
        Save
      </Button>
    </div>
  );
}
