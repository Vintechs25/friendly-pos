import { useState, useEffect } from "react";
import { Star, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  [key: string]: any;
}

interface FavoritesBarProps {
  businessId: string | null;
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export default function FavoritesBar({ businessId, products, onAddToCart }: FavoritesBarProps) {
  const [topProductIds, setTopProductIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"top" | "recent">("top");

  useEffect(() => {
    if (!businessId) return;
    // Get top-selling products from recent sales
    const loadTopSellers = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from("sale_items")
        .select("product_id, quantity")
        .not("product_id", "is", null)
        .gte("created_at", since.toISOString())
        .limit(500);

      if (!data) return;
      const counts = new Map<string, number>();
      for (const item of data) {
        if (item.product_id) {
          counts.set(item.product_id, (counts.get(item.product_id) || 0) + Number(item.quantity));
        }
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      setTopProductIds(sorted.map(([id]) => id));
    };
    loadTopSellers();
  }, [businessId]);

  const topProducts = topProductIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  if (topProducts.length === 0) return null;

  return (
    <div className="px-2.5 py-2 border-b border-border/50 bg-background/50">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          Top Sellers
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {topProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onAddToCart(product)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50",
              "bg-gradient-to-r from-muted/60 to-muted/30",
              "hover:border-primary/40 hover:shadow-sm hover:shadow-primary/10",
              "active:scale-95 transition-all touch-manipulation select-none",
              "max-w-[160px]"
            )}
          >
            {product.image_url ? (
              <img src={product.image_url} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-primary/50">
                  {product.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold truncate leading-tight">{product.name}</p>
              <p className="text-[10px] font-bold text-primary">KSh {product.price.toLocaleString("en-KE")}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
