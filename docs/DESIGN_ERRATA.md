# Design Errata — divergences found in frozen `design/` v1.0.0

Status: authoritative errata register. `design/` is frozen v1.0.0 and READ-ONLY
(AGENTS.md §3 rule 8); corrections are recorded here, never edited in place.
Opened: 2026-10-16 (session m2-comp-lib, Israel-approved).

Precedence reminder (HANDOFF): `tokens.json` > component specs > screens > previews.
Where a frozen doc disagrees with the shipped tokens/previews, the token authority
governed the implementation; the stale doc value is recorded below.

---

## E-1 — `tailwind.theme.md` §4.5 documents the wrong z-index namespace

- **Location:** `design/03-foundations/tokens/tailwind.theme.md:221-225`.
- **Doc says:** `--z-*` namespace — `z-base` (0), `z-sticky` (20), `z-rail` (30),
  `z-overlay` (40), `z-modal` (50).
- **Reality:** Tailwind v4's z-index theme namespace is `--z-index-*`
  (`node_modules/tailwindcss/dist/lib.mjs` → `themeKeys: ["--z-index"]`). Keys
  declared as `--z-*` compile to nothing, so the `z-overlay` utility was a no-op.
- **Resolution applied (code):** `app/globals.css` `@theme inline` declares
  `--z-index-base|sticky|rail|overlay|modal` (from `tokens.css` `--zIndex-*`).
  Verified: built CSS emits `.z-overlay{z-index:var(--zIndex-overlay)}`.
- **Action for Israel:** correct the namespace in the frozen doc at next unfreeze.

## E-2 — C-005 stale disabled-pair contrast figure

- **Location:** `design/04-components/specs/C-005.md:35,64-65`.
- **Doc says:** disabled pair contrast **5.54:1**.
- **Authority:** `design/03-foundations/.../contrast-report.md:35` records **6.50:1**
  (token `#4E5652` on `#EAEFEB`); recomputed 6.50:1.
- **Resolution applied (code):** no code change needed — the component uses the live
  token pair; `tests/button.test.tsx` pins the authority value (6.50:1). The stale
  figure is documentation-only.
- **Action for Israel:** update the C-005 figure at next unfreeze.

## E-3 — C-005/006/007 §7 prose uses dead (non-existent) utility names

- **Location:** `C-005.md:88-90` (`border-action`, `min-h-[48px]`),
  `C-006.md:80-81` (`border-strong`, `bg-action-subtle`),
  `C-007.md:85-86` (`border-danger`, `bg-faulty-600`).
- **Reality:** under the `tailwind.theme.md` §1.3 namespace rule these single-prefix
  utilities compile to nothing. The canonical emitted classes are the doubled-prefix
  forms (`border-bg-action`, `border-border-strong`, `hover:bg-bg-action-subtle`,
  `hover:bg-accent-faulty-600`).
- **Resolution applied (code):** the implementation uses the canonical doubled-prefix
  classes (correct per HANDOFF precedence: tokens > specs); tests assert the correct
  classes.
- **Action for Israel:** correct the §7 prose at next unfreeze.

## E-4 — C-004 Footer spec-vs-preview ground and padding divergence (SP-4)

- **Location:** `design/04-components/specs/C-004.md:21-25` vs `design/05-screens/*/preview.html`.
- **Doc says:** spec §2.2 mandates `bg.page` (`bg-bg-page`), §2.3 specifies `space.5` padding (`p-5`)
  and `space.3` gap (`gap-3`) with always-column layout. The reference preview used `bg-surface`,
  `space-6` padding, and `gap-5`.
- **Resolution applied (code):** the implementation follows the component spec over the preview
  per HANDOFF §1 strict precedence (specs decide; previews illustrate).
- **Action for Israel:** reconcile the preview with the spec at next design unfreeze.

## E-5 — C-022 DataTable LOCATION column divergence (SP-5)

- **Location:** `design/04-components/specs/C-022.md:25-35` vs `design/07-copy/ux-copy.md:234-240`.
- **Doc says:** C-022 spec §2.5/§3 names a 7th LOCATION column. The frozen `ux-copy.md` headers
  and S-004 preview define a 6-column set (record, name, qty, condition, updated, actions).
- **Resolution applied (code):** the implementation follows the copy authority (`ux-copy.md`)
  with the 6-column layout.
- **Action for Israel:** align C-022 §2.5 with ux-copy.md at next design unfreeze.

## E-6 — C-023 Stamp punctuation divergence (SP-7)

- **Location:** `design/04-components/specs/C-023.md:28,45` vs `design/07-copy/ux-copy.md:37`.
- **Doc says:** C-023 spec §3/§6 asserts an ASCII hyphen ("-") in the provenance string.
  The frozen copy authority `ux-copy.md` and S-001 preview use an em-dash ("—").
- **Resolution applied (code):** the implementation uses the em-dash from frozen `ux-copy.md`
  per HANDOFF §3 rule 3 (copy is verbatim).
- **Action for Israel:** update C-023 spec to use em-dash at next design unfreeze.

---

Source: `.agent/teamwork/m2-comp-lib/agents/critic_m2/report.md` (B-4, B-5),
`agents/auditor_m4/report.md` (E-1 confirmation), `agents/w5/verification.md` (E-1 root cause),
`.agent/teamwork/S-02/agents/critic_m2/objections.json` (SP-4, SP-5, SP-7; approved by Israel 2026-10-16).

