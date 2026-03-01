import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseAndAutoFillCSV } from "@/lib/product-auto-gen";
import { toast } from "sonner";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  branchId: string | null;
  onImported: () => void;
}

export default function BulkImportDialog({
  open, onOpenChange, businessId, branchId, onImported,
}: BulkImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleOpen = (v: boolean) => {
    if (!v) { setPreview(null); setCsvText(""); setResult(null); }
    onOpenChange(v);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      try {
        const rows = await parseAndAutoFillCSV(text, businessId);
        setPreview(rows);
      } catch {
        toast.error("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const product of preview) {
      const { data, error } = await supabase
        .from("products")
        .insert(product)
        .select("id")
        .single();

      if (error) {
        failed++;
        continue;
      }
      success++;

      if (branchId && data) {
        await supabase.from("inventory").insert({
          product_id: data.id,
          branch_id: branchId,
          quantity: product.stock_quantity ?? 0,
          reorder_level: product.min_stock_level ?? 10,
        });
      }
    }

    setResult({ success, failed });
    setImporting(false);
    if (success > 0) {
      toast.success(`${success} products imported`);
      onImported();
    }
    if (failed > 0) {
      toast.error(`${failed} products failed to import`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Bulk Import Products
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
            <p className="font-semibold">{result.success} products imported successfully</p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive">{result.failed} failed (duplicates or errors)</p>
            )}
            <Button onClick={() => handleOpen(false)}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>CSV File</Label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required columns: <strong>name</strong>, <strong>price</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Optional: sku, barcode, cost, tax_rate, unit
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              {preview && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <Label>{preview.length} products ready to import</Label>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">SKU</th>
                          <th className="p-2 text-right">Price</th>
                          <th className="p-2 text-left">Barcode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 20).map((p, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2 font-medium">{p.name}</td>
                            <td className="p-2 text-muted-foreground">{p.sku}</td>
                            <td className="p-2 text-right">{p.price}</td>
                            <td className="p-2 text-muted-foreground">{p.barcode}</td>
                          </tr>
                        ))}
                        {preview.length > 20 && (
                          <tr>
                            <td colSpan={4} className="p-2 text-center text-muted-foreground">
                              ...and {preview.length - 20} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Missing SKU and barcode values will be auto-generated. Products are assigned to "Uncategorized" category by default.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={importing || !preview || preview.length === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : `Import ${preview?.length ?? 0} Products`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
