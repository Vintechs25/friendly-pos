import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftSettings } from "@/hooks/useShiftSettings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";

interface ShiftGateProps {
  children: React.ReactNode;
}

export default function ShiftGate({ children }: ShiftGateProps) {
  const { user, profile, signOut } = useAuth();
  const { settings, isLoading: settingsLoading } = useShiftSettings();
  const [openShift, setOpenShift] = useState<string | null>(null); // shift id
  const [checking, setChecking] = useState(true);
  const [openingCash, setOpeningCash] = useState("0");
  const [saving, setSaving] = useState(false);

  const checkOpenShift = useCallback(async () => {
    if (!user || !profile?.business_id) return;
    setChecking(true);
    const { data } = await supabase
      .from("cashier_shifts")
      .select("id")
      .eq("business_id", profile.business_id)
      .eq("cashier_id", user.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();
    setOpenShift(data?.id ?? null);
    setChecking(false);
  }, [user, profile?.business_id]);

  useEffect(() => {
    checkOpenShift();
  }, [checkOpenShift]);

  const handleOpenShift = async () => {
    if (!user || !profile?.business_id) return;
    setSaving(true);
    try {
      const { data: branches } = await supabase
        .from("branches")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("is_active", true)
        .limit(1);
      const branchId = branches?.[0]?.id;
      if (!branchId) {
        toast.error("No active branch found");
        return;
      }
      const { data, error } = await supabase
        .from("cashier_shifts")
        .insert({
          business_id: profile.business_id,
          branch_id: branchId,
          cashier_id: user.id,
          opening_cash: settings.requireCashCounting ? (parseFloat(openingCash) || 0) : 0,
          status: "open",
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setOpenShift(data.id);
      toast.success("Shift opened — you're ready to sell!");
    } catch {
      toast.error("Failed to open shift");
    } finally {
      setSaving(false);
    }
  };

  // If settings loading or checking shift, show spinner
  if (settingsLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If shifts not required, pass through
  if (!settings.requireShift) {
    return <>{children}</>;
  }

  // If shift is already open, pass through
  if (openShift) {
    return <>{children}</>;
  }

  // Show shift opening screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Open Your Shift</CardTitle>
          <CardDescription>
            You need to open a shift before you can start selling.
            {settings.requireCashCounting && " Count the cash in your drawer and enter the amount below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.requireCashCounting && (
            <div className="space-y-2">
              <Label>Opening Cash Amount (KSh)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="text-lg h-12"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Count all cash in your register drawer
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Button onClick={handleOpenShift} disabled={saving} size="lg" className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {saving ? "Opening..." : "Open Shift & Start Selling"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Logout Instead
            </Button>
          </div>

          <p className="text-[11px] text-center text-muted-foreground">
            Your shift will be tracked until you close it or log out.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
