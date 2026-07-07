-- Operator-adjustable offer terms + counter flow.
--
-- Custom-campaign offers gain explicit terms (start/end dates, a time-window
-- label, a location label) on top of the existing price fields (budget +
-- cost_per_impression_cents). The fleet operator can COUNTER a pending offer —
-- proposing adjusted time / dates / price / location — which the advertiser then
-- reviews and accepts (or declines). So terms only become final once both sides
-- agree; nobody is charged a rate they didn't approve.
--
-- Backward-compatible: columns are additive/nullable, kovio_place_offer keeps its
-- existing named args (new ones default null) so the currently-deployed web keeps
-- working, and the read RPCs only ADD return columns (old readers ignore them).

alter table public.campaign_offers
  add column if not exists start_at       date,
  add column if not exists end_at         date,
  add column if not exists time_window    text,
  add column if not exists location_label text,
  add column if not exists counter        jsonb,   -- operator's proposed adjustments
  add column if not exists counter_note   text,
  add column if not exists countered_at   timestamptz;

alter table public.campaign_offers drop constraint if exists campaign_offers_status_check;
alter table public.campaign_offers add constraint campaign_offers_status_check
  check (status in ('pending','accepted','rejected','countered'));

-- place_offer: add date / time-window / location params (default null).
drop function if exists public.kovio_place_offer(uuid,uuid,text,text,text,text,text,jsonb,bigint,numeric,text);
create function public.kovio_place_offer(
  p_target_oem uuid, p_target_fleet uuid, p_name text, p_advertiser_name text,
  p_creative_url text, p_creative_type text, p_category text, p_targeting jsonb,
  p_budget_cents bigint, p_cpi numeric, p_message text,
  p_start_at date default null, p_end_at date default null,
  p_time_window text default null, p_location_label text default null)
returns table (offer_id uuid, oem_email text, oem_name text)
language plpgsql security definer set search_path = public as $$
declare v_adv_org uuid; v_offer_id uuid;
begin
  select org_id into v_adv_org from public._kovio_caller_org();
  if not exists (select 1 from public.organizations where id=p_target_oem and kind='oem') then
    raise exception 'invalid_target_oem'; end if;
  if p_target_fleet is not null and not exists (
    select 1 from public.fleets where id=p_target_fleet and org_id=p_target_oem) then
    raise exception 'invalid_target_fleet'; end if;
  insert into public.campaign_offers (
    advertiser_user, advertiser_org_id, advertiser_name, target_oem_org_id, target_fleet_id,
    name, creative_url, creative_type, category, targeting, budget_total_cents,
    cost_per_impression_cents, message, start_at, end_at, time_window, location_label
  ) values (
    auth.uid(), v_adv_org, coalesce(nullif(p_advertiser_name,''),'An advertiser'), p_target_oem, p_target_fleet,
    p_name, p_creative_url, p_creative_type, p_category, coalesce(p_targeting,'[]'::jsonb), coalesce(p_budget_cents,0),
    p_cpi, p_message, p_start_at, p_end_at, p_time_window, p_location_label
  ) returning id into v_offer_id;
  return query select v_offer_id,
    (select u.email from public.users u where u.org_id=p_target_oem order by (u.role='admin') desc, u.created_at limit 1),
    (select o.name::text from public.organizations o where o.id=p_target_oem);
end; $$;
grant execute on function public.kovio_place_offer(uuid,uuid,text,text,text,text,text,jsonb,bigint,numeric,text,date,date,text,text) to authenticated;

-- oem_offers: add the term + counter columns.
drop function if exists public.kovio_oem_offers();
create function public.kovio_oem_offers()
returns table (id uuid, advertiser_name text, name text, creative_url text, creative_type text,
  category text, targeting jsonb, budget_total_cents bigint, cost_per_impression_cents numeric,
  message text, fleet_name text, status text, decision_reason text, created_at timestamptz, decided_at timestamptz,
  start_at date, end_at date, time_window text, location_label text, counter jsonb, counter_note text)
language sql security definer set search_path = public stable as $$
  select co.id, co.advertiser_name, co.name, co.creative_url, co.creative_type, co.category, co.targeting,
         co.budget_total_cents, co.cost_per_impression_cents, co.message, f.name::text, co.status, co.decision_reason,
         co.created_at, co.decided_at, co.start_at, co.end_at, co.time_window, co.location_label, co.counter, co.counter_note
    from public.campaign_offers co
    left join public.fleets f on f.id=co.target_fleet_id
   where co.target_oem_org_id = (select org_id from public._kovio_caller_org())
   order by (co.status='pending') desc, (co.status='countered') desc, co.created_at desc;
