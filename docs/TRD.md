# TRD — ABU Smart Class Inventory

**Precedence.** This document defines HOW the PRD gets built: stack and per-tier ceilings, data layer with RLS, API contracts, the push-webhook + ISR freshness split, image pipelines, email delivery, heartbeat, secrets inventory, budget enforcement, and per-dependency failure branches. It is governed by the Project Summary on framing and by the **PRD on all product scope** (PRD wins on WHAT; this document wins on HOW, and outranks the PRD and Project Summary on pure technical detail). The `design/` handoff folder is authoritative for visual/interaction detail and is subordinate to this document on architecture and functional scope. Same-level conflicts: most recent revision governs; flag to the user, never resolve silently (writing-standards §2). Every PRD open risk (PRD §8) is resolved below or explicitly carried forward in §14. Specialised detail (backend internals beyond this doc, security controls, CI/CD pipelines) lives in `docs/ARCHITECTURE_BACKEND.md`, `docs/SECURITY.md` and `docs/CICD.md` (manifest items 4–6, later batches) — cross-referenced, not restated.

---

## 1. Build & Runtime Environment

### 1.1 Confirmed stack (envelope D4; ceilings I6–I10)

| Layer               | Choice                                          | Binding ceiling / constraint                                                                                                                                                         |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend + admin UI | Next.js on **Vercel Hobby**                     | Functions ≤ 300 s; proxied external request timeout 120 s; ISR supported; **no Docker** (I8)                                                                                         |
| Backend API         | **Node.js in Docker on Render free**            | 0.1 CPU / **512 MB RAM**, 750 instance-hours/mo, idle spin-down after 15 min, ~1 min restart, **no persistent disks, no one-off jobs, no SSH**; Docker builds supported on free (I6) |
| Database + Auth     | **Supabase** (Postgres, Auth, RLS)              | argon2id (Supabase default); free tier pauses after 7 days inactivity → daily heartbeat (I9)                                                                                         |
| Image storage       | **Cloudflare R2**, public bucket, S3-compatible | 10M Class B reads/mo free, zero egress (I10)                                                                                                                                         |
| Email               | **Gmail REST API over HTTPS (Option A)**        | SMTP ports 25/465/587 blocked on Render (live since 26 Sep 2025) — SMTP is NOT an option (I7)                                                                                        |
| Scheduler           | **GitHub Actions** daily cron                   | Heartbeat + optional ISR nudge (I9)                                                                                                                                                  |

### 1.2 Docker scope correction (I13/C4)

Docker containerization applies to the **Render backend only**. The frontend deploys as a Vercel build output — Vercel does not run Docker. `sharp` is a native module: it must be installed and executed **on Render**, never on Vercel.

### 1.3 Language & versions

Backend runtime must be **Node.js** (mandated: `sharp` is a native Node module — I16/D3). Implementation language: **TypeScript** (app + backend; OR-6, pinned at implementation kickoff 2026-10-13). Version pins (real installs at first commit): Next.js **16.4.0**, Node.js LTS **24** (local/CI v24.11.1; Docker base `node:24.11.1-alpine`), Express **5.3.0**, TypeScript **6.0.3** (latest within typescript-eslint@8.71.2 peer range `<6.1.0`; TS 7.0.2 exists but is ecosystem peer-capped — revisit when typescript-eslint ships support), ESLint **10.12.0**, Prettier **3.9.10**, Vitest **5.0.4**, Tailwind CSS **4.3.3**, @tailwindcss/postcss **4.3.3**. Container image digest pinning deferred (flagged in S-01 handoff, HB-06).

### 1.4 Local-dev vs prod parity

Minimum parity requirement: the backend runs from the same Docker image locally and on Render; both environments read configuration exclusively from environment variables (T7). Local development uses a **dedicated cloud Supabase dev project** (no local Postgres stand-in; OR-6, pinned at implementation kickoff 2026-10-13).

## 2. Core Architecture

| Component                     | Runs on                                   | Talks to                                                                         | Protocol / auth                                                                        |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Public pages (ISR-cached)     | Vercel                                    | Supabase (inventory reads)                                                       | HTTPS (PostgREST) with anon role; RLS public `SELECT` only                             |
| Admin UI                      | Vercel                                    | Render backend API                                                               | HTTPS, Supabase session JWT (server-side-verified on Render)                           |
| Revalidation webhook endpoint | Vercel                                    | — (inbound from Render)                                                          | HTTPS POST, shared-secret validated (T6)                                               |
| Backend API                   | Render (Docker, Node.js)                  | Supabase (Postgres + Auth admin ops), R2, Gmail REST, Vercel revalidate endpoint | Service-role / user-JWT as per §3.5; presigned S3 for R2 writes; HTTPS everywhere (T8) |
| Scheduler                     | GitHub Actions                            | Render `/healthz`                                                                | HTTPS GET, daily cron                                                                  |
| Bootstrap import              | Google Sheets Apps Script → Drive → local | R2 (later, via enhancement run)                                                  | One-time; agent-assisted local enhancement (I16)                                       |

Key structural rules:

- **Render is never in the visitor request path** (D3/D4). Visitors hit Vercel's ISR cache only; this is what keeps FCP/LCP (I2/I3) independent of Render free-tier cold starts.
- Supabase Auth issues every admin session; Render verifies JWTs **server-side** (T2). argon2id hashing is Supabase's default (D6).
- All writes flow through the Render backend (admin UI never writes to Supabase directly), so every mutation passes through validation, `updated_at`/`updated_by` attribution (I14), image processing (I16), and the revalidation call (I5).

## 3. Data Layer

### 3.1 Ownership & retention

| Entity              | Storage                            | Owner                                        | Retention rule                                                                                                                |
| ------------------- | ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `equipment`         | Supabase Postgres                  | Render backend (writes); anon public (reads) | Kept for project lifetime; removal only via explicit admin delete                                                             |
| `admins`            | Supabase Postgres (+ `auth.users`) | Render backend (invite/accept/remove flows)  | Kept while the auth account exists; removal via admin action (FR-8.2)                                                         |
| `admin_invites`     | Supabase Postgres                  | Render backend                               | Pending until accepted; accepted/expired rows retained for audit continuity (lifetime TBD → OR-7, Security doc)               |
| `audit_log`         | Supabase Postgres                  | Render backend (inserts)                     | Append-only, kept for project lifetime (COREN defensibility, D8/C2)                                                           |
| Gallery images      | Cloudflare R2 (public bucket)      | Render backend (writes/deletes)              | Kept while referenced by an `equipment.image_keys[]` entry; orphan cleanup on item delete is best-effort with logged failures |
| Auth credentials    | Supabase Auth                      | Supabase                                     | Managed by platform (argon2id)                                                                                                |
| Legacy Google Sheet | Google Drive/Sheets                | User                                         | **Retired after v1 import** — Supabase is the sole source of truth post-import (D3)                                           |

### 3.2 Schema (Postgres, Supabase)

**Enum** `condition_enum`: `'Working' | 'Faulty' | 'Under Maintenance' | 'Decommissioned'` (D1; PRD FR-2.1).

**`equipment`** (full D3 field set; C5/C2/I14):

| Column                | Type             | Constraints                                                |
| --------------------- | ---------------- | ---------------------------------------------------------- |
| `id`                  | `uuid`           | PK, default `gen_random_uuid()`                            |
| `name`                | `text`           | NOT NULL                                                   |
| `core_functionality`  | `text`           |                                                            |
| `other_functionality` | `text`           |                                                            |
| `condition`           | `condition_enum` | NOT NULL                                                   |
| `quantity`            | `integer`        | NOT NULL, default `1`, CHECK (`quantity >= 0`)             |
| `image_keys`          | `text[]`         | NOT NULL, default `'{}'` — R2 object keys, ordered gallery |
| `created_at`          | `timestamptz`    | NOT NULL, default `now()`                                  |
| `updated_at`          | `timestamptz`    | NOT NULL — set by backend on every mutation                |
| `updated_by`          | `uuid`           | FK → `admins(id)` — acting admin, set on every mutation    |

**`admins`:**

| Column       | Type          | Constraints               |
| ------------ | ------------- | ------------------------- |
| `id`         | `uuid`        | PK, FK → `auth.users(id)` |
| `name`       | `text`        |                           |
| `email`      | `text`        | NOT NULL, UNIQUE          |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Flat equality: no role column with multiple values — adminship is signalled by Supabase Auth `app_metadata.role = 'admin'` (single value). D4-stack, D1 flat model.

**`admin_invites`** (needed for the FR-7 acceptance flow; TRD design decision):

| Column        | Type          | Constraints                                                                |
| ------------- | ------------- | -------------------------------------------------------------------------- |
| `id`          | `uuid`        | PK, default `gen_random_uuid()`                                            |
| `email`       | `text`        | NOT NULL, UNIQUE while pending (`accepted_at IS NULL`)                     |
| `token_hash`  | `text`        | NOT NULL — SHA-256 of the emailed single-use token; plaintext never stored |
| `invited_by`  | `uuid`        | FK → `admins(id)`                                                          |
| `created_at`  | `timestamptz` | NOT NULL, default `now()`                                                  |
| `accepted_at` | `timestamptz` | NULL until acceptance                                                      |

**`audit_log`** (admin-invite grants per task contract; C2 "audit-logged"):

| Column           | Type          | Constraints                                               |
| ---------------- | ------------- | --------------------------------------------------------- |
| `id`             | `uuid`        | PK, default `gen_random_uuid()`                           |
| `actor_admin_id` | `uuid`        | FK → `admins(id)` (the inviting/removing admin)           |
| `action`         | `text`        | e.g. `'admin.invite'`, `'admin.accept'`, `'admin.remove'` |
| `target`         | `text`        | invitee/admin email                                       |
| `created_at`     | `timestamptz` | NOT NULL, default `now()`                                 |

**Indexes:** `equipment(updated_at DESC)` (export ordering); `equipment` PK; `admins(email)` unique; `admin_invites(email)` partial unique on pending; `audit_log(created_at)`. (15-item ceiling — I1 — makes deeper indexing unnecessary.)

### 3.3 RLS policies (every table; D6)

| Table           | `anon` (public) | Authenticated (admin claim)            | Service role (Render only)                                |
| --------------- | --------------- | -------------------------------------- | --------------------------------------------------------- |
| `equipment`     | `SELECT` only   | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | full (invite-accept edge cases)                           |
| `admins`        | none            | `SELECT`, `DELETE`                     | `INSERT`, `UPDATE` (acceptance provisions row + metadata) |
| `admin_invites` | none            | `SELECT`                               | `INSERT`, `UPDATE`                                        |
| `audit_log`     | none            | `SELECT`, `INSERT`                     | `INSERT`                                                  |

