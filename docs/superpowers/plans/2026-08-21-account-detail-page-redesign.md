# Account Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `AccountDetailPage.jsx` into a clean Overview-style layout: header, status strip, one Connect card (two rows), Sharing, Danger — without changing any sync/share/delete behavior.

**Architecture:** Single-file UI pass. Keep all existing handlers, modals, and data loading. Replace the avatar hero + 2×2 card grid with a vertical stack of local helpers (`StatusBadge`, thin `Panel`, optional `ConnectRow`). Reuse existing `lib/ui` tokens only.

**Tech Stack:** React 19, Tailwind via existing `lib/ui` class strings, Vite (`npm run dev`). Manual UI verification (no new unit tests — this is layout-only with no new pure functions).

---

## Reference: spec

Full design: `docs/superpowers/specs/2026-08-21-account-detail-page-redesign-design.md`.

## File map

| File | Responsibility |
|------|----------------|
| Modify: `src/pages/AccountDetailPage.jsx` | All layout changes; keep handlers 1:1 |
| Unchanged: `src/components/settings/InvestorSyncPanel.jsx` | Still used with `compact` |
| Unchanged: `AccountFormModal` / `SyncKeyModal` from `TradingAccountsManager.jsx` | Same modals |

Do **not** touch APIs, routing, or Settings.

---

### Task 1: Replace header + remove hero; add status strip

**Files:**
- Modify: `src/pages/AccountDetailPage.jsx`

- [ ] **Step 1: Keep helpers that stay useful**

Keep `formatLastSynced`, `StatusBadge`, and a slim `Panel` (drop required `eyebrow` — make it optional or remove the eyebrow line).

Update `Panel` to:

