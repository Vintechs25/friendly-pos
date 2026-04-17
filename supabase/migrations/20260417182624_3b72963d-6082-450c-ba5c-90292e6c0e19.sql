-- 1. user_roles: elevated roles only for write
DROP POLICY IF EXISTS "Business owners manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Elevated roles manage user_roles" ON public.user_roles;

CREATE POLICY "Elevated roles manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'business_owner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  business_id = public.get_user_business_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'business_owner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- 2. user_permission_overrides: elevated roles only for write
DROP POLICY IF EXISTS "upo_all" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "upo_write_elevated" ON public.user_permission_overrides;

CREATE POLICY "upo_write_elevated"
ON public.user_permission_overrides
FOR ALL
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'business_owner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  business_id = public.get_user_business_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'business_owner'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- 3. Safe profiles view that masks PIN codes from non-managers
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  id, user_id, business_id, branch_id, full_name, phone, avatar_url,
  is_active, created_at, updated_at,
  CASE
    WHEN user_id = auth.uid()
      OR public.has_role(auth.uid(), 'business_owner'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'platform_admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    THEN pin_code
    ELSE NULL
  END AS pin_code
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

-- 4. Storage UPDATE policy for business-files bucket
DROP POLICY IF EXISTS "Business members update own files" ON storage.objects;
CREATE POLICY "Business members update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-files'
  AND (storage.foldername(name))[1] = public.get_user_business_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'business-files'
  AND (storage.foldername(name))[1] = public.get_user_business_id(auth.uid())::text
);