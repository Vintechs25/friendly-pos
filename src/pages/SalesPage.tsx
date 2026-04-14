import { useState, useEffect, useCallback, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Receipt, Download, Calendar, Filter, TrendingUp, ArrowUpDown, ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReceiptPreviewDialog from "@/components/ReceiptPreviewDialog";
import type { ReceiptData } from "@/components/ThermalReceipt";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface SaleRow {
  id: string;
  receipt_number: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  cashier_id: string;
}

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";
type SortField = "created_at" | "total";
type SortDir = "asc" | "desc";

export default function SalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<any[]>([]);

  const businessId = profile?.business_id;

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
    const endOfDay = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };

    switch (datePreset) {
      case "today":
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
      }
      case "week": {
        const w = new Date(now);
        w.setDate(w.getDate() - 7);
        return { from: startOfDay(w).toISOString(), to: endOfDay(now).toISOString() };
      }
      case "month": {
        const m = new Date(now);
        m.setDate(m.getDate() - 30);
        return { from: startOfDay(m).toISOString(), to: endOfDay(now).toISOString() };
      }
      case "custom": {
        const f = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
        const t = customTo ? new Date(customTo) : now;
        return { from: startOfDay(f).toISOString(), to: endOfDay(t).toISOString() };
      }
    }
  }, [datePreset, customFrom, customTo]);

  const loadSales = useCallback(async () => {
    if (!businessId) { setLoading(false); return; }
    setLoading(true);
    const { from, to } = getDateRange();
    let query = supabase
      .from("sales")
      .select("id, receipt_number, total, subtotal, tax_amount, discount_amount, payment_method, status, created_at, customer_id, customer_name, cashier_id")
      .eq("business_id", businessId)
      .gte("created_at", from)
      .lte("created_at", to)
      .order(sortField, { ascending: sortDir === "asc" })
      .limit(500);

    const { data } = await query;
    setSales((data ?? []).map(s => ({
      ...s,
      total: Number(s.total),
      subtotal: Number(s.subtotal),
      tax_amount: Number(s.tax_amount),
      discount_amount: Number(s.discount_amount),
      receipt_number: s.receipt_number || "",
      payment_method: s.payment_method || "cash",
      customer_name: s.customer_name || null,
    })));
    setLoading(false);
  }, [businessId, getDateRange, sortField, sortDir]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => { loadSales(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId, loadSales]);

  const handleReprint = async (sale: SaleRow) => {
    const [itemsRes, bizRes, branchRes] = await Promise.all([
      supabase.from("sale_items").select("product_name, quantity, unit_price, tax_amount, total").eq("sale_id", sale.id),
      supabase.from("businesses").select("name, address, phone").eq("id", businessId!).single(),
      supabase.from("branches").select("name").eq("business_id", businessId!).eq("is_active", true).limit(1),
    ]);
    setReceiptData({
      receiptNumber: sale.receipt_number,
      businessName: bizRes.data?.name || "Business",
      branchName: branchRes.data?.[0]?.name,
      address: bizRes.data?.address || undefined,
      phone: bizRes.data?.phone || undefined,
      cashierName: profile?.full_name || undefined,
      items: (itemsRes.data ?? []).map(i => ({
        name: i.product_name,
        qty: i.quantity,
        unitPrice: Number(i.unit_price),
        taxAmount: Number(i.tax_amount),
        total: Number(i.total),
      })),
      subtotal: sale.subtotal,
      taxAmount: sale.tax_amount,
      discountAmount: sale.discount_amount,
      total: sale.total,
      paymentMethod: sale.payment_method,
      date: new Date(sale.created_at),
    });
    setShowReceipt(true);
  };

  const toggleExpand = async (sale: SaleRow) => {
    if (expandedId === sale.id) { setExpandedId(null); return; }
    setExpandedId(sale.id);
    const { data } = await supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, total")
      .eq("sale_id", sale.id);
    setExpandedItems(data ?? []);
  };

  const exportCSV = () => {
    const header = "Receipt,Date,Customer,Total,Payment,Status\n";
    const rows = filtered.map(s =>
      `${s.receipt_number},${new Date(s.created_at).toISOString()},${s.customer_name || "Walk-in"},${s.total},${s.payment_method},${s.status}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-export-${Date.now()}.csv`;
    a.click();
  };

  const fmt = (n: number) => `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-KE", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Apply search and filters
  const filtered = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch =
        s.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
        (s.customer_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesPayment = paymentFilter === "all" || s.payment_method === paymentFilter;
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesPayment && matchesStatus;
    });
  }, [sales, search, paymentFilter, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const completed = filtered.filter(s => s.status === "completed");
    return {
      totalRevenue: completed.reduce((s, r) => s + r.total, 0),
      totalTax: completed.reduce((s, r) => s + r.tax_amount, 0),
      totalDiscount: completed.reduce((s, r) => s + r.discount_amount, 0),
      count: completed.length,
      avgSale: completed.length > 0 ? completed.reduce((s, r) => s + r.total, 0) / completed.length : 0,
      paymentBreakdown: Object.entries(
        completed.reduce((acc, s) => {
          acc[s.payment_method] = (acc[s.payment_method] || 0) + s.total;
          return acc;
        }, {} as Record<string, number>)
      ),
    };
  }, [filtered]);

  const statusStyles: Record<string, string> = {
    completed: "bg-primary/10 text-primary",
    refunded: "bg-destructive/10 text-destructive",
    partially_refunded: "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]",
    voided: "bg-muted text-muted-foreground",
  };

  const paymentColors: Record<string, string> = {
    cash: "bg-primary/10 text-primary",
    mpesa: "bg-[hsl(145,63%,42%)]/10 text-[hsl(145,63%,42%)]",
    mobile_money: "bg-[hsl(145,63%,42%)]/10 text-[hsl(145,63%,42%)]",
    card: "bg-accent/10 text-accent-foreground",
    credit: "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]",
    split: "bg-secondary/10 text-secondary-foreground",
  };

  const datePresets: { value: DatePreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "7 Days" },
    { value: "month", label: "30 Days" },
    { value: "custom", label: "Custom" },
  ];

  const uniquePayments = [...new Set(sales.map(s => s.payment_method))];

  return (
    <DashboardLayout>
      <ReceiptPreviewDialog open={showReceipt} onOpenChange={setShowReceipt} data={receiptData} />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Sales History</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track transactions, view receipts, and analyze sales</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Revenue</p>
            <p className="text-lg font-black text-primary tabular-nums">{fmt(stats.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Transactions</p>
            <p className="text-lg font-black tabular-nums">{stats.count}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Avg Sale</p>
            <p className="text-lg font-black tabular-nums">{fmt(stats.avgSale)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tax Collected</p>
            <p className="text-lg font-black tabular-nums">{fmt(stats.totalTax)}</p>
          </div>
        </div>

        {/* Payment breakdown mini-bar */}
        {stats.paymentBreakdown.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {stats.paymentBreakdown.map(([method, amount]) => (
              <div key={method} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold", paymentColors[method] || "bg-muted text-muted-foreground")}>
                <span className="capitalize">{method.replace("_", " ")}</span>
                <span className="font-bold">{fmt(amount as number)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date presets */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {datePresets.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors",
                  datePreset === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-[130px] text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-[130px] text-xs" />
            </div>
          )}

          {/* Payment filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-card text-xs font-medium"
          >
            <option value="all">All Payments</option>
            {uniquePayments.map(m => (
              <option key={m} value={m} className="capitalize">{m.replace("_", " ")}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border bg-card text-xs font-medium"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="voided">Voided</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search receipt or customer..."
              className="pl-9 h-8 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Sales table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Receipt className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">No sales found</p>
            <p className="text-xs mt-1">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left font-medium p-3 text-xs">Receipt</th>
                    <th className="text-left font-medium p-3 text-xs hidden sm:table-cell">
                      <button onClick={() => { setSortField("created_at"); setSortDir(d => d === "desc" ? "asc" : "desc"); }} className="flex items-center gap-1 hover:text-foreground">
                        Date <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left font-medium p-3 text-xs hidden md:table-cell">Customer</th>
                    <th className="text-left font-medium p-3 text-xs hidden md:table-cell">Payment</th>
                    <th className="text-right font-medium p-3 text-xs">
                      <button onClick={() => { setSortField("total"); setSortDir(d => d === "desc" ? "asc" : "desc"); }} className="flex items-center gap-1 ml-auto hover:text-foreground">
                        Total <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-center font-medium p-3 text-xs">Status</th>
                    <th className="text-center font-medium p-3 text-xs w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <>
                      <tr
                        key={s.id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer",
                          expandedId === s.id && "bg-muted/20"
                        )}
                        onClick={() => toggleExpand(s)}
                      >
                        <td className="p-3 font-medium font-mono text-xs">{s.receipt_number}</td>
                        <td className="p-3 text-muted-foreground text-xs hidden sm:table-cell">{fmtDate(s.created_at)}</td>
                        <td className="p-3 text-xs hidden md:table-cell">
                          {s.customer_name || <span className="text-muted-foreground">Walk-in</span>}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", paymentColors[s.payment_method] || "bg-muted text-muted-foreground")}>
                            {s.payment_method.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-xs tabular-nums">{fmt(s.total)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyles[s.status] ?? "bg-muted text-muted-foreground"}`}>
                            {s.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReprint(s); }}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="View Receipt"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(s); }}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="View Items"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row - sale items */}
                      {expandedId === s.id && (
                        <tr key={`${s.id}-expand`}>
                          <td colSpan={7} className="p-0">
                            <div className="bg-muted/20 px-6 py-3 border-b border-border">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Items in this sale</p>
                              {expandedItems.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Loading...</p>
                              ) : (
                                <div className="space-y-1">
                                  {expandedItems.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{Number(item.quantity)}×</span>
                                        <span className="font-medium">{item.product_name}</span>
                                      </div>
                                      <span className="font-semibold tabular-nums">
                                        {fmt(Number(item.total))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Footer */}
            <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{filtered.length} transactions</span>
              <span className="text-xs font-bold">Total: {fmt(stats.totalRevenue)}</span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
