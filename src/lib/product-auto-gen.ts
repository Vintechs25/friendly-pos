import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a SKU from a product name.
 * e.g. "Hammer" → "HAM-001", "Screwdriver" → "SCR-001"
 */
export async function generateSKU(name: string, businessId: string): Promise<string> {
  const prefix = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("")
    .slice(0, 3)
    .padEnd(3, "X");

  // Find the highest existing SKU with this prefix
  const { data } = await supabase
    .from("products")
    .select("sku")
    .eq("business_id", businessId)
    .like("sku", `${prefix}-%`)
    .order("sku", { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0 && data[0].sku) {
    const match = data[0].sku.match(/-(\d+)$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

/**
 * Generate a unique internal barcode.
 * Format: 2000000XXXX (starts at 20000000001)
 */
export async function generateBarcode(businessId: string): Promise<string> {
  const { data } = await supabase
    .from("products")
    .select("barcode")
    .eq("business_id", businessId)
    .like("barcode", "2000000%")
    .order("barcode", { ascending: false })
    .limit(1);

  let next = 20000000001;
  if (data && data.length > 0 && data[0].barcode) {
    const num = parseInt(data[0].barcode, 10);
    if (!isNaN(num)) next = num + 1;
  }

  return String(next);
}

/**
 * Ensure an "Uncategorized" category exists for the business, return its ID.
 */
export async function getOrCreateUncategorizedCategory(businessId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("business_id", businessId)
    .ilike("name", "uncategorized")
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ business_id: businessId, name: "Uncategorized", color: "#9ca3af" })
    .select("id")
    .single();

  if (error) return null;
  return created.id;
}

/**
 * Fill in missing product fields with auto-generated values.
 * Only generates fields that are empty/null.
 */
export async function autoFillProductFields(
  product: {
    name: string;
    price: number;
    sku?: string | null;
    barcode?: string | null;
    category_id?: string | null;
    unit?: string | null;
    cost?: number;
    tax_rate?: number;
    min_stock_level?: number;
    initial_stock?: number;
  },
  businessId: string
) {
  const [sku, barcode, categoryId] = await Promise.all([
    !product.sku ? generateSKU(product.name, businessId) : Promise.resolve(product.sku),
    !product.barcode ? generateBarcode(businessId) : Promise.resolve(product.barcode),
    !product.category_id ? getOrCreateUncategorizedCategory(businessId) : Promise.resolve(product.category_id),
  ]);

  return {
    business_id: businessId,
    name: product.name.trim(),
    price: product.price,
    cost: product.cost ?? 0,
    tax_rate: product.tax_rate ?? 0,
    sku,
    barcode,
    category_id: categoryId,
    unit: product.unit || "pcs",
    unit_of_measure: product.unit || "pcs",
    min_stock_level: product.min_stock_level ?? 10,
    track_inventory: true,
    track_stock: true,
    stock_quantity: product.initial_stock ?? 0,
  };
}

/**
 * Parse CSV text into rows, auto-generating missing SKU/barcode for each.
 */
export async function parseAndAutoFillCSV(
  csvText: string,
  businessId: string
): Promise<Array<ReturnType<typeof autoFillProductFields> extends Promise<infer T> ? T : never>> {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows = lines.slice(1);

  const results = [];
  for (const row of rows) {
    const cols = row.split(",").map((c) => c.trim().replace(/^['"]|['"]$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });

    const name = obj["name"] || obj["product name"] || obj["product_name"];
    const price = parseFloat(obj["price"] || obj["selling price"] || "0");
    if (!name) continue;

    const filled = await autoFillProductFields(
      {
        name,
        price,
        sku: obj["sku"] || null,
        barcode: obj["barcode"] || null,
        cost: parseFloat(obj["cost"] || obj["cost price"] || "0") || 0,
        tax_rate: parseFloat(obj["tax_rate"] || obj["tax"] || "0") || 0,
        unit: obj["unit"] || null,
      },
      businessId
    );
    results.push(filled);
  }

  return results;
}
