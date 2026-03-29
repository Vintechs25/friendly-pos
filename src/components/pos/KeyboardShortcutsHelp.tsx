import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const shortcuts = [
  { key: "F1", action: "Cash payment" },
  { key: "F2", action: "Card payment" },
  { key: "F3", action: "M-Pesa payment" },
  { key: "F4", action: "Hold sale" },
  { key: "F8", action: "Void sale" },
  { key: "Enter", action: "Complete sale" },
  { key: "Esc", action: "Clear search" },
  { key: "F11", action: "Toggle fullscreen" },
];

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.action}</span>
              <kbd className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono font-semibold border border-border">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
