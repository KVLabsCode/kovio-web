-- Exact operator locations + advertiser-side reflection.
--
-- Locations become selected places (label + lat/lng from a geocoder), not free
-- text. Stored as locations_geo jsonb [{label, lat, lng}] alongside the legacy
-- locations text[] (labels), which every existing reader keeps using. All
-- changed RPCs keep old callers working: new params have defaults, and read
-- RPCs only ADD columns.

alter table public.oem_terms
  add column if not exists locations_geo jsonb not null default '[]'::jsonb;

-- Operator set (own org) — adds p_locations_geo with a default so the deployed
-- site's call (without it) still resolves.
drop function if exists public.kovio_set_oem_terms(bigint,text,text[],text[],date,date,int,text,boolean);
create function public.kovio_set_oem_terms(
  p_price_cents bigint, p_price_unit text, p_time_windows text[], p_locations text[],
  p_available_from date, p_available_to date, p_min_days int, p_note text, p_published boolean,
  p_locations_geo jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_kind text;
begin
  select org_id, kind into v_org, v_kind from public._kovio_caller_org();
  if v_org is null or v_kind <> 'oem' then raise exception 'not_an_operator'; end if;
  if p_price_unit not in ('per_day','flat') then raise exception 'invalid_price_unit'; end if;
  insert into public.oem_terms as t (
    org_id, price_cents, price_unit, time_windows, locations, locations_geo,
    available_from, available_to, min_days, note, published, updated_at
  ) values (
    v_org, greatest(0, coalesce(p_price_cents,0)), p_price_unit,
    coalesce(p_time_windows,'{}'), coalesce(p_locations,'{}'), coalesce(p_locations_geo,'[]'::jsonb),
    p_available_from, p_available_to, p_min_days, p_note, coalesce(p_published,false), now()
  )
  on conflict (org_id) do update set
    price_cents=excluded.price_cents, price_unit=excluded.price_unit,
    time_windows=excluded.time_windows, locations=excluded.locations,
    locations_geo=excluded.locations_geo,
    available_from=excluded.available_from, available_to=excluded.available_to,
    min_days=excluded.min_days, note=excluded.note, published=excluded.published,
    updated_at=now();
end; $$;
grant execute on function public.kovio_set_oem_terms(bigint,text,text[],text[],date,date,int,text,boolean,jsonb) to authenticated;

-- Admin set (any operator) — same treatment.
drop function if exists public.kovio_admin_set_oem_terms(uuid,bigint,text,text[],text[],date,date,int,text,boolean);
create function public.kovio_admin_set_oem_terms(
  p_org_id uuid, p_price_cents bigint, p_price_unit text, p_time_windows text[], p_locations text[],
  p_available_from date, p_available_to date, p_min_days int, p_note text, p_published boolean,
  p_locations_geo jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id=p_org_id and kind='oem') then
    raise exception 'invalid_operator'; end if;
  if p_price_unit not in ('per_day','flat') then raise exception 'invalid_price_unit'; end if;
  insert into public.oem_terms as t (
    org_id, price_cents, price_unit, time_windows, locations, locations_geo,
    available_from, available_to, min_days, note, published, updated_at
  ) values (
    p_org_id, greatest(0, coalesce(p_price_cents,0)), p_price_unit,
    coalesce(p_time_windows,'{}'), coalesce(p_locations,'{}'), coalesce(p_locations_geo,'[]'::jsonb),
    p_available_from, p_available_to, p_min_days, p_note, coalesce(p_published,false), now()
  )
  on conflict (org_id) do update set
    price_cents=excluded.price_cents, price_unit=excluded.price_unit,
    time_windows=excluded.time_windows, locations=excluded.locations,
    locations_geo=excluded.locations_geo,
    available_from=excluded.available_from, available_to=excluded.available_to,
    min_days=excluded.min_days, note=excluded.note, published=excluded.published,
    updated_at=now();
end; $$;
grant execute on function public.kovio_admin_set_oem_terms(uuid,bigint,text,text[],text[],date,date,int,text,boolean,jsonb) to authenticated;

-- Read RPCs: add locations_geo to the returned columns.
drop function if exists public.kovio_get_my_oem_terms();
create function public.kovio_get_my_oem_terms()
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text, published boolean, locations_geo jsonb)
language sql security definer set search_path = public stable as $$
  select t.price_cents, t.price_unit, t.time_windows, t.locations,
         t.available_from, t.available_to, t.min_days, t.note, t.published, t.locations_geo
    from public.oem_terms t
   where t.org_id = (select org_id from public._kovio_caller_org());
$$;
grant execute on function public.kovio_get_my_oem_terms() to authenticated;

drop function if exists public.kovio_oem_terms(uuid);
create function public.kovio_oem_terms(p_oem_org_id uuid)
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text, locations_geo jsonb)
language sql security definer set search_path = public stable as $$
  select t.price_cents, t.price_unit, t.time_windows, t.locations,
         t.available_from, t.available_to, t.min_days, t.note, t.locations_geo
    from public.oem_terms t
   where t.org_id = p_oem_org_id and t.published = true;
$$;
grant execute on function public.kovio_oem_terms(uuid) to authenticated;

drop function if exists public.kovio_admin_get_oem_terms(uuid);
create function public.kovio_admin_get_oem_terms(p_org_id uuid)
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text, published boolean, locations_geo jsonb)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select t.price_cents, t.price_unit, t.time_windows, t.locations,
    t.available_from, t.available_to, t.min_days, t.note, t.published, t.locations_geo
    from public.oem_terms t where t.org_id = p_org_id;
end; $$;
grant execute on function public.kovio_admin_get_oem_terms(uuid) to authenticated;
