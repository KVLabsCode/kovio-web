-- Custom campaign offers (advertiser -> OEM brokering / approval inbox).
--
-- An advertiser "places" a custom campaign with a specific OEM (optionally a
-- specific fleet). The OEM sees it in their Campaigns tab with full info and
-- Accepts or Rejects based on content. Decoupled from the paid campaign engine
-- (this is the approval layer); wiring an accepted offer into actual serving is
-- a later step.
--
-- Identity is resolved through public.users.supabase_user_id = auth.uid(). The
-- table itself is RLS-locked with NO policies, so it is unreachable directly by
-- the anon/authenticated roles — every access goes through the SECURITY DEFINER
-- RPCs below, which enforce who-can-see-what.

create table if not exists public.campaign_offers (
  id                        uuid primary key default gen_random_uuid(),
  advertiser_user           uuid not null default auth.uid(),        -- placer (auth uid)
  advertiser_org_id         uuid references public.organizations(id),
  advertiser_name           text not null,                           -- brand/display name
  target_oem_org_id         uuid not null references public.organizations(id),
  target_fleet_id           uuid references public.fleets(id),
  name                      text not null,
  creative_url              text,
  creative_type             text,                                    -- image | video | html
  category                  text,
  targeting                 jsonb not null default '[]'::jsonb,
  budget_total_cents        bigint not null default 0,
  cost_per_impression_cents numeric,
  message                   text,                                    -- note to the OEM
  status                    text not null default 'pending'
                              check (status in ('pending','accepted','rejected')),
  decision_reason           text,
  decided_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists ix_campaign_offers_oem on public.campaign_offers (target_oem_org_id, status);
create index if not exists ix_campaign_offers_adv on public.campaign_offers (advertiser_user, created_at desc);

-- Locked down: RLS on, no policies -> no direct table access. Use the RPCs.
alter table public.campaign_offers enable row level security;

-- ---------------------------------------------------------------------------
-- Identity helper: the caller's backend org (id, name, kind) from their auth uid.
-- ---------------------------------------------------------------------------
create or replace function public._kovio_caller_org()
returns table (org_id uuid, org_name text, kind text)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.name::text, o.kind::text
    from public.users u
    join public.organizations o on o.id = u.org_id
   where u.supabase_user_id = auth.uid()
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Directory: OEM orgs + their fleets, so an advertiser can choose who to place
-- a custom campaign with. Names only — no emails or private data.
-- ---------------------------------------------------------------------------
create or replace function public.kovio_oem_directory()
returns table (oem_org_id uuid, oem_name text, fleet_id uuid, fleet_name text, region text)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.name::text, f.id, f.name::text, f.region::text
    from public.organizations o
    left join public.fleets f on f.org_id = o.id
   where o.kind = 'oem' and o.status = 'active'
   order by o.name, f.name;
$$;

grant execute on function public.kovio_oem_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- Place an offer. Resolves the advertiser's org from their auth uid, inserts
-- the offer, and returns the target OEM's notification email (admin user) so the
-- server route can send it — the email is NEVER exposed to the browser because
-- this RPC is only called server-side.
-- ---------------------------------------------------------------------------
create or replace function public.kovio_place_offer(
  p_target_oem     uuid,
  p_target_fleet   uuid,
  p_name           text,
  p_advertiser_name text,
  p_creative_url   text,
  p_creative_type  text,
  p_category       text,
  p_targeting      jsonb,
  p_budget_cents   bigint,
  p_cpi            numeric,
  p_message        text
)
returns table (offer_id uuid, oem_email text, oem_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adv_org  uuid;
  v_offer_id uuid;
begin
  select org_id into v_adv_org from public._kovio_caller_org();

  -- Validate the target is a real OEM org.
  if not exists (select 1 from public.organizations where id = p_target_oem and kind = 'oem') then
    raise exception 'invalid_target_oem';
  end if;
  -- If a fleet is specified it must belong to the target OEM.
  if p_target_fleet is not null and not exists (
    select 1 from public.fleets where id = p_target_fleet and org_id = p_target_oem
  ) then
    raise exception 'invalid_target_fleet';
  end if;

  insert into public.campaign_offers (
    advertiser_user, advertiser_org_id, advertiser_name,
    target_oem_org_id, target_fleet_id, name, creative_url, creative_type,
    category, targeting, budget_total_cents, cost_per_impression_cents, message
  ) values (
    auth.uid(), v_adv_org, coalesce(nullif(p_advertiser_name, ''), 'An advertiser'),
    p_target_oem, p_target_fleet, p_name, p_creative_url, p_creative_type,
    p_category, coalesce(p_targeting, '[]'::jsonb), coalesce(p_budget_cents, 0), p_cpi, p_message
  )
  returning id into v_offer_id;

  return query
    select v_offer_id,
           (select u.email from public.users u
             where u.org_id = p_target_oem
             order by (u.role = 'admin') desc, u.created_at
             limit 1),
           (select o.name::text from public.organizations o where o.id = p_target_oem);
end;
$$;

grant execute on function public.kovio_place_offer(uuid,uuid,text,text,text,text,text,jsonb,bigint,numeric,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Advertiser: my placed offers (with the target OEM/fleet names for display).
-- ---------------------------------------------------------------------------
create or replace function public.kovio_my_offers()
returns table (
  id uuid, name text, status text, decision_reason text,
  oem_name text, fleet_name text, budget_total_cents bigint,
  created_at timestamptz, decided_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select co.id, co.name, co.status, co.decision_reason,
         o.name::text, f.name::text, co.budget_total_cents,
         co.created_at, co.decided_at
    from public.campaign_offers co
    join public.organizations o on o.id = co.target_oem_org_id
    left join public.fleets f on f.id = co.target_fleet_id
   where co.advertiser_user = auth.uid()
   order by co.created_at desc;
$$;

grant execute on function public.kovio_my_offers() to authenticated;

-- ---------------------------------------------------------------------------
-- OEM: incoming offers for the caller's org (full content for review).
-- ---------------------------------------------------------------------------
create or replace function public.kovio_oem_offers()
returns table (
  id uuid, advertiser_name text, name text, creative_url text, creative_type text,
  category text, targeting jsonb, budget_total_cents bigint,
  cost_per_impression_cents numeric, message text, fleet_name text,
  status text, decision_reason text, created_at timestamptz, decided_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select co.id, co.advertiser_name, co.name, co.creative_url, co.creative_type,
         co.category, co.targeting, co.budget_total_cents,
         co.cost_per_impression_cents, co.message, f.name::text,
         co.status, co.decision_reason, co.created_at, co.decided_at
    from public.campaign_offers co
    left join public.fleets f on f.id = co.target_fleet_id
   where co.target_oem_org_id = (select org_id from public._kovio_caller_org())
   order by (co.status = 'pending') desc, co.created_at desc;
$$;

grant execute on function public.kovio_oem_offers() to authenticated;

-- ---------------------------------------------------------------------------
-- OEM: accept/reject an offer. Verifies the caller's org owns the offer, then
-- records the decision and returns the advertiser's email (for the server route
-- to notify them). Idempotent-guarded: only pending offers can be decided.
-- ---------------------------------------------------------------------------
create or replace function public.kovio_decide_offer(
  p_offer_id uuid,
  p_decision text,
  p_reason   text
)
returns table (offer_id uuid, advertiser_email text, advertiser_name text, campaign_name text, decision text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_org uuid;
  v_row        public.campaign_offers%rowtype;
begin
  if p_decision not in ('accepted','rejected') then
    raise exception 'invalid_decision';
  end if;

  select org_id into v_caller_org from public._kovio_caller_org();

  select * into v_row from public.campaign_offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_row.target_oem_org_id is distinct from v_caller_org then
    raise exception 'not_authorized';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'already_decided';
  end if;

  update public.campaign_offers
     set status = p_decision,
         decision_reason = nullif(p_reason, ''),
         decided_at = now(),
         updated_at = now()
   where id = p_offer_id;

  return query
    select v_row.id,
           (select u.email from public.users u where u.supabase_user_id = v_row.advertiser_user limit 1),
           v_row.advertiser_name,
           v_row.name,
           p_decision;
end;
$$;

grant execute on function public.kovio_decide_offer(uuid,text,text) to authenticated;
