import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Percent, DollarSign, Edit3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CartItem, getEffectivePrice, getItemTotal } from "./types";
import { cn } from "@/lib/utils";

interface CartItemRowProps {
  item: CartItem;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onUpdateDiscount: (id: string, discount: number, type: "fixed" | "percent") => void;
  onPriceOverride: (id: string, price: number) => void;
  canOverridePrice: boolean;
}

export default function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
  onUpdateDiscount,
  onPriceOverride,
  canOverridePrice,
}: CartItemRowProps) {
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.qty));
  const effectivePrice = getEffectivePrice(item);
  const lineTotal = getItemTotal(item);

  const commitQty = () => {
    const parsed = parseFloat(qtyInput);
    if (!isNaN(parsed) && parsed >= 0.001) {
      onUpdateQty(item.id, parsed);
    } else {
      setQtyInput(String(item.qty));
    }
    setEditingQty(false);
  };

  return (
    <div className="group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors touch-manipulation border-b border-border/50 last:border-0">
      {/* Qty controls - compact */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => onUpdateQty(item.id, Math.max(0.001, item.qty - 1))}
          className="h-7 w-7 rounded-md bg-muted/80 flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
        >
          <Minus className="h-3 w-3" />
        </button>
        {editingQty ? (
          <Input
            className="w-10 h-7 text-center text-xs font-bold p-0 rounded-md"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => e.key === "Enter" && commitQty()}
            autoFocus
          />
        ) : (
          <button
            className="w-9 h-7 text-center text-xs font-bold bg-muted/80 rounded-md hover:bg-muted transition-colors"
            onClick={() => { setQtyInput(String(item.qty)); setEditingQty(true); }}
          >
            {item.qty % 1 !== 0 ? item.qty.toFixed(2) : item.qty}
          </button>
        )}
        <button
          onClick={() => onUpdateQty(item.id, item.qty + 1)}
          className="h-7 w-7 rounded-md bg-muted/80 flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold truncate leading-tight">{item.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            @ {effectivePrice.toFixed(0)}
          </span>
          {item.priceOverride !== null && (
            <span className="text-[9px] text-warning font-medium bg-warning/10 px-1 rounded">edited</span>
          )}
          {item.itemDiscount > 0 && (
            <span className="text-[9px] text-success font-medium bg-success/10 px-1 rounded">
              -{item.itemDiscountType === "percent" ? `${item.itemDiscount}%` : item.itemDiscount.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Line total */}
      <span className="text-[13px] font-bold w-[68px] text-right tabular-nums shrink-0">
        {lineTotal.toFixed(2)}
      </span>

      {/* Actions - show on hover */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ItemDiscountPopover item={item} onApply={onUpdateDiscount} />
        {canOverridePrice && (
          <PriceOverridePopover item={item} onApply={onPriceOverride} />
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ItemDiscountPopover({
  item,
  onApply,
}: {
  item: CartItem;
  onApply: (id: string, discount: number, type: "fixed" | "percent") => void;
}) {
  const [discount, setDiscount] = useState(String(item.itemDiscount || ""));
  const [type, setType] = useState<"fixed" | "percent">(item.itemDiscountType);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
          item.itemDiscount > 0
            ? "bg-success/10 text-success"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}>
          <Percent className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2" side="left">
        <Label className="text-xs font-semibold">Item Discount</Label>
        <div className="flex gap-1">
          <Button variant={type === "fixed" ? "default" : "outline"} size="sm" className="h-8 text-xs flex-1" onClick={() => setType("fixed")}>
            <DollarSign className="h-3 w-3 mr-1" /> Fixed
          </Button>
          <Button variant={type === "percent" ? "default" : "outline"} size="sm" className="h-8 text-xs flex-1" onClick={() => setType("percent")}>
            <Percent className="h-3 w-3 mr-1" /> %
          </Button>
        </div>
        <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="h-9" min="0" />
        <div className="flex gap-1">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => { onApply(item.id, parseFloat(discount) || 0, type); setOpen(false); }}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { onApply(item.id, 0, "fixed"); setDiscount(""); setOpen(false); }}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PriceOverridePopover({
  item,
  onApply,
}: {
  item: CartItem;
  onApply: (id: string, price: number) => void;
}) {
  const [price, setPrice] = useState(String(item.priceOverride ?? item.price));
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
          item.priceOverride !== null
            ? "bg-warning/10 text-warning"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}>
          <Edit3 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3 space-y-2" side="left">
        <Label className="text-xs font-semibold">Override Price</Label>
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9" min="0" step="0.01" />
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => { onApply(item.id, parseFloat(price) || item.price); setOpen(false); }}>
          Set Price
        </Button>
      </PopoverContent>
    </Popover>
  );
}