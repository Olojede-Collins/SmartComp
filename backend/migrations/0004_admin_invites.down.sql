-- 0004_admin_invites (down) — inverse of 0004_admin_invites.up.sql.
-- DROP TABLE also removes the partial unique index admin_invites_email_pending_key.

DROP TABLE IF EXISTS admin_invites;
