import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getPendingSales,
  markSaleSynced,
  markSaleSyncError,
  clearSyncedSales,
  getPendingSaleCount,
  OfflineSale,
} from "@/lib/offline-store";
import { useOnlineStatus } from "./use-online-status";
import { toast } from "sonner";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingSaleCount();
    setPendingCount(count);
  }, []);

  const syncSale = async (sale: OfflineSale): Promise<boolean> => {
    try {
      // Insert sale
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          business_id: sale.business_id,
          branch_id: sale.branch_id,
          cashier_id: sale.cashier_id,
          receipt_number: sale.receipt_number,
          subtotal: sale.subtotal,
          tax_amount: sale.tax_amount,
          discount_amount: sale.discount_amount,
          total: sale.total,
          payment_method: sale.payment_method,
          status: "completed" as const,
          customer_id: sale.customer_id,
          customer_name: sale.customer_name,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert items
      await supabase.from("sale_items").insert(
        sale.items.map((item) => ({
          sale_id: saleData.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_amount: item.tax_amount,
          total: item.total,
          price_override: item.price_override,
          override_by: item.override_by,
          item_discount: item.item_discount,
          item_discount_type: item.item_discount_type,
        }))
      );

      // Insert payments
      await supabase.from("payments").insert(
        sale.payments.map((p) => ({
          sale_id: saleData.id,
          business_id: sale.business_id,
          method: (p.method === "mobile_money" ? "mpesa" : p.method) as any,
          amount: p.amount,
          reference: p.reference,
          payment_status: "confirmed",
        }))
      );

      await markSaleSynced(sale.id);
      return true;
    } catch (err: any) {
      await markSaleSyncError(sale.id, err.message || "Sync failed");
      return false;
    }
  };

  const syncAll = useCallback(async () => {
    if (syncRef.current || !navigator.onLine) return;
    syncRef.current = true;
    setSyncing(true);

    try {
      const pending = await getPendingSales();
      if (pending.length === 0) return;

      let synced = 0;
      let failed = 0;

      for (const sale of pending) {
        const ok = await syncSale(sale);
        if (ok) synced++;
        else failed++;
      }

      if (synced > 0) {
        toast.success(`Synced ${synced} offline sale${synced > 1 ? "s" : ""}`);
        await clearSyncedSales();
      }
      if (failed > 0) {
        toast.error(`${failed} sale${failed > 1 ? "s" : ""} failed to sync`);
      }
    } finally {
      syncRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncAll();
    }
  }, [isOnline, syncAll]);

  // Periodic sync check every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) syncAll();
      refreshCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [syncAll, refreshCount]);

  // Initial count
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { isOnline, pendingCount, syncing, syncAll, refreshCount };
}
