import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ShiftSettings {
  requireShift: boolean;
  requireCashCounting: boolean;
}

export function useShiftSettings() {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["shift-settings", profile?.business_id],
    enabled: !!profile?.business_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_settings")
        .select("require_shift, require_cash_counting")
        .eq("business_id", profile!.business_id!)
        .single();
      if (error || !data) return { requireShift: false, requireCashCounting: true };
      return {
        requireShift: (data as any).require_shift ?? false,
        requireCashCounting: (data as any).require_cash_counting ?? true,
      };
    },
  });

  return {
    settings: data ?? { requireShift: false, requireCashCounting: true },
    isLoading,
  };
}
