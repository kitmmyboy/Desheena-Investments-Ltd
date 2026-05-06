-- Create media storage bucket for branding assets (logos, favicons, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for all objects in the media bucket
CREATE POLICY "Public read access for media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Only Admins can upload/update/delete media
CREATE POLICY "Admin upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admin update media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admin delete media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );
