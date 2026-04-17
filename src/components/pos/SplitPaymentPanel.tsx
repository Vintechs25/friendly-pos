import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Banknote, CreditCard, Smartphone, Plus, Trash2, Calculator,
  Wallet, Gift, Search, Loader2,
} from "lucide-react";
import NumericKeypad from "./NumericKeypad";
import { PaymentEntry, PaymentMethod } from "./types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MpesaPaymentDialog from "./MpesaPaymentDialog";

const methodIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-4 w-4" />,
  card: <CreditCard className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  store_credit: <Wallet className="h-4 w-4" />,
  gift_card: <Gift className="h-4 w-4" />,
};

const methodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "M-Pesa",
  store_credit: "Credit",
  gift_card: "Gift Card",
};

interface SplitPaymentPanelProps {
  total: number;
  payments: PaymentEntry[];
  onPaymentsChange: (payments: PaymentEntry[]) => void;
  splitMode: boolean;
  onToggleSplit: () => void;
  cashTendered: number;
  onCashTenderedChange: (v: number) => void;
  businessId: string | null;
  customerId?: string | null;
  customerCreditBalance?: number;
  mpesaEnabled?: boolean;
  cardEnabled?: boolean;
  giftCardsEnabled?: boolean;
  storeCreditEnabled?: boolean;
}