$$;
grant execute on function public.kovio_oem_offers() to authenticated;

-- my_offers: add terms, counter, and creative so the advertiser can review.
drop function if exists public.kovio_my_offers();
create function public.kovio_my_offers()
returns table (id uuid, name text, status text, decision_reason text, oem_name text, fleet_name text,
  budget_total_cents bigint, cost_per_impression_cents numeric, created_at timestamptz, decided_at timestamptz,
  start_at date, end_at date, time_window text, location_label text, counter jsonb, counter_note text,
  advertiser_name text, creative_url text, creative_type text)
language sql security definer set search_path = public stable as $$
  select co.id, co.name, co.status, co.decision_reason, o.name::text, f.name::text,
         co.budget_total_cents, co.cost_per_impression_cents, co.created_at, co.decided_at,
         co.start_at, co.end_at, co.time_window, co.location_label, co.counter, co.counter_note,
         co.advertiser_name, co.creative_url, co.creative_type
    from public.campaign_offers co
    join public.organizations o on o.id=co.target_oem_org_id
    left join public.fleets f on f.id=co.target_fleet_id
   where co.advertiser_user = auth.uid()
   order by (co.status='countered') desc, co.created_at desc;
$$;
grant execute on function public.kovio_my_offers() to authenticated;

-- counter_offer: operator proposes adjusted terms on a pending offer.
create or replace function public.kovio_counter_offer(p_offer_id uuid, p_counter jsonb, p_note text)
returns table (offer_id uuid, advertiser_email text, advertiser_name text, campaign_name text)
language plpgsql security definer set search_path = public as $$
declare v_caller_org uuid; v_row public.campaign_offers%rowtype;
begin
  select org_id into v_caller_org from public._kovio_caller_org();
  select * into v_row from public.campaign_offers where id=p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_row.target_oem_org_id is distinct from v_caller_org then raise exception 'not_authorized'; end if;
  if v_row.status <> 'pending' then raise exception 'already_decided'; end if;
  update public.campaign_offers
     set status='countered', counter=p_counter, counter_note=nullif(p_note,''),
         countered_at=now(), updated_at=now()
   where id=p_offer_id;
  return query select v_row.id,
    (select u.email from public.users u where u.supabase_user_id=v_row.advertiser_user limit 1),
    v_row.advertiser_name, v_row.name;
end; $$;
grant execute on function public.kovio_counter_offer(uuid,jsonb,text) to authenticated;

-- respond_counter: advertiser accepts (applies the counter) or declines it.
create or replace function public.kovio_respond_counter(p_offer_id uuid, p_accept boolean)
returns table (offer_id uuid, oem_email text, oem_name text, campaign_name text, decision text)
language plpgsql security definer set search_path = public as $$
declare v_row public.campaign_offers%rowtype;
begin
  select * into v_row from public.campaign_offers where id=p_offer_id for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_row.advertiser_user is distinct from auth.uid() then raise exception 'not_authorized'; end if;
  if v_row.status <> 'countered' then raise exception 'not_countered'; end if;
  if p_accept then
    update public.campaign_offers set
      cost_per_impression_cents = coalesce((counter->>'cpi_cents')::numeric, cost_per_impression_cents),
      budget_total_cents        = coalesce((counter->>'budget_cents')::bigint, budget_total_cents),
      start_at                  = coalesce((counter->>'start_at')::date, start_at),
      end_at                    = coalesce((counter->>'end_at')::date, end_at),
      time_window               = coalesce(counter->>'time_window', time_window),
      location_label            = coalesce(counter->>'location_label', location_label),
      status='accepted', decided_at=now(), updated_at=now()
    where id=p_offer_id;
  else
    update public.campaign_offers set status='rejected', decided_at=now(), updated_at=now() where id=p_offer_id;
  end if;
  return query select v_row.id,
    (select u.email from public.users u where u.org_id=v_row.target_oem_org_id order by (u.role='admin') desc, u.created_at limit 1),
    (select o.name::text from public.organizations o where o.id=v_row.target_oem_org_id),
    v_row.name, case when p_accept then 'accepted' else 'rejected' end;
end; $$;
grant execute on function public.kovio_respond_counter(uuid,boolean) to authenticated;
