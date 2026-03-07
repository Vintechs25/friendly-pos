import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EmailComposeProps {
  onSent?: () => void;
  defaultTo?: string;
  defaultSubject?: string;
}

export default function EmailCompose({ onSent, defaultTo, defaultSubject }: EmailComposeProps) {
  const { profile } = useAuth();
  const [to, setTo] = useState(defaultTo || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [emailType, setEmailType] = useState("transactional");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error("Please fill in To, Subject, and Body");
      return;
    }
    if (!fromEmail) {
      toast.error("Please enter a From email address");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          action: "send_single",
          to: to.split(",").map((e) => e.trim()),
          subject,
          html: `<div style="font-family:sans-serif;line-height:1.6">${body.replace(/\n/g, "<br/>")}</div>`,
          text: body,
          from_email: fromEmail,
          from_name: fromName || undefined,
          email_type: emailType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Email sent successfully!");
      setTo("");
      setSubject("");
      setBody("");
      onSent?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" /> Compose Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Email *</Label>
            <Input
              placeholder="noreply@yourdomain.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              placeholder="Your Business Name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>To * (comma-separated for multiple)</Label>
          <Input
            placeholder="customer@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={emailType} onValueChange={setEmailType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Message *</Label>
          <Textarea
            placeholder="Type your message here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
        </div>

        <Button onClick={handleSend} disabled={sending} className="w-full sm:w-auto">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Email
        </Button>
      </CardContent>
    </Card>
  );
}
