import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Calendar, User } from "lucide-react";

interface CreditSaleDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  customerName?: string;
  onConfirm: (dueDate: string, notes: string) => void;
}

export default function CreditSaleDialog({
  open,
  onOpenChange,
  total,
  customerName,
  onConfirm,
}: CreditSaleDialogProps) {
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Credit Sale (Pay Later)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Amount on Credit</p>
            <p className="text-2xl font-black text-primary tabular-nums">
              KSh {total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
            </p>
            {customerName && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <User className="h-3 w-3" /> {customerName}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Due Date
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Will pay on Friday"
              className="h-16 text-sm resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onConfirm(dueDate, notes); onOpenChange(false); }}>
            Confirm Credit Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
