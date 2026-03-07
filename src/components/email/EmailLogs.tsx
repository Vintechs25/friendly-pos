import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export default function EmailLogs() {
  const { profile } = useAuth();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["email-logs", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.business_id,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return "default" as const;
      case "failed":
      case "bounced":
        return "destructive" as const;
      case "queued":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Sent Email Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No emails sent yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {log.to_name ? `${log.to_name} (${log.to_email})` : log.to_email}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{log.email_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(log.status)} className="text-xs">{log.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.opened_at ? format(new Date(log.opened_at), "MMM d, HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
