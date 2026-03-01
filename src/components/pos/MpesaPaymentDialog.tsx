import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smartphone, Loader2, Clock, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import UnmatchedPayments from "./UnmatchedPayments";

interface MpesaPaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount: number;
  businessId: string;
  onPaymentConfirmed: (reference: string, method: "stk_push" | "till") => void;
}

export default function MpesaPaymentDialog({
  open, onOpenChange, amount, businessId, onPaymentConfirmed,
}: MpesaPaymentDialogProps) {
  const [tab, setTab] = useState<"stk" | "till">("stk");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [stkSent, setStkSent] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [stkStatus, setStkStatus] = useState<"pending" | "confirmed" | "failed" | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStkSent(false);
      setCheckoutRequestId(null);
      setStkStatus(null);
      setRetryCount(0);
    }
  }, [open]);

  // Poll STK status
  useEffect(() => {
    if (!stkSent || !checkoutRequestId || stkStatus === "confirmed" || stkStatus === "failed") return;

    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("mpesa-stk", {
          body: {
            action: "query",
            checkout_request_id: checkoutRequestId,
            business_id: businessId,
          },
        });
        if (data?.success) {
          setStkStatus("confirmed");
          onPaymentConfirmed(checkoutRequestId, "stk_push");
          toast.success("M-Pesa payment confirmed!");
          clearInterval(pollInterval);
        } else if (data?.result_code && data.result_code !== "0") {
          // Check if it's a timeout or user cancel vs still processing
          if (data.result_desc?.toLowerCase().includes("cancelled") || data.result_desc?.toLowerCase().includes("insufficient")) {
            setStkStatus("failed");
            toast.error(data.result_desc || "Payment failed");
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    // Timeout after 2 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (stkStatus === "pending") {
        setStkStatus("failed");
        toast.error("Payment timed out. Customer may not have responded.");
      }
    }, 120000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [stkSent, checkoutRequestId, stkStatus, businessId]);

  const handleSendSTK = async () => {
    if (!phone) { toast.error("Enter phone number"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-stk", {
        body: {
          action: "stk_push",
          phone,
          amount,
          account_reference: "POS Sale",
          business_id: businessId,
        },
      });

      if (error) throw error;
      if (data?.success) {
        setStkSent(true);
        setStkStatus("pending");
        setCheckoutRequestId(data.checkout_request_id);
        toast.success("STK Push sent! Customer should check their phone.");
      } else {
        toast.error(data?.error || "STK Push failed");
      }
    } catch (err: any) {
      toast.error(err.message || "M-Pesa error");
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySTK = () => {
    setRetryCount((c) => c + 1);
    setStkSent(false);
    setStkStatus(null);
    setCheckoutRequestId(null);
  };

  const handleMatchTillPayment = useCallback((txn: any) => {
    onPaymentConfirmed(txn.transaction_id, "till");
    toast.success(`Attached M-Pesa payment KSh ${txn.amount}`);
    onOpenChange(false);
  }, [onPaymentConfirmed, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> M-Pesa Payment
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-xs text-muted-foreground">Amount Due</p>
          <p className="text-2xl font-bold text-success">KSh {amount.toFixed(2)}</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "stk" | "till")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stk" className="text-xs gap-1">
              <Smartphone className="h-3.5 w-3.5" /> Send STK Push
            </TabsTrigger>
            <TabsTrigger value="till" className="text-xs gap-1">
              <Clock className="h-3.5 w-3.5" /> Wait for Till
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stk" className="space-y-3 mt-3">
            {!stkSent ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Phone Number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712345678 or 254712345678"
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    An STK Push prompt will be sent to this number
                  </p>
                </div>
                <Button
                  onClick={handleSendSTK}
                  disabled={loading}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Smartphone className="h-4 w-4 mr-2" />}
                  Send STK Push
                </Button>
                {retryCount > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center">Retry #{retryCount}</p>
                )}
              </>
            ) : (
              <div className="space-y-3 text-center py-2">
                {stkStatus === "pending" && (
                  <>
                    <div className="flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <p className="text-sm font-medium">Waiting for customer to approve...</p>
                    <p className="text-[10px] text-muted-foreground">
                      STK Push sent to {phone}. The customer should enter their M-Pesa PIN.
                    </p>
                  </>
                )}
                {stkStatus === "confirmed" && (
                  <>
                    <div className="flex justify-center">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <p className="text-sm font-medium text-success">Payment Confirmed!</p>
                  </>
                )}
                {stkStatus === "failed" && (
                  <>
                    <div className="flex justify-center">
                      <XCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-sm font-medium text-destructive">Payment Failed</p>
                    <Button variant="outline" size="sm" className="gap-1" onClick={handleRetrySTK}>
                      <RefreshCw className="h-3.5 w-3.5" /> Retry STK Push
                    </Button>
                  </>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="till" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Ask the customer to pay via M-Pesa to your Till number. Incoming payments will appear below automatically.
            </p>
            <UnmatchedPayments
              businessId={businessId}
              saleTotal={amount}
              onMatch={handleMatchTillPayment}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {stkStatus === "confirmed" ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
