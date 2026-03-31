import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wrench } from "lucide-react";
import type { CartItem } from "./types";

interface CustomItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: CartItem) => void;
}

export default function CustomItemDialog({ open, onOpenChange, onAdd }: CustomItemDialogProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");

  const handleOpen = (v: boolean) => {
    if (v) { setName(""); setPrice(""); setQty("1"); setNotes(""); }
    onOpenChange(v);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const p = parseFloat(price) || 0;
    if (p <= 0) return;

    const item: CartItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: notes ? `${name.trim()} — ${notes.trim()}` : name.trim(),
      price: p,
      cost: 0,
      tax_rate: 0,
      qty: parseFloat(qty) || 1,
      track_inventory: false,
      itemDiscount: 0,
      itemDiscountType: "fixed",
      priceOverride: null,
      overrideBy: null,
    };
    onAdd(item);
    handleOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Custom Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Item Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Haircut, Repair service" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price (KSh) *</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" step="1" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Service details, customer instructions..." rows={2} className="text-xs resize-none" />
          </div>
          <p className="text-[10px] text-muted-foreground">Custom items don't affect inventory.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !price || parseFloat(price) <= 0}>Add to Cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
