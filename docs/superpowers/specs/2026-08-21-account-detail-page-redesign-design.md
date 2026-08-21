# Account Detail Page Redesign — Design Spec

**Date:** 2026-08-21  
**Status:** Approved for planning  
**Product:** FinHubKH Journal  
**Scope file:** `src/pages/AccountDetailPage.jsx`

## Goal

Restructure the trading account detail page so it feels clean, consistent with Overview/Accounts, and easy to scan — without changing sync, share, or delete behavior.

## Current state (for reference)

- Large colored avatar hero card with intro copy.
- Four competing cards in a 2×2-ish grid: EA sync (“Option A”), Investor password (“Option B”), Public link, Danger zone.
- Investor panel uses negative-margin hacks to sit inside its card.
- Actions work correctly (edit, default, generate/revoke key, investor connect, publish/copy/regenerate, remove). Pain is visual hierarchy and consistency, not missing features.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Overall feel | Clean Overview-style page (title + subtitle + header actions) |
| First content after header | Status strip (chips), then Connect, then Sharing, then Danger |
| Connect layout | One card with two internal rows (EA, then Investor) — not side-by-side cards |
| Approach | Light polish only — layout/UI pass; keep all handlers and modals |
| Visual system | Existing Tailwind tokens only (`card`, buttons, chips). No new palette/fonts |
| Cent↔USD tip | Remove from Danger zone; belongs in Edit details |

## Out of scope

- API, routing, or Settings changes.
- New tabs (Connect / Share / Danger).
- Redesigning `InvestorSyncPanel` internals beyond fitting cleanly in a row.
- Changing publish/share or sync key security behavior.
- Adding performance stats or trade lists to this page.

## Page structure

Single column, same dashboard page shell (`dashboardPageWideFull` + scroll):

1. **Back** → `/dashboard/accounts`
2. **Header**
   - Left: account name as `h1`; subtitle `Account type · Currency` (existing label helpers)
   - Right: Edit details; Set as default (hidden when already default)
3. **Status strip** — wrap chips:
   - Default (only if default)
   - Public / Private
   - Key active / No key
   - Investor connected / Not connected
4. **Connect** — one card, title “Connect”
   - **Row 1 — EA sync key:** short copy, last synced when present, status chip; actions Generate / Key info / Regenerate / Revoke (same as today)
   - **Row 2 — Investor password:** short copy, status chip; `InvestorSyncPanel` with `compact` (no negative-margin card hacks)
   - Rows divided by a single horizontal rule inside the card
5. **Sharing** — one card: short copy; Publish/Unpublish; when public: Copy link + Regenerate; status chip in header
6. **Danger zone** — last section, soft rose border: Remove account only

Not found state unchanged: back control + empty card + link to accounts list.

## Components / implementation notes

- Prefer small local helpers already on the page (`Panel`, `StatusBadge`) or thin Settings-style row wrappers; do not invent a new design system.
- Drop “Option A / Option B” eyebrows and the avatar hero.
- Mobile: status chips wrap; Connect rows stack (copy/status above, actions/panel below).
- Modals stay: `AccountFormModal`, `SyncKeyModal`. All existing handlers/toasts stay.

## Success criteria

- Page reads top-to-bottom without a 2×2 card grid fighting for attention.
- Status of sync/share is visible without opening each panel.
- EA and investor still work with the same confirmations and errors as today.
- Visual language matches Overview / Accounts list (quiet borders, shared buttons, no extra chrome).

## Testing (manual)

- Open an account with no sync key / no investor / private → chips and empty actions look correct.
- Generate, regenerate, revoke EA key; open SyncKeyModal.
- Connect/disconnect investor password via compact panel.
- Publish → copy → regenerate → unpublish.
- Set as default; Edit details save; Remove account returns to list.
- Narrow viewport: header actions and Connect rows stack cleanly.
