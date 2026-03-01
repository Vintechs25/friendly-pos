import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, CreditCard, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface PaymentConfigCardProps {
  businessId: string;
}

export default function PaymentConfigCard({ businessId }: PaymentConfigCardProps) {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["payment-configs", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_payment_configs")
        .select("*")
        .eq("business_id", businessId);
      return data ?? [];
    },
  });

  const mpesaConfig = configs?.find((c: any) => c.payment_type === "mpesa");

  const [mpesa, setMpesa] = useState({
    shortcode: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    till_number: "",
    environment: "sandbox",
    is_active: false,
  });

  // Sync state from loaded config
  const [initialized, setInitialized] = useState(false);
  if (mpesaConfig && !initialized) {
    setMpesa({
      shortcode: mpesaConfig.shortcode || "",
      consumer_key: mpesaConfig.consumer_key || "",
      consumer_secret: mpesaConfig.consumer_secret || "",
      passkey: mpesaConfig.passkey || "",
      till_number: mpesaConfig.till_number || "",
      environment: mpesaConfig.environment || "sandbox",
      is_active: mpesaConfig.is_active ?? false,
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId,
        payment_type: "mpesa" as const,
        shortcode: mpesa.shortcode || null,
        consumer_key: mpesa.consumer_key || null,
        consumer_secret: mpesa.consumer_secret || null,
        passkey: mpesa.passkey || null,
        till_number: mpesa.till_number || null,
        environment: mpesa.environment,
        is_active: mpesa.is_active,
      };

      if (mpesaConfig) {
        const { error } = await supabase
          .from("business_payment_configs")
          .update(payload)
          .eq("id", mpesaConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_payment_configs")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("M-Pesa configuration saved");
      queryClient.invalidateQueries({ queryKey: ["payment-configs", businessId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" /> Payment Integrations
        </CardTitle>
        <CardDescription>
          Configure M-Pesa and card payment settings for your business.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* M-Pesa Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-success" />
              <Label className="font-semibold">M-Pesa (Daraja API)</Label>
            </div>
            <Switch
              checked={mpesa.is_active}
              onCheckedChange={(v) => setMpesa((p) => ({ ...p, is_active: v }))}
            />
          </div>

          {mpesa.is_active && (
            <div className="grid gap-3 md:grid-cols-2 pl-6 border-l-2 border-success/20">
              <div className="space-y-1.5">
                <Label className="text-xs">Environment</Label>
                <Select value={mpesa.environment} onValueChange={(v) => setMpesa((p) => ({ ...p, environment: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production (Live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Business Shortcode</Label>
                <Input className="h-9" value={mpesa.shortcode} onChange={(e) => setMpesa((p) => ({ ...p, shortcode: e.target.value }))} placeholder="174379" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Till Number (Buy Goods)</Label>
                <Input className="h-9" value={mpesa.till_number} onChange={(e) => setMpesa((p) => ({ ...p, till_number: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Consumer Key</Label>
                  <button onClick={() => setShowSecrets(!showSecrets)} className="text-muted-foreground hover:text-foreground">
                    {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Input className="h-9" type={showSecrets ? "text" : "password"} value={mpesa.consumer_key} onChange={(e) => setMpesa((p) => ({ ...p, consumer_key: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Consumer Secret</Label>
                <Input className="h-9" type={showSecrets ? "text" : "password"} value={mpesa.consumer_secret} onChange={(e) => setMpesa((p) => ({ ...p, consumer_secret: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Passkey</Label>
                <Input className="h-9" type={showSecrets ? "text" : "password"} value={mpesa.passkey} onChange={(e) => setMpesa((p) => ({ ...p, passkey: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* Card Terminal Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <Label className="font-semibold">Card Payments</Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Card payments are processed via external terminals. The POS sends the amount to the terminal, which handles card processing. No card details are stored in the system.
          </p>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? "Saving..." : "Save Payment Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
