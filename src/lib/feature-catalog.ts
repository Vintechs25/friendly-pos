/**
 * Single source of truth for the platform's feature toggle catalog.
 *
 * Every togglable capability MUST be declared here. The Admin UI, the
 * provisioning logic, the route/permission guards, and inline POS gates
 * all read from this file so the feature names never drift.
 */

export type FeatureKey =
  | "pos"
  | "inventory"
  | "barcode_scanning"
  | "custom_items"
  | "restaurant_mode"
  | "kitchen_display"
  | "table_management"
  | "batch_tracking"
  | "expiry_tracking"
  | "customer_loyalty"
  | "gift_cards"
  | "store_credit"
  | "mpesa_payments"
  | "card_payments"
  | "etims_compliance"
  | "hardware_support"
  | "advanced_reports"
  | "audit_logs"
  | "email_marketing"
  | "multi_branch"
  | "purchase_orders"
  | "stock_transfers";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
  category: "Core" | "Sales" | "Inventory" | "Payments" | "Compliance" | "Operations";
}

export const FEATURE_CATALOG: FeatureMeta[] = [
  // Core
  { key: "pos", label: "Point of Sale", category: "Core", description: "Core POS terminal for taking orders" },
  { key: "inventory", label: "Inventory Management", category: "Core", description: "Stock tracking and product catalog" },
  { key: "multi_branch", label: "Multi-Branch", category: "Core", description: "Manage multiple branches" },

  // Sales experience
  { key: "barcode_scanning", label: "Barcode Scanning", category: "Sales", description: "Scan barcodes via camera or USB scanner" },
  { key: "custom_items", label: "Custom Items", category: "Sales", description: "Add ad-hoc service items not in inventory" },
  { key: "restaurant_mode", label: "Restaurant Mode", category: "Sales", description: "Dine-in flow, KOTs, table-based ordering" },
  { key: "table_management", label: "Tables", category: "Sales", description: "Floor plan and table status" },
  { key: "kitchen_display", label: "Kitchen Display (KDS)", category: "Sales", description: "Kitchen ticket queue" },
  { key: "customer_loyalty", label: "Customer Loyalty", category: "Sales", description: "Customer profiles, points, rewards" },
  { key: "gift_cards", label: "Gift Cards", category: "Sales", description: "Sell and redeem gift cards" },
  { key: "store_credit", label: "Store Credit", category: "Sales", description: "Allow customers to pay on account" },

  // Inventory
  { key: "batch_tracking", label: "Batch Tracking", category: "Inventory", description: "Track batch / lot numbers" },
  { key: "expiry_tracking", label: "Expiry Tracking", category: "Inventory", description: "Track product expiry dates" },
  { key: "purchase_orders", label: "Purchase Orders", category: "Inventory", description: "Create and receive POs" },
  { key: "stock_transfers", label: "Stock Transfers", category: "Inventory", description: "Move stock between branches" },

  // Payments
  { key: "mpesa_payments", label: "M-Pesa Payments", category: "Payments", description: "Daraja STK push and till matching" },
  { key: "card_payments", label: "Card Payments", category: "Payments", description: "Accept card / POS terminal payments" },

  // Compliance
  { key: "etims_compliance", label: "KRA eTIMS", category: "Compliance", description: "Submit invoices to KRA eTIMS" },
  { key: "audit_logs", label: "Audit Logs", category: "Compliance", description: "Track every change to data" },

  // Operations
  { key: "hardware_support", label: "Hardware Support", category: "Operations", description: "Printers, scanners, cash drawers" },
  { key: "advanced_reports", label: "Advanced Reports", category: "Operations", description: "Profit analytics & exports" },
  { key: "email_marketing", label: "Email & Campaigns", category: "Operations", description: "Inbox, templates, campaigns" },
];

export const ALL_FEATURE_KEYS: FeatureKey[] = FEATURE_CATALOG.map((f) => f.key);

/** Industry → set of features enabled by default when a business is provisioned. */
export const INDUSTRY_DEFAULTS: Record<string, FeatureKey[]> = {
  retail: [
    "pos", "inventory", "barcode_scanning", "customer_loyalty", "gift_cards", "store_credit",
    "mpesa_payments", "card_payments", "etims_compliance", "hardware_support",
    "advanced_reports", "audit_logs", "purchase_orders",
  ],
  supermarket: [
    "pos", "inventory", "barcode_scanning", "batch_tracking", "expiry_tracking",
    "customer_loyalty", "gift_cards", "store_credit", "mpesa_payments", "card_payments",
    "etims_compliance", "hardware_support", "advanced_reports", "audit_logs",
    "purchase_orders", "stock_transfers", "multi_branch",
  ],
  hardware: [
    "pos", "inventory", "barcode_scanning", "custom_items", "customer_loyalty",
    "store_credit", "mpesa_payments", "card_payments", "etims_compliance",
    "hardware_support", "advanced_reports", "audit_logs", "purchase_orders",
  ],
  restaurant: [
    "pos", "inventory", "custom_items", "restaurant_mode", "table_management", "kitchen_display",
    "expiry_tracking", "customer_loyalty", "mpesa_payments", "card_payments",
    "etims_compliance", "hardware_support", "advanced_reports", "audit_logs",
  ],
  hotel: [
    "pos", "inventory", "custom_items", "restaurant_mode", "table_management", "kitchen_display",
    "customer_loyalty", "store_credit", "mpesa_payments", "card_payments",
    "etims_compliance", "hardware_support", "advanced_reports", "audit_logs", "multi_branch",
  ],
  pharmacy: [
    "pos", "inventory", "barcode_scanning", "batch_tracking", "expiry_tracking",
    "customer_loyalty", "mpesa_payments", "card_payments", "etims_compliance",
    "hardware_support", "advanced_reports", "audit_logs", "purchase_orders",
  ],
  wholesale: [
    "pos", "inventory", "barcode_scanning", "custom_items", "batch_tracking", "expiry_tracking",
    "store_credit", "mpesa_payments", "card_payments", "etims_compliance",
    "hardware_support", "advanced_reports", "audit_logs", "purchase_orders",
    "stock_transfers", "multi_branch",
  ],
  service: [
    "pos", "custom_items", "customer_loyalty", "store_credit", "mpesa_payments",
    "card_payments", "etims_compliance", "advanced_reports", "audit_logs", "email_marketing",
  ],
  other: [
    "pos", "inventory", "barcode_scanning", "custom_items", "customer_loyalty",
    "mpesa_payments", "card_payments", "etims_compliance", "hardware_support",
    "advanced_reports", "audit_logs",
  ],
};

/** Resolve the default-enabled set for an industry, falling back to "other". */
export function defaultsForIndustry(industry: string | null | undefined): Set<FeatureKey> {
  const list = INDUSTRY_DEFAULTS[industry ?? ""] ?? INDUSTRY_DEFAULTS.other;
  return new Set(list);
}
