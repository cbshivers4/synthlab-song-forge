CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_day ON public.ai_usage (user_id, created_at DESC);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own AI usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Reserves one AI use for the caller if they are under the daily limit (UTC day). Returns the reservation id, or null when the limit is reached.
CREATE OR REPLACE FUNCTION public.consume_ai_use(_tool text, _daily_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); used integer; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT count(*) INTO used FROM public.ai_usage WHERE user_id = uid AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  IF used >= _daily_limit THEN RETURN jsonb_build_object('id', NULL, 'remaining', 0); END IF;
  INSERT INTO public.ai_usage (user_id, tool) VALUES (uid, left(_tool, 40)) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'remaining', _daily_limit - used - 1);
END $$;

-- Gives a reserved use back when the AI service failed before producing anything (own, recent reservations only).
CREATE OR REPLACE FUNCTION public.refund_ai_use(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.ai_usage WHERE id = _id AND user_id = auth.uid() AND created_at > now() - interval '15 minutes';
$$;

-- Today's remaining uses for the caller.
CREATE OR REPLACE FUNCTION public.ai_uses_left(_daily_limit integer DEFAULT 25)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, _daily_limit - count(*)::int) FROM public.ai_usage
  WHERE user_id = auth.uid() AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
$$;

REVOKE ALL ON FUNCTION public.consume_ai_use(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_ai_use(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_uses_left(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_use(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_use(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_uses_left(integer) TO authenticated, service_role;