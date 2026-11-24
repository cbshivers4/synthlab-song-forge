CREATE TABLE public.free_access_trials (
  user_id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.free_access_trials TO authenticated;
GRANT ALL ON public.free_access_trials TO service_role;

ALTER TABLE public.free_access_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own free access"
  ON public.free_access_trials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_free_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.free_access_trials
    WHERE user_id = _user_id AND ends_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND u.email_confirmed_at IS NOT NULL
        AND lower(u.email) IN ('christophershivers@synclabsapp.com', 'cbshivers@gmail.com')
    )
    OR public.has_active_subscription(_user_id, 'live');
$$;

CREATE OR REPLACE FUNCTION public.can_use_ai_tools()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_premium_access(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_save_projects(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_premium_access(_user_id)
    OR public.has_free_access(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.start_free_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  row_started timestamptz;
  row_ends timestamptz;
  inserted boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.free_access_trials (user_id, ends_at)
  VALUES (uid, now() + interval '14 days')
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  SELECT started_at, ends_at INTO row_started, row_ends
  FROM public.free_access_trials WHERE user_id = uid;
  RETURN jsonb_build_object(
    'started_at', row_started,
    'ends_at', row_ends,
    'created', inserted
  );
END $$;

REVOKE ALL ON FUNCTION public.start_free_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_free_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_free_access(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_use_ai_tools() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_save_projects(uuid) TO anon, authenticated, service_role;