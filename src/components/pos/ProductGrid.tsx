import { useState } from "react";
import { Package, Plus, ShoppingCart, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  category_id: string | null;
  stock_quantity: number;
  [key: string]: any;
}

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: any, qty?: number) => void;
}

// Professional color palette using semantic hues
const TILE_COLORS = [
  "from-primary/70 to-primary/90",
  "from-accent/70 to-accent/90",
  "from-[hsl(38,92%,50%)]/70 to-[hsl(38,92%,40%)]/90",
  "from-[hsl(340,65%,47%)]/70 to-[hsl(340,65%,37%)]/90",
  "from-[hsl(262,60%,50%)]/70 to-[hsl(262,60%,40%)]/90",
  "from-[hsl(190,80%,42%)]/70 to-[hsl(190,80%,32%)]/90",
  "from-[hsl(24,80%,50%)]/70 to-[hsl(24,80%,40%)]/90",
  "from-[hsl(170,70%,40%)]/70 to-[hsl(170,70%,30%)]/90",
];

function getTileColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

// Quick qty multiplier options
const QTY_SHORTCUTS = [2, 3, 5, 10];

export default function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [qtyPopover, setQtyPopover] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Package className="h-16 w-16 mb-4 opacity-10" />
        <p className="text-base font-bold">No products found</p>
        <p className="text-sm mt-1 text-muted-foreground/60">Try a different category or search term</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
      {products.map((product) => {
        const outOfStock = product.stock_quantity <= 0;
        const lowStock = product.stock_quantity > 0 && product.stock_quantity <= 10;
        const showQtyPicker = qtyPopover === product.id;

        return (
          <div key={product.id} className="relative">
            <button
              onClick={() => onAddToCart(product)}
              onContextMenu={(e) => {
                e.preventDefault();
                setQtyPopover(showQtyPicker ? null : product.id);
              }}
              disabled={outOfStock}
              className={cn(
                "group relative flex flex-col rounded-2xl overflow-hidden transition-all touch-manipulation select-none w-full",
                "h-[140px] min-h-[140px]",
                outOfStock
                  ? "opacity-35 cursor-not-allowed grayscale"
                  : "hover:scale-[1.03] active:scale-[0.96] hover:shadow-xl hover:shadow-primary/10 active:shadow-none cursor-pointer ring-1 ring-border/30 hover:ring-primary/40"
              )}
            >
              {/* Background */}
              {product.image_url ? (
                <div className="absolute inset-0">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
                </div>
              ) : (
                <div className={cn("absolute inset-0 bg-gradient-to-br", getTileColor(product.name))}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[48px] font-black text-white/[0.08] leading-none select-none pointer-events-none">
                    {product.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}

              {/* Stock badges */}
              {outOfStock ? (
                <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  OUT
                </div>
              ) : lowStock ? (
                <div className="absolute top-2 left-2 bg-[hsl(38,92%,50%)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  {product.stock_quantity} left
                </div>
              ) : null}

              {/* Quick add hover + qty shortcut icon */}
              {!outOfStock && (
                <>
                  <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:scale-110">
                    <Plus className="h-4 w-4 text-white drop-shadow" />
                  </div>
                  {/* Qty shortcut indicator */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setQtyPopover(showQtyPicker ? null : product.id); }}
                    className="absolute bottom-[52px] right-2 h-6 w-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white/80 hover:bg-white/30"
                  >
                    <Hash className="h-3 w-3" />
                  </button>
                </>
              )}

              {/* Product info */}
              <div className="relative mt-auto">
                <div className="px-3 py-2.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[13px] font-bold leading-tight line-clamp-2 text-white drop-shadow-md">
                    {product.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[15px] font-black text-white drop-shadow-md tracking-tight">
                      KSh {product.price.toLocaleString("en-KE", { minimumFractionDigits: 0 })}
                    </p>
                    {!outOfStock && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ShoppingCart className="h-3 w-3 text-white/70" />
                        <span className="text-[10px] text-white/70 font-medium">Add</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* Quantity shortcuts popover */}
            {showQtyPicker && !outOfStock && (
              <div className="absolute top-0 left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-xl p-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-bold text-muted-foreground px-1 truncate">{product.name}</p>
                <div className="grid grid-cols-4 gap-1">
                  {QTY_SHORTCUTS.map((qty) => (
                    <button
                      key={qty}
                      onClick={() => { onAddToCart(product, qty); setQtyPopover(null); }}
                      className="h-9 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 active:scale-95 transition-all"
                    >
                      ×{qty}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setQtyPopover(null)}
                  className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
