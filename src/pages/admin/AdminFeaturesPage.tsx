import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, RotateCcw, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import {
  FEATURE_CATALOG,
  ALL_FEATURE_KEYS,
  defaultsForIndustry,
  isFeatureAllowedForIndustry,
  type FeatureKey,
} from "@/lib/feature-catalog";
import { getFeatureTogglesForIndustry } from "@/lib/feature-provisioning";

interface Business { id: string; name: string; industry: string }
interface Toggle { id: string; feature_name: string; is_enabled: boolean; business_id: string }

const CATEGORY_ORDER: ReadonlyArray<typeof FEATURE_CATALOG[number]["category"]> = [
  "Core", "Sales", "Inventory", "Payments", "Compliance", "Operations",
];

export default function AdminFeaturesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [toggles, setToggles] = useState<Toggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, industry")
        .order("name");
      setBusinesses(data ?? []);
      if (data?.length) setSelectedBiz(data[0].id);
      setLoading(false);
    })();
  }, []);

  const refreshToggles = async (bizId: string) => {
    const { data } = await supabase
      .from("feature_toggles")
      .select("*")
      .eq("business_id", bizId);
    setToggles(data ?? []);
  };

  useEffect(() => {
    if (!selectedBiz) return;
    refreshToggles(selectedBiz);
  }, [selectedBiz]);

  const currentBiz = businesses.find((b) => b.id === selectedBiz);
  const industryDefaults = useMemo(
    () => defaultsForIndustry(currentBiz?.industry),
    [currentBiz?.industry],
  );

  /** Resolves the displayed value: explicit row wins, else industry default. */
  const isOn = (key: FeatureKey) => {
    const row = toggles.find((t) => t.feature_name === key);
    if (row) return row.is_enabled;
    return industryDefaults.has(key);
  };

  const handleToggle = async (key: FeatureKey, enabled: boolean) => {
    setBusy(key);
    try {
      const existing = toggles.find((t) => t.feature_name === key);
      if (existing) {
        const { error } = await supabase
          .from("feature_toggles")
          .update({ is_enabled: enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("feature_toggles")
          .insert({ business_id: selectedBiz, feature_name: key, is_enabled: enabled });
        if (error) throw error;
      }
      await refreshToggles(selectedBiz);
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setBusy(null);
    }
  };

  const resetToIndustryDefaults = async () => {
    if (!currentBiz) return;
    setResetting(true);
    try {
      // Delete then re-insert the full catalog with industry defaults
      await supabase.from("feature_toggles").delete().eq("business_id", selectedBiz);
      const rows = getFeatureTogglesForIndustry(selectedBiz, currentBiz.industry);
      if (rows.length) {
        const { error } = await supabase.from("feature_toggles").insert(rows);
        if (error) throw error;
      }
      await refreshToggles(selectedBiz);
      toast.success("Reset to industry defaults");
    } catch (err: any) {
      toast.error(err.message ?? "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: FEATURE_CATALOG.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Feature Toggles</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Enable or disable modules per business. Defaults follow each industry.
            </p>
          </div>
          {currentBiz && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetToIndustryDefaults}
              disabled={resetting}
              className="gap-2"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
              Reset to {currentBiz.industry} defaults
            </Button>
          )}
        </div>

        {businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">No businesses to manage</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Business:</span>
              <Select value={selectedBiz} onValueChange={setSelectedBiz}>
                <SelectTrigger className="w-[320px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{" "}
                      <span className="text-muted-foreground ml-1 capitalize">
                        ({b.industry})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.category}>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {group.category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map((feat) => {
                      const checked = isOn(feat.key);
                      const isDefault = industryDefaults.has(feat.key);
                      const allowed = isFeatureAllowedForIndustry(feat.key, currentBiz?.industry);
                      return (
                        <div
                          key={feat.key}
                          className={`flex items-center justify-between rounded-xl border border-border bg-card p-4 ${!allowed ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                              <ToggleLeft className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                {feat.label}
                                {isDefault && allowed && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                                    default
                                  </span>
                                )}
                                {!allowed && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70">
                                    not for {currentBiz?.industry}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {feat.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={allowed && checked}
                            onCheckedChange={(v) => handleToggle(feat.key, v)}
                            disabled={busy === feat.key || !allowed}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
