import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Clock, Receipt, RotateCcw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RecentSale {
  id: string;
  receipt_number: string;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  items_count: number;
}

interface RecentSalesDrawerProps {
  businessId: string | null;
  onRepeatSale?: (saleId: string) => void;
  children: React.ReactNode;
}

export default function RecentSalesDrawer({ businessId, onRepeatSale, children }: RecentSalesDrawerProps) {
  const [open, setOpen] = useState(false);
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !businessId) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, receipt_number, total, payment_method, status, created_at, customer_name")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        // Get item counts
        const ids = data.map((s) => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id")
          .in("sale_id", ids);

        const countMap = new Map<string, number>();
        items?.forEach((i) => countMap.set(i.sale_id, (countMap.get(i.sale_id) || 0) + 1));

        setSales(
          data.map((s) => ({
            ...s,
            total: Number(s.total),
            receipt_number: s.receipt_number || "",
            payment_method: s.payment_method || "cash",
            items_count: countMap.get(s.id) || 0,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [open, businessId]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const paymentBadge: Record<string, { bg: string; text: string }> = {
    cash: { bg: "bg-primary/10", text: "text-primary" },
    mpesa: { bg: "bg-[hsl(145,63%,42%)]/10", text: "text-[hsl(145,63%,42%)]" },
    mobile_money: { bg: "bg-[hsl(145,63%,42%)]/10", text: "text-[hsl(145,63%,42%)]" },
    card: { bg: "bg-accent/10", text: "text-accent-foreground" },
    split: { bg: "bg-secondary/10", text: "text-secondary-foreground" },
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-[360px] sm:w-[400px] p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Recent Sales
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto h-[calc(100vh-60px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Receipt className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No recent sales</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sales.map((sale) => {
                const badge = paymentBadge[sale.payment_method] || paymentBadge.cash;
                return (
                  <div
                    key={sale.id}
                    className="px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-xs font-mono font-semibold text-muted-foreground">
                          {sale.receipt_number}
                        </p>
                        {sale.customer_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">{sale.customer_name}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        KSh {sale.total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", badge.bg, badge.text)}>
                          {sale.payment_method.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {sale.items_count} {sale.items_count === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{fmtTime(sale.created_at)}</span>
                        {onRepeatSale && (
                          <button
                            onClick={() => {
                              onRepeatSale(sale.id);
                              setOpen(false);
                            }}
                            className="h-7 px-2 rounded-md flex items-center gap-1 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Repeat
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
