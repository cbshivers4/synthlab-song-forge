CREATE OR REPLACE FUNCTION public.consume_ai_use(_tool text, _daily_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(_daily_limit, 25), 1), 25);
  used integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT count(*) INTO used FROM public.ai_usage WHERE user_id = uid AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  IF used >= lim THEN RETURN jsonb_build_object('id', NULL, 'remaining', 0); END IF;
  INSERT INTO public.ai_usage (user_id, tool) VALUES (uid, left(_tool, 40)) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'remaining', lim - used - 1);
END $$;

CREATE OR REPLACE FUNCTION public.ai_uses_left(_daily_limit integer DEFAULT 25)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, least(greatest(coalesce(_daily_limit, 25), 1), 25) - count(*)::int) FROM public.ai_usage
  WHERE user_id = auth.uid() AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
$$;

CREATE OR REPLACE FUNCTION public.refund_ai_use(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.ai_usage WHERE id = _id AND created_at > now() - interval '15 minutes';
$$;

REVOKE ALL ON FUNCTION public.refund_ai_use(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_use(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.can_save_projects(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND u.email_confirmed_at IS NOT NULL
        AND lower(u.email) IN ('christophershivers@synclabsapp.com', 'cbshivers@gmail.com')
    )
    OR public.has_active_subscription(_user_id, 'live');
$$;

GRANT EXECUTE ON FUNCTION public.can_save_projects(uuid) TO anon, authenticated, service_role;