-- Claim pages for advertisers (e.g. Pylon), created from the admin dashboard.
--
-- 1. kovio_admin_create_org: admin creates an advertiser (or operator) org by
--    name — slug auto-generated, uniquified on collision.
-- 2. kovio_admin_advertisers: advertiser orgs + members + pending claim link,
--    mirroring the operators list.
-- 3. create_claim / claim_info gain org_kind so the invite email, claim page
--    copy, and post-claim redirect adapt (advertiser → /dashboard).

create or replace function public.kovio_admin_create_org(p_name text, p_kind text)
returns table (org_id uuid, name text, kind text)
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_base text; v_id uuid; v_try int := 0;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if p_kind not in ('advertiser','oem') then raise exception 'invalid_kind'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'invalid_name'; end if;
  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'org'; end if;
  loop
    v_slug := case when v_try = 0 then v_base else v_base || '-' || substr(md5(random()::text), 1, 4) end;
    begin
      insert into public.organizations (name, slug, kind, status)
      values (trim(p_name), v_slug, p_kind, 'active')
      returning id into v_id;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then raise exception 'slug_conflict'; end if;
    end;
  end loop;
  return query select v_id, trim(p_name), p_kind;
end; $$;
grant execute on function public.kovio_admin_create_org(text,text) to authenticated;

create or replace function public.kovio_admin_advertisers()
returns table (org_id uuid, name text, member_emails text[], pending_invite text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text,
    coalesce((select array_agg(u.email order by u.created_at) from public.users u where u.org_id = o.id), '{}'),
    (select coalesce(c.email, 'open link') from public.org_claims c
      where c.org_id = o.id and c.claimed_at is null and c.expires_at >= now()
      order by c.created_at desc limit 1)
    from public.organizations o
   where o.kind = 'advertiser' order by o.created_at desc;
end; $$;
grant execute on function public.kovio_admin_advertisers() to authenticated;

-- create_claim: also return the org kind (email wording adapts).
drop function if exists public.kovio_admin_create_claim(uuid,text);
create function public.kovio_admin_create_claim(p_org_id uuid, p_email text default null)
returns table (token text, org_name text, org_kind text)
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'invalid_org';
  end if;
  if p_email is not null and p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.org_claims (token, org_id, email)
  values (v_token, p_org_id, case when p_email is null then null else lower(trim(p_email)) end);
  return query select v_token, o.name::text, o.kind::text
    from public.organizations o where o.id = p_org_id;
end; $$;
grant execute on function public.kovio_admin_create_claim(uuid,text) to authenticated;

-- claim_info: also return the org kind (claim-page copy + redirect adapt).
drop function if exists public.kovio_claim_info(text);
create function public.kovio_claim_info(p_token text)
returns table (org_name text, org_kind text, invited_email_hint text, valid boolean, reason text)
language plpgsql security definer set search_path = public stable as $$
declare v_claim public.org_claims%rowtype;
begin
  select * into v_claim from public.org_claims where token = p_token;
  if not found then
    return query select null::text, null::text, null::text, false, 'not_found'; return;
  end if;
  return query select
    (select o.name::text from public.organizations o where o.id = v_claim.org_id),
    (select o.kind::text from public.organizations o where o.id = v_claim.org_id),
    case when v_claim.email is null then null
         else regexp_replace(v_claim.email, '^(.).*(@.*)$', '\1***\2') end,
    (v_claim.claimed_at is null and v_claim.expires_at >= now()),
    case when v_claim.claimed_at is not null then 'already_claimed'
         when v_claim.expires_at < now() then 'expired'
         else 'ok' end;
end; $$;
grant execute on function public.kovio_claim_info(text) to anon, authenticated;
