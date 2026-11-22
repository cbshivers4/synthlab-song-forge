CREATE TABLE public.app_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active_seconds integer NOT NULL DEFAULT 0,
  ended_at timestamptz
);
GRANT SELECT ON public.app_visits TO authenticated;
GRANT ALL ON public.app_visits TO service_role;
ALTER TABLE public.app_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read app visits" ON public.app_visits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX app_visits_started_idx ON public.app_visits (started_at DESC);
CREATE INDEX app_visits_user_idx ON public.app_visits (user_id, last_seen_at DESC);

CREATE TABLE public.founder_notification_prefs (
  user_id uuid PRIMARY KEY,
  sign_ins boolean NOT NULL DEFAULT true,
  app_opens boolean NOT NULL DEFAULT true,
  time_spent boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  desktop boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.founder_notification_prefs TO authenticated;
GRANT ALL ON public.founder_notification_prefs TO service_role;
ALTER TABLE public.founder_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads own notification prefs" ON public.founder_notification_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin creates own notification prefs" ON public.founder_notification_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin updates own notification prefs" ON public.founder_notification_prefs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_visits;