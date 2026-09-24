CREATE TABLE public.user_visual_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  skins jsonb NOT NULL DEFAULT '{}'::jsonb,
  presets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_visual_settings TO authenticated;
GRANT ALL ON public.user_visual_settings TO service_role;
ALTER TABLE public.user_visual_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own visual settings" ON public.user_visual_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);