-- Public read path for the fleet-rendered creative. SECURITY DEFINER so an
-- anonymous scanner/fleet can read the image without a table grant (RLS owner
-- policy would otherwise hide the row). Returns 0 rows for an unknown code.
create or replace function public.get_creative(p_code text)
returns table(image_url text)
language sql
security definer
set search_path = public
as $$
  select image_url from public.campaign_links where code = p_code;
$$;

grant execute on function public.get_creative(text) to anon, authenticated;
