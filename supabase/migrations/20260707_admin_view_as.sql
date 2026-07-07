-- Admin "view as": one click to browse Kovio as any org (advertiser or
-- operator), then return to the admin view. Implemented as a temporary org
-- association on the admin's own users row, with the previous org remembered so
-- returning restores it exactly (including "no org" for pure staff accounts).

create table if not exists public.admin_view_state (
  admin_email text primary key,
  prev_org_id uuid,
  viewing_org_id uuid references public.organizations(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.admin_view_state enable row level security; -- RPC-only

create or replace function public.kovio_admin_view_as(p_org_id uuid)
returns table (kind text)
language plpgsql security definer set search_path = public as $$
declare v_email text; v_prev uuid; v_kind text;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  select o.kind::text into v_kind from public.organizations o where o.id = p_org_id;
  if v_kind is null then raise exception 'invalid_org'; end if;
  v_email := lower(public._kovio_caller_email());

  -- Remember where we came from only on first entry (switching targets while
  -- already viewing keeps the ORIGINAL home org).
  select u.org_id into v_prev from public.users u where u.supabase_user_id = auth.uid();
  insert into public.admin_view_state (admin_email, prev_org_id, viewing_org_id)
  values (v_email, v_prev, p_org_id)
  on conflict (admin_email) do update set viewing_org_id = excluded.viewing_org_id, started_at = now();

  update public.users set org_id = p_org_id where supabase_user_id = auth.uid();
  if not found then
    insert into public.users (supabase_user_id, email, org_id, role)
    values (auth.uid(), v_email, p_org_id, 'admin');
  end if;
  return query select v_kind;
end; $$;
grant execute on function public.kovio_admin_view_as(uuid) to authenticated;

create or replace function public.kovio_admin_return()
returns void
language plpgsql security definer set search_path = public as $$
declare v_email text; v_state public.admin_view_state%rowtype;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  v_email := lower(public._kovio_caller_email());
  select * into v_state from public.admin_view_state where admin_email = v_email;
  if not found then return; end if;
  update public.users set org_id = v_state.prev_org_id where supabase_user_id = auth.uid();
  delete from public.admin_view_state where admin_email = v_email;
end; $$;
grant execute on function public.kovio_admin_return() to authenticated;

-- What (if anything) the calling admin is currently viewing as.
create or replace function public.kovio_admin_viewing()
returns table (org_name text, kind text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.name::text, o.kind::text
    from public.admin_view_state s
    join public.organizations o on o.id = s.viewing_org_id
   where s.admin_email = lower(public._kovio_caller_email());
end; $$;
grant execute on function public.kovio_admin_viewing() to authenticated;
