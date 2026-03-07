import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, Inbox, Megaphone, FileText } from "lucide-react";
import EmailCompose from "@/components/email/EmailCompose";
import EmailInbox from "@/components/email/EmailInbox";
import EmailCampaigns from "@/components/email/EmailCampaigns";
import EmailLogs from "@/components/email/EmailLogs";

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email</h1>
            <p className="text-sm text-muted-foreground">Send, receive, and manage emails</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="h-4 w-4" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="compose" className="gap-1.5">
              <Send className="h-4 w-4" /> Compose
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="h-4 w-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <FileText className="h-4 w-4" /> Sent Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox">
            <EmailInbox />
          </TabsContent>
          <TabsContent value="compose">
            <EmailCompose onSent={() => setActiveTab("logs")} />
          </TabsContent>
          <TabsContent value="campaigns">
            <EmailCampaigns />
          </TabsContent>
          <TabsContent value="logs">
            <EmailLogs />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