Admin claim check in policies: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`. `audit_log` is append-only: `UPDATE`/`DELETE` privileges are revoked from all roles including `authenticated` (defensibility, D8). **No public write surface anywhere** (D6). All queries parameterised via PostgREST/prepared statements only (T3).

### 3.4 Migration strategy

Versioned SQL migration files live in the repository and are applied to Supabase by the developer (SQL editor or Supabase CLI). Render free has **no one-off jobs** (I6), so migrations are never executed from the backend service. Initial bootstrap: one-time Google Sheet import (Apps Script, manifest item 10) → data loaded into `equipment` → Sheet retired (D3).

### 3.5 Attribution write rule (I14/C2)

Every backend mutation of `equipment` sets `updated_at = now()` and `updated_by = <session admin id>` in the same transaction as the change. There is no history table (PRD FR-2.2); attribution satisfies "current value only" while remaining COREN-defensible (D8).

## 4. API Contract

Base: Render backend HTTPS base URL (hostname assigned at deploy). All admin endpoints require a valid Supabase session JWT verified server-side; responses use JSON error bodies of the form `{ "error": "<machine_code>", "message": "<human-readable>" }`.

Common auth failures for every admin endpoint: **401** missing/invalid/expired JWT; **403** valid session without `app_metadata.role = 'admin'`.

| Method + path                             | Purpose                                                           | Request body                                                                           | Success                                        | Error branches                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/items`                    | List all items (≤15)                                              | —                                                                                      | 200: item array                                | 401/403                                                                                                                                       |
| `POST /api/admin/items`                   | Create item                                                       | `{name, core_functionality?, other_functionality?, condition, quantity?, image_keys?}` | 201: item                                      | 401/403; **409** `condition-enum-invalid`; **409** `inventory-ceiling` when count = 15 (I1)                                                   |
| `GET /api/admin/items/:id`                | Read one                                                          | —                                                                                      | 200: item                                      | 401/403; 404                                                                                                                                  |
| `PATCH /api/admin/items/:id`              | Update fields / condition                                         | any subset of create body                                                              | 200: item                                      | 401/403; 404; **409** `condition-enum-invalid` (PRD FR-2.5)                                                                                   |
| `DELETE /api/admin/items/:id`             | Delete item (+ best-effort R2 cleanup)                            | —                                                                                      | 204                                            | 401/403; 404                                                                                                                                  |
| `POST /api/admin/items/:id/images`        | Upload image (multipart)                                          | file part                                                                              | 201: updated `image_keys`                      | 401/403; 404; **413** `image-too-large` (names byte counts vs cap); **415** `mime-rejected` (magic-byte sniff, T4); **502** `r2-write-failed` |
| `DELETE /api/admin/items/:id/images/:key` | Remove gallery image                                              | —                                                                                      | 204                                            | 401/403; 404                                                                                                                                  |
| `GET /api/admin/admins`                   | List admins                                                       | —                                                                                      | 200                                            | 401/403                                                                                                                                       |
| `POST /api/admin/admins/invites`          | Invite admin by email                                             | `{email}`                                                                              | 201                                            | 401/403; **409** `already-admin` / `invite-pending`; **502** `gmail-send-failed` (FR-7.5)                                                     |
| `POST /api/admin/invites/accept`          | Complete acceptance (called after Supabase Auth signup handshake) | `{token}`                                                                              | 200: `{status:'active'}`                       | **404** `unknown-token`; **409** `already-accepted`                                                                                           |
| `DELETE /api/admin/admins/:id`            | Remove admin                                                      | —                                                                                      | 204                                            | 401/403; 404; **409** `last-admin` with clear message (FR-8.3, D1)                                                                            |
| `GET /api/admin/export/pdf`               | COREN export (PDF)                                                | —                                                                                      | 200: PDF stream                                | 401/403; **500** `export-generation-failed`                                                                                                   |
| `GET /api/admin/export/csv`               | COREN export (CSV)                                                | —                                                                                      | 200: CSV stream                                | 401/403; **500** `export-generation-failed`                                                                                                   |
| `GET /healthz`                            | Heartbeat target (§9)                                             | —                                                                                      | 200: `{ok:true}` + trivial Supabase round-trip | 503 if Supabase round-trip fails                                                                                                              |

Export columns: floor = name, condition, quantity, `updated_at`, `updated_by` (PRD FR-9.2); full set TBD — OR-1.

**Vercel-side endpoints:**

