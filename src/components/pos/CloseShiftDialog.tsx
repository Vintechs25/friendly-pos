import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftSettings } from "@/hooks/useShiftSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Square, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CloseShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShiftClosed: () => void;
}

export default function CloseShiftDialog({ open, onOpenChange, onShiftClosed }: CloseShiftDialogProps) {
  const { user, profile } = useAuth();
  const { settings } = useShiftSettings();
  const [closingCash, setClosingCash] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [openShift, setOpenShift] = useState<any>(null);

  useEffect(() => {
    if (!open || !user || !profile?.business_id) return;
    supabase
      .from("cashier_shifts")
      .select("*")
      .eq("business_id", profile.business_id)
      .eq("cashier_id", user.id)
      .eq("status", "open")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setOpenShift(data));
  }, [open, user, profile?.business_id]);

  const handleClose = async () => {
    if (!openShift || !user || !profile?.business_id) return;
    setSaving(true);
    try {
      const closing = parseFloat(closingCash) || 0;

      // Calculate expected cash
      const { data: cashSales } = await supabase
        .from("sales")
        .select("total")
        .eq("business_id", profile.business_id)
        .eq("cashier_id", user.id)
        .eq("status", "completed")
        .eq("payment_method", "cash")
        .gte("created_at", openShift.started_at);

      const cashTotal = (cashSales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);

      const { data: drops } = await supabase
        .from("safe_drops")
        .select("amount")
        .eq("shift_id", openShift.id);

      const totalDrops = (drops ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);

      const { data: allSales } = await supabase
        .from("sales")
        .select("total")
        .eq("business_id", profile.business_id)
        .eq("cashier_id", user.id)
        .eq("status", "completed")
        .gte("created_at", openShift.started_at);

      const totalSales = (allSales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
      const totalTx = allSales?.length ?? 0;
      const expected = openShift.opening_cash + cashTotal - totalDrops;
      const variance = settings.requireCashCounting ? closing - expected : null;

      const { error } = await supabase
        .from("cashier_shifts")
        .update({
          ended_at: new Date().toISOString(),
          closing_cash: settings.requireCashCounting ? closing : null,
          expected_cash: settings.requireCashCounting ? expected : null,
          cash_variance: variance,
          total_sales: totalSales,
          total_transactions: totalTx,
          notes: notes || null,
          status: "closed",
        })
        .eq("id", openShift.id);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Shift closed!");
      onOpenChange(false);
      onShiftClosed();
    } catch {
      toast.error("Failed to close shift");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Your Shift</DialogTitle>
          <DialogDescription>
            {settings.requireCashCounting
              ? "Count the cash in your drawer before closing."
              : "Confirm you want to close your current shift."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {settings.requireCashCounting && (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs">Count all cash in your register including the opening amount</p>
              </div>
              <div className="space-y-2">
                <Label>Closing Cash Amount (KSh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  autoFocus
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about the shift..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleClose} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
            Close Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
