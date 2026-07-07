-- Kovio admin layer + Robot.com featured operator.
--
-- Admin access is an email allowlist (independent of org kind) so we don't have
-- to move anyone's account. Robot.com is seeded as an operator org so advertiser
-- placements target a real record and admins can redirect them.

-- Robot.com featured operator (the only live option for advertisers right now).
insert into public.organizations (name, slug, kind, status)
values ('Robot.com', 'robot-com', 'oem', 'active')
on conflict (slug) do nothing;

-- Admin allowlist (RLS-locked; used only inside the RPCs below).
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;
insert into public.admin_emails (email) values ('caovivek@gmail.com') on conflict do nothing;

create or replace function public._kovio_caller_email()
returns text language sql security definer set search_path = public stable as $$
  select email from public.users where supabase_user_id = auth.uid() limit 1;
$$;

create or replace function public.kovio_is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admin_emails a where a.email = public._kovio_caller_email());
$$;
grant execute on function public.kovio_is_admin() to authenticated;

-- The advertiser's featured place target (Robot.com), with its external link.
create or replace function public.kovio_place_target()
returns table (oem_org_id uuid, oem_name text, link text)
language sql security definer set search_path = public stable as $$
  select id, name::text, 'https://www.robot.com/'
    from public.organizations where slug = 'robot-com' and kind = 'oem' limit 1;
$$;
grant execute on function public.kovio_place_target() to authenticated;

-- ---- Admin RPCs (all gated on kovio_is_admin) -----------------------------

create or replace function public.kovio_admin_overview()
returns table (advertisers bigint, operators bigint, users_count bigint,
  campaigns_count bigint, offers_count bigint, pending_offers bigint, impressions_count bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select
    (select count(*) from public.organizations where kind='advertiser'),
    (select count(*) from public.organizations where kind='oem'),
    (select count(*) from public.users),
    (select count(*) from public.campaigns),
    (select count(*) from public.campaign_offers),
    (select count(*) from public.campaign_offers where status='pending'),
    (select count(*) from public.impressions);
end; $$;
grant execute on function public.kovio_admin_overview() to authenticated;

create or replace function public.kovio_admin_users()
returns table (email text, org_name text, kind text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select u.email, o.name::text, o.kind::text, u.role::text, u.created_at
    from public.users u left join public.organizations o on o.id = u.org_id
    order by u.created_at desc;
end; $$;
grant execute on function public.kovio_admin_users() to authenticated;

create or replace function public.kovio_admin_campaigns()
returns table (name text, advertiser text, org_name text, status text,
  budget_total_cents bigint, budget_spent_cents bigint, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select c.name::text, c.advertiser::text, o.name::text, c.status::text,
    c.budget_total_cents, c.budget_spent_cents, c.created_at
    from public.campaigns c left join public.organizations o on o.id = c.org_id
    order by c.created_at desc;
end; $$;
grant execute on function public.kovio_admin_campaigns() to authenticated;

create or replace function public.kovio_admin_offers()
returns table (id uuid, advertiser_name text, name text, creative_url text, creative_type text,
  status text, target_oem_name text, target_oem_org_id uuid, budget_total_cents bigint,
  start_at date, end_at date, time_window text, location_label text, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select co.id, co.advertiser_name, co.name, co.creative_url, co.creative_type,
    co.status, o.name::text, co.target_oem_org_id, co.budget_total_cents,
    co.start_at, co.end_at, co.time_window, co.location_label, co.created_at
    from public.campaign_offers co left join public.organizations o on o.id = co.target_oem_org_id
    order by (co.status='pending') desc, co.created_at desc;
end; $$;
grant execute on function public.kovio_admin_offers() to authenticated;

create or replace function public.kovio_admin_operators()
returns table (org_id uuid, name text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select id, name::text from public.organizations where kind='oem' order by name;
end; $$;
grant execute on function public.kovio_admin_operators() to authenticated;

-- Redirect an incoming campaign to a chosen operator (Robot.com or another).
create or replace function public.kovio_admin_route_offer(p_offer_id uuid, p_target_oem uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id=p_target_oem and kind='oem') then
    raise exception 'invalid_target'; end if;
  update public.campaign_offers set target_oem_org_id=p_target_oem, updated_at=now()
   where id=p_offer_id;
end; $$;
grant execute on function public.kovio_admin_route_offer(uuid,uuid) to authenticated;
