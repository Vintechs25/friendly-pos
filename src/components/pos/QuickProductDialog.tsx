import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { autoFillProductFields } from "@/lib/product-auto-gen";
import { toast } from "sonner";

interface QuickProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  branchId: string | null;
  /** Pre-fill the name or barcode from a failed scan/search */
  initialValue?: string;
  /** Called with the newly created product */
  onCreated: (product: any) => void;
}

export default function QuickProductDialog({
  open, onOpenChange, businessId, branchId, initialValue, onCreated,
}: QuickProductDialogProps) {
  const [name, setName] = useState(initialValue ?? "");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => {
    if (v) {
      setName(initialValue ?? "");
      setPrice("");
    }
    onOpenChange(v);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    if (!price || parseFloat(price) <= 0) { toast.error("Price must be greater than 0"); return; }

    setSaving(true);
    try {
      const filled = await autoFillProductFields(
        { name: name.trim(), price: parseFloat(price) },
        businessId
      );

      const { data: product, error } = await supabase
        .from("products")
        .insert(filled)
        .select()
        .single();

      if (error) { toast.error(error.message); return; }

      // Create inventory record
      if (branchId) {
        await supabase.from("inventory").insert({
          product_id: product.id,
          branch_id: branchId,
          quantity: 0,
          reorder_level: 10,
        });
      }

      toast.success(`${product.name} created (SKU: ${product.sku})`);
      onCreated(product);
      handleOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Quick Product
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hammer"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Price (KSh) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            SKU, barcode, category, and unit will be generated automatically.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Create & Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