```jsx
function Panel({ title, badge, children, danger = false }) {
  return (
    <section
      className={`${card} overflow-hidden ${
        danger ? 'border-rose-200 dark:border-rose-900/50' : ''
      }`}
    >
      <div className={cardHd}>
        <div className="min-w-0">
          <h2 className={cardTitle}>{title}</h2>
        </div>
        {badge}
      </div>
      <div className={cardBody}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Replace the back+actions row and avatar hero with Overview-style header**

In the main `return` (when `account` exists), replace the current top block (back row + hero `header` card) with:

```jsx
<div className={`${dashboardPageWideFull} overflow-y-auto`}>
  <div className="mb-4">
    <BackButton onClick={() => navigate('/dashboard/accounts')} />
  </div>

  <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        {account.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {accountTypeLabel(account.account_type)}
        <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
        {pnlDenominationLabel(account.pnl_denomination)}
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={btnGhost} type="button" disabled={busy} onClick={() => setEditOpen(true)}>
        Edit details
      </button>
      {!account.is_default ? (
        <button className={btnOutline} type="button" disabled={busy} onClick={() => void handleSetDefault()}>
          Set as default
        </button>
      ) : null}
    </div>
  </header>

  <div className="mb-6 flex flex-wrap gap-2" aria-label="Account status">
    {account.is_default ? (
      <StatusBadge ok okLabel="Default" idleLabel="Default" />
    ) : null}
    <StatusBadge
      ok={Boolean(account.is_public)}
      okLabel="Public"
      idleLabel="Private"
    />
    <StatusBadge ok={hasSyncKey} okLabel="Key active" idleLabel="No key" />
    <StatusBadge
      ok={Boolean(investorStatus)}
      okLabel="Investor connected"
      idleLabel="Not connected"
    />
  </div>

  {/* Connect / Sharing / Danger come in later tasks */}
```

Note: `StatusBadge` currently requires both labels; for Default-only chip, either render a one-off span matching the emerald chip styles, or call `<StatusBadge ok okLabel="Default" idleLabel="Default" />` as above.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev` (already running is fine)  
Open `/dashboard/accounts` → open any account.

Expected:
- No colored avatar hero
- Title + subtitle + Edit / Set as default in header
- Status chips visible under header
- Old Connect/Share/Danger cards may still be below until Task 2–3 (ok for this checkpoint)

- [ ] **Step 4: Commit**

```bash
git add src/pages/AccountDetailPage.jsx
git commit -m "refactor: Overview-style header and status strip on account detail"
```

---

### Task 2: Single Connect card with two rows

**Files:**
- Modify: `src/pages/AccountDetailPage.jsx`

- [ ] **Step 1: Add a small `ConnectRow` helper above the page component**

```jsx
function ConnectRow({ title, description, badge, children }) {
  return (
    <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          {badge}
        </div>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="w-full shrink-0 sm:max-w-md sm:text-right">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the EA + Investor two-column grid with one Connect panel**

Remove the `lg:grid-cols-2` block that wraps the two Option A/B panels. Replace with:

```jsx
<Panel title="Connect" className="mb-6">
```

`Panel` as defined in Task 1 does not take `className` — wrap instead:

```jsx
<div className="mb-6">
  <Panel title="Connect">
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      <div className="pb-5">
        <ConnectRow
          title="EA sync key"
          description="Install the Finhub EA on MetaTrader 5 and paste a sync key. Best if you keep the terminal open locally."
          badge={<StatusBadge ok={hasSyncKey} okLabel="Key active" idleLabel="No key" />}
        >
          {hasSyncKey ? (
            <div className="space-y-3">
              <p className={`text-xs font-medium sm:text-right ${syncMeta?.last_synced_at ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
                {syncMeta?.last_synced_at
                  ? `Last synced: ${formatLastSynced(syncMeta.last_synced_at)}`
                  : 'Not synced yet'}
              </p>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button className={btnSm} type="button" disabled={busy} onClick={() => void handleShowKey()}>
                  Key info
                </button>
                <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                  Regenerate
                </button>
                <button className={btnDanger} type="button" disabled={busy} onClick={() => void handleRevokeKey()}>
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button className={btnSm} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                Generate sync key
              </button>
            </div>
          )}
        </ConnectRow>
      </div>

      <div className="pt-5">
        <ConnectRow
          title="Investor password"
          description="Read-only MT5 login. We pull closed trades for you — no EA install required."
          badge={(
            <StatusBadge
              ok={Boolean(investorStatus)}
              okLabel="Connected"
              idleLabel="Not connected"
            />
          )}
        >
          <div className="sm:text-left">
            <InvestorSyncPanel
              account={account}
              status={investorStatus}
              onChanged={reloadSyncState}
              compact
            />
          </div>
        </ConnectRow>
      </div>
    </div>
  </Panel>
</div>
```

Critical: do **not** wrap `InvestorSyncPanel` in `-mx-4 -mb-4 border-t ...` hacks.

Handlers must remain the same function references (`handleShowKey`, `handleGenerateKey`, `handleRevokeKey`, `reloadSyncState`).

- [ ] **Step 3: Browser check**

Expected:
- One “Connect” card
- EA row then divider then Investor row
- Generate / regenerate / revoke still open confirms and SyncKeyModal
- Investor compact panel usable without broken layout

- [ ] **Step 4: Commit**

```bash
git add src/pages/AccountDetailPage.jsx
git commit -m "refactor: single Connect card with EA and investor rows"
```

---

### Task 3: Sharing + Danger zone; finish page stack

**Files:**
- Modify: `src/pages/AccountDetailPage.jsx`

- [ ] **Step 1: Replace the bottom 2-column grid with stacked Sharing then Danger**

```jsx
<div className="mb-6">
  <Panel
    title="Sharing"
    badge={(
      <StatusBadge
        ok={Boolean(account.is_public)}
        okLabel="Public"
        idleLabel="Private"
      />
    )}
  >
    <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
      {account.is_public
        ? 'Anyone with the link can view stats and trade history. Notes stay private.'
        : 'Only you can see this account. Publish to share a read-only link.'}
    </p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={btnSm} type="button" disabled={busy} onClick={() => void handlePublishToggle()}>
        {account.is_public ? 'Unpublish' : 'Publish'}
      </button>
      {account.is_public && shareUrl ? (
        <>
          <button className={btnSm} type="button" disabled={busy} onClick={() => void handleCopyLink()}>
            Copy link
          </button>
          <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleRegenerateLink()}>
            Regenerate
          </button>
        </>
      ) : null}
    </div>
  </Panel>
</div>

<div className="mb-2">
  <Panel title="Danger zone" danger>
    <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
      Remove this account permanently. Synced trades and the MT5 sync key for this account are deleted.
    </p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={btnDanger} type="button" disabled={busy} onClick={() => void handleRemove()}>
        Remove account
      </button>
    </div>
  </Panel>
</div>
```

Remove the Cent↔USD tip from Danger (edit flow covers that).

- [ ] **Step 2: Confirm modals still mount at the bottom of the page**

Keep unchanged:

```jsx
{editOpen ? (
  <AccountFormModal
    mode="edit"
    account={account}
    tradingAccounts={tradingAccounts}
    onClose={() => setEditOpen(false)}
    onSaved={refreshAll}
  />
) : null}

{revealedKey ? (
  <SyncKeyModal
    account={account}
    syncKey={revealedKey}
    onClose={() => setRevealedKey(null)}
  />
) : null}
```

- [ ] **Step 3: Remove dead imports / unused UI**

- Drop `sectionLabel` from imports if `Panel` no longer uses it.
- Ensure no leftover “Option A/B” strings or avatar markup remain.
- Keep `btnOutline` (header Set as default + not-found).

- [ ] **Step 4: Full manual QA checklist**

From the spec:

1. Account with no key / no investor / private → chips + Generate only.
2. Generate key → SyncKeyModal → regenerate → revoke.
3. Investor connect / disconnect via compact panel.
4. Publish → copy → regenerate → unpublish.
5. Set as default; Edit details save; Remove returns to `/dashboard/accounts`.
6. Narrow viewport: header and Connect rows stack cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AccountDetailPage.jsx
git commit -m "refactor: stack Sharing and Danger on account detail page"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Overview-style header | Task 1 |
| Status strip chips | Task 1 |
| One Connect card, two rows | Task 2 |
| No Option A/B, no avatar hero | Tasks 1–2 |
| No investor negative-margin hack | Task 2 |
| Sharing card + actions | Task 3 |
| Danger: remove only, no Cent tip | Task 3 |
| Handlers/modals unchanged | All tasks |
| Not-found unchanged | Left alone (verify in Task 3 QA) |

## Out of scope reminders

Do not change APIs, Settings, `InvestorSyncPanel` internals, routing, or add tabs/stats.
