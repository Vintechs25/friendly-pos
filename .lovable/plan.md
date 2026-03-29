

## POS System Rating: 7.5/10

**Strengths**: Split-panel layout, barcode scanning, offline mode, split payments, M-Pesa integration, held sales, shift management, gift cards, loyalty points.

**Weaknesses**: No keyboard shortcuts for speed, numeric keypad always visible eating cart space, no last-sale quick-reprint, no order notes, no stock count on product tiles, payment section too tall, no fullscreen mode, cart empty state too large, no audio/haptic feedback on add-to-cart.

---

## Recommended Improvements

### 1. Keyboard shortcuts for power users
Add hotkeys: `F1`=Cash, `F2`=Card, `F3`=M-Pesa, `F4`=Hold, `F8`=Void, `Enter`=Complete Sale, `Esc`=Clear search. Display a small `?` button in the status bar showing the shortcut map.

### 2. Collapsible numeric keypad
Only show the numeric keypad when cash is selected AND the user taps the amount display. Default to showing just the quick-cash buttons to save vertical space. This reclaims ~250px of cart height.

### 3. Stock quantity badges on product tiles
Show remaining stock count as a small badge (e.g., "3 left") on product tiles when stock is below a threshold (e.g., 10). Helps cashiers warn customers about limited availability.

### 4. Order notes field
Add a small "Add note" button in the cart header that expands an input for order-level notes (e.g., "Gift wrap", "Customer will pick up later"). Saved with the sale record.

### 5. Last sale quick-reprint
After completing a sale, show a small toast with "Reprint Receipt" action. Also add a "Last Receipt" button in the status bar that opens the most recent receipt.

### 6. Compact empty cart state
Reduce the empty cart padding from `py-16` to `py-8` and use a single line instead of two lines + large icon.

### 7. Fullscreen toggle
Add an expand button in the POS status bar to toggle browser fullscreen mode — essential for dedicated POS terminals/tablets.

### 8. Better visual feedback on add-to-cart
Brief green flash/pulse animation on the cart header badge when items are added. Currently only a toast appears which is easy to miss.

---

## Technical Changes

| File | Change |
|------|--------|
| `src/pages/POSPage.tsx` | Add `useEffect` for keyboard shortcuts, order notes state, last-receipt state, cart-add animation |
| `src/components/pos/ProductGrid.tsx` | Add low-stock badge on tiles |
| `src/components/pos/SplitPaymentPanel.tsx` | Make NumericKeypad collapsible (show/hide toggle), default to collapsed |
| `src/components/pos/POSLayout.tsx` | Add fullscreen toggle button, keyboard shortcut help dialog, last-receipt button |
| `src/components/pos/CartItemRow.tsx` | No changes needed |
| `src/components/pos/NumericKeypad.tsx` | No changes needed |
| New: `src/components/pos/KeyboardShortcutsHelp.tsx` | Small dialog listing all shortcuts |

**Database**: Add `notes` column to `sales` table (nullable text) via migration.

All changes are additive — no existing functionality is removed or rebuilt.

