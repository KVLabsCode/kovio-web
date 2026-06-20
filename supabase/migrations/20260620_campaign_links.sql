create table if not exists public.campaign_links (
  code text primary key,
  target_url text not null,
  image_url text,
  campaign_id text,
  owner uuid not null default auth.uid(),
  scan_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.campaign_links enable row level security;

create policy "owner can insert" on public.campaign_links
  for insert with check (owner = auth.uid());
create policy "owner can select" on public.campaign_links
  for select using (owner = auth.uid());
create policy "owner can update" on public.campaign_links
  for update using (owner = auth.uid());

-- Public scan increment: SECURITY DEFINER so anonymous scanners can bump the
-- counter without a direct table grant. Returns the redirect target.
create or replace function public.increment_scan(p_code text)
returns text
language sql
security definer
set search_path = public
as $$
  update public.campaign_links
     set scan_count = scan_count + 1
   where code = p_code
  returning target_url;
$$;

grant execute on function public.increment_scan(text) to anon, authenticated;
