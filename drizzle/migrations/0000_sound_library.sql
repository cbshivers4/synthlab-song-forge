CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sample','synth','drum','notes')),
  folder text NOT NULL DEFAULT 'Unsorted',
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own library select" ON public.library_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own library insert" ON public.library_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own library update" ON public.library_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own library delete" ON public.library_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX library_items_user_kind ON public.library_items(user_id, kind);