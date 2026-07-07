-- Operator account claiming.
--
-- Admin generates a claim link for an operator org (e.g. Robot.com) addressed
-- to a specific email. The recipient opens /claim/<token>, signs in with that
-- email, and their account is associated with the org (users row created or
-- moved). The token only works for the invited email, expires in 14 days, and
-- is single-use.

create table if not exists public.org_claims (
  token      text primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  claimed_at timestamptz,
  claimed_by uuid
);
create index if not exists ix_org_claims_org on public.org_claims (org_id, created_at desc);
alter table public.org_claims enable row level security; -- no policies: RPC-only

-- Admin: mint a claim link for an org + email. Returns the token for the email.
create or replace function public.kovio_admin_create_claim(p_org_id uuid, p_email text)
returns table (token text, org_name text)
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'invalid_org';
  end if;
  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid_email'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.org_claims (token, org_id, email)
  values (v_token, p_org_id, lower(trim(p_email)));
  return query select v_token,
    (select o.name::text from public.organizations o where o.id = p_org_id);
end; $$;
grant execute on function public.kovio_admin_create_claim(uuid,text) to authenticated;

-- Recipient: claim. Must be signed in with the invited email. Creates or moves
-- their public.users row into the org, marks the token used.
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
  if v_email = '' or v_email <> v_claim.email then raise exception 'wrong_email'; end if;

  -- Associate: move the existing users row, or create one for a fresh account.
  update public.users set org_id = v_claim.org_id where supabase_user_id = auth.uid();
  if not found then
    insert into public.users (supabase_user_id, email, org_id, role)
    values (auth.uid(), v_email, v_claim.org_id, 'admin');
  end if;

  update public.org_claims set claimed_at = now(), claimed_by = auth.uid() where token = p_token;

  return query select o.name::text, o.kind::text from public.organizations o where o.id = v_claim.org_id;
end; $$;
grant execute on function public.kovio_claim_org(text) to authenticated;

-- Peek at a claim (which org, is it still valid) so the claim page can render
-- before sign-in. No email disclosure beyond a hint.
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
    regexp_replace(v_claim.email, '^(.).*(@.*)$', '\1***\2'),
    (v_claim.claimed_at is null and v_claim.expires_at >= now()),
    case when v_claim.claimed_at is not null then 'already_claimed'
         when v_claim.expires_at < now() then 'expired'
         else 'ok' end;
end; $$;
grant execute on function public.kovio_claim_info(text) to anon, authenticated;

-- Admin operators list: also surface the latest pending invite per org.
drop function if exists public.kovio_admin_operators();
create function public.kovio_admin_operators()
returns table (org_id uuid, name text, accepting boolean, member_emails text[], pending_invite text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  return query select o.id, o.name::text, coalesce(t.published, false),
    coalesce((select array_agg(u.email order by u.created_at) from public.users u where u.org_id = o.id), '{}'),
    (select c.email from public.org_claims c
      where c.org_id = o.id and c.claimed_at is null and c.expires_at >= now()
      order by c.created_at desc limit 1)
    from public.organizations o
    left join public.oem_terms t on t.org_id = o.id
   where o.kind = 'oem' order by o.name;
end; $$;
grant execute on function public.kovio_admin_operators() to authenticated;
