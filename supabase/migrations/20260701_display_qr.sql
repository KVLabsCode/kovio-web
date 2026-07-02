-- Per-campaign QR overlay for OEM custom campaigns (custom displays).
--
-- One movable/resizable QR code per custom display. Position (x, y) and size are
-- stored as fractions (0..1) of the full-screen player stage so the OEM can place
-- the QR beside their logo and resize it. The QR resolves through the existing
-- tracked-redirect infra: it encodes /r/<link_code>, which bumps
-- campaign_links.scan_count and 302s to the configured target_url. This reuses
-- campaign_links (code, target_url, scan_count) rather than duplicating it.

create table if not exists public.display_qr (
  display_code text primary key,          -- CustomDisplay.code (the /display/<code> screen)
  link_code    text not null,             -- campaign_links.code the QR encodes (/r/<link_code>)
  enabled      boolean not null default true,
  x            real not null default 0.70, -- left, fraction of stage width  (0..1)
  y            real not null default 0.68, -- top,  fraction of stage height (0..1)
  size         real not null default 0.22, -- QR box width, fraction of stage width (0..1)
  owner        uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.display_qr enable row level security;

drop policy if exists "owner can insert" on public.display_qr;
create policy "owner can insert" on public.display_qr
  for insert with check (owner = auth.uid());
drop policy if exists "owner can select" on public.display_qr;
create policy "owner can select" on public.display_qr
  for select using (owner = auth.uid());
drop policy if exists "owner can update" on public.display_qr;
create policy "owner can update" on public.display_qr
  for update using (owner = auth.uid());
drop policy if exists "owner can delete" on public.display_qr;
create policy "owner can delete" on public.display_qr
  for delete using (owner = auth.uid());

-- Public read for the full-screen player, which runs unauthenticated on a robot
-- screen. SECURITY DEFINER bypasses RLS and joins the redirect target so the
-- player can build the QR in one call. Only enabled overlays are returned.
create or replace function public.get_display_qr(p_code text)
returns table (
  enabled    boolean,
  target_url text,
  link_code  text,
  x          real,
  y          real,
  size       real
)
language sql
security definer
set search_path = public
as $$
  select q.enabled, l.target_url, q.link_code, q.x, q.y, q.size
    from public.display_qr q
    join public.campaign_links l on l.code = q.link_code
   where q.display_code = p_code
     and q.enabled = true;
$$;

grant execute on function public.get_display_qr(text) to anon, authenticated;
