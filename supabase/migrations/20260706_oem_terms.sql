-- Operator-published terms (one set per OEM operator).
--
-- The fleet operator publishes their schedule (time windows + availability),
-- price (a flat or per-day package price) and locations. When an advertiser
-- picks that operator on /campaigns/place, THOSE become the options they choose
-- within — the advertiser no longer proposes arbitrary numbers. Content is still
-- reviewed (accept/reject) on the incoming offer.
--
-- One row per OEM org. RLS-locked; access only via the SECURITY DEFINER RPCs.

create table if not exists public.oem_terms (
  org_id          uuid primary key references public.organizations(id) on delete cascade,
  price_cents     bigint not null default 0,
  price_unit      text   not null default 'per_day' check (price_unit in ('per_day','flat')),
  time_windows    text[] not null default '{}',   -- e.g. {'Mornings 6–11','Evenings 5–9'}
  locations       text[] not null default '{}',   -- e.g. {'San Francisco','Oakland'}
  available_from  date,
  available_to    date,
  min_days        int,
  note            text,
  published       boolean not null default false,
  updated_at      timestamptz not null default now()
);

alter table public.oem_terms enable row level security;

-- Operator reads their own terms (for the settings page), published or not.
create or replace function public.kovio_get_my_oem_terms()
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text, published boolean)
language sql security definer set search_path = public stable as $$
  select t.price_cents, t.price_unit, t.time_windows, t.locations,
         t.available_from, t.available_to, t.min_days, t.note, t.published
    from public.oem_terms t
   where t.org_id = (select org_id from public._kovio_caller_org());
$$;
grant execute on function public.kovio_get_my_oem_terms() to authenticated;

-- Operator upserts their terms. Only OEM orgs may.
create or replace function public.kovio_set_oem_terms(
  p_price_cents bigint, p_price_unit text, p_time_windows text[], p_locations text[],
  p_available_from date, p_available_to date, p_min_days int, p_note text, p_published boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_kind text;
begin
  select org_id, kind into v_org, v_kind from public._kovio_caller_org();
  if v_org is null or v_kind <> 'oem' then raise exception 'not_an_operator'; end if;
  if p_price_unit not in ('per_day','flat') then raise exception 'invalid_price_unit'; end if;
  insert into public.oem_terms as t (
    org_id, price_cents, price_unit, time_windows, locations,
    available_from, available_to, min_days, note, published, updated_at
  ) values (
    v_org, greatest(0, coalesce(p_price_cents,0)), p_price_unit,
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
grant execute on function public.kovio_set_oem_terms(bigint,text,text[],text[],date,date,int,text,boolean) to authenticated;

-- Advertiser fetches a specific operator's PUBLISHED terms (for the place form).
create or replace function public.kovio_oem_terms(p_oem_org_id uuid)
returns table (price_cents bigint, price_unit text, time_windows text[], locations text[],
  available_from date, available_to date, min_days int, note text)
language sql security definer set search_path = public stable as $$
  select t.price_cents, t.price_unit, t.time_windows, t.locations,
         t.available_from, t.available_to, t.min_days, t.note
    from public.oem_terms t
   where t.org_id = p_oem_org_id and t.published = true;
$$;
grant execute on function public.kovio_oem_terms(uuid) to authenticated;