| Method + path          | Purpose                                 | Auth                                                     | Error branches                                                                                                                                                     |
| ---------------------- | --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/revalidate` | Invalidate ISR paths after a write (T6) | Shared secret in a request header; validated server-side | **401** invalid secret; **500** `revalidate-secret-missing` when the secret env var is unset (contract-mandated 500 branch); 200 `{revalidated:true, paths:[...]}` |

Public routes (closed by Design Phase, D-019 — full map: `design/01-research/ia.md`): `/` (landing, carousel), `/room` (room view), `/item/[id]` (item detail), `/privacy`, `/admin/login`, `/admin`, `/admin/items/new`, `/admin/items/[id]`, `/admin/admins`, `/admin/invite/accept`. **No public write endpoint exists** on either platform (D6).

## 5. Integration Points & Failure Branches

| #   | System                             | Direction / purpose                                                                      | On failure                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Supabase Postgres                  | ISR pages read inventory at render/revalidate time (anon `SELECT`); backend reads/writes | Public: serve last-known-good cache (T1); no error page while cache exists. Admin write: 503 `db-unavailable`, named message; no partial writes (single transaction)                                                                                                                                                                              |
| 2   | Supabase Auth                      | Session issuance/verification                                                            | Invalid sessions → 401/403 per §4; login unavailable → Supabase-side error surfaced by the auth UI                                                                                                                                                                                                                                                |
| 3   | Cloudflare R2                      | Image reads (public bucket); writes/deletes (presigned URLs from Render — T5)            | Read failure → gallery placeholder (PRD FR-1.5). Write failure → 502 `r2-write-failed`; item row unaffected                                                                                                                                                                                                                                       |
| 4   | Vercel `/api/revalidate` (inbound) | Render notifies cache invalidation after every write                                     | Non-2xx is logged by Render. **No retry loop is required for correctness**: the 60 s time-based ISR fallback (I5/T1) converges content regardless. Vercel's 120 s proxied external-request timeout (I8) comfortably covers a single revalidate call                                                                                               |
| 5   | Gmail REST API                     | Send admin-invite emails (§8)                                                            | 4xx/5xx → 502 `gmail-send-failed`; invite row not marked sent; admin may retry (FR-7.5)                                                                                                                                                                                                                                                           |
| 6   | GitHub Actions                     | Daily heartbeat (§9)                                                                     | Missed runs → Supabase may pause after 7 days (I9); recovery is manual (dashboard activity / Supabase resume). Alerting on cron failure → `docs/CICD.md` §2 (GitHub's default workflow-failure email is the confirmed baseline); anything beyond it: **TBD — [blocking: user decision, HB-07; trigger: before v1 launch or explicitly declined]** |
| 7   | Google Sheets + Apps Script        | One-time bootstrap import (manifest item 10)                                             | Import failure → re-run script; no runtime dependency exists post-import (Sheet retired, D3)                                                                                                                                                                                                                                                      |
| 8   | Render cold start                  | Admin UI calls after ≥15 min idle                                                        | ~1 min spin-up accepted (I11); admin UI shows a waiting state and retries until 200; visitors unaffected (not in their path)                                                                                                                                                                                                                      |

## 6. Read/Write Path & Content Freshness (Option C hybrid — D3, I5)

Numbered write-to-visitor flow:

1. Admin saves a change in the admin UI (Vercel-hosted) → HTTPS request to Render backend with the admin's Supabase session JWT.
2. Render verifies the JWT server-side (T2), authorises via the admin claim, validates payload (e.g. condition enum → 409), and writes to Supabase Postgres in one transaction, setting `updated_at`/`updated_by` (I14). _(Item-image writes additionally run the §7 pipeline before the row's `image_keys` update.)_
3. Render responds 2xx to the admin UI.
4. Render **pushes** `POST https://<vercel>/api/revalidate` with the shared secret (T6) for the affected paths.
5. Vercel validates the secret (401 invalid / 500 missing env var), then marks those ISR paths stale.
6. The next visitor request re-renders the page from Supabase and serves fresh HTML.
7. **Fallback:** if steps 4–5 fail for any reason, the time-based ISR revalidation interval (**≤ 60 s**, configured to the freshness ceiling I5) re-renders the page anyway. Content converges within ≤ 60 s in every case; the push path merely makes it immediate.
8. **Invariant:** Render never appears in the visitor request path; visitors always hit Vercel ISR, so FCP/LCP (I2/I3) are independent of Render's free-tier lifecycle.

## 7. Image Pipeline (domain-specific — both paths, I16/C1)

Both ingestion paths enforce the identical output contract (I4): **WebP/AVIF only, longest edge ≤ 1200 px, ≤ 150 KB delivered mobile / ≤ 400 KB delivered desktop**. Rendition-set strategy and post-clamp oversize handling: TBD — [blocking: OR-5, implementation spike against I4].

### 7.1 Path (a) — offline bootstrap pipeline (pre-launch import)

1. Container-bound Google Sheets Apps Script (manifest item 10) fetches image URLs/attachments from the sheet's "Images of the equipment" column, slug-tags each file with its equipment slug, and writes them to **one Drive folder**. **No resize or enhancement occurs inside Apps Script** (D3).
2. The user manually downloads the Drive folder to the project root.
3. The agent-assisted **local enhancement run** (I16) processes each file: autocontrast, sharpen, **EXIF strip**, transcode to WebP/AVIF, and enforce the I4 byte/dimension budgets (Pillow-class or `sharp` locally). Enhanced files are the ones uploaded to R2 and referenced in `image_keys[]`.

### 7.2 Path (b) — runtime admin upload

1. Admin UI → `POST /api/admin/items/:id/images` (multipart) → Render.
2. Render enforces the raw size cap first (413, named byte counts) and **MIME-sniffs magic bytes** against the allowlist `jpeg/png/webp/avif` (415) — client headers are never trusted (T4).
3. Render runs **`sharp`**: resize longest edge ≤ 1200 px → encode WebP/AVIF → quality clamp → drive output to the I4 budget (D3).
4. Stored object key appended to `image_keys[]`; object written to R2 via **presigned URL** (T5 — R2 credentials never leave the server).
5. Revalidation flow (§6) runs as for any item write.

### 7.3 Why `sharp` must run on Render (I6/I8/I13/I16)

`sharp` is a native (C++) Node module: it must be installed in the backend's runtime environment. Vercel Hobby does **not** run Docker (I8) and the frontend deploy is a build output, not a container (I13); the only Node service with a controlled native environment is the Render Docker backend — which also owns the 512 MB RAM ceiling (I6) that bounds processing. Consequently, concurrent image processing is serialised (one upload processed at a time) to bound peak memory under 512 MB.

## 8. Email Delivery — Gmail REST API over HTTPS (Option A)

- **Why not SMTP:** Render free-tier blocks outbound SMTP ports 25/465/587 (live since 26 Sep 2025; I7). SMTP is not an option; the Gmail REST API over HTTPS is the confirmed path (D4).
- **Flow (invite):** `POST /api/admin/admins/invites` → Render generates a single-use random token, stores its SHA-256 hash in `admin_invites.token_hash`, inserts an `audit_log` row (`admin.invite`), and calls Gmail REST `users.messages.send` with the acceptance link. On Gmail 4xx/5xx → 502, invite not marked sent (FR-7.5).
- **Acceptance:** invitee opens the link → Supabase Auth signup (argon2id default) → `POST /api/admin/invites/accept {token}` → Render verifies hash, marks `accepted_at`, provisions the `admins` row, sets `app_metadata.role = 'admin'`, and inserts `audit_log` (`admin.accept`).
- **Credential mode:** OAuth2 (client id/secret + refresh token) vs Gmail app password — TBD — [blocking: OR-4, user decision at implementation]. Whichever mode is chosen, the credentials are **server-side secrets on Render only** (T7) and all calls are HTTPS (T8). Token lifetime/expiry policy folds into OR-7 (Security doc).

## 9. Heartbeat & Scheduler (I9)

GitHub Actions runs a **daily cron** (exact schedule time set in the workflow file at implementation) that sends `GET /healthz` to the Render service. The handler performs a trivial Supabase round-trip (a single `SELECT 1`-equivalent via PostgREST) so Supabase records activity and does not trip its 7-day free-tier inactivity pause. The same workflow may optionally nudge ISR revalidation (D4 "optional ISR nudge"). Cron failure handling: see integration #6 (CI/CD doc owns alerting details).

## 10. Secrets Inventory (T7 — env vars only; never in client bundles, never in the repo)

| Secret                                                                   | Stored on       | Read by                                               | Notes                                               |
| ------------------------------------------------------------------------ | --------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `SUPABASE_URL`                                                           | Vercel + Render | ISR page renders; backend                             | Non-secret identifier                               |
| `SUPABASE_ANON_KEY`                                                      | Vercel          | ISR public reads                                      | Publishable by design (anon, RLS-scoped)            |
| `SUPABASE_SERVICE_ROLE_KEY`                                              | **Render only** | Invite acceptance / admin provisioning (§8)           | Bypasses RLS; must never reach Vercel or the client |
| `SUPABASE_JWT_SECRET` (or JWKS fetch config)                             | Render          | Server-side session verification (T2)                 |                                                     |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`            | **Render only** | Presigned write URLs, image deletes (T5)              | Public **reads** need no key (public bucket)        |
| `REVALIDATE_SECRET`                                                      | Vercel + Render | Webhook validation (Vercel); webhook signing (Render) | T6; missing on Vercel → 500 branch (§4)             |
| `GMAIL_*` (client id/secret/refresh-token **or** app password, per OR-4) | **Render only** | Gmail REST client (§8)                                | Mode TBD (OR-4)                                     |

Transport everywhere is TLS 1.2+ (T8; all five platforms default HTTPS). Full secret-handling controls: `docs/SECURITY.md` (later batch).

## 11. Performance & Motion Budget Enforcement

- **Image budgets (I4):** enforced at **both** ingestion points — runtime path by the `sharp` pipeline (§7.2), offline path by the local enhancement run (§7.1). A stored object that fails the budget audit is a defect; the audit is a launch gate (PRD NFR-3).
- **FCP/LCP (I2/I3):** enforced by architecture (ISR-served static HTML, images from R2, no Render in the visitor path) and verified by Lighthouse throttled-3G runs on landing, room view and item detail after full import (PRD NFR-1/2).
- **Lazy loading:** below-the-fold images use native lazy-loading (I4).
- **Motion (I12/C3):** code-level rules —
  1. All CSS/JS animations and transitions SHALL animate only `transform` and `opacity` (GPU-composited properties).
  2. A global `@media (prefers-reduced-motion: reduce)` override neutralises all transitions/animations; the landing carousel's auto-advance timer is disabled (manual navigation only).
  3. Motion must not delay first paint: no animation library may load render-blocking; budgets I2/I3 are measured **with** motion assets present.
  4. Enforcement mechanism beyond code review: the **motion-property allowlist gate** in CI lint stage 1 (`docs/CICD.md` §1) — the build fails if any CSS/JS animation or transition declares properties outside `transform`/`opacity` (I12/NFR-7); exact lint tooling is pinned at OR-6 kickoff.
- **Carousel cadence:** auto-advance every **6000 ms**, paused on hover/focus and fully disabled under `prefers-reduced-motion: reduce` — closed by Design Phase (`design/03-foundations/motion.md`, C-016; `docs/EXECUTION_HANDBOOK.md` §9 closed table). The behavioural rules above (I12) still govern implementation.

## 12. Deployment Architecture

- **Render:** single free-tier instance, one Node.js process in Docker; no horizontal scaling (0.1 CPU/512 MB fixed — I6). Docker builds on Render (supported on free). Idle spin-down after 15 min; ~1 min restart (I11).
- **Vercel:** Next.js build output; serverless/edge ISR caching; one webhook function (`/api/revalidate`); function ceiling 300 s, proxied timeout 120 s (I8).
- **Supabase / R2 / Gmail / GitHub Actions:** managed services as per §1; no deployment artifacts of ours beyond configuration and cron.
- **CI/CD pipelines, promotion steps, environment setup runbooks:** owned by `docs/CICD.md` (manifest item 6) — pointer only, not restated here.

## 13. Parallel Development Plan

**Single-threaded development.** One human owner (Israel) directs sequential coding-agent work; there are no concurrent human contributors and no agent workstreams that partition files. No collision-avoidance partitioning is required. (If parallelisation is ever introduced, this section must be rewritten before work resumes.)

## 14. Open Risk Resolution Register (PRD §8)

**Closure note (2026-10-13):** OR-2 and OR-8 were closed by the Major Design Phase and are marked **Closed** below (evidence: `docs/EXECUTION_HANDBOOK.md` §9 closed table). OR-1 and OR-3…OR-7 are carried forward unchanged.

| #    | PRD open risk                                 | TRD resolution                                                                                                                                                                                                                                                                                                                      | Status                          |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| OR-1 | Export column set                             | Floor fixed (§4 export rows; name, condition, quantity, `updated_at`, `updated_by`). Full set: **TBD — [blocking: user/department COREN confirmation]**; owner: user; trigger: before export implementation                                                                                                                         | Carried forward                 |
| OR-2 | Final route map                               | Closed by Design Phase: the 10 fixed public/admin routes are listed in §4 (D-019; `design/01-research/ia.md`)                                                                                                                                                                                                                       | **Closed** (2026-10-13)         |
| OR-3 | Room-view semantics vs missing `room` field   | v1 implementation treats the room view as the **whole single Smart Class collection** (no `room` column in the D3 field set). If the user confirms multiple rooms/locations exist, a `room` column + route change is a schema-affecting scope change: **TBD — [blocking: user confirmation]**; trigger: before schema freeze (§3.2) | Carried forward                 |
| OR-4 | Gmail credential mode                         | Either mode works over HTTPS (§8); choice: **TBD — [blocking: user decision]**; trigger: before invite implementation                                                                                                                                                                                                               | Carried forward                 |
| OR-5 | Rendition set / post-clamp oversize behaviour | Pipeline contract fixed (§7); rendition granularity and rejection-vs-further-compression: **TBD — [blocking: implementation spike against I4]**                                                                                                                                                                                     | Carried forward                 |
| OR-6 | Version pins + local-dev parity               | §1.3/§1.4 constraints fixed (Node backend, env-var config, same Docker image); exact pins: **TBD — [blocking: implementation kickoff]**                                                                                                                                                                                             | Carried forward                 |
| OR-7 | Invite-link lifetime                          | Single-use enforced via `token_hash` (§8); time-bounded expiry: **TBD — [blocking: `docs/SECURITY.md`]**; trigger: before v1 launch                                                                                                                                                                                                 | Carried forward to Security doc |
| OR-8 | Carousel cadence                              | Closed by Design Phase: 6000 ms auto-advance + reduced-motion kill (§11; `design/03-foundations/motion.md`, C-016)                                                                                                                                                                                                                  | **Closed** (2026-10-13)         |

---

**Conditional sections (schema-trd):** _Domain-Specific Pipeline_ — **triggered**, rendered as §7 (images are a core input modality). _RAG Ingestion & Retrieval_, _Agentic Tooling_ — **not triggered** (D5: no AI, no models, no agentic loops). _External Registry / Directory Integration_ — **not triggered** (the Google Sheet is a one-time import source, retired after v1; no ongoing authoritative external dataset).

**Source-of-truth statement (contract-mandated):** Supabase Postgres is the source of truth for all inventory data post-import. The Google Sheet is retired once the v1 import completes (D3).
