import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MpesaTransaction {
  id: string;
  transaction_id: string;
  phone: string | null;
  customer_name: string | null;
  amount: number;
  status: string;
  transaction_type: string;
  created_at: string;
}

interface UnmatchedPaymentsProps {
  businessId: string;
  saleTotal: number;
  onMatch: (transaction: MpesaTransaction) => void;
}

export default function UnmatchedPayments({ businessId, saleTotal, onMatch }: UnmatchedPaymentsProps) {
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUnmatched = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "unmatched")
      .order("created_at", { ascending: false })
      .limit(20);
    setTransactions((data as MpesaTransaction[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadUnmatched();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("mpesa-incoming")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mpesa_transactions",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const newTxn = payload.new as MpesaTransaction;
          if (newTxn.status === "unmatched") {
            setTransactions((prev) => [newTxn, ...prev]);
            toast.info(`New M-Pesa payment received: KSh ${newTxn.amount}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  if (transactions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          <Smartphone className="h-3 w-3" /> Incoming Payments ({transactions.length})
        </p>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={loadUnmatched} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="max-h-28 overflow-y-auto space-y-1">
        {transactions.map((txn) => {
          const amountMatch = Math.abs(txn.amount - saleTotal) < 1;
          const isOver = txn.amount > saleTotal + 1;
          const isUnder = txn.amount < saleTotal - 1;
          return (
            <div
              key={txn.id}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tabular-nums">KSh {txn.amount.toLocaleString()}</span>
                  {amountMatch && <Badge variant="default" className="h-4 text-[9px] px-1">Match</Badge>}
                  {isOver && <Badge variant="secondary" className="h-4 text-[9px] px-1">Over</Badge>}
                  {isUnder && <Badge variant="destructive" className="h-4 text-[9px] px-1">Under</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {txn.phone} {txn.customer_name ? `· ${txn.customer_name}` : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1 shrink-0"
                onClick={() => onMatch(txn)}
              >
                <Link2 className="h-3 w-3" /> Attach
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
