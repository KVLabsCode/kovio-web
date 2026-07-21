-- Marketing-site leads (kovio.dev): table marketing_leads (RLS-locked) +
-- anon-callable kovio_submit_lead (validated, rate-limited) + admin RPCs
-- kovio_admin_leads / kovio_admin_update_lead + storage policy allowing anon
-- INSERT to creatives/leads/* only. Full bodies in applied migration
-- 'marketing_leads' on prod.

-- 2026-07-21 (applied migration 'agency_leads'): kind check widened to
-- ('trial','fleet','agency'); kovio_submit_lead re-created to accept it.
