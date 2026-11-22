CREATE TABLE public.tape_shelf_items (
  user_id uuid NOT NULL,
  id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reel', 'cassette', 'cd')),
  type_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  artist text NOT NULL DEFAULT '',
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tape_shelf_items TO authenticated;
GRANT ALL ON public.tape_shelf_items TO service_role;

ALTER TABLE public.tape_shelf_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own tape shelf select" ON public.tape_shelf_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own tape shelf insert" ON public.tape_shelf_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tape shelf update" ON public.tape_shelf_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tape shelf delete" ON public.tape_shelf_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);