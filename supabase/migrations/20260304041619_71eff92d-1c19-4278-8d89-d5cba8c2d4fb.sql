CREATE POLICY "Admins can delete exam audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-audio' AND public.has_role(auth.uid(), 'admin'));