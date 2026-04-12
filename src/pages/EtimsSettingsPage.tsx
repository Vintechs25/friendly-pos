import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Shield, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface EtimsTransaction {
  id: string;
  sale_id: string;
  invoice_number: string | null;
  control_code: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  retry_count: number;
}

export default function EtimsSettingsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  const [kraPin, setKraPin] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Load settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["etims-settings", businessId],
    queryFn: async () => {
      if (!businessId) return null;
      const { data } = await supabase
        .from("etims_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();
      return data;
    },
    enabled: !!businessId,
  });

  // Load recent transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["etims-transactions", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data } = await supabase
        .from("etims_transactions")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as EtimsTransaction[];
    },
    enabled: !!businessId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (settings) {
      setKraPin(settings.kra_pin || "");
      setDeviceId(settings.device_id || "");
      setApiUsername(settings.api_username || "");
      setApiPassword(settings.api_password || "");
      setEnvironment(settings.environment || "sandbox");
      setIsActive(settings.is_active || false);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      const payload = {
        business_id: businessId,
        kra_pin: kraPin.trim(),
        device_id: deviceId.trim(),
        api_username: apiUsername.trim() || null,
        api_password: apiPassword.trim() || null,
        environment,
        is_active: isActive,
      };

      if (settings) {
        await supabase.from("etims_settings").update(payload).eq("id", settings.id);
      } else {
        await supabase.from("etims_settings").insert(payload);
      }

      queryClient.invalidateQueries({ queryKey: ["etims-settings"] });
      toast.success("eTIMS settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const retrySubmission = async (tx: EtimsTransaction) => {
    setRetrying(tx.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("etims-submit", {
        body: { sale_id: tx.sale_id },
      });
      if (res.error) throw new Error(res.error.message);
      queryClient.invalidateQueries({ queryKey: ["etims-transactions"] });
      toast.success("Retry submitted");
    } catch (err: any) {
      toast.error(err.message || "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  const pendingCount = transactions.filter(t => t.status === "pending" || t.status === "failed").length;
  const sentCount = transactions.filter(t => t.status === "sent").length;

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending": return <Clock className="h-4 w-4 text-accent-foreground" />;
      default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> eTIMS Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure KRA eTIMS fiscal compliance for automatic invoice submission
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{sentCount}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-accent-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending / Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{transactions.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">KRA Configuration</CardTitle>
            <CardDescription>Enter your eTIMS credentials from KRA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="kraPin">KRA PIN</Label>
                <Input id="kraPin" placeholder="e.g. P051234567X" value={kraPin} onChange={e => setKraPin(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deviceId">eTIMS Device ID</Label>
                <Input id="deviceId" placeholder="Device serial number" value={deviceId} onChange={e => setDeviceId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apiUser">API Username</Label>
                <Input id="apiUser" placeholder="eTIMS API username" value={apiUsername} onChange={e => setApiUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apiPass">API Password</Label>
                <Input id="apiPass" type="password" placeholder="eTIMS API password" value={apiPassword} onChange={e => setApiPassword(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production (Live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Enable eTIMS auto-submission</Label>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || !kraPin.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Transaction Log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Submissions</CardTitle>
            <CardDescription>eTIMS invoice submission history</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      {statusIcon(tx.status)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium font-mono truncate">{tx.invoice_number || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {tx.control_code && <span className="ml-2">CC: {tx.control_code}</span>}
                        </p>
                        {tx.error_message && (
                          <p className="text-xs text-destructive truncate">{tx.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={tx.status === "sent" ? "default" : tx.status === "failed" ? "destructive" : "secondary"}>
                        {tx.status}
                      </Badge>
                      {(tx.status === "failed" || tx.status === "pending") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => retrySubmission(tx)}
                          disabled={retrying === tx.id}
                        >
                          {retrying === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
