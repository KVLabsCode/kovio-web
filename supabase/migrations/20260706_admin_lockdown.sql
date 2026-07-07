-- Admin sign-in lockdown + dedicated admin account.
--
-- 1. supportkovio@gmail.com becomes a Kovio admin (its advertiser data is
--    cleared separately so it's a clean staff account).
-- 2. _kovio_caller_email falls back to the auth JWT's email claim, so an
--    allowlisted account has admin access even with no public.users row (a
--    pure staff account that never onboarded as advertiser/OEM).
-- 3. kovio_is_admin_email lets the /admin/login server route refuse to send
--    magic links to non-allowlisted emails (the sign-in lock).

insert into public.admin_emails (email) values ('supportkovio@gmail.com') on conflict do nothing;

create or replace function public._kovio_caller_email()
returns text language sql security definer set search_path = public stable as $$
  select coalesce(
    (select email from public.users where supabase_user_id = auth.uid() limit 1),
    nullif(auth.jwt() ->> 'email', '')
  );
$$;

create or replace function public.kovio_is_admin_email(p_email text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admin_emails a where a.email = lower(trim(p_email)));
$$;
grant execute on function public.kovio_is_admin_email(text) to anon, authenticated;
