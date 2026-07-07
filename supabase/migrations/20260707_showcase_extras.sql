-- Claimed-at surfaced to admin + own-org showcases for the post-claim dashboard.
drop function if exists public.kovio_admin_advertisers();
create function public.kovio_admin_advertisers()
returns table (org_id uuid, name text, member_emails text[], pending_invite text, claimed_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text,
    coalesce((select array_agg(u.email order by u.created_at) from public.users u where u.org_id = o.id), '{}'),
    (select coalesce(c.email, 'open link') from public.org_claims c
      where c.org_id = o.id and c.claimed_at is null and c.expires_at >= now()
      order by c.created_at desc limit 1),
    (select max(c.claimed_at) from public.org_claims c where c.org_id = o.id)
    from public.organizations o
   where o.kind = 'advertiser' order by o.created_at desc;
end; $$;
grant execute on function public.kovio_admin_advertisers() to authenticated;

create or replace function public.kovio_my_showcases()
returns table (id uuid, name text, video_url text, video_kind text,
  location_label text, duration_label text, metrics jsonb)
language sql security definer set search_path = public stable as $$
  select s.id, s.name, s.video_url, s.video_kind, s.location_label, s.duration_label, s.metrics
    from public.showcase_campaigns s
   where s.org_id = (select org_id from public._kovio_caller_org())
   order by s.created_at;
$$;
grant execute on function public.kovio_my_showcases() to authenticated;
