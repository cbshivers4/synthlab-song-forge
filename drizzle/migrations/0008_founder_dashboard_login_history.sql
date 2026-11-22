CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'sign_in' CHECK (kind IN ('sign_in', 'open')),
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_created_idx ON public.login_events (created_at DESC);
CREATE INDEX login_events_user_idx ON public.login_events (user_id, created_at DESC);
CREATE INDEX login_events_session_idx ON public.login_events (session_id);

GRANT SELECT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read login history" ON public.login_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.marketing_contacts (
  user_id uuid PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  opted_in boolean NOT NULL DEFAULT false,
  opted_in_at timestamptz,
  opt_in_source text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT 'free',
  loops_synced_at timestamptz,
  loops_error text NOT NULL DEFAULT '',
  campaign_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketing_contacts TO authenticated;
GRANT ALL ON public.marketing_contacts TO service_role;
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or admin marketing contact" ON public.marketing_contacts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT UPDATE ON public.support_tickets TO authenticated;
CREATE POLICY "admins update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.login_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;