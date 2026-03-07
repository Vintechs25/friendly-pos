import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, Plus, Send, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function EmailCampaigns() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["email-campaigns", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.business_id,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-email", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("business_id", profile.business_id)
        .not("email", "is", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.business_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.business_id) throw new Error("No business");
      const { error } = await supabase.from("email_campaigns").insert({
        business_id: profile.business_id,
        subject,
        body_html: `<div style="font-family:sans-serif;line-height:1.6">${bodyHtml.replace(/\n/g, "<br/>")}</div>`,
        from_email: fromEmail,
        from_name: fromName,
        created_by: profile.id,
        total_recipients: customers.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      setCreateOpen(false);
      setSubject("");
      setBodyHtml("");
      toast.success("Campaign created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendCampaign = async (campaign: any) => {
    if (customers.length === 0) {
      toast.error("No customers with email addresses found");
      return;
    }

    setSendingId(campaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          action: "send_bulk",
          campaign_id: campaign.id,
          recipients: customers.map((c: any) => ({ email: c.email, name: c.name })),
          subject: campaign.subject,
          html: campaign.body_html,
          from_email: campaign.from_email || fromEmail,
          from_name: campaign.from_name || fromName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Campaign sent! ${data.total_sent} delivered, ${data.total_failed} failed`);
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send campaign");
    } finally {
      setSendingId(null);
    }
  };

  const statusColor = (status: string) => {
    if (status === "sent") return "default";
    if (status === "draft") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Email Campaigns
        </CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>From Email *</Label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@yourdomain.com" />
                </div>
                <div className="space-y-1">
                  <Label>From Name</Label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Business Name" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Subject *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Campaign subject" />
              </div>
              <div className="space-y-1">
                <Label>Message *</Label>
                <Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={8} placeholder="Type your campaign message..." />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Will be sent to {customers.length} customers with email addresses
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!subject || !bodyHtml || !fromEmail || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No campaigns yet. Create your first email campaign!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent / Failed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.total_recipients}</TableCell>
                  <TableCell>
                    {c.total_sent} / {c.total_failed}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendCampaign(c)}
                        disabled={sendingId === c.id}
                      >
                        {sendingId === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Send
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
