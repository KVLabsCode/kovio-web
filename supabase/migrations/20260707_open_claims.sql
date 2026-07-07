-- Copyable claim links: the invited email becomes optional.
--
-- With an email, the claim link only works for that address (as before). With
-- no email, it's an "open" link the admin copies and shares however they like —
-- the first person to sign in and claim gets the account. Still single-use and
-- 14-day expiry either way.

alter table public.org_claims alter column email drop not null;

create or replace function public.kovio_admin_create_claim(p_org_id uuid, p_email text default null)
returns table (token text, org_name text)
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
  return query select v_token,
    (select o.name::text from public.organizations o where o.id = p_org_id);
end; $$;
grant execute on function public.kovio_admin_create_claim(uuid,text) to authenticated;

create or replace function public.kovio_claim_org(p_token text)
returns table (org_name text, kind text)
language plpgsql security definer set search_path = public as $$
declare v_claim public.org_claims%rowtype; v_email text;
begin
  select * into v_claim from public.org_claims where token = p_token for update;
  if not found then raise exception 'claim_not_found'; end if;
  if v_claim.claimed_at is not null then raise exception 'already_claimed'; end if;
  if v_claim.expires_at < now() then raise exception 'claim_expired'; end if;

  v_email := lower(coalesce(public._kovio_caller_email(), ''));
  if v_email = '' then raise exception 'wrong_email'; end if;
  -- Email-bound links only work for the invited address; open links bind to
  -- whoever claims first.
  if v_claim.email is not null and v_email <> v_claim.email then raise exception 'wrong_email'; end if;

  update public.users set org_id = v_claim.org_id where supabase_user_id = auth.uid();
  if not found then
    insert into public.users (supabase_user_id, email, org_id, role)
    values (auth.uid(), v_email, v_claim.org_id, 'admin');
  end if;

  update public.org_claims set claimed_at = now(), claimed_by = auth.uid() where token = p_token;

  return query select o.name::text, o.kind::text from public.organizations o where o.id = v_claim.org_id;
end; $$;
grant execute on function public.kovio_claim_org(text) to authenticated;

create or replace function public.kovio_claim_info(p_token text)
returns table (org_name text, invited_email_hint text, valid boolean, reason text)
language plpgsql security definer set search_path = public stable as $$
declare v_claim public.org_claims%rowtype;
begin
  select * into v_claim from public.org_claims where token = p_token;
  if not found then
    return query select null::text, null::text, false, 'not_found'; return;
  end if;
  return query select
    (select o.name::text from public.organizations o where o.id = v_claim.org_id),
    case when v_claim.email is null then null
         else regexp_replace(v_claim.email, '^(.).*(@.*)$', '\1***\2') end,
    (v_claim.claimed_at is null and v_claim.expires_at >= now()),
    case when v_claim.claimed_at is not null then 'already_claimed'
         when v_claim.expires_at < now() then 'expired'
         else 'ok' end;
end; $$;
grant execute on function public.kovio_claim_info(text) to anon, authenticated;

-- Pending-invite display copes with open links.
drop function if exists public.kovio_admin_operators();
create function public.kovio_admin_operators()
returns table (org_id uuid, name text, accepting boolean, member_emails text[], pending_invite text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text, coalesce(t.published, false),
    coalesce((select array_agg(u.email order by u.created_at) from public.users u where u.org_id = o.id), '{}'),
    (select coalesce(c.email, 'open link') from public.org_claims c
      where c.org_id = o.id and c.claimed_at is null and c.expires_at >= now()
      order by c.created_at desc limit 1)
    from public.organizations o
    left join public.oem_terms t on t.org_id = o.id
   where o.kind = 'oem' order by o.name;
end; $$;
grant execute on function public.kovio_admin_operators() to authenticated;
