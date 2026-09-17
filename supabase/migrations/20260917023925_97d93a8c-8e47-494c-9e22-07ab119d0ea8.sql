CREATE TABLE public.cloud_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  bpm INTEGER NOT NULL DEFAULT 120 CHECK (bpm BETWEEN 20 AND 400),
  musical_key TEXT NOT NULL DEFAULT 'C',
  time_signature TEXT NOT NULL DEFAULT '4/4',
  template TEXT NOT NULL DEFAULT 'empty',
  session JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_projects TO authenticated;
GRANT ALL ON public.cloud_projects TO service_role;

ALTER TABLE public.cloud_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cloud projects"
ON public.cloud_projects FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their cloud projects"
ON public.cloud_projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their cloud projects"
ON public.cloud_projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their cloud projects"
ON public.cloud_projects FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX cloud_projects_user_updated_idx
ON public.cloud_projects (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_cloud_project_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_cloud_project_updated_at
BEFORE UPDATE ON public.cloud_projects
FOR EACH ROW EXECUTE FUNCTION public.set_cloud_project_updated_at();

CREATE POLICY "Users can read their SYNCLAB files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'synclab-cloud' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their SYNCLAB files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'synclab-cloud' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their SYNCLAB files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'synclab-cloud' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'synclab-cloud' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their SYNCLAB files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'synclab-cloud' AND (storage.foldername(name))[1] = auth.uid()::text);