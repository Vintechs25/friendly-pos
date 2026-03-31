/**
 * Maps business industry types to default feature flags.
 * When a business is provisioned, these features are auto-enabled.
 */

const INDUSTRY_FEATURES: Record<string, Record<string, boolean>> = {
  retail: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: false,
    restaurant_mode: false,
    batch_tracking: false,
    expiry_tracking: false,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  supermarket: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: false,
    restaurant_mode: false,
    batch_tracking: true,
    expiry_tracking: true,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  hardware: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: true,
    restaurant_mode: false,
    batch_tracking: false,
    expiry_tracking: false,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  restaurant: {
    pos: true,
    inventory: true,
    barcode_scanning: false,
    custom_items: true,
    restaurant_mode: true,
    batch_tracking: false,
    expiry_tracking: true,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  hotel: {
    pos: true,
    inventory: true,
    barcode_scanning: false,
    custom_items: true,
    restaurant_mode: true,
    batch_tracking: false,
    expiry_tracking: false,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  pharmacy: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: false,
    restaurant_mode: false,
    batch_tracking: true,
    expiry_tracking: true,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  wholesale: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: true,
    restaurant_mode: false,
    batch_tracking: true,
    expiry_tracking: true,
    customer_loyalty: false,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
  other: {
    pos: true,
    inventory: true,
    barcode_scanning: true,
    custom_items: true,
    restaurant_mode: false,
    batch_tracking: false,
    expiry_tracking: false,
    customer_loyalty: true,
    mpesa_payments: true,
    hardware_support: true,
    advanced_reports: true,
    audit_logs: true,
  },
};

/**
 * Returns the feature toggle rows to insert for a given industry type.
 */
export function getFeatureTogglesForIndustry(
  businessId: string,
  industry: string
): { business_id: string; feature_name: string; is_enabled: boolean }[] {
  const features = INDUSTRY_FEATURES[industry] ?? INDUSTRY_FEATURES["other"];
  return Object.entries(features).map(([feature_name, is_enabled]) => ({
    business_id: businessId,
    feature_name,
    is_enabled,
  }));
}

export function getSupportedIndustries(): string[] {
  return Object.keys(INDUSTRY_FEATURES);
}
