-- Offer collaboration + admin control.
--
-- 1. Comments on an offer between the advertiser, the target operator, and
--    Kovio admins (offer_comments, RLS-locked, RPC-only access).
-- 2. Admin management: list/add/remove admin emails from the allowlist.
-- 3. Admin "edit everything": read/write any operator's campaign settings
--    (oem_terms) and update any offer's fields.
-- 4. kovio_admin_operators now reports whether each operator is accepting
--    custom campaigns (oem_terms.published drives the operator opt-in).

-- ---------------------------------------------------------------------------
-- Who is the caller relative to an offer? 'kovio' | 'advertiser' | 'operator'.
-- ---------------------------------------------------------------------------
create or replace function public._kovio_offer_role(p_offer_id uuid)
returns text
language plpgsql security definer set search_path = public stable as $$
declare v_row public.campaign_offers%rowtype;
begin
  select * into v_row from public.campaign_offers where id = p_offer_id;
  if not found then return null; end if;
  if public.kovio_is_admin() then return 'kovio'; end if;
  if v_row.advertiser_user = auth.uid() then return 'advertiser'; end if;
  if v_row.target_oem_org_id = (select org_id from public._kovio_caller_org()) then return 'operator'; end if;
  return null;
end; $$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create table if not exists public.offer_comments (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.campaign_offers(id) on delete cascade,
  author_user uuid not null default auth.uid(),
  author_role text not null check (author_role in ('advertiser','operator','kovio')),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists ix_offer_comments_offer on public.offer_comments (offer_id, created_at);
alter table public.offer_comments enable row level security;

create or replace function public.kovio_offer_comments(p_offer_id uuid)
returns table (id uuid, author_role text, body text, created_at timestamptz, is_me boolean)
language plpgsql security definer set search_path = public stable as $$
begin
  if public._kovio_offer_role(p_offer_id) is null then raise exception 'not_authorized'; end if;
  return query
    select c.id, c.author_role, c.body, c.created_at, (c.author_user = auth.uid())
      from public.offer_comments c
     where c.offer_id = p_offer_id
     order by c.created_at asc;
end; $$;
grant execute on function public.kovio_offer_comments(uuid) to authenticated;

-- Adds a comment and returns both sides' emails + names so the server route can
-- notify the counterpart (emails never reach the browser — server-only call).
create or replace function public.kovio_add_offer_comment(p_offer_id uuid, p_body text)
returns table (author_role text, campaign_name text, advertiser_email text, oem_email text)
language plpgsql security definer set search_path = public as $$
declare v_role text; v_row public.campaign_offers%rowtype;
begin
  v_role := public._kovio_offer_role(p_offer_id);
  if v_role is null then raise exception 'not_authorized'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty_comment'; end if;
  select * into v_row from public.campaign_offers where id = p_offer_id;
  insert into public.offer_comments (offer_id, author_user, author_role, body)
  values (p_offer_id, auth.uid(), v_role, trim(p_body));
  return query select v_role, v_row.name,
    (select u.email from public.users u where u.supabase_user_id = v_row.advertiser_user limit 1),
    (select u.email from public.users u where u.org_id = v_row.target_oem_org_id
      order by (u.role='admin') desc, u.created_at limit 1);
end; $$;
grant execute on function public.kovio_add_offer_comment(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin management (allowlist)
-- ---------------------------------------------------------------------------
create or replace function public.kovio_admin_list_admins()
returns table (email text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select a.email from public.admin_emails a order by a.email;
end; $$;
grant execute on function public.kovio_admin_list_admins() to authenticated;

create or replace function public.kovio_admin_add_admin(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid_email'; end if;
  insert into public.admin_emails (email) values (lower(trim(p_email))) on conflict do nothing;
end; $$;
grant execute on function public.kovio_admin_add_admin(text) to authenticated;

create or replace function public.kovio_admin_remove_admin(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  -- Guard: an admin cannot remove themselves (also guarantees >=1 admin remains).
  if lower(trim(p_email)) = lower(public._kovio_caller_email()) then
    raise exception 'cannot_remove_self';
  end if;
  delete from public.admin_emails where email = lower(trim(p_email));
end; $$;
grant execute on function public.kovio_admin_remove_admin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin edit-everything
-- ---------------------------------------------------------------------------
-- Operators + whether they're accepting custom campaigns (return type changed).
drop function if exists public.kovio_admin_operators();
create function public.kovio_admin_operators()
returns table (org_id uuid, name text, accepting boolean)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text, coalesce(t.published, false)
    from public.organizations o
    left join public.oem_terms t on t.org_id = o.id
   where o.kind = 'oem' order by o.name;
end; $$;
grant execute on function public.kovio_admin_operators() to authenticated;

create or replace function public.kovio_admin_get_oem_terms(p_org_id uuid)
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text, published boolean)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select t.price_cents, t.price_unit, t.time_windows, t.locations,
    t.available_from, t.available_to, t.min_days, t.note, t.published
    from public.oem_terms t where t.org_id = p_org_id;
end; $$;
grant execute on function public.kovio_admin_get_oem_terms(uuid) to authenticated;

create or replace function public.kovio_admin_set_oem_terms(
  p_org_id uuid, p_price_cents bigint, p_price_unit text, p_time_windows text[], p_locations text[],
  p_available_from date, p_available_to date, p_min_days int, p_note text, p_published boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id=p_org_id and kind='oem') then
    raise exception 'invalid_operator'; end if;
  if p_price_unit not in ('per_day','flat') then raise exception 'invalid_price_unit'; end if;
  insert into public.oem_terms as t (
    org_id, price_cents, price_unit, time_windows, locations,
    available_from, available_to, min_days, note, published, updated_at
  ) values (
    p_org_id, greatest(0, coalesce(p_price_cents,0)), p_price_unit,
    coalesce(p_time_windows,'{}'), coalesce(p_locations,'{}'),
    p_available_from, p_available_to, p_min_days, p_note, coalesce(p_published,false), now()
  )
  on conflict (org_id) do update set
    price_cents=excluded.price_cents, price_unit=excluded.price_unit,
    time_windows=excluded.time_windows, locations=excluded.locations,
    available_from=excluded.available_from, available_to=excluded.available_to,
    min_days=excluded.min_days, note=excluded.note, published=excluded.published,
    updated_at=now();
end; $$;
grant execute on function public.kovio_admin_set_oem_terms(uuid,bigint,text,text[],text[],date,date,int,text,boolean) to authenticated;

-- Update any offer field (null = leave unchanged).
create or replace function public.kovio_admin_update_offer(
  p_offer_id uuid, p_status text default null, p_start date default null, p_end date default null,
  p_budget_cents bigint default null, p_time_window text default null, p_location text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if p_status is not null and p_status not in ('pending','accepted','rejected','countered') then
    raise exception 'invalid_status'; end if;
  update public.campaign_offers set
    status         = coalesce(p_status, status),
    start_at       = coalesce(p_start, start_at),
    end_at         = coalesce(p_end, end_at),
    budget_total_cents = coalesce(p_budget_cents, budget_total_cents),
    time_window    = coalesce(p_time_window, time_window),
    location_label = coalesce(p_location, location_label),
    decided_at     = case when p_status in ('accepted','rejected') then now() else decided_at end,
    updated_at     = now()
  where id = p_offer_id;
  if not found then raise exception 'offer_not_found'; end if;
end; $$;
grant execute on function public.kovio_admin_update_offer(uuid,text,date,date,bigint,text,text) to authenticated;
