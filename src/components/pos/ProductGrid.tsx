import { Package, Plus } from "lucide-react";
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
  onAddToCart: (product: any) => void;
}

// Generate a consistent color from product name
function getProductColor(name: string): string {
  const colors = [
    "from-blue-500/80 to-blue-600/80",
    "from-emerald-500/80 to-emerald-600/80",
    "from-amber-500/80 to-amber-600/80",
    "from-rose-500/80 to-rose-600/80",
    "from-violet-500/80 to-violet-600/80",
    "from-cyan-500/80 to-cyan-600/80",
    "from-orange-500/80 to-orange-600/80",
    "from-teal-500/80 to-teal-600/80",
    "from-indigo-500/80 to-indigo-600/80",
    "from-pink-500/80 to-pink-600/80",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-15" />
        <p className="text-sm font-semibold">No products found</p>
        <p className="text-xs mt-1 text-muted-foreground/70">Try a different category or search</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
      {products.map((product) => {
        const outOfStock = product.stock_quantity <= 0;
        return (
          <button
            key={product.id}
            onClick={() => onAddToCart(product)}
            disabled={outOfStock}
            className={cn(
              "group relative flex flex-col rounded-xl overflow-hidden transition-all touch-manipulation select-none",
              "h-[110px] min-h-[110px]",
              outOfStock
                ? "opacity-40 cursor-not-allowed grayscale"
                : "hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg active:shadow-none cursor-pointer"
            )}
          >
            {/* Colored background */}
            {product.image_url ? (
              <div className="absolute inset-0">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>
            ) : (
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br",
                getProductColor(product.name)
              )} />
            )}

            {/* Stock badge */}
            {outOfStock ? (
              <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                OUT
              </div>
            ) : product.stock_quantity <= 10 && product.stock_quantity > 0 && (
              <div className="absolute top-1.5 left-1.5 bg-warning/90 text-warning-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                {product.stock_quantity} left
              </div>
            )}

            {/* Quick add indicator */}
            {!outOfStock && (
              <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-3.5 w-3.5 text-white" />
              </div>
            )}

            {/* Product info - bottom aligned */}
            <div className="relative mt-auto p-2 pt-3">
              <p className="text-[12px] font-bold leading-tight line-clamp-2 text-white drop-shadow-sm">
                {product.name}
              </p>
              <p className="text-[13px] font-black text-white/90 mt-0.5 drop-shadow-sm">
                KSh {product.price.toLocaleString("en-KE", { minimumFractionDigits: 0 })}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}