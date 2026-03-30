import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Users, Trash2, Edit2, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestaurantTable {
  id: string;
  table_number: string;
  name: string | null;
  capacity: number;
  status: string;
  floor: string;
  is_active: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  occupied: "bg-red-500/15 text-red-700 border-red-500/30",
  reserved: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  cleaning: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const STATUS_BG: Record<string, string> = {
  available: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
  occupied: "border-red-500/40 bg-red-50 dark:bg-red-950/20",
  reserved: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
  cleaning: "border-blue-500/40 bg-blue-50 dark:bg-blue-950/20",
};

export default function TablesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({ table_number: "", name: "", capacity: 4, floor: "Main" });
  const [floorFilter, setFloorFilter] = useState("all");

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["restaurant-tables", profile?.business_id],
    enabled: !!profile?.business_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("business_id", profile!.business_id!)
        .eq("is_active", true)
        .order("table_number");
      if (error) throw error;
      return (data ?? []) as RestaurantTable[];
    },
  });

  const floors = [...new Set(tables.map((t) => t.floor))];
  const filtered = floorFilter === "all" ? tables : tables.filter((t) => t.floor === floorFilter);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("restaurant_tables")
          .update({ table_number: form.table_number, name: form.name || null, capacity: form.capacity, floor: form.floor })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_tables")
          .insert({
            business_id: profile!.business_id!,
            branch_id: null,
            table_number: form.table_number,
            name: form.name || null,
            capacity: form.capacity,
            floor: form.floor,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      toast.success(editing ? "Table updated" : "Table created");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restaurant-tables"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      toast.success("Table removed");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ table_number: String(tables.length + 1), name: "", capacity: 4, floor: "Main" });
    setDialogOpen(true);
  };

  const openEdit = (t: RestaurantTable) => {
    setEditing(t);
    setForm({ table_number: t.table_number, name: t.name || "", capacity: t.capacity, floor: t.floor });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-primary" /> Table Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {tables.length} tables · {tables.filter((t) => t.status === "occupied").length} occupied
            </p>
          </div>
          <div className="flex items-center gap-2">
            {floors.length > 1 && (
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-32 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Table
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No tables configured yet</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
              Add your first table
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((table) => (
              <div
                key={table.id}
                className={cn(
                  "relative rounded-xl border-2 p-4 transition-all hover:shadow-md cursor-pointer group",
                  STATUS_BG[table.status] || "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg">T{table.table_number}</span>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[table.status])}>
                    {table.status}
                  </Badge>
                </div>
                {table.name && <p className="text-xs text-muted-foreground truncate mb-1">{table.name}</p>}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {table.capacity}
                </div>

                {/* Quick status buttons */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {["available", "occupied", "reserved", "cleaning"].filter((s) => s !== table.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => statusMutation.mutate({ id: table.id, status: s })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted-foreground/10 capitalize"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Hover actions */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button onClick={() => openEdit(table)} className="p-1 rounded bg-background/80 hover:bg-background">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(table.id)} className="p-1 rounded bg-background/80 hover:bg-background text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Table" : "Add Table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Table Number</label>
              <Input value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Name (optional)</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Window Seat" />
            </div>
            <div>
              <label className="text-xs font-medium">Capacity</label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs font-medium">Floor</label>
              <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="Main" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.table_number || saveMutation.isPending}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
