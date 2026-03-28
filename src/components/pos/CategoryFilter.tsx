import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (id: string | null) => void;
}

export default function CategoryFilter({ categories, selectedCategory, onSelect }: CategoryFilterProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-1.5 pb-1">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all touch-manipulation select-none",
            selectedCategory === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <LayoutGrid className="h-3 w-3" />
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all touch-manipulation select-none",
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}