CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.cloud_projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  owner_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);
CREATE INDEX project_members_email_idx ON public.project_members (lower(email));

CREATE OR REPLACE FUNCTION public.owns_project(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cloud_projects p WHERE p.id = _project AND p.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.owns_project(_project) OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = _project
      AND lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND coalesce(auth.jwt() ->> 'email', '') <> ''
  )
$$;

-- storage folder names are text: only real project ids can match
CREATE OR REPLACE FUNCTION public.can_access_project_folder(_folder text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _folder IS NULL OR _folder !~ '^[0-9a-fA-F-]{36}$' THEN RETURN false; END IF;
  RETURN public.can_access_project(_folder::uuid);
END $$;

GRANT EXECUTE ON FUNCTION public.owns_project(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project_folder(text) TO anon, authenticated, service_role;

GRANT SELECT, INSERT, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people in a song see its members" ON public.project_members
  FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY "owner invites to a song" ON public.project_members
  FOR INSERT TO authenticated WITH CHECK (public.owns_project(project_id) AND invited_by = auth.uid());
CREATE POLICY "owner removes or member leaves" ON public.project_members
  FOR DELETE TO authenticated USING (
    public.owns_project(project_id)
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- invited people can open and save the song; only the owner can delete it
CREATE POLICY "members can view shared projects" ON public.cloud_projects
  FOR SELECT TO authenticated USING (public.can_access_project(id));
CREATE POLICY "members can update shared projects" ON public.cloud_projects
  FOR UPDATE TO authenticated
  USING (public.can_access_project(id))
  WITH CHECK (public.can_access_project(id) AND public.can_save_projects(auth.uid()));

CREATE OR REPLACE FUNCTION public.keep_cloud_project_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A song''s owner cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cloud_projects_keep_owner BEFORE UPDATE ON public.cloud_projects
  FOR EACH ROW EXECUTE FUNCTION public.keep_cloud_project_owner();

-- live edits, presence and join snapshots for songs people work on together
CREATE TABLE public.project_ops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.cloud_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_ops_project_idx ON public.project_ops (project_id, id);
CREATE INDEX project_ops_created_idx ON public.project_ops (created_at);
GRANT SELECT, INSERT ON public.project_ops TO authenticated;
GRANT ALL ON public.project_ops TO service_role;
ALTER TABLE public.project_ops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people in a song read its live edits" ON public.project_ops
  FOR SELECT TO authenticated USING (public.can_access_project(project_id));
CREATE POLICY "people in a song send live edits" ON public.project_ops
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_project(project_id));

CREATE OR REPLACE FUNCTION public.prune_project_ops()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF random() < 0.02 THEN
    DELETE FROM public.project_ops WHERE created_at < now() - interval '1 day';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER project_ops_prune AFTER INSERT ON public.project_ops
  FOR EACH ROW EXECUTE FUNCTION public.prune_project_ops();

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_ops;

-- people in a shared song can play its stored audio (files live under <uploader>/<song id>/...)
CREATE POLICY "Song members can read shared SYNCLAB files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'synclab-cloud' AND public.can_access_project_folder((storage.foldername(name))[2])
  );