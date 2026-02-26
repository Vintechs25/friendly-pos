

# SwiftPOS -- Full Architecture Plan

## Overview

A complete, multi-tenant POS SaaS platform built on Lovable Cloud (Supabase). This plan covers the full database schema, module architecture, and phased implementation roadmap.

---

## Phase 1: Foundation (Backend + Auth + Multi-Tenancy)

### 1.1 Enable Lovable Cloud
- Spin up the backend (database, auth, edge functions, storage)

### 1.2 Database Schema -- Core Tables

```text
+------------------+     +------------------+     +------------------+
|   businesses     |     |    branches      |     |   user_roles     |
|------------------|     |------------------|     |------------------|
| id (PK)          |<--->| business_id (FK) |     | user_id (FK)     |
| name             |     | name             |     | role (enum)      |
| industry         |     | address, phone   |     | business_id (FK) |
| subscription_plan|     | is_active        |     | branch_id (FK)   |
| trial_ends_at    |     +------------------+     +------------------+
| is_active        |
| settings (JSONB) |
+------------------+
         |
         v
+------------------+     +------------------+     +------------------+
|    profiles      |     |    products      |     |   categories     |
|------------------|     |------------------|     |------------------|
| id (FK auth)     |     | business_id (FK) |     | business_id (FK) |
| business_id (FK) |     | name, sku        |     | name             |
| full_name        |     | category_id (FK) |     +------------------+
| phone            |     | price, cost      |
+------------------+     | tax_rate         |
                         | barcode          |
                         | track_inventory  |
                         | is_active        |
                         +------------------+
                                |
         +----------------------+----------------------+
         v                                             v
+------------------+                          +------------------+
|   inventory      |                          |     sales        |
|------------------|                          |------------------|
| product_id (FK)  |                          | business_id (FK) |
| branch_id (FK)   |                          | branch_id (FK)   |
| quantity         |                          | cashier_id (FK)  |
| reorder_level    |                          | customer_id (FK) |
+------------------+                          | total, tax, disc |
                                              | payment_method   |
                                              | status           |
                                              | receipt_number   |
                                              +------------------+
                                                       |
                                              +------------------+
                                              |   sale_items     |
                                              |------------------|
                                              | sale_id (FK)     |
                                              | product_id (FK)  |
                                              | quantity, price  |
                                              | discount         |
                                              +------------------+
```

**Additional tables:**
- `suppliers` -- supplier records per business
- `purchase_orders` / `purchase_order_items` -- procurement
- `stock_transfers` -- inter-branch transfers
- `customers` -- customer registry with loyalty points and credit balance
- `expenses` -- expense tracking per business/branch
- `audit_logs` -- all critical actions logged
- `subscription_plans` -- plan definitions (for Super Admin)
- `payments` -- payment records supporting split payments
- `feature_toggles` -- per-business module enablement

### 1.3 Role System
- Enum: `super_admin`, `business_owner`, `manager`, `cashier`, `waiter`, `inventory_officer`
- `user_roles` table (separate from profiles, as required)
- `has_role()` security definer function to prevent RLS recursion
- RLS policies on all tables scoped to `business_id`

### 1.4 Authentication
- Supabase Auth with email/password
- Signup flow creates: business record, default branch, profile, and owner role
- Login redirects based on role (Super Admin vs Business user)
- Protected routes with auth context provider

---

## Phase 2: Core Business Modules

### 2.1 Items Management
- CRUD for products with categories, pricing, tax rates, barcodes
- Support for product types: physical, service, room, bundle
- Image upload via Supabase Storage
- Batch import capability

### 2.2 POS Terminal (enhance existing)
- Connect to real products from database
- Barcode scanning input
- Tax calculation per item
- Discount application (percentage or fixed)
- Multiple payment methods (Cash, Card, Mobile Money)
- Split payment support
- Receipt generation (printable)
- Hold/recall sale functionality
- Refund processing

### 2.3 Inventory Module (enhance existing)
- Real-time stock tracking per branch
- Low stock alerts with configurable reorder levels
- Supplier management
- Purchase order creation and receiving
- Stock transfers between branches
- Stock adjustment with reason codes

### 2.4 Sales History
- Searchable/filterable sales records
- Date range, payment method, cashier filters
- Sale detail view with items
- Refund initiation from sale record
- CSV/PDF export

---

## Phase 3: Business Operations

