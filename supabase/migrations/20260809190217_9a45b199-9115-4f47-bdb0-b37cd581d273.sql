CREATE OR REPLACE FUNCTION public.owns_character(_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.characters c WHERE c.id = _character_id AND c.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_character(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_character(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;