-- Admin management: rename orgs, delete users (with their offer data), delete
-- offers, delete empty orgs. All admin-gated.

create or replace function public.kovio_admin_rename_org(p_org_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'invalid_name'; end if;
  update public.organizations set name = trim(p_name), updated_at = now() where id = p_org_id;
  if not found then raise exception 'invalid_org'; end if;
end; $$;
grant execute on function public.kovio_admin_rename_org(uuid,text) to authenticated;

create or replace function public.kovio_admin_delete_offer(p_offer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  delete from public.campaign_offers where id = p_offer_id;
end; $$;
grant execute on function public.kovio_admin_delete_offer(uuid) to authenticated;

create or replace function public.kovio_admin_delete_user(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  if exists (select 1 from public.admin_emails a where lower(a.email) = lower(trim(p_email))) then
    raise exception 'cannot_delete_admin';
  end if;
  select supabase_user_id into v_uid from public.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'user_not_found'; end if;
  delete from public.campaign_offers where advertiser_user = v_uid;
  delete from public.offer_comments where author_user = v_uid;
  delete from public.campaign_links where owner = v_uid;
  delete from public.display_qr where owner = v_uid;
  delete from public.users where supabase_user_id = v_uid;
end; $$;
grant execute on function public.kovio_admin_delete_user(text) to authenticated;

create or replace function public.kovio_admin_delete_org(p_org_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if not public.kovio_is_admin() then raise exception 'not_admin'; end if;
  select kind into v_kind from public.organizations where id = p_org_id;
  if v_kind is null then raise exception 'invalid_org'; end if;
  if v_kind = 'admin' then raise exception 'cannot_delete_admin_org'; end if;
  if exists (select 1 from public.impressions where advertiser_org_id = p_org_id or oem_org_id = p_org_id)
     or exists (select 1 from public.transactions where org_id = p_org_id)
     or exists (select 1 from public.events_raw e join public.fleets f on f.id = e.fleet_id where f.org_id = p_org_id)
  then
    raise exception 'org_has_activity';
  end if;
  delete from public.showcase_campaigns where org_id = p_org_id;
  delete from public.org_claims where org_id = p_org_id;
  delete from public.oem_terms where org_id = p_org_id;
  delete from public.campaign_offers where target_oem_org_id = p_org_id or advertiser_org_id = p_org_id;
  delete from public.display_assignments where display_id in (select id from public.custom_displays where org_id = p_org_id);
  delete from public.custom_display_items where display_id in (select id from public.custom_displays where org_id = p_org_id);
  delete from public.custom_displays where org_id = p_org_id;
  delete from public.campaigns where org_id = p_org_id;
  delete from public.api_keys where org_id = p_org_id;
  delete from public.robots where fleet_id in (select id from public.fleets where org_id = p_org_id);
  delete from public.fleets where org_id = p_org_id;
  update public.users set org_id = null where org_id = p_org_id;
  update public.admin_view_state set prev_org_id = null where prev_org_id = p_org_id;
  delete from public.organizations where id = p_org_id;
end; $$;
grant execute on function public.kovio_admin_delete_org(uuid) to authenticated;