### 3.1 Customer Management
- Customer registry with contact info
- Loyalty points system
- Credit/account balance tracking
- Purchase history per customer
- Customer groups

### 3.2 Expense Management
- Expense categories
- Record expenses per branch
- Attach receipts (file upload)
- Expense reports by period

### 3.3 Reporting & Analytics
- Dashboard with real KPIs from database
- Daily/weekly/monthly sales summaries
- Profit calculations (revenue - cost - expenses)
- Top products, top customers
- Sales by payment method, by cashier, by branch
- Exportable reports

### 3.4 Team Management
- Invite users by email
- Assign roles per branch
- View activity per team member
- Deactivate/remove users

### 3.5 Branch Management
- Create and manage branches
- Per-branch settings (tax, currency)
- Branch-level inventory and sales views

---

## Phase 4: Advanced Features

### 4.1 Industry-Specific Modules
- Feature toggle system (`feature_toggles` table)
- **Retail/Supermarket**: Standard POS + inventory (default)
- **Restaurant**: Table management, kitchen orders, waiter assignment
- **Hotel**: Room management, booking, check-in/out
- **Pharmacy**: Batch/expiry tracking, prescription flag
- **Hardware**: Unit conversions, bulk pricing
- Modules enabled per business via settings

### 4.2 Super Admin Panel
- Separate admin layout and routes (`/admin/*`)
- Business management (view all, activate/deactivate)
- Subscription plan management
- Global analytics (total revenue, active businesses, transactions)
- Feature toggle management per business
- System audit logs

### 4.3 Subscription & Billing
- Plan definitions (Starter, Professional, Enterprise)
- Trial period management (14-day)
- Plan limits enforcement (branches, users, features)
- Billing history display
- Expiry control and grace periods

### 4.4 Audit & Security
- Audit log for all write operations (who, what, when)
- Activity logs viewable by managers
- Session management
- Data isolation enforced via RLS on every table using `business_id`

---

## Technical Architecture

### File Structure
```text
src/
  contexts/
    AuthContext.tsx          -- Auth state, session, role checking
  hooks/
    useAuth.ts              -- Auth utilities
    useBusinessContext.ts   -- Current business/branch context
    useRoleAccess.ts        -- Role-based access helpers
  components/
    DashboardLayout.tsx     -- Business user layout (exists)
    AdminLayout.tsx         -- Super Admin layout
    ProtectedRoute.tsx      -- Route guard component
    pos/                    -- POS terminal components
    inventory/              -- Inventory components
    sales/                  -- Sales history components
    customers/              -- Customer management
    reports/                -- Charts and report components
    admin/                  -- Super Admin components
  pages/
    (existing pages enhanced)
    SalesPage.tsx
    CustomersPage.tsx
    ExpensesPage.tsx
    ReportsPage.tsx
    TeamPage.tsx
    BranchesPage.tsx
    SettingsPage.tsx
    admin/
      AdminDashboard.tsx
      AdminBusinesses.tsx
      AdminPlans.tsx
  integrations/
    supabase/
      client.ts
      types.ts
  lib/
    utils.ts
    constants.ts
```

### RLS Strategy
- Every business-scoped table has `business_id` column
- All RLS policies check `business_id` matches the user's business
- `has_role()` function for role-based access within policies
- Super Admin bypasses business scoping via role check

### Key Security Measures
- Roles stored in separate `user_roles` table (never on profiles)
- No client-side role checking for authorization
- All mutations require authenticated user
- Input validation with Zod on all forms
- Audit logging on sensitive operations

---

## Implementation Order

| Step | What | Scope |
|------|------|-------|
| 1 | Enable Lovable Cloud | Backend setup |
| 2 | Create database schema (core tables + RLS) | ~15 migrations |
| 3 | Auth system (signup, login, protected routes) | Auth context + pages |
| 4 | Business setup flow (post-signup) | Create business + branch |
| 5 | Dashboard with real data | Replace mock data |
| 6 | POS terminal with database | Products, cart, sales |
| 7 | Inventory management | Stock, suppliers, alerts |
| 8 | Sales history + reports | Queries, charts, exports |
| 9 | Customers + expenses | CRUD pages |
| 10 | Team + branch management | Invites, roles |
| 11 | Super Admin panel | Admin routes + views |
| 12 | Industry modules + feature toggles | Conditional UI |
| 13 | Subscription management | Plans, limits, billing |

Each step will be implemented incrementally across multiple iterations, starting with enabling Lovable Cloud.

