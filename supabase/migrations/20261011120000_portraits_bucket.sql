-- The portraits bucket, created where its policies are.
--
-- 20260822203710 wrote the four storage.objects policies for 'portraits' and
-- never created the bucket: policies alone do not make one, so a fresh
-- database had rules for a bucket that did not exist and every portrait upload
-- failed. The deployed project's bucket was made by hand, so this does nothing
-- there. Private: the app reads portraits through signed URLs
-- (src/lib/backend/portraits.ts) and the policies scope every object to its
-- owner's folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('portraits', 'portraits', false)
ON CONFLICT (id) DO NOTHING;
