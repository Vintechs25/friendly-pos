import { supabase } from "@/integrations/supabase/client";

/**
 * Submit a completed sale to eTIMS via the edge function.
 * Silently fails if eTIMS is not configured — does not block the sale.
 */
export async function submitToEtims(saleId: string, businessId: string): Promise<{
  success: boolean;
  status: string;
  invoiceNumber?: string;
  controlCode?: string;
  qrCode?: string;
}> {
  try {
    // Check if eTIMS is active for this business
    const { data: settings } = await supabase
      .from("etims_settings")
      .select("is_active")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!settings?.is_active) {
      return { success: false, status: "disabled" };
    }

    // Create a pending record immediately
    await supabase.from("etims_transactions").insert({
      sale_id: saleId,
      business_id: businessId,
      status: "pending",
    });

    // Call edge function (non-blocking fire-and-forget style with await)
    const { data, error } = await supabase.functions.invoke("etims-submit", {
      body: { sale_id: saleId },
    });

    if (error) {
      console.warn("eTIMS submission failed:", error.message);
      return { success: false, status: "failed" };
    }

    return {
      success: data?.success ?? false,
      status: data?.status ?? "unknown",
      invoiceNumber: data?.etims_transaction?.invoice_number,
      controlCode: data?.etims_transaction?.control_code,
      qrCode: data?.etims_transaction?.qr_code,
    };
  } catch (err) {
    console.warn("eTIMS submission error:", err);
    return { success: false, status: "error" };
  }
}

/**
 * Get eTIMS data for a given sale (for receipt display)
 */
export async function getEtimsDataForSale(saleId: string): Promise<{
  invoiceNumber?: string;
  controlCode?: string;
  qrCode?: string;
  status?: string;
} | null> {
  const { data } = await supabase
    .from("etims_transactions")
    .select("invoice_number, control_code, qr_code, status")
    .eq("sale_id", saleId)
    .maybeSingle();

  return data;
}
