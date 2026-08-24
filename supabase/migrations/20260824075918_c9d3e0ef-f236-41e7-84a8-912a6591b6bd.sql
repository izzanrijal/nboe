-- Master admin helper
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND lower(email) = 'izzan.rijal@gmail.com'
  )
$$;

-- Owner-of-case helper
CREATE OR REPLACE FUNCTION public.owns_case(_user_id uuid, _case_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinical_cases
    WHERE id = _case_id AND created_by = _user_id
  )
$$;

-- Promote every existing participant (candidate) to admin as well
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'admin'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'candidate'
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure master admin has admin role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role FROM public.profiles p
WHERE lower(p.email) = 'izzan.rijal@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- clinical_cases: split the blanket admin policy
DROP POLICY IF EXISTS "Admins manage cases" ON public.clinical_cases;

CREATE POLICY "Admins read all cases" ON public.clinical_cases
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create cases" ON public.clinical_cases
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or master admin update cases" ON public.clinical_cases
FOR UPDATE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid()));

CREATE POLICY "Owner or master admin delete cases" ON public.clinical_cases
FOR DELETE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid()));

-- case_answer_keys: read for admins, write only for owner/master
DROP POLICY IF EXISTS "Admins manage answer keys" ON public.case_answer_keys;

CREATE POLICY "Admins read answer keys" ON public.case_answer_keys
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or master admin write answer keys" ON public.case_answer_keys
FOR INSERT TO authenticated
WITH CHECK (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

CREATE POLICY "Owner or master admin update answer keys" ON public.case_answer_keys
FOR UPDATE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)))
WITH CHECK (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

CREATE POLICY "Owner or master admin delete answer keys" ON public.case_answer_keys
FOR DELETE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

-- case_assets: read for admins, write only for owner/master
DROP POLICY IF EXISTS "Admins manage assets" ON public.case_assets;

CREATE POLICY "Admins read assets" ON public.case_assets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or master admin write assets" ON public.case_assets
FOR INSERT TO authenticated
WITH CHECK (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

CREATE POLICY "Owner or master admin update assets" ON public.case_assets
FOR UPDATE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)))
WITH CHECK (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

CREATE POLICY "Owner or master admin delete assets" ON public.case_assets
FOR DELETE TO authenticated
USING (public.is_master_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin') AND public.owns_case(auth.uid(), case_id)));

-- Only master admin may hand out/revoke roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Master admin manages roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));