import { useEffect, useState } from 'react';
import {
  insertTradingAccount, deleteTradingAccount, updateTradingAccount,
  recalculateTradesForDenomination,
  listAccountSyncKeys, generateAccountSyncKey, revokeAccountSyncKey,
  setTradingAccountPublic, getAccountShareUrl, regenerateTradingAccountShareToken,
  listInvestorCredentialsStatus,
  connectAndVerifyInvestorCredentials,
} from '../../api';
import { useDialog } from '../../context/DialogContext';
import { toast } from 'react-toastify';
import { invalidateLeaderboardCache } from '../../lib/leaderboardCache';
import {
  ACCOUNT_TYPES,
  PNL_DENOMINATIONS,
  ACCOUNT_COLORS,
  accountTypeLabel,
  pnlDenominationLabel,
  normalizeSlug,
  normalizePnlDenomination,
} from '../../lib/accounts';
import {
  btnDanger, btnGhost, btnOutline, btnPrimary, btnSm, card, emptyState, input, label,
  msgError, msgSuccess, sectionLabel, select,
} from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';
import PasswordInput from '../common/PasswordInput';
import InvestorSyncPanel from './InvestorSyncPanel';
import BrokerServerFields from './BrokerServerFields';

/** Form dropdowns should match text inputs, not toolbar pills. */
const formSelectBtn = `${select} inline-flex items-center justify-between gap-2 text-left font-normal`;

const EMPTY_FORM = {
  name: '',
  accountType: 'live',
  pnlDenomination: 'usd',
  syncMode: 'ea',
  brokerId: '',
  serverChoice: '',
  customServer: '',
  brokerServer: '',
  brokerName: '',
  mt5Login: '',
  investorPassword: '',
};

function accountToForm(account) {
  return {
    name: account.name || '',
    accountType: account.account_type || 'live',
    pnlDenomination: normalizePnlDenomination(account.pnl_denomination),
  };
}

function formatLastSynced(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    accent: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    muted: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

const CENT_HELPER = (
  <p className="text-xs text-zinc-500 dark:text-zinc-400">
    Choose <strong className="font-medium text-zinc-600 dark:text-zinc-300">Cent account</strong> if your broker shows PnL in cents (e.g. USC).
    Sync stores the same numbers MT5 shows; switching Cent ↔ USD automatically rescales existing trades (×100 / ÷100).
  </p>
);

function AccountFormFields({ form, setField }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={label}>Account name</label>
        <input
          className={input}
          placeholder="e.g. FTMO Cent, Personal"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Type</label>
          <CustomDropdown
            className="w-full"
            menuClassName="w-full"
            buttonClassName={formSelectBtn}
            value={form.accountType}
            onChange={(v) => setField('accountType', v)}
            options={ACCOUNT_TYPES}
          />
        </div>
        <div>
          <label className={label}>Account currency</label>
          <CustomDropdown
            className="w-full"
            menuClassName="w-full"
            buttonClassName={formSelectBtn}
            value={form.pnlDenomination}
            onChange={(v) => setField('pnlDenomination', v)}
            options={PNL_DENOMINATIONS}
          />
        </div>
      </div>
      {CENT_HELPER}
    </div>
  );
}

function CreateStepProgress({ steps, index }) {
  const pct = ((index + 1) / steps.length) * 100;
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <span>Step {index + 1} of {steps.length}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition ${
              i <= index ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-800'
            }`}
            title={s.title}
          />
        ))}
      </div>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{steps[index]?.title}</p>
      {steps[index]?.hint ? (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{steps[index].hint}</p>
      ) : null}
    </div>
  );
}

function SyncModeStep({ form, setField }) {
  const selected = 'border-violet-400 bg-white ring-2 ring-violet-200 dark:bg-zinc-900 dark:ring-violet-900/50';
  const idle = 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700';
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label
        className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
          form.syncMode === 'ea' ? selected : idle
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="syncMode"
          value="ea"
          checked={form.syncMode === 'ea'}
          onChange={() => setField('syncMode', 'ea')}
        />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">EA sync key</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Install the EA on your MT5 and paste a sync key. Best if you keep MT5 open locally.
        </p>
      </label>
      <label
        className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
          form.syncMode === 'investor' ? selected : idle
        }`}
      >
        <input
          type="radio"
          className="sr-only"
          name="syncMode"
          value="investor"
          checked={form.syncMode === 'investor'}
          onChange={() => setField('syncMode', 'investor')}
        />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Investor password</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Read-only login. We pull closed trades for you — no EA install.
        </p>
      </label>
    </div>
  );
}

function createWizardSteps(syncMode) {
  const base = [
    { id: 'basics', title: 'Account details', hint: 'Name this account and set type / currency.' },
    { id: 'sync', title: 'How should we sync MT5?', hint: 'Pick EA if you run MetaTrader locally, or investor password for hands-off sync.' },
  ];
  if (syncMode === 'investor') {
    return [
      ...base,
      { id: 'broker', title: 'Choose your broker', hint: 'Type or pick from popular brokers.' },
      { id: 'server', title: 'Select MT5 server', hint: 'Exact server name from MetaTrader login box.' },
      { id: 'credentials', title: 'Login & investor password', hint: 'Use the investor (read-only) password — not the master password.' },
      { id: 'review', title: 'Review & create', hint: 'We’ll verify the investor login after creating the account.' },
    ];
  }
  return [
    ...base,
    { id: 'review', title: 'Review & create', hint: 'After creating, we’ll show an EA sync key to paste into MetaTrader.' },
  ];
}

function ReviewStep({ form }) {
  const row = 'flex justify-between gap-3';
  const dt = 'text-zinc-500 dark:text-zinc-400';
  const dd = 'font-medium text-zinc-900 dark:text-zinc-100';
  return (
    <dl className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className={row}>
        <dt className={dt}>Name</dt>
        <dd className={dd}>{form.name.trim() || '—'}</dd>
      </div>
      <div className={row}>
        <dt className={dt}>Type</dt>
        <dd className={dd}>{accountTypeLabel(form.accountType)}</dd>
      </div>
      <div className={row}>
        <dt className={dt}>Currency</dt>
        <dd className={dd}>{pnlDenominationLabel(form.pnlDenomination)}</dd>
      </div>
      <div className={row}>
        <dt className={dt}>Sync</dt>
        <dd className={dd}>
          {form.syncMode === 'investor' ? 'Investor password' : 'EA sync key'}
        </dd>
      </div>
      {form.syncMode === 'investor' ? (
        <>
          <div className={row}>
            <dt className={dt}>Broker</dt>
            <dd className={dd}>{form.brokerName || '—'}</dd>
          </div>
          <div className={row}>
            <dt className={dt}>Server</dt>
            <dd className={`max-w-[60%] truncate ${dd}`} title={form.brokerServer}>
              {form.brokerServer || '—'}
            </dd>
          </div>
          <div className={row}>
            <dt className={dt}>Login</dt>
            <dd className={dd}>{form.mt5Login || '—'}</dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}

export function AccountFormModal({ mode, account, tradingAccounts, onClose, onSaved }) {
  const { alert, confirm } = useDialog();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => (isEdit ? accountToForm(account) : EMPTY_FORM));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [createdSyncKey, setCreatedSyncKey] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = isEdit ? [] : createWizardSteps(form.syncMode);
  const step = steps[stepIndex] || null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  // Keep step index in range when sync mode changes step list length
  useEffect(() => {
    if (isEdit) return;
    setStepIndex((i) => Math.min(i, createWizardSteps(form.syncMode).length - 1));
  }, [form.syncMode, isEdit]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyBrokerFields(next) {
    setForm((f) => ({
      ...f,
      brokerId: next.brokerId,
      serverChoice: next.serverChoice,
      customServer: next.customServer,
      brokerServer: next.brokerServer,
      brokerName: next.brokerName,
    }));
  }

  function validateStep(id) {
    if (id === 'basics') {
      if (!form.name.trim()) return 'Account name is required.';
      return null;
    }
    if (id === 'sync') {
      if (!form.syncMode) return 'Choose how to sync MT5.';
      return null;
    }
    if (id === 'broker') {
      if (!form.brokerId) return 'Choose your broker.';
      return null;
    }
    if (id === 'server') {
      if (!form.brokerServer.trim()) return 'Pick or type the exact MT5 server.';
      return null;
    }
    if (id === 'credentials') {
      if (!form.mt5Login.trim() || !form.investorPassword) {
        return 'MT5 login and investor password are required.';
      }
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step?.id);
    if (err) {
      setMsg({ type: 'error', text: err });
      return;
    }
    setMsg(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setMsg(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit) {
      // Only submit on final review step
      if (step?.id !== 'review') {
        goNext();
        return;
      }
      for (const s of steps) {
        const err = validateStep(s.id);
        if (err) {
          setMsg({ type: 'error', text: err });
          setStepIndex(steps.findIndex((x) => x.id === s.id));
          return;
        }
      }
    }

    const name = form.name.trim();
    if (!name) {
      setMsg({ type: 'error', text: 'Account name is required.' });
      return;
    }

    if (!isEdit && form.syncMode === 'investor') {
      if (!form.brokerId) {
        setMsg({ type: 'error', text: 'Choose your broker first.' });
        return;
      }
      if (!form.brokerServer.trim() || !form.mt5Login.trim() || !form.investorPassword) {
        setMsg({ type: 'error', text: 'MT5 server, login, and investor password are required.' });
        return;
      }
    }

    setBusy(true);
    setMsg(null);
    try {
      if (isEdit) {
        const oldDenom = normalizePnlDenomination(account.pnl_denomination);
        const newDenom = normalizePnlDenomination(form.pnlDenomination);
        if (oldDenom !== newDenom) {
          const ok = await confirm({
            title: 'Change account currency?',
            message: newDenom === 'cent'
              ? 'Existing trade PnL will be multiplied by 100 so amounts match MT5 cent accounts (¢).'
              : 'Existing trade PnL will be divided by 100 so amounts match USD ($).',
            confirmLabel: 'Update trades',
          });
          if (!ok) {
            setBusy(false);
            return;
          }
        }
        const adjusted = await recalculateTradesForDenomination(
          { id: account.id, name },
          oldDenom,
          newDenom,
        );
        await updateTradingAccount(account.id, {
          name,
          slug: normalizeSlug(name),
          account_type: form.accountType,
          pnl_denomination: newDenom,
        });
        await onSaved();
        onClose();
        if (adjusted > 0) {
          await alert({
            title: 'Account saved',
            message: `Adjusted PnL on ${adjusted} trade${adjusted === 1 ? '' : 's'}.`,
          });
        }
      } else {
        const color = ACCOUNT_COLORS[tradingAccounts.length % ACCOUNT_COLORS.length];
        const created = await insertTradingAccount({
          name,
          slug: normalizeSlug(name),
          account_type: form.accountType,
          pnl_denomination: form.pnlDenomination,
          color,
          is_default: tradingAccounts.length === 0,
          connection_status: form.syncMode === 'investor' ? 'investor' : 'ea',
          broker: form.syncMode === 'investor'
            ? (form.brokerName || form.brokerServer).trim() || null
            : null,
        });
        const row = Array.isArray(created) ? created[0] : created;
        if (!row?.id) throw new Error('Account was created but no id was returned.');

        if (form.syncMode === 'investor') {
          try {
            await connectAndVerifyInvestorCredentials({
              tradingAccountId: row.id,
              brokerServer: form.brokerServer.trim(),
              login: form.mt5Login.trim(),
              investorPassword: form.investorPassword,
            });
            toast.success('Account created — investor password verified');
          } catch (verifyErr) {
            toast.warn(
              verifyErr.message
                || 'Account created, but investor login failed. Reconnect credentials on the account page.',
            );
          }
          await onSaved();
          onClose();
        } else {
          const key = await generateAccountSyncKey(row.id);
          setCreatedAccount(row);
          setCreatedSyncKey(key);
          await onSaved();
          toast.success('Account created — copy your EA sync key');
        }
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || `Could not ${isEdit ? 'save' : 'add'} account.` });
    } finally {
      setBusy(false);
    }
  }

  if (createdSyncKey && createdAccount) {
    return (
      <SyncKeyModal
        account={createdAccount}
        syncKey={createdSyncKey}
        onClose={onClose}
      />
    );
  }

  const isLastCreateStep = !isEdit && step?.id === 'review';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className={`${card} w-full max-w-lg shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id="account-form-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? `Edit account — ${account.name}` : 'New trading account'}
          </h2>
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>
        <form className="px-5 py-4" onSubmit={handleSubmit}>
          {isEdit ? (
            <AccountFormFields form={form} setField={setField} />
          ) : (
            <>
              <CreateStepProgress steps={steps} index={stepIndex} />
              {step?.id === 'basics' ? (
                <div className="space-y-3">
                  <div>
                    <label className={label}>Account name</label>
                    <input
                      className={input}
                      placeholder="e.g. ST Markets Live, Personal"
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={label}>Type</label>
                      <CustomDropdown
                        className="w-full"
                        menuClassName="w-full"
                        buttonClassName={formSelectBtn}
                        value={form.accountType}
                        onChange={(v) => setField('accountType', v)}
                        options={ACCOUNT_TYPES}
                      />
                    </div>
                    <div>
                      <label className={label}>Account currency</label>
                      <CustomDropdown
                        className="w-full"
                        menuClassName="w-full"
                        buttonClassName={formSelectBtn}
                        value={form.pnlDenomination}
                        onChange={(v) => setField('pnlDenomination', v)}
                        options={PNL_DENOMINATIONS}
                      />
                    </div>
                  </div>
                  {CENT_HELPER}
                </div>
              ) : null}
              {step?.id === 'sync' ? <SyncModeStep form={form} setField={setField} /> : null}
              {step?.id === 'broker' ? (
                <BrokerServerFields
                  mode="broker"
                  brokerId={form.brokerId}
                  serverChoice={form.serverChoice}
                  customServer={form.customServer}
                  onChange={applyBrokerFields}
                />
              ) : null}
              {step?.id === 'server' ? (
                <BrokerServerFields
                  mode="server"
                  brokerId={form.brokerId}
                  serverChoice={form.serverChoice}
                  customServer={form.customServer}
                  onChange={applyBrokerFields}
                />
              ) : null}
              {step?.id === 'credentials' ? (
                <div className="space-y-3">
                  <div>
                    <label className={label}>MT5 login</label>
                    <input
                      className={input}
                      placeholder="MT5 login number"
                      value={form.mt5Login}
                      onChange={(e) => setField('mt5Login', e.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={label}>Investor password</label>
                    <PasswordInput
                      placeholder="Investor (read-only) password"
                      value={form.investorPassword}
                      onChange={(e) => setField('investorPassword', e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    We encrypt the password before storing it.
                  </p>
                </div>
              ) : null}
              {step?.id === 'review' ? <ReviewStep form={form} /> : null}
            </>
          )}
          {msg && <p className={`mt-3 ${msg.type === 'error' ? msgError : msgSuccess}`}>{msg.text}</p>}
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div>
              {!isEdit && stepIndex > 0 ? (
                <button className={btnGhost} type="button" disabled={busy} onClick={goBack}>
                  Back
                </button>
              ) : (
                <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>
                  Cancel
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isEdit && !isLastCreateStep ? (
                <button className={btnPrimary} type="button" disabled={busy} onClick={goNext}>
                  Continue
                </button>
              ) : (
                <button className={btnPrimary} type="submit" disabled={busy}>
                  {busy
                    ? (!isEdit && form.syncMode === 'investor' ? 'Verifying...' : 'Saving...')
                    : isEdit ? 'Save changes' : 'Create account'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SyncKeyModal({ account, syncKey, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(syncKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${card} w-full max-w-md shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-key-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id="sync-key-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            MT5 sync key — {account.name}
          </h2>
          <button className={btnGhost} type="button" onClick={onClose}>Close</button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Paste this key into the EA <strong className="font-medium text-zinc-700 dark:text-zinc-300">Sync Key</strong> field on this MT5 account only.
          </p>
          <div className="mt-3 break-all rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 select-all dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {syncKey}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnOutline} type="button" onClick={copyKey}>Copy</button>
            <button className={btnPrimary} type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ account, hasSyncKey, lastSyncedAt, investorStatus, onEdit, onSetDefault, onUpdated, onKeysChanged, onInvestorChanged }) {
  const { alert, confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);
  const shareUrl = getAccountShareUrl(account);

  async function handlePublishToggle() {
    const next = !account.is_public;
    if (next) {
      const ok = await confirm({
        title: `Publish "${account.name}"?`,
        message:
          'Anyone with the link can view: account name, type, stats, equity curve, and trade history (date, symbol, side, result, R, PnL, session). Journal notes and MT5 sync keys stay private. The account also becomes eligible for the public leaderboard.',
        confirmLabel: 'Publish',
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: `Unpublish "${account.name}"?`,
        message: 'The public link and leaderboard listing will stop working until you publish again. The same link is reused if you publish later (unless you regenerate it).',
        confirmLabel: 'Unpublish',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const updated = await setTradingAccountPublic(account.id, next);
      invalidateLeaderboardCache();
      await onUpdated();
      if (next) {
        const url = getAccountShareUrl(updated) || `${window.location.origin}/share/${updated?.share_token || ''}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Account published — link copied');
        } catch {
          toast.success('Account published');
        }
      } else {
        toast.success('Account unpublished');
      }
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not update publish status.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied');
    } catch {
      await alert({ title: 'Share link', message: shareUrl });
    }
  }

  async function handleRegenerateLink() {
    const ok = await confirm({
      title: 'Regenerate share link?',
      message: 'The current public URL will stop working immediately. Anyone with the old link will need the new one.',
      confirmLabel: 'Regenerate',
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const updated = await regenerateTradingAccountShareToken(account.id);
      invalidateLeaderboardCache();
      await onUpdated();
      const url = getAccountShareUrl(updated) || `${window.location.origin}/share/${updated?.share_token || ''}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('New link copied');
      } catch {
        toast.success('Share link regenerated');
      }
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not regenerate share link.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateKey() {
    const ok = await confirm({
      title: `Generate sync key for "${account.name}"?`,
      message: hasSyncKey
        ? 'The previous key for this account will stop working until you update MT5.'
        : 'Copy the key into the EA on this MT5 terminal.',
      confirmLabel: 'Generate',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const key = await generateAccountSyncKey(account.id);
      setRevealedKey(key);
      await onKeysChanged();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not generate sync key.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleShowKey() {
    await alert({
      title: 'Key shown only once',
      message: 'For security, the sync key cannot be retrieved again. Generate a new key and update MT5 if you lost it.',
    });
  }

  async function handleRevokeKey() {
    const ok = await confirm({
      title: `Revoke sync key for "${account.name}"?`,
      message: 'MT5 will stop syncing for this account until you generate a new key.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await revokeAccountSyncKey(account.id);
      await onKeysChanged();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not revoke sync key.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'All synced trades for this account will be permanently deleted. The MT5 sync key for this account will also be revoked.',
      confirmLabel: 'Remove account',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTradingAccount(account);
      await onUpdated();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not remove account.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <article className={`${card} overflow-hidden transition hover:border-zinc-300 dark:hover:border-zinc-700`}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-900"
                style={{ backgroundColor: account.color || '#7c3aed' }}
                aria-hidden
              />
              <h4 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{account.name}</h4>
              {account.is_default ? <Badge tone="accent">Default</Badge> : null}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {accountTypeLabel(account.account_type)}
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              {pnlDenominationLabel(account.pnl_denomination)}
            </p>
          </div>
          <button className={btnSm} type="button" disabled={busy} onClick={() => onEdit(account)}>
            Edit
          </button>
        </div>

        <div className="grid gap-px border-t border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2">
          <div className="bg-white px-4 py-4 dark:bg-zinc-900 md:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={sectionLabel}>Sharing</p>
              {account.is_public ? <Badge tone="success">Public</Badge> : <Badge tone="muted">Private</Badge>}
            </div>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {account.is_public
                ? 'Anyone with the link can view stats and trade history (notes stay private).'
                : 'Only you can see this account. Publish to share a read-only link.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnSm} type="button" disabled={busy} onClick={() => void handlePublishToggle()}>
                {account.is_public ? 'Unpublish' : 'Publish'}
              </button>
              {account.is_public && shareUrl ? (
                <>
                  <button className={btnSm} type="button" disabled={busy} onClick={() => void handleCopyLink()}>
                    Copy link
                  </button>
                  <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleRegenerateLink()}>
                    Regenerate link
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="bg-white px-4 py-4 dark:bg-zinc-900 md:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className={sectionLabel}>MT5 sync</p>
              {hasSyncKey ? <Badge tone="success">Connected</Badge> : <Badge tone="muted">No key</Badge>}
            </div>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {hasSyncKey
                ? 'A sync key is active for this account. Show it to reconnect the EA if needed.'
                : 'Generate a key and paste it into the EA Sync Key field on this terminal.'}
            </p>
            {hasSyncKey ? (
              <p className={`mt-2 text-xs font-medium ${lastSyncedAt ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
                {lastSyncedAt ? `Last synced: ${formatLastSynced(lastSyncedAt)}` : 'Not synced yet'}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasSyncKey ? (
                <>
                  <button className={btnSm} type="button" disabled={busy} onClick={() => void handleShowKey()}>
                    Key info
                  </button>
                  <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                    Regenerate
                  </button>
                  <button
                    className={btnDanger}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRevokeKey()}
                  >
                    Revoke
                  </button>
                </>
              ) : (
                <button className={btnSm} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                  Generate key
                </button>
              )}
            </div>
          </div>
        </div>

        <InvestorSyncPanel account={account} status={investorStatus} onChanged={onInvestorChanged} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 px-4 py-3 md:px-5">
          <div className="flex flex-wrap gap-2">
            {!account.is_default ? (
              <button className={btnGhost} type="button" disabled={busy} onClick={() => onSetDefault(account.id)}>
                Set as default
              </button>
            ) : (
              <span className="self-center text-xs text-zinc-400">Used as your default account</span>
            )}
          </div>
          <button className={btnDanger} type="button" disabled={busy} onClick={() => void handleRemove()}>
            Remove
          </button>
        </div>
      </article>

      {revealedKey ? (
        <SyncKeyModal
          account={account}
          syncKey={revealedKey}
          onClose={() => setRevealedKey(null)}
        />
      ) : null}
    </>
  );
}

export default function TradingAccountsManager({ tradingAccounts, onUpdated, onSetDefault }) {
  const [modal, setModal] = useState(null);
  const [syncKeyByAccount, setSyncKeyByAccount] = useState({});
  const [investorByAccount, setInvestorByAccount] = useState({});

  async function refreshSyncKeys() {
    try {
      const rows = await listAccountSyncKeys();
      const map = {};
      for (const row of rows) {
        map[row.trading_account_id] = {
          id: row.id,
          last_synced_at: row.last_synced_at || null,
        };
      }
      setSyncKeyByAccount(map);
    } catch {
      setSyncKeyByAccount({});
    }
  }

  async function refreshInvestorStatus() {
    try {
      const rows = await listInvestorCredentialsStatus();
      const map = {};
      for (const row of rows) {
        map[row.trading_account_id] = row;
      }
      setInvestorByAccount(map);
    } catch {
      setInvestorByAccount({});
      toast.error('Could not load sync status — check your connection and try again.', { toastId: 'sync-status-error' });
    }
  }

  useEffect(() => {
    refreshSyncKeys();
    refreshInvestorStatus();
  }, [tradingAccounts.length]);

  async function handleKeysChanged() {
    await refreshSyncKeys();
  }

  async function handleInvestorChanged() {
    await refreshInvestorStatus();
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {tradingAccounts.length === 0
            ? 'Add an account and choose EA sync or investor password.'
            : `${tradingAccounts.length} account${tradingAccounts.length === 1 ? '' : 's'} · sync, share, and set your default`}
        </p>
        <button className={btnPrimary} type="button" onClick={() => setModal({ mode: 'add' })}>
          Add account
        </button>
      </div>

      {tradingAccounts.length === 0 ? (
        <div className={`${card} ${emptyState} mt-3`}>
          <p>No trading accounts yet.</p>
          <button className={`${btnOutline} mt-4`} type="button" onClick={() => setModal({ mode: 'add' })}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {tradingAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              hasSyncKey={Boolean(syncKeyByAccount[account.id])}
              lastSyncedAt={syncKeyByAccount[account.id]?.last_synced_at}
              investorStatus={investorByAccount[account.id] || null}
              onEdit={(acc) => setModal({ mode: 'edit', account: acc })}
              onSetDefault={onSetDefault}
              onUpdated={onUpdated}
              onKeysChanged={handleKeysChanged}
              onInvestorChanged={handleInvestorChanged}
            />
          ))}
        </div>
      )}

      {modal && (
        <AccountFormModal
          mode={modal.mode}
          account={modal.account}
          tradingAccounts={tradingAccounts}
          onClose={() => setModal(null)}
          onSaved={onUpdated}
        />
      )}
    </>
  );
}
