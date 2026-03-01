
-- Allow super_admin/platform_admin to delete licenses
CREATE POLICY "lic_delete"
ON public.licenses
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'platform_admin'::app_role)
);
