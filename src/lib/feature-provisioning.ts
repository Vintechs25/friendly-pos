/**
 * Builds the feature_toggles rows to insert when a business is provisioned.
 * Reads the unified catalog from feature-catalog.ts.
 */
import {
  ALL_FEATURE_KEYS,
  defaultsForIndustry,
  INDUSTRY_DEFAULTS,
} from "./feature-catalog";

export function getFeatureTogglesForIndustry(
  businessId: string,
  industry: string,
): { business_id: string; feature_name: string; is_enabled: boolean }[] {
  const enabled = defaultsForIndustry(industry);
  // Insert ONE row per known feature so the admin UI always reflects state explicitly.
  return ALL_FEATURE_KEYS.map((key) => ({
    business_id: businessId,
    feature_name: key,
    is_enabled: enabled.has(key),
  }));
}

export function getSupportedIndustries(): string[] {
  return Object.keys(INDUSTRY_DEFAULTS);
}