export default function SplitPaymentPanel({
  total,
  payments,
  onPaymentsChange,
  splitMode,
  onToggleSplit,
  cashTendered,
  onCashTenderedChange,
  businessId,
  customerId,
  customerCreditBalance = 0,
  mpesaEnabled = true,
  cardEnabled = true,
  giftCardsEnabled = true,
  storeCreditEnabled = true,
}: SplitPaymentPanelProps) {
  const [showMpesaDialog, setShowMpesaDialog] = useState(false);
  const [showGiftCardDialog, setShowGiftCardDialog] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardId, setGiftCardId] = useState<string | null>(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);

  const allocated = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - allocated);
  const hasCash = payments.some((p) => p.method === "cash");
  const cashEntry = payments.find((p) => p.method === "cash");
  const changeAmount = hasCash && cashTendered > 0
    ? Math.max(0, cashTendered - (cashEntry?.amount ?? 0))
    : 0;

  const handleMpesaConfirmed = (reference: string, _method: "stk_push" | "till") => {
    if (!splitMode) {
      onPaymentsChange([{ method: "mobile_money", amount: total, reference }]);
    } else {
      const updated = payments.map((p) =>
        p.method === "mobile_money" ? { ...p, reference } : p
      );
      onPaymentsChange(updated);
    }
    setShowMpesaDialog(false);
  };

  const lookupGiftCard = async () => {
    if (!giftCardCode || !businessId) return;
    setGiftCardLoading(true);
    const { data, error } = await supabase
      .from("gift_cards")
      .select("id, balance, is_active, expires_at")
      .eq("business_id", businessId)
      .eq("code", giftCardCode.toUpperCase())
      .single();

    if (error || !data) {
      toast.error("Gift card not found");
      setGiftCardBalance(null);
      setGiftCardId(null);
    } else if (!data.is_active) {
      toast.error("Gift card is inactive");
      setGiftCardBalance(null);
    } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error("Gift card has expired");
      setGiftCardBalance(null);
    } else {
      setGiftCardBalance(data.balance);
      setGiftCardId(data.id);
    }
    setGiftCardLoading(false);
  };

  const applyGiftCard = () => {
    if (giftCardBalance === null || giftCardBalance <= 0) return;
    const useAmount = Math.min(giftCardBalance, splitMode ? remaining : total);
    if (splitMode) {
      onPaymentsChange([...payments, { method: "gift_card", amount: useAmount, reference: giftCardCode.toUpperCase() }]);
    } else {
      onPaymentsChange([{ method: "gift_card", amount: useAmount, reference: giftCardCode.toUpperCase() }]);
    }
    setShowGiftCardDialog(false);
    setGiftCardCode("");
    setGiftCardBalance(null);
    toast.success(`Gift card applied: KSh ${useAmount.toFixed(2)}`);
  };

  const applyStoreCredit = () => {
    if (!customerId || customerCreditBalance <= 0) {
      toast.error("No store credit available for this customer");
      return;
    }
    const useAmount = Math.min(customerCreditBalance, splitMode ? remaining : total);
    if (splitMode) {
      onPaymentsChange([...payments, { method: "store_credit", amount: useAmount }]);
    } else {
      onPaymentsChange([{ method: "store_credit", amount: useAmount }]);
    }
    toast.success(`Store credit applied: KSh ${useAmount.toFixed(2)}`);
  };

  const selectMethod = (m: PaymentMethod) => {
    if (m === "mobile_money") {
      if (!splitMode) onPaymentsChange([{ method: m, amount: total }]);
      setShowMpesaDialog(true);
      return;
    }
    if (m === "gift_card") {
      setShowGiftCardDialog(true);
      return;
    }
    if (m === "store_credit") {
      applyStoreCredit();
      return;
    }
    onPaymentsChange([{ method: m, amount: total }]);
  };

  const allMethods: PaymentMethod[] = ["cash", "card", "mobile_money", "store_credit", "gift_card"];

  if (!splitMode) {
    const selectedMethod = payments[0]?.method ?? "cash";

    const methodStyles: Record<PaymentMethod, string> = {
      cash: "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20",
      card: "bg-accent text-accent-foreground border-accent shadow-md shadow-accent/20",
      mobile_money: "bg-[hsl(145,63%,42%)] text-white border-[hsl(145,63%,42%)] shadow-md shadow-[hsl(145,63%,42%)]/25",
      store_credit: "bg-secondary text-secondary-foreground border-secondary",
      gift_card: "bg-[hsl(38,92%,50%)] text-white border-[hsl(38,92%,50%)] shadow-md shadow-[hsl(38,92%,50%)]/20",
    };

    const primaryRow = (["cash", "card", "mobile_money"] as PaymentMethod[]).filter((m) => {
      if (m === "card" && !cardEnabled) return false;
      if (m === "mobile_money" && !mpesaEnabled) return false;
      return true;
    });
    const secondaryRow = (["store_credit", "gift_card"] as PaymentMethod[]).filter((m) => {
      if (m === "store_credit" && !storeCreditEnabled) return false;
      if (m === "gift_card" && !giftCardsEnabled) return false;
      return true;
    });

    return (
      <div className="space-y-2.5">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, primaryRow.length)}, minmax(0, 1fr))` }}
        >
          {primaryRow.map((m) => (
            <button
              key={m}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 touch-manipulation active:scale-95 transition-all font-semibold",
                selectedMethod === m
                  ? methodStyles[m]
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
              )}
              onClick={() => selectMethod(m)}
            >
              {methodIcons[m]}
              <span className="text-[10px] leading-tight font-bold">{methodLabels[m]}</span>
            </button>
          ))}
        </div>
        {secondaryRow.length > 0 && (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${secondaryRow.length}, minmax(0, 1fr))` }}
          >
            {secondaryRow.map((m) => (
              <button
                key={m}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border-2 touch-manipulation active:scale-95 transition-all text-[10px] font-semibold",
                  selectedMethod === m
                    ? methodStyles[m]
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                )}
                onClick={() => selectMethod(m)}
              >
                {methodIcons[m]}
                <span>{methodLabels[m]}</span>
              </button>
            ))}
          </div>
        )}

        {selectedMethod === "cash" && (
          <div className="space-y-1">
            <button
              onClick={() => setShowKeypad((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calculator className="h-3 w-3" />
              {showKeypad ? "Hide keypad" : "Show keypad"}
            </button>
            {showKeypad && (
              <NumericKeypad
                value={cashTendered}
                onChange={onCashTenderedChange}
                total={total}
              />
            )}
          </div>
        )}

        {selectedMethod === "mobile_money" && payments[0]?.reference && (
          <p className="text-xs text-muted-foreground">
            STK Push sent. Till confirmation pending...
          </p>
        )}

        <Button variant="ghost" size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg" onClick={onToggleSplit}>
          <Calculator className="h-3.5 w-3.5" /> Split Payment
        </Button>

        {/* M-Pesa Dialog */}
        {businessId && (
          <MpesaPaymentDialog
            open={showMpesaDialog}
            onOpenChange={setShowMpesaDialog}
            amount={total}
            businessId={businessId}
            onPaymentConfirmed={handleMpesaConfirmed}
          />
        )}

        {/* Gift Card Dialog */}
        <GiftCardDialog
          open={showGiftCardDialog}
          onOpenChange={setShowGiftCardDialog}
          code={giftCardCode}
          onCodeChange={setGiftCardCode}
          balance={giftCardBalance}
          loading={giftCardLoading}
          onLookup={lookupGiftCard}
          onApply={applyGiftCard}
        />
      </div>
    );
  }

  // Split payment mode
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Split Payment</Label>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onToggleSplit}>
          Cancel Split
        </Button>
      </div>

      {payments.map((entry, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex gap-0.5 shrink-0">
            {allMethods.map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (m === "mobile_money") { setShowMpesaDialog(true); }
                  if (m === "gift_card") { setShowGiftCardDialog(true); return; }
                  if (m === "store_credit") { applyStoreCredit(); return; }
                  const updated = [...payments];
                  updated[i] = { ...updated[i], method: m };
                  onPaymentsChange(updated);
                }}
                className={`h-6 w-6 rounded flex items-center justify-center ${
                  entry.method === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="scale-75">{methodIcons[m]}</span>
              </button>
            ))}
          </div>
          <Input
            type="number"
            value={entry.amount || ""}
            onChange={(e) => {
              const updated = [...payments];
              updated[i] = { ...updated[i], amount: parseFloat(e.target.value) || 0 };
              onPaymentsChange(updated);
            }}
            className="h-7 text-sm flex-1"
            min="0"
            step="0.01"
          />
          <span className="text-[9px] text-muted-foreground w-10 truncate">{methodLabels[entry.method]}</span>
          {payments.length > 1 && (
            <button
              onClick={() => onPaymentsChange(payments.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {remaining > 0 && (
        <p className="text-xs text-destructive">Remaining: KSh {remaining.toFixed(2)}</p>
      )}
      {remaining <= 0 && allocated >= total && (
        <p className="text-xs text-success">Fully allocated ✓</p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs gap-1"
        onClick={() =>
          onPaymentsChange([...payments, { method: "cash", amount: remaining }])
        }
      >
        <Plus className="h-3 w-3" /> Add Payment Method
      </Button>

      {hasCash && (
        <NumericKeypad
          value={cashTendered}
          onChange={onCashTenderedChange}
          total={cashEntry?.amount ?? total}
        />
      )}

      {/* M-Pesa Dialog */}
      {businessId && (
        <MpesaPaymentDialog
          open={showMpesaDialog}
          onOpenChange={setShowMpesaDialog}
          amount={payments.find((p) => p.method === "mobile_money")?.amount ?? remaining}
          businessId={businessId}
          onPaymentConfirmed={handleMpesaConfirmed}
        />
      )}

      {/* Gift Card Dialog */}
      <GiftCardDialog
        open={showGiftCardDialog}
        onOpenChange={setShowGiftCardDialog}
        code={giftCardCode}
        onCodeChange={setGiftCardCode}
        balance={giftCardBalance}
        loading={giftCardLoading}
        onLookup={lookupGiftCard}
        onApply={applyGiftCard}
      />
    </div>
  );
}

// Gift Card Dialog
function GiftCardDialog({
  open, onOpenChange, code, onCodeChange, balance, loading, onLookup, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
  onCodeChange: (v: string) => void;
  balance: number | null;
  loading: boolean;
  onLookup: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Gift Card Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
              placeholder="Enter gift card code"
              className="h-9 flex-1 font-mono"
            />
            <Button onClick={onLookup} disabled={loading || !code} size="sm" className="h-9">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {balance !== null && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-primary">KSh {balance.toFixed(2)}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onApply} disabled={balance === null || balance <= 0}>
            Apply Gift Card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
