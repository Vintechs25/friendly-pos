import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChefHat, Clock, CheckCircle2, Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface KitchenOrder {
  id: string;
  order_number: string;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  table_id: string | null;
  kitchen_order_items: KitchenOrderItem[];
}

interface KitchenOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  status: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-primary text-primary-foreground",
};

const STATUS_COLS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
};

export default function KitchenDisplayPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["kitchen-orders", profile?.business_id],
    enabled: !!profile?.business_id,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchen_orders")
        .select("*, kitchen_order_items(*)")
        .eq("business_id", profile!.business_id!)
        .in("status", ["pending", "preparing", "ready"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KitchenOrder[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!profile?.business_id) return;
    const channel = supabase
      .channel("kitchen-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_orders" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.business_id, qc]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "preparing") updates.accepted_at = new Date().toISOString();
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("kitchen_orders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen-orders"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const updateItemStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("kitchen_order_items").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  const columns = ["pending", "preparing", "ready"] as const;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <ChefHat className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">Kitchen Display</h1>
            <p className="text-xs text-muted-foreground">{orders.length} active orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        </div>
      </header>

      {/* Columns */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col);
          return (
            <div key={col} className="flex flex-col border-r border-border last:border-r-0 overflow-hidden">
              <div className={cn(
                "px-4 py-2 border-b border-border flex items-center justify-between",
                col === "pending" && "bg-amber-50 dark:bg-amber-950/20",
                col === "preparing" && "bg-blue-50 dark:bg-blue-950/20",
                col === "ready" && "bg-emerald-50 dark:bg-emerald-950/20",
              )}>
                <span className="font-semibold text-sm">{STATUS_COLS[col]}</span>
                <Badge variant="secondary" className="text-xs">{colOrders.length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colOrders.map((order) => (
                  <div
                    key={order.id}
                    className={cn(
                      "rounded-xl border-2 bg-card p-3 space-y-2 transition-all",
                      order.priority === "urgent" && "border-red-500 animate-pulse",
                      order.priority === "high" && "border-orange-400",
                      order.priority === "normal" && "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px]", PRIORITY_COLORS[order.priority])}>
                          #{order.order_number}
                        </Badge>
                        {order.priority === "urgent" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: false })}
                      </span>
                    </div>

                    {order.notes && (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
                        ⚠️ {order.notes}
                      </p>
                    )}

                    {/* Items */}
                    <div className="space-y-1">
                      {order.kitchen_order_items?.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between text-sm px-2 py-1 rounded",
                            item.status === "done" && "line-through opacity-50 bg-muted/50",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateItemStatus.mutate({
                                  id: item.id,
                                  status: item.status === "done" ? "pending" : "done",
                                })
                              }
                              className="shrink-0"
                            >
                              <CheckCircle2
                                className={cn(
                                  "h-4 w-4",
                                  item.status === "done" ? "text-emerald-500" : "text-muted-foreground/30"
                                )}
                              />
                            </button>
                            <span className="font-medium">
                              {item.quantity}× {item.product_name}
                            </span>
                          </div>
                          {item.notes && (
                            <span className="text-[10px] text-muted-foreground italic truncate max-w-24">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 pt-1">
                      {col === "pending" && (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => updateStatus.mutate({ id: order.id, status: "preparing" })}
                        >
                          Start Preparing
                        </Button>
                      )}
                      {col === "preparing" && (
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {col === "ready" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={() => updateStatus.mutate({ id: order.id, status: "completed" })}
                        >
                          Complete & Clear
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {colOrders.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-xs opacity-50">
                    No {col} orders
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
