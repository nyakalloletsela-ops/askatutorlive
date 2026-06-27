import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformConfig = {
  is_subscriptions_enabled: boolean;
  ai_enabled: boolean;
  ai_token_limit_per_user: number;
  classrooms_enabled: boolean;
  whiteboard_graphing_enabled: boolean;
  whiteboard_latex_enabled: boolean;
  whiteboard_ocr_enabled: boolean;
  whiteboard_export_enabled: boolean;
};

const DEFAULTS: PlatformConfig = {
  is_subscriptions_enabled: false,
  ai_enabled: true,
  ai_token_limit_per_user: 100000,
  classrooms_enabled: true,
  whiteboard_graphing_enabled: true,
  whiteboard_latex_enabled: true,
  whiteboard_ocr_enabled: true,
  whiteboard_export_enabled: true,
};

export function usePlatformConfig() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-config"],
    staleTime: 60_000,
    queryFn: async (): Promise<PlatformConfig> => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return DEFAULTS;
      return data as PlatformConfig;
    },
  });
  return { config: data ?? DEFAULTS, isLoading };
}
