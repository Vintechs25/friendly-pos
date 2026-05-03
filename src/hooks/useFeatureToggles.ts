import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  defaultsForIndustry,
  isFeatureAllowedForIndustry,
  type FeatureKey,
} from "@/lib/feature-catalog";

interface FeatureToggle {
  feature_name: string;
  is_enabled: boolean;
}

/**
 * Map a toggle key to the legacy nav permission names it controls.
 * Disabling the feature hides the matching nav items.
 */
const FEATURE_TO_PERMISSIONS: Partial<Record<FeatureKey, string[]>> = {
  pos: ["manage_pos"],
  inventory: ["manage_inventory"],
  purchase_orders: ["manage_purchase_orders"],
  stock_transfers: ["manage_stock"],
  advanced_reports: ["view_reports"],
  audit_logs: ["view_audit_logs"],
  customer_loyalty: ["manage_customers"],
};

/** Map a toggle key to specific dashboard route paths it controls. */
const FEATURE_TO_ROUTES: Partial<Record<FeatureKey, string[]>> = {
  pos: ["/dashboard/pos", "/dashboard/shifts"],
  inventory: ["/dashboard/inventory"],
  purchase_orders: ["/dashboard/purchase-orders"],
  stock_transfers: ["/dashboard/stock-transfers", "/dashboard/stock-adjustments"],
  advanced_reports: ["/dashboard/reports"],
  audit_logs: ["/dashboard/audit-logs"],
  customer_loyalty: ["/dashboard/customers"],
  table_management: ["/dashboard/tables"],
  kitchen_display: ["/dashboard/kitchen"],
  hardware_support: ["/dashboard/hardware"],
  email_marketing: ["/dashboard/email"],
  etims_compliance: ["/dashboard/etims"],
};

interface UseFeatureTogglesArgs {
  /** Optional industry override – falls back to the user's business industry. */
  industry?: string;
}

export function useFeatureToggles(_args: UseFeatureTogglesArgs = {}) {
  const { profile, roles } = useAuth();

  // Pull the toggles for this business
  const { data: toggles = [], isLoading: togglesLoading } = useQuery<FeatureToggle[]>({
    queryKey: ["feature-toggles", profile?.business_id],
    enabled: !!profile?.business_id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_toggles")
        .select("feature_name, is_enabled")
        .eq("business_id", profile!.business_id!);
      if (error) {
        console.error("Feature toggles error:", error);
        return [];
      }
      return (data ?? []) as FeatureToggle[];
    },
  });

  // Pull the business industry so we know the default set when a row is missing
  const { data: businessRow, isLoading: businessLoading } = useQuery<{ industry: string } | null>({
    queryKey: ["business-industry", profile?.business_id],
    enabled: !!profile?.business_id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("industry")
        .eq("id", profile!.business_id!)
        .maybeSingle();
      if (error) {
        console.error("Business industry lookup error:", error);
        return null;
      }
      return data;
    },
  });

  const isLoading = togglesLoading || businessLoading;
  const isSuperAdmin =
    roles.includes("super_admin" as any) ||
    roles.includes("platform_admin" as any);

  const explicit = new Map<string, boolean>();
  for (const t of toggles) explicit.set(t.feature_name, t.is_enabled);

  const industryDefaults = defaultsForIndustry(businessRow?.industry);

  /**
   * Resolution order:
   *   1. Super admins / platform admins → always enabled.
   *   2. Explicit row in feature_toggles → use that value.
   *   3. No row → fall back to the industry default for this business.
   */
  const isFeatureEnabled = (featureKey: string): boolean => {
    if (isSuperAdmin) return true;
    if (explicit.has(featureKey)) return explicit.get(featureKey)!;
    return industryDefaults.has(featureKey as FeatureKey);
  };

  const isPermissionAllowedByFeature = (permission: string): boolean => {
    if (isSuperAdmin) return true;
    for (const [feature, perms] of Object.entries(FEATURE_TO_PERMISSIONS)) {
      if (perms?.includes(permission) && !isFeatureEnabled(feature)) return false;
    }
    return true;
  };

  const isRouteAllowedByFeature = (path: string): boolean => {
    if (isSuperAdmin) return true;
    for (const [feature, routes] of Object.entries(FEATURE_TO_ROUTES)) {
      if (routes?.includes(path) && !isFeatureEnabled(feature)) return false;
    }
    return true;
  };

  return {
    isFeatureEnabled,
    isPermissionAllowedByFeature,
    isRouteAllowedByFeature,
    isLoading,
    toggles,
    industry: businessRow?.industry ?? null,
  };
}
