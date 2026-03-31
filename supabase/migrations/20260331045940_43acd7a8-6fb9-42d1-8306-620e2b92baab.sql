-- Create storage bucket for business files
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-files', 'business-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload files to their business folder
CREATE POLICY "business_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-files' AND
  (storage.foldername(name))[1] = (get_user_business_id(auth.uid()))::text
);

-- RLS: Users can view files in their business folder
CREATE POLICY "business_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'business-files' AND
  (storage.foldername(name))[1] = (get_user_business_id(auth.uid()))::text
);

-- RLS: Users can delete files in their business folder
CREATE POLICY "business_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'business-files' AND
  (storage.foldername(name))[1] = (get_user_business_id(auth.uid()))::text
);