CREATE OR REPLACE FUNCTION public.owns_campaign(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = _campaign_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_encounter(_encounter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.encounters e
    JOIN public.campaigns c ON c.id = e.campaign_id
    WHERE e.id = _encounter_id AND c.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.owns_campaign(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_encounter(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_campaign(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_encounter(jsonb) FROM anon;