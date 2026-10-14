-- 0004_admin_invites — TRD §3.2 admin_invites table (FR-7 acceptance flow).
-- email: NOT NULL, UNIQUE while pending (accepted_at IS NULL) — partial unique index below.
-- token_hash: SHA-256 of the emailed single-use token; plaintext never stored (TRD §3.2).
-- invited_by: FK → admins(id) — on-delete action not specified in TRD → Postgres default (NO ACTION).

CREATE TABLE admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid REFERENCES admins (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX admin_invites_email_pending_key
  ON admin_invites (email)
  WHERE accepted_at IS NULL;
