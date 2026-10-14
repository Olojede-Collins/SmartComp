# backend/migrations

Versioned SQL migrations for the ABU Smart Class Inventory database (TRD §3).

## Naming

Each migration is a pair of files sharing the same `NNNN_slug` stem:

```
0001_condition_enum.up.sql
0001_condition_enum.down.sql
```

- `NNNN` — zero-padded version, starting at `0001`, contiguous, no gaps.
- `slug` — lowercase snake_case.
- `.up.sql` / `.down.sql` — apply and inverse.

The static checker (`scripts/check-migrations.mjs`, wired into `npm run lint`)
enforces naming, pairing, contiguous versions, and the absence of `TBD`
markers inside applied SQL.

## Apply order

**Up:** ascending version order — `0001` → `0002` → … → `0007`.

**Down:** descending version order — `0007` → `0006` → … → `0001`.

## How they are applied

There is no auto-migration runner in this project (TRD §3.4, CICD §6.3).
Migrations are applied manually by the developer in the **Supabase SQL
editor** against the cloud dev project, before each backend deploy:

1. Open the Supabase dashboard → SQL editor for the target project.
2. Paste the next pending `.up.sql` file in version order and run it.
3. Record the applied version in your notes / the team checklist.
4. Repeat for every pending migration.

Agents must never live-apply migrations to the Supabase cloud project.
Local verification (CI / agents) uses disposable ephemeral databases only —
see `MIGRATION_NOTES.md` for the probe queries Israel runs once after
applying `0007_rls.up.sql`.

## Contents

| Version | Name | Purpose |
| ------- | ---- | ------- |
| 0001 | condition_enum | `condition_enum` type (D1; PRD FR-2.1) |
| 0002 | admins | Admin accounts linked to `auth.users` |
| 0003 | equipment | Core inventory table (D3; C5/C2/I14) |
| 0004 | admin_invites | Single-use invite tokens (FR-7) |
| 0005 | audit_log | Append-only audit trail (C2) |
| 0006 | indexes | `equipment.updated_at DESC`, `audit_log.created_at` |
| 0007 | rls | RLS enable + 7 policies + anon/append-only revokes (§3.3) |

TBD register, open observations, and post-apply probes: **MIGRATION_NOTES.md**.
