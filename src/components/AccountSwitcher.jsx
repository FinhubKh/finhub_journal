import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { accountTypeLabel } from '../lib/accounts';
import { input } from '../lib/ui';

export default function AccountSwitcher() {
  const navigate = useNavigate();
  const {
    tradingAccounts,
    viewMode,
    activeAccountId,
    setViewMode,
    setActiveAccountId,
  } = useAppData();

  const value = viewMode === 'portfolio' ? 'portfolio' : activeAccountId;

  function onChange(e) {
    const v = e.target.value;
    if (v === 'portfolio') {
      setViewMode('portfolio');
      return;
    }
    if (v === 'manage') {
      navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } });
      return;
    }
    setActiveAccountId(v);
  }

  return (
    <select
      className={`${input} py-2 text-xs`}
      value={value}
      onChange={onChange}
      aria-label="Portfolio or trading account"
    >
      <option value="portfolio">Portfolio</option>
      {tradingAccounts.length > 0 && (
        <optgroup label="Accounts">
          {tradingAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({accountTypeLabel(a.account_type)})
            </option>
          ))}
        </optgroup>
      )}
      <option value="manage">+ Connect account</option>
    </select>
  );
}
