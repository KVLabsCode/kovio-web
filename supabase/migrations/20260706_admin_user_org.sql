-- Admin: associate any user account with any organization.
--
-- The concrete need: Robot.com is a seeded operator org with no login user.
-- From /admin, pick an account and assign it to Robot.com — that account then
-- receives Robot.com's incoming campaigns (inbox, emails, accept/reschedule/
-- comment). Kept generic: an admin can move any user to any org.

-- All orgs, for the assignment dropdown.
create or replace function public.kovio_admin_orgs()
returns table (org_id uuid, name text, kind text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text, o.kind::text
    from public.organizations o order by o.kind, o.name;
end; $$;
grant execute on function public.kovio_admin_orgs() to authenticated;

-- Move a user (by email) into an org.
create or replace function public.kovio_admin_assign_user_org(p_email text, p_org_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'invalid_org';
  end if;
  update public.users set org_id = p_org_id where lower(email) = lower(trim(p_email));
  if not found then raise exception 'user_not_found'; end if;
end; $$;
grant execute on function public.kovio_admin_assign_user_org(text,uuid) to authenticated;

-- kovio_admin_users: add org_id (for the dropdown's current value).
drop function if exists public.kovio_admin_users();
create function public.kovio_admin_users()
returns table (email text, org_id uuid, org_name text, kind text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select u.email, u.org_id, o.name::text, o.kind::text, u.role::text, u.created_at
    from public.users u left join public.organizations o on o.id = u.org_id
    order by u.created_at desc;
end; $$;
grant execute on function public.kovio_admin_users() to authenticated;

-- kovio_admin_operators: also list associated account emails, so the admin can
-- see at a glance whether Robot.com has an account behind it.
drop function if exists public.kovio_admin_operators();
create function public.kovio_admin_operators()
returns table (org_id uuid, name text, accepting boolean, member_emails text[])
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text, coalesce(t.published, false),
    coalesce((select array_agg(u.email order by u.created_at) from public.users u where u.org_id = o.id), '{}')
    from public.organizations o
    left join public.oem_terms t on t.org_id = o.id
   where o.kind = 'oem' order by o.name;
end; $$;
grant execute on function public.kovio_admin_operators() to authenticated;
