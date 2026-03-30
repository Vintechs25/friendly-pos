import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Search, Barcode, Loader2, Package, PauseCircle,
  Percent, DollarSign, XCircle, LayoutGrid, List, ShoppingBag, Plus, StickyNote, UtensilsCrossed,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLicense, LicenseBanner } from "@/contexts/LicenseContext";
import { useScanner, ScanMode } from "@/hooks/use-scanner";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import ReceiptPreviewDialog from "@/components/ReceiptPreviewDialog";
import type { ReceiptData } from "@/components/ThermalReceipt";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { BarcodeResult } from "@/lib/scan-engine";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  savePendingSale,
  cacheProducts,
  cacheCategories,
  getCachedProducts,
  getCachedCategories,
  OfflineSale,
} from "@/lib/offline-store";

import POSLayout from "@/components/pos/POSLayout";
import QuickProductDialog from "@/components/pos/QuickProductDialog";
import CategoryFilter from "@/components/pos/CategoryFilter";
import CartItemRow from "@/components/pos/CartItemRow";
import SplitPaymentPanel from "@/components/pos/SplitPaymentPanel";
import HeldSalesPanel from "@/components/pos/HeldSalesPanel";
import ProductGrid from "@/components/pos/ProductGrid";
import CustomerPicker from "@/components/pos/CustomerPicker";
import QuickCashButtons from "@/components/pos/QuickCashButtons";
import LoyaltyRedemption from "@/components/pos/LoyaltyRedemption";
import {
  CartItem, PaymentEntry, PaymentMethod, HeldSale,
  createCartItem, getItemTotal, getItemTax,
} from "@/components/pos/types";
import { useHardwareConfig } from "@/hooks/useHardwareConfig";
import ShiftGate from "@/components/pos/ShiftGate";
import TableSelector from "@/components/pos/TableSelector";
type Product = Tables<"products">;

