import { useState, useEffect } from "react";
import { Target, TrendingUp, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DailySalesTargetProps {
  businessId: string | null;
  target?: number;
}

export default function DailySalesTarget({ businessId, target = 50000 }: DailySalesTargetProps) {
  const [todaySales, setTodaySales] = useState(0);
  const [txCount, setTxCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("sales")
        .select("total")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("created_at", today.toISOString());
      if (data) {
        setTodaySales(data.reduce((s, r) => s + Number(r.total), 0));
        setTxCount(data.length);
      }
    };
    load();
    // Listen for new sales
    const ch = supabase
      .channel("daily-target")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [businessId]);

  const pct = Math.min(100, (todaySales / target) * 100);
  const isHot = pct >= 80;
  const isDone = pct >= 100;

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className={cn(
        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
        isDone ? "bg-[hsl(145,63%,42%)]/10" : isHot ? "bg-[hsl(38,92%,50%)]/10" : "bg-muted"
      )}>
        {isDone ? (
          <Flame className="h-4 w-4 text-[hsl(145,63%,42%)]" />
        ) : (
          <Target className={cn("h-4 w-4", isHot ? "text-[hsl(38,92%,50%)]" : "text-muted-foreground")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Today: {txCount} sales
          </span>
          <span className="text-[11px] font-bold tabular-nums">
            KSh {todaySales.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
            <span className="text-muted-foreground font-normal">
              {" "}/ {target.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
            </span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              isDone
                ? "bg-gradient-to-r from-[hsl(145,63%,42%)] to-[hsl(145,63%,52%)]"
                : isHot
                ? "bg-gradient-to-r from-[hsl(38,92%,50%)] to-[hsl(24,80%,50%)]"
                : "bg-gradient-to-r from-primary/60 to-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
