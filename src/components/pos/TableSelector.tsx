import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableSelectorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (tableId: string, tableNumber: string) => void;
}

const STATUS_BG: Record<string, string> = {
  available: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 hover:border-emerald-500",
  occupied: "border-red-500/40 bg-red-50 dark:bg-red-950/20 opacity-60",
  reserved: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 opacity-60",
  cleaning: "border-blue-500/40 bg-blue-50 dark:bg-blue-950/20 opacity-60",
};

export default function TableSelector({ open, onOpenChange, onSelect }: TableSelectorProps) {
  const { profile } = useAuth();

  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant-tables", profile?.business_id],
    enabled: !!profile?.business_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("business_id", profile!.business_id!)
        .eq("is_active", true)
        .order("table_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" /> Select Table
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto py-2">
          {tables.map((table: any) => (
            <button
              key={table.id}
              disabled={table.status !== "available"}
              onClick={() => {
                onSelect(table.id, table.table_number);
                onOpenChange(false);
              }}
              className={cn(
                "rounded-xl border-2 p-3 text-center transition-all",
                STATUS_BG[table.status] || "border-border"
              )}
            >
              <span className="font-bold text-lg block">T{table.table_number}</span>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                <Users className="h-3 w-3" /> {table.capacity}
              </div>
              <Badge variant="outline" className="text-[9px] mt-1 capitalize">{table.status}</Badge>
            </button>
          ))}
          {tables.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
              No tables configured. Add tables in Table Management.
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Counter Order (No Table)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
