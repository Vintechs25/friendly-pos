import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, MapPin, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function BusinessSetupPage() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "retail",
    phone: "",
    email: "",
    address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // Create business
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: form.name.trim(),
          industry: form.industry,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
        })
        .select()
        .single();

      if (bizError) throw bizError;

      // Update profile with business_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ business_id: business.id })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Create default branch
      const { error: branchError } = await supabase
        .from("branches")
        .insert({
          business_id: business.id,
          name: "Main Branch",
          is_active: true,
        });

      if (branchError) console.warn("Branch creation failed:", branchError);

      // Assign business_owner role if no role exists
      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("business_id", business.id);

      if (!existingRoles?.length) {
        await supabase.from("user_roles").insert({
          user_id: user.id,
          business_id: business.id,
          role: "business_owner",
        });
      }

      // Create default business settings
      await supabase.from("business_settings").insert({
        business_id: business.id,
      });

      toast.success("Business created successfully!");
      await refreshProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to create business");
    } finally {
      setLoading(false);
    }
  };

  const industries = [
    { value: "retail", label: "Retail Store" },
    { value: "supermarket", label: "Supermarket" },
    { value: "restaurant", label: "Restaurant / Café" },
    { value: "pharmacy", label: "Pharmacy" },
    { value: "hardware", label: "Hardware Store" },
    { value: "electronics", label: "Electronics" },
    { value: "fashion", label: "Fashion & Apparel" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">Set Up Your Business</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Create your business profile to start using the POS system.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Kelvin's Supermarket"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry" className="text-sm font-semibold">Industry</Label>
            <select
              id="industry"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {industries.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  placeholder="0712345678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="info@shop.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="h-11 pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-semibold">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                placeholder="e.g. Moi Avenue, Nairobi"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="h-11 pl-9"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Creating...</>
            ) : (
              "Create Business & Continue"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update these details later in Settings.
        </p>
      </div>
    </div>
  );
}
