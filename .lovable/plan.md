
# Enterprise POS System - Phased Implementation Plan

This plan organizes all 15 feature categories into 6 implementation phases, prioritized by business criticality. Each phase builds on the previous one.

---

## Phase 1: POS Transaction Engine (Core Revenue Flow)

**Why first**: Without robust transaction handling, the system can't process sales properly.

### 1A. Enhanced Cart Operations
- **Item discount**: Per-item percentage or fixed discount with permission check
- **Cart discount**: Whole-cart percentage or fixed discount
- **Void item**: Remove item from cart with audit log entry
- **Void entire sale**: Cancel a completed sale (status -> "voided"), log reason
- **Price override**: Allow editing unit price in cart (requires `manager` or `business_owner` role)
- **Category filter**: Add category tabs/dropdown above product grid for quick filtering
- **Hold/Resume transaction**: "Park" a cart to a `held_sales` table, resume later
- **Quantity edit**: Direct input field for quantity (not just +/- buttons)

### 1B. Split Payments
- Allow selecting multiple payment methods for one sale
- Cash amount input with automatic change calculation
- Record multiple entries in the `payments` table per sale
- Show payment breakdown on receipt

### Database Changes
- Add `held_sales` and `held_sale_items` tables for parked transactions
- Add `voided_at`, `voided_by`, `void_reason` columns to `sales` table
- Add `price_override`, `override_by` columns to `sale_items` table

---

## Phase 2: Payment System (M-Pesa + Store Credit)

### 2A. Payment Methods Expansion
- Add payment types: `bank_transfer`, `store_credit`, `gift_card` to the `payment_method_type` enum
- M-Pesa STK Push integration via edge function (requires Daraja API key)
- Till confirmation number input for M-Pesa payments
- Payment status tracking: `pending`, `confirmed`, `failed`
- Failed payment handling with retry option

### 2B. Store Credit & Gift Cards
- Add `gift_cards` table (code, balance, business_id, is_active, expires_at)
- Store credit deduction from `customers.credit_balance`
- Gift card lookup by code, balance check, partial redemption

### 2C. Cash Management Enhancement
- Change calculation display in POS checkout
- Safe drop recording during shift (partial cash removal to safe)
- Add `safe_drops` table linked to `cashier_shifts`

### Database Changes
- Extend `payment_method_type` enum
- Create `gift_cards` table
- Create `safe_drops` table
- Add `payment_status` column to `payments` table

---

## Phase 3: Inventory & Product Enhancements

### 3A. Product Variants & Extended Fields
- Add `product_variants` table (product_id, variant_name, variant_value, sku, barcode, price_adjustment, stock)
- Support size, color, weight variants
- Expiry date and batch number fields on products
- Serial number tracking for electronics
- Minimum price field (floor price for discounts)

### 3B. Inventory Operations
- Stock adjustment with reason codes (damage, theft, count correction)
- Stock transfer between branches (already has `stock_transfers` table -- build UI)
- Purchase order management UI (table exists -- build the page)
- Supplier management UI (table exists -- build the page)
- Bulk CSV import for products
- Inventory valuation report (cost-based)

### 3C. Damaged Goods
- Add `stock_adjustments` table (product_id, branch_id, quantity, reason, adjusted_by)
- Damaged goods workflow: record damage -> adjust stock -> log audit

### Database Changes
- Create `product_variants` table
- Create `stock_adjustments` table
- Add `expiry_date`, `batch_number`, `serial_number`, `minimum_price` columns to `products`

---

## Phase 4: User Roles, Permissions & Audit

### 4A. Granular Permissions System
- Create `permissions` table mapping roles to specific actions
- Actions: `price_edit`, `refund_authorize`, `discount_limit`, `report_view`, `shift_close`, `void_sale`
- Per-role discount limits (e.g., cashier max 10%, manager max 50%)
- UI in Settings for business owners to configure role permissions

### 4B. Enhanced Audit Logging
- Refund log with full details
- Voided sales log
- Price override log
- Login activity tracking (record login/logout events)
- Anti-date manipulation: server-side timestamp enforcement (already using `now()` defaults)

### 4C. User Management Page
- List all users in business with their roles
- Invite new users (send signup link)
- Assign/change roles
- Auditor role: read-only access to reports and audit logs

### Database Changes
- Create `permissions` table
- Create `login_activity` table
- Add `discount_limit` column to role permissions

---

## Phase 5: Reporting, Promotions & CRM

### 5A. Expanded Reports
- Hourly sales heatmap
- Monthly/yearly trend views
- Sales by branch breakdown
- Profit margin per item (using cost vs price)
- Financial reports: revenue, gross profit, expenses, tax summary
- Payment method breakdown chart
- Audit reports tab: refunds, voids, overrides
- Export to CSV for all report types

### 5B. Promotions Engine
- Create `promotions` table (type, conditions, discount_value, start_date, end_date, is_active)
- Promotion types: BOGO, bundle pricing, category discount, time-based/happy hour
- Coupon codes with usage limits
- Auto-apply matching promotions at checkout
- Gift voucher generation and redemption

### 5C. Customer CRM Enhancements
- Customer segmentation by spending tier
- Loyalty point earn/redeem rules
- Credit limit management
- Account statements (PDF/printable)
- Customer purchase frequency analytics

### Database Changes
- Create `promotions` table
- Create `coupon_codes` table
- Create `loyalty_rules` table
- Add `credit_limit` column to `customers`

---

## Phase 6: Advanced & Enterprise Features

### 6A. Multi-Branch Dashboard
- Central admin view showing all branches side-by-side
- Branch-level inventory comparison
- Branch performance ranking
- Consolidated reporting across branches

### 6B. Compliance & Accounting
- Tax configuration page (multiple tax rates, exemptions)
- VAT report generation
- Sequential invoice numbering system
- Financial year management
- Audit export (downloadable report pack)

### 6C. AI & Smart Features (using Lovable AI)
- AI restock suggestions based on sales velocity
- Demand forecasting using historical data
- Staff performance ranking
- Fraud detection alerts (unusual voids, refunds, discounts)
- Sales hour heatmap

### 6D. Mobile & Alerts
- Manager dashboard optimized for mobile
- Real-time low stock alerts via toast notifications
- Sales milestone notifications
- End-of-day summary auto-generation

### 6E. Hardware Notes
- Barcode scanner: already supported (USB/Bluetooth via keyboard wedge)
- Receipt printer: browser print API (already implemented)
- Cash drawer: triggered via receipt printer ESC/POS commands
- Weight scale, customer display, label printer: require native driver bridges (out of scope for web app, noted for future native wrapper)

---

## Technical Summary

| Phase | New Tables | New Pages | Estimated Scope |
|-------|-----------|-----------|-----------------|
| 1 | 2 (held_sales, held_sale_items) | 0 (enhance POSPage) | POS cart enhancements, split pay |
| 2 | 2 (gift_cards, safe_drops) | 0 (enhance POSPage, ShiftsPage) | Payment methods, M-Pesa, credits |
| 3 | 2 (product_variants, stock_adjustments) | 3 (Suppliers, PurchaseOrders, StockTransfer) | Inventory depth |
| 4 | 2 (permissions, login_activity) | 1 (UserManagement) | Roles, permissions, audit |
| 5 | 3 (promotions, coupon_codes, loyalty_rules) | 1 (Promotions) | Reports, promotions, CRM |
| 6 | 0-1 | 2 (Compliance, AIInsights) | Enterprise features |

Each phase is self-contained and deployable independently. Phase 1 should be implemented first as it directly impacts daily POS operations.