interface SelectedCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyalty_points: number;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("checkout");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [quickProductOpen, setQuickProductOpen] = useState(false);
  const [quickProductInitial, setQuickProductInitial] = useState("");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const [selectedTable, setSelectedTable] = useState<{ id: string; number: string } | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);

  // Loyalty redemption
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const LOYALTY_POINT_VALUE = 1;

  // Cart discount
  const [cartDiscount, setCartDiscount] = useState(0);
  const [cartDiscountType, setCartDiscountType] = useState<"fixed" | "percent">("fixed");

  // Payments
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: "cash", amount: 0 }]);
  const [splitMode, setSplitMode] = useState(false);
  const [cashTendered, setCashTendered] = useState(0);

  // Held sales
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

  const { user, profile, hasRole } = useAuth();
  const { canUsePOS } = useLicense();
  const { isOnline, pendingCount, syncing, syncAll, refreshCount } = useOfflineSync();
  const { deviceStatuses } = useHardwareConfig();
  const { isFeatureEnabled } = useFeatureToggles();
  const restaurantMode = isFeatureEnabled("restaurant_mode");

  const canOverridePrice = hasRole("business_owner") || hasRole("manager") || hasRole("super_admin");

  // Barcode index
  const barcodeIndex = useMemo(() => {
    const idx = new Map<string, Product>();
    for (const p of products) {
      if (p.barcode) idx.set(p.barcode.toLowerCase(), p);
      if (p.sku) idx.set(p.sku.toLowerCase(), p);
    }
    return idx;
  }, [products]);

  // Scanner handler
  const handleScan = useCallback(
    (result: BarcodeResult) => {
      const code = result.sanitized.toLowerCase();
      if (scanMode === "search") { setSearchTerm(result.sanitized); return; }
      if (result.type === "WEIGHTED" && result.productCode) {
        const wp = products.find((p) => p.barcode?.includes(result.productCode!) || p.sku === result.productCode);
        if (wp) {
          const item = createCartItem(wp);
          if (result.weight) item.qty = result.weight / 1000;
          if (result.embeddedPrice) item.priceOverride = result.embeddedPrice;
          setCart((prev) => [...prev, item]);
          toast.success(`Weighted: ${wp.name}`);
          return;
        }
      }
      const product = barcodeIndex.get(code);
      if (!product) {
        const nameMatch = products.find((p) => p.name.toLowerCase() === code || p.sku?.toLowerCase() === code);
        if (nameMatch) { addToCart(nameMatch); toast.success(`Added: ${nameMatch.name}`); return; }
        // Offer quick product creation
        setQuickProductInitial(result.sanitized);
        setQuickProductOpen(true);
        return;
      }
      if (scanMode === "quantity") {
        setCart((prev) => {
          const existing = prev.find((i) => i.id === product.id);
          if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
          return [...prev, createCartItem(product)];
        });
        return;
      }
      addToCart(product);
      toast.success(`Added: ${product.name}`);
    },
    [barcodeIndex, products, scanMode, cart]
  );

  const scanner = useScanner({
    enabled: true,
    mode: scanMode,
    config: { enableSound: soundEnabled },
    onScan: handleScan,
    onError: useCallback((error: string) => toast.error(error), []),
  });

  // Load data
  useEffect(() => {
    if (!profile?.business_id) return;
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const [{ data }, { data: branches }] = await Promise.all([
          supabase.from("products").select("*").eq("business_id", profile.business_id!).eq("is_active", true).order("name"),
          supabase.from("branches").select("id").eq("business_id", profile.business_id!).eq("is_active", true).limit(1),
        ]);
        const prods = data ?? [];
        setProducts(prods);
        setBranchId(branches?.[0]?.id ?? null);
        cacheProducts(prods).catch(() => {});
      } catch {
        const cached = await getCachedProducts();
        if (cached.length > 0) { setProducts(cached as Product[]); toast.info("Using cached products (offline)"); }
      }
      setLoadingProducts(false);
    };
    const loadCategories = async () => {
      try {
        const { data } = await supabase.from("categories").select("id, name").eq("business_id", profile.business_id!).eq("is_active", true).order("name");
        const cats = data ?? [];
        setCategories(cats);
        cacheCategories(cats).catch(() => {});
      } catch {
        const cached = await getCachedCategories();
        if (cached.length > 0) setCategories(cached);
      }
    };
    loadProducts();
    loadCategories();
    loadHeldSales();
    const channel = supabase.channel("pos-products").on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => loadProducts()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.business_id]);

  const loadHeldSales = async () => {
    if (!profile?.business_id) return;
    const { data } = await supabase.from("held_sales").select("id, label, created_at, total, held_sale_items(id)").eq("business_id", profile.business_id).order("created_at", { ascending: false });
    setHeldSales((data ?? []).map((hs: any) => ({ id: hs.id, label: hs.label, created_at: hs.created_at, total: hs.total, itemCount: hs.held_sale_items?.length ?? 0 })));
  };

  // Cart ops
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, createCartItem(product)];
    });
    // Pulse animation on cart badge
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 600);
  };
  const updateQty = (id: string, qty: number) => setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(0.001, qty) } : i));
  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));
  const updateItemDiscount = (id: string, discount: number, type: "fixed" | "percent") => setCart((prev) => prev.map((i) => i.id === id ? { ...i, itemDiscount: discount, itemDiscountType: type } : i));
  const overridePrice = (id: string, price: number) => setCart((prev) => prev.map((i) => i.id === id ? { ...i, priceOverride: price, overrideBy: user?.id ?? null } : i));

  // Calculations
  const itemsSubtotal = cart.reduce((s, i) => s + getItemTotal(i), 0);
  const cartDiscountAmount = cartDiscountType === "percent" ? itemsSubtotal * (cartDiscount / 100) : cartDiscount;
  const loyaltyDiscount = redeemedPoints * LOYALTY_POINT_VALUE;
  const subtotalAfterDiscount = Math.max(0, itemsSubtotal - cartDiscountAmount - loyaltyDiscount);
  const taxAmount = cart.reduce((s, i) => s + getItemTax(i), 0);
  const total = subtotalAfterDiscount + taxAmount;

  useEffect(() => { if (!splitMode) setPayments((prev) => [{ method: prev[0]?.method ?? "cash", amount: total }]); }, [total, splitMode]);
  useEffect(() => { setRedeemedPoints(0); }, [selectedCustomer?.id]);

  const filtered = products.filter((p) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s) || (p.barcode ?? "").toLowerCase().includes(s);
    return matchesSearch && (!selectedCategory || p.category_id === selectedCategory);
  });

  // Hold / Resume / Void
  const holdTransaction = async () => {
    if (!user || !profile?.business_id || cart.length === 0) return;
    const { data: branches } = await supabase.from("branches").select("id").eq("business_id", profile.business_id).eq("is_active", true).limit(1);
    const branchId = branches?.[0]?.id;
    if (!branchId) { toast.error("No active branch"); return; }
    const label = `Sale @ ${new Date().toLocaleTimeString()}`;
    const { data: held, error } = await supabase.from("held_sales").insert({ business_id: profile.business_id, branch_id: branchId, cashier_id: user.id, label, subtotal: itemsSubtotal, tax_amount: taxAmount, discount_amount: cartDiscountAmount, total, cart_discount: cartDiscount, cart_discount_type: cartDiscountType }).select().single();
    if (error || !held) { toast.error("Failed to hold sale"); return; }
    await supabase.from("held_sale_items").insert(cart.map((item) => ({ held_sale_id: held.id, product_id: item.id, product_name: item.name, quantity: item.qty, unit_price: item.price, item_discount: item.itemDiscount, item_discount_type: item.itemDiscountType, price_override: item.priceOverride, tax_rate: item.tax_rate })));
    resetSale();
    toast.success("Sale parked");
    loadHeldSales();
  };

  const resumeHeldSale = async (id: string) => {
    const { data: held } = await supabase.from("held_sales").select("*, held_sale_items(*)").eq("id", id).single();
    if (!held) { toast.error("Could not load held sale"); return; }
    setCart((held.held_sale_items as any[]).map((item: any) => ({ id: item.product_id, name: item.product_name, price: item.unit_price, cost: 0, tax_rate: item.tax_rate, qty: item.quantity, track_inventory: true, itemDiscount: item.item_discount, itemDiscountType: item.item_discount_type as "fixed" | "percent", priceOverride: item.price_override, overrideBy: null })));
    setCartDiscount(held.cart_discount);
    setCartDiscountType(held.cart_discount_type as "fixed" | "percent");
    await supabase.from("held_sales").delete().eq("id", id);
    loadHeldSales();
    toast.success("Sale resumed");
  };

  const deleteHeldSale = async (id: string) => { await supabase.from("held_sales").delete().eq("id", id); loadHeldSales(); };

  const resetSale = () => { setCart([]); setCartDiscount(0); setCashTendered(0); setSplitMode(false); setSelectedCustomer(null); setRedeemedPoints(0); setOrderNotes(""); setShowNotes(false); };
  const voidCurrentSale = () => { if (cart.length === 0) return; resetSale(); toast.info("Sale voided"); };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        if (e.key === "Escape") { setSearchTerm(""); (e.target as HTMLElement).blur(); e.preventDefault(); }
        return;
      }
      switch (e.key) {
        case "F1": e.preventDefault(); setPayments([{ method: "cash", amount: total }]); break;
        case "F2": e.preventDefault(); setPayments([{ method: "card", amount: total }]); break;
        case "F3": e.preventDefault(); setPayments([{ method: "mobile_money", amount: total }]); break;
        case "F4": e.preventDefault(); holdTransaction(); break;
        case "F8": e.preventDefault(); voidCurrentSale(); break;
        case "F11": e.preventDefault(); if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen().catch(() => {}); break;
        case "Enter": e.preventDefault(); if (cart.length > 0 && !processing) completeSale(); break;
        case "Escape": e.preventDefault(); setSearchTerm(""); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length, processing, total]);

  // Complete sale
  const completeSale = async () => {
    if (!user || !profile?.business_id || cart.length === 0) return;
    if (splitMode) { const allocated = payments.reduce((s, p) => s + p.amount, 0); if (allocated < total - 0.01) { toast.error(`Payment short by KSh ${(total - allocated).toFixed(2)}`); return; } }
    setProcessing(true);
    try {
      let branch: { id: string; name: string } | null = null;
      try { const { data: branches } = await supabase.from("branches").select("id, name").eq("business_id", profile.business_id).eq("is_active", true).limit(1); branch = branches?.[0] ?? null; } catch {}
      if (!branch && isOnline) { toast.error("No active branch found"); return; }
      const branchId = branch?.id ?? "offline";
      const branchName = branch?.name ?? "Offline";
      let business: any = null;
      try { const { data } = await supabase.from("businesses").select("name, address, phone, email").eq("id", profile.business_id).single(); business = data; } catch {}
      const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
      const primaryMethod = splitMode ? "split" as any : payments[0]?.method ?? "cash";
      const saleItems = cart.map((item) => ({ product_id: item.id, product_name: item.name, quantity: item.qty, unit_price: item.priceOverride ?? item.price, discount: item.itemDiscount, tax_amount: getItemTax(item), total: getItemTotal(item) + getItemTax(item), price_override: item.priceOverride, override_by: item.overrideBy, item_discount: item.itemDiscount, item_discount_type: item.itemDiscountType }));
      const paymentEntries = splitMode ? payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method === "mobile_money" ? "mpesa" : p.method, amount: p.amount, reference: p.reference || null })) : [{ method: ((payments[0]?.method === "mobile_money" ? "mpesa" : payments[0]?.method) ?? "cash"), amount: total, reference: payments[0]?.reference || null }];

      if (isOnline && branch) {
        const salePayload: Record<string, any> = { business_id: profile.business_id, branch_id: branch.id, cashier_id: user.id, receipt_number: receiptNumber, subtotal: itemsSubtotal, tax_amount: taxAmount, discount_amount: cartDiscountAmount + loyaltyDiscount, total, payment_method: primaryMethod, status: "completed", order_type: selectedTable ? "dine_in" : "counter" };
        if (selectedTable) salePayload.table_id = selectedTable.id;
        if (selectedCustomer?.id) salePayload.customer_id = selectedCustomer.id;
        if (selectedCustomer?.name) salePayload.customer_name = selectedCustomer.name;
        if (orderNotes.trim()) salePayload.notes = orderNotes.trim();
        const { data: sale, error: saleError } = await supabase.from("sales").insert(salePayload as any).select().single();
        if (saleError) { toast.error("Failed: " + saleError.message); return; }
        await supabase.from("sale_items").insert(saleItems.map((si) => ({ ...si, sale_id: sale.id })));
        await supabase.from("payments").insert(paymentEntries.map((p) => ({ sale_id: sale.id, business_id: profile!.business_id!, method: p.method as any, amount: p.amount, reference: p.reference, payment_status: "confirmed" as any })));
        for (const p of payments) { if (p.method === "gift_card" && p.reference && p.amount > 0) { const { data: gc } = await supabase.from("gift_cards").select("id, balance").eq("business_id", profile.business_id).eq("code", p.reference).single(); if (gc) await supabase.from("gift_cards").update({ balance: Math.max(0, gc.balance - p.amount) }).eq("id", gc.id); } }
        for (const item of cart) { if (!item.track_inventory) continue; const { data: inv } = await supabase.from("inventory").select("id, quantity").eq("product_id", item.id).eq("branch_id", branch.id).single(); if (inv) await supabase.from("inventory").update({ quantity: Math.max(0, inv.quantity - item.qty) }).eq("id", inv.id); else await supabase.from("inventory").insert({ product_id: item.id, branch_id: branch.id, quantity: 0 }); }
        // Create KOT if restaurant mode and table selected
        if (restaurantMode && selectedTable) {
          const kotNumber = `KOT-${Date.now().toString(36).toUpperCase()}`;
          const { data: kot } = await supabase.from("kitchen_orders").insert({ business_id: profile.business_id, branch_id: branch.id, sale_id: sale.id, table_id: selectedTable.id, order_number: kotNumber, status: "pending", created_by: user.id, notes: orderNotes.trim() || null } as any).select().single();
          if (kot) {
            await supabase.from("kitchen_order_items").insert(cart.map((item) => ({ kitchen_order_id: kot.id, product_id: item.id, product_name: item.name, quantity: item.qty, notes: null } as any)));
          }
          // Set table to occupied
          await supabase.from("restaurant_tables").update({ status: "available" } as any).eq("id", selectedTable.id);
          setSelectedTable(null);
        }
        let loyaltyPointsEarned = 0;
        if (selectedCustomer) { loyaltyPointsEarned = Math.floor(total / 100); const netPoints = selectedCustomer.loyalty_points + loyaltyPointsEarned - redeemedPoints; await supabase.from("customers").update({ loyalty_points: Math.max(0, netPoints) }).eq("id", selectedCustomer.id); }
      } else {
        const offlineSale: OfflineSale = { id: crypto.randomUUID(), created_at: new Date().toISOString(), business_id: profile.business_id, branch_id: branchId, cashier_id: user.id, receipt_number: receiptNumber, subtotal: itemsSubtotal, tax_amount: taxAmount, discount_amount: cartDiscountAmount + loyaltyDiscount, total, payment_method: primaryMethod, customer_id: selectedCustomer?.id ?? null, customer_name: selectedCustomer?.name ?? null, items: saleItems, payments: paymentEntries, loyalty_points_earned: selectedCustomer ? Math.floor(total / 100) : 0, synced: false, sync_error: null };
        await savePendingSale(offlineSale);
        await refreshCount();
        toast.info("Sale saved offline");
      }

      const loyaltyPointsEarned = selectedCustomer ? Math.floor(total / 100) : 0;
      const receiptPayments = splitMode ? payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount, reference: p.reference })) : [{ method: payments[0]?.method ?? "cash", amount: total }];
      const cashPayment = receiptPayments.find((p) => p.method === "cash");
      const changeAmt = cashPayment ? Math.max(0, cashTendered - total) : 0;

      setReceiptData({
        receiptNumber, businessName: business?.name || "Business", branchName, address: business?.address || undefined, phone: business?.phone || undefined, email: business?.email || undefined, cashierName: profile.full_name || undefined,
        items: cart.map((item) => ({ name: item.name, qty: item.qty, unitPrice: item.priceOverride ?? item.price, taxAmount: getItemTax(item), total: getItemTotal(item) + getItemTax(item), discount: item.itemDiscount > 0 ? item.itemDiscount : undefined, discountType: item.itemDiscount > 0 ? item.itemDiscountType : undefined, taxIndicator: item.tax_rate > 0 ? "V" : undefined })),
        subtotal: itemsSubtotal, taxAmount, discountAmount: cartDiscountAmount + loyaltyDiscount, total, paymentMethod: splitMode ? "split" : (payments[0]?.method ?? "cash"), payments: receiptPayments, cashTendered: cashPayment ? cashTendered : undefined, changeAmount: changeAmt > 0 ? changeAmt : undefined, date: new Date(), customerName: selectedCustomer?.name, loyaltyPointsEarned: loyaltyPointsEarned > 0 ? loyaltyPointsEarned : undefined, isPendingSync: !isOnline,
        config: { taxLabel: "VAT", currency: "KSh", showQR: true, loyaltyPointsEarned: loyaltyPointsEarned > 0 ? loyaltyPointsEarned : undefined },
      });
      setShowReceipt(true);
      toast.success(`Sale completed! ${receiptNumber}`);
      resetSale();
      scanner.resetCount();
    } catch (err: any) { toast.error(err.message || "Error"); } finally { setProcessing(false); }
  };

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <ShiftGate>
    <POSLayout
      isOnline={isOnline}
      pendingCount={pendingCount}
      syncing={syncing}
      onSync={syncAll}
      scannerActive={scanner.isActive}
      scanCount={scanner.scanCount}
      showFlash={scanner.showFlash}
      scanMode={scanMode}
      soundEnabled={soundEnabled}
      onToggleSound={() => setSoundEnabled((p) => !p)}
      lastBarcode={scanner.lastScan?.sanitized}
      deviceStatuses={{ ...deviceStatuses, internet: isOnline ? "online" : "offline" }}
      onLastReceipt={receiptData ? () => setShowReceipt(true) : undefined}
    >
      <LicenseBanner />
      <ReceiptPreviewDialog open={showReceipt} onOpenChange={setShowReceipt} data={receiptData} />
      <QuickProductDialog
        open={quickProductOpen}
        onOpenChange={setQuickProductOpen}
        businessId={profile?.business_id ?? ""}
        branchId={branchId}
        initialValue={quickProductInitial}
        onCreated={(product) => {
          setProducts((prev) => [...prev, product]);
          addToCart(product);
        }}
      />

      <div className="flex h-full">
        {/* ═══ LEFT: Product Catalog ═══ */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/30">
          {/* Search bar */}
          <div className="px-3 py-2 space-y-1.5 bg-background border-b border-border">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search or scan barcode..."
                  className="pl-9 h-10 text-sm rounded-lg bg-muted/50 border-border focus:border-primary touch-manipulation"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`h-10 w-10 flex items-center justify-center transition-colors touch-manipulation ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`h-10 w-10 flex items-center justify-center transition-colors touch-manipulation ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Category pills */}
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/50" />
              </div>
            ) : viewMode === "grid" ? (
              <>
                <ProductGrid products={filtered} onAddToCart={(p) => { addToCart(p); toast.success(`${p.name} added`); }} />
                {filtered.length === 0 && searchTerm && (
                  <div className="text-center mt-2">
                    <Button variant="outline" size="sm" onClick={() => { setQuickProductInitial(searchTerm); setQuickProductOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create "{searchTerm}"
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-0.5">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Package className="h-12 w-12 mb-4 opacity-15" />
                    <p className="text-sm font-semibold">No products found</p>
                    {searchTerm && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => { setQuickProductInitial(searchTerm); setQuickProductOpen(true); }}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Create "{searchTerm}"
                      </Button>
                    )}
                  </div>
                ) : filtered.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => { addToCart(product); toast.success(`${product.name} added`); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-all text-left touch-manipulation active:scale-[0.98] select-none"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-primary/40">
                        {product.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {product.sku && <span className="mr-2">{product.sku}</span>}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                      KSh {product.price.toLocaleString("en-KE")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Cart + Payment ═══ */}
        <div className="w-[380px] xl:w-[420px] 2xl:w-[460px] flex flex-col bg-card shrink-0 border-l border-border">
          {/* Cart header */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <ShoppingBag className={cn("h-4 w-4 text-primary transition-transform", cartPulse && "scale-125 text-success")} />
              <span className="font-bold text-sm">
                Cart
                <span className={cn("text-muted-foreground font-normal ml-1.5 text-[11px] transition-colors", cartPulse && "text-success font-semibold")}>
                  ({cart.length} {cart.length === 1 ? "item" : "items"})
                </span>
              </span>
            </div>
            <div className="flex gap-1">
              {cart.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 touch-manipulation rounded-md px-2" onClick={() => setShowNotes(!showNotes)}>
                    <StickyNote className={cn("h-3 w-3", orderNotes && "text-warning")} />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 touch-manipulation rounded-md px-2" onClick={holdTransaction}>
                    <PauseCircle className="h-3 w-3" /> Hold
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation rounded-md px-2" onClick={voidCurrentSale}>
                    <XCircle className="h-3 w-3" /> Void
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Scrollable middle */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Table selector (restaurant mode) */}
            {restaurantMode && (
              <div className="px-3 py-2 border-b border-border/50">
                <button
                  onClick={() => setTableDialogOpen(true)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 text-xs transition-colors",
                    selectedTable
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {selectedTable ? `Table ${selectedTable.number}` : "Select Table (Dine-in)"}
                  {selectedTable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTable(null); }}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  )}
                </button>
              </div>
            )}
            <TableSelector open={tableDialogOpen} onOpenChange={setTableDialogOpen} onSelect={(id, num) => setSelectedTable({ id, number: num })} />

            {/* Customer */}
            <div className="px-3 py-2 border-b border-border/50">
              <CustomerPicker businessId={profile?.business_id ?? null} selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} />
              {selectedCustomer && selectedCustomer.loyalty_points > 0 && cart.length > 0 && (
                <div className="mt-1.5">
                  <LoyaltyRedemption customerName={selectedCustomer.name} availablePoints={selectedCustomer.loyalty_points} pointValue={LOYALTY_POINT_VALUE} maxRedeemable={itemsSubtotal - cartDiscountAmount} onRedeem={setRedeemedPoints} redeemedPoints={redeemedPoints} />
                </div>
              )}
            </div>

            {/* Held sales */}
            {heldSales.length > 0 && (
              <div className="px-3 pt-2">
                <HeldSalesPanel heldSales={heldSales} onResume={resumeHeldSale} onDelete={deleteHeldSale} />
              </div>
            )}

            {/* Order notes */}
            {showNotes && cart.length > 0 && (
              <div className="px-3 py-1.5 border-b border-border/50">
                <Input
                  placeholder="Order notes (e.g. Gift wrap, pickup later)"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {/* Cart items */}
            <div className="px-2 py-1">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Barcode className="h-5 w-5 opacity-20" />
                  <p className="text-xs">Scan or tap to add items</p>
                </div>
              ) : cart.map((item) => (
                <CartItemRow key={item.id} item={item} onUpdateQty={updateQty} onRemove={removeItem} onUpdateDiscount={updateItemDiscount} onPriceOverride={overridePrice} canOverridePrice={canOverridePrice} />
              ))}
            </div>
          </div>

          {/* ═══ Totals & Payment - pinned bottom ═══ */}
          <div className="border-t-2 border-border bg-card shrink-0">
            <div className="px-3 py-2 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">KSh {itemsSubtotal.toFixed(2)}</span>
              </div>

              {/* Cart discount */}
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all touch-manipulation">
                      <Percent className="h-2.5 w-2.5" /> Discount
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3 space-y-2" side="top">
                    <Label className="text-xs font-semibold">Cart Discount</Label>
                    <div className="flex gap-1.5">
                      <Button variant={cartDiscountType === "fixed" ? "default" : "outline"} size="sm" className="h-8 text-xs flex-1" onClick={() => setCartDiscountType("fixed")}><DollarSign className="h-3 w-3 mr-1" /> Fixed</Button>
                      <Button variant={cartDiscountType === "percent" ? "default" : "outline"} size="sm" className="h-8 text-xs flex-1" onClick={() => setCartDiscountType("percent")}><Percent className="h-3 w-3 mr-1" /> %</Button>
                    </div>
                    <Input type="number" value={cartDiscount || ""} onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)} placeholder="0" className="h-9" min="0" />
                  </PopoverContent>
                </Popover>
                {cartDiscountAmount > 0 && <span className="text-[10px] text-destructive font-semibold ml-auto tabular-nums">-KSh {cartDiscountAmount.toFixed(2)}</span>}
              </div>

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Loyalty</span>
                  <span className="text-destructive font-medium tabular-nums">-KSh {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium tabular-nums">KSh {taxAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Total - big and prominent */}
            <div className="flex justify-between items-center px-3 py-2.5 bg-primary/5 border-y border-primary/20">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">TOTAL</span>
              <span className="text-2xl font-black text-primary tabular-nums">
                KSh {total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Payment methods */}
            <div className="px-3 py-2 space-y-2">
              <SplitPaymentPanel
                total={total}
                payments={payments}
                onPaymentsChange={setPayments}
                splitMode={splitMode}
                onToggleSplit={() => { setSplitMode(!splitMode); if (!splitMode) setPayments([{ method: "cash", amount: total }]); }}
                cashTendered={cashTendered}
                onCashTenderedChange={setCashTendered}
                businessId={profile?.business_id ?? null}
              />

              {/* Quick cash */}
              {payments[0]?.method === "cash" && !splitMode && total > 0 && (
                <QuickCashButtons total={total} onSelect={setCashTendered} />
              )}
            </div>

            {/* Complete button */}
            <div className="px-3 pb-3 pt-1">
              <Button
                className="w-full h-12 text-sm font-bold rounded-lg touch-manipulation shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
                disabled={cart.length === 0 || processing || !canUsePOS}
                onClick={completeSale}
              >
                {!canUsePOS ? "License Required" : processing ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
                ) : !isOnline ? (
                  "Complete Sale (Offline)"
                ) : (
                  <>Complete Sale — KSh {total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </POSLayout>
    </ShiftGate>
  );
}
