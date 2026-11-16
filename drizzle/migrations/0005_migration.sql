-- has_role only answers for the signed-in caller (or the service role), so it can't be used to probe other accounts' roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role = _role
      and (_user_id = auth.uid() or auth.role() = 'service_role')
  )
$$;

-- Records which account started each AI stem-split job so only that account can check or cancel it.
CREATE TABLE public.stem_split_jobs (
  prediction_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stem_split_jobs TO authenticated;
GRANT ALL ON public.stem_split_jobs TO service_role;

ALTER TABLE public.stem_split_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own stem split jobs"
ON public.stem_split_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX stem_split_jobs_user_id_idx ON public.stem_split_jobs (user_id);