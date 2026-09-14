// src/components/settings/BrokerServerFields.jsx
import { useEffect, useMemo, useState } from 'react';
import CustomDropdown from '../common/CustomDropdown';
import { input, label, select } from '../../lib/ui';
import {
  CUSTOM_SERVER_VALUE,
  OTHER_BROKER_ID,
  brokerDisplayName,
  brokerSelectOptions,
  resolveMt5Server,
  serverSelectOptions,
} from '../../data/mt5Brokers';

const formSelectBtn = `${select} inline-flex items-center justify-between gap-2 text-left font-normal`;

/**
 * Broker → server picker for investor connect.
 * Emits the exact MetaTrader `brokerServer` string plus optional display `brokerName`.
 * `mode`: "all" | "broker" | "server"
 * `platform`: "mt4" | "mt5" — labels + MT4/MT5 server lists when a broker defines both.
 */
export default function BrokerServerFields({
  brokerId = '',
  serverChoice = '',
  customServer = '',
  onChange,
  disabled = false,
  mode = 'all',
  platform = 'mt5',
}) {
  const [brokerQuery, setBrokerQuery] = useState('');
  const showBroker = mode === 'all' || mode === 'broker';
  const showServer = mode === 'all' || mode === 'server';
  const platShort = String(platform || 'mt5').toLowerCase() === 'mt4' ? 'MT4' : 'MT5';
  const allBrokers = useMemo(() => brokerSelectOptions({ includePlaceholder: true }), []);
  const filteredBrokers = useMemo(() => {
    const q = brokerQuery.trim().toLowerCase();
    const base = allBrokers.filter((o) => o.value !== '' || !q);
    if (!q) return base;
    const matched = base.filter(
      (o) => o.value && (o.label.toLowerCase().includes(q) || o.value.includes(q)),
    );
    const selected = allBrokers.find((o) => o.value === brokerId);
    if (selected && selected.value && !matched.some((o) => o.value === selected.value)) {
      matched.unshift(selected);
    }
    return matched.length ? matched : base;
  }, [allBrokers, brokerQuery, brokerId]);

  const serverOpts = useMemo(
    () => serverSelectOptions(brokerId, platform),
    [brokerId, platform],
  );
  const showCustom =
    showServer && (
      !brokerId ||
      brokerId === OTHER_BROKER_ID ||
      serverChoice === CUSTOM_SERVER_VALUE ||
      serverOpts.length <= 1
    );

  function patch(next) {
    const merged = {
      brokerId,
      serverChoice,
      customServer,
      ...next,
    };
    const brokerServer = resolveMt5Server(merged.brokerId, merged.serverChoice, merged.customServer);
    onChange({
      ...merged,
      brokerServer,
      brokerName: brokerDisplayName(merged.brokerId) || brokerServer,
    });
  }

  // When platform flips MT4 ↔ MT5, keep the broker but refresh the default server list.
  useEffect(() => {
    if (!brokerId || brokerId === OTHER_BROKER_ID) return;
    const opts = serverSelectOptions(brokerId, platform);
    const values = opts.map((o) => o.value).filter((v) => v && v !== CUSTOM_SERVER_VALUE);
    if (!values.length) return;
    if (serverChoice && serverChoice !== CUSTOM_SERVER_VALUE && values.includes(serverChoice)) {
      return;
    }
    const first = values[0];
    if (first && first !== serverChoice) {
      patch({ serverChoice: first, customServer: '' });
    }
    // Intentionally only react to platform/broker changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, brokerId]);

  function handleBroker(nextId) {
    if (!nextId) {
      setBrokerQuery('');
      patch({
        brokerId: '',
        serverChoice: '',
        customServer: '',
      });
      return;
    }
    const opts = serverSelectOptions(nextId, platform);
    const first = opts.find((o) => o.value !== CUSTOM_SERVER_VALUE);
    const nextChoice = first?.value || CUSTOM_SERVER_VALUE;
    setBrokerQuery('');
    patch({
      brokerId: nextId,
      serverChoice: nextChoice,
      customServer: nextChoice === CUSTOM_SERVER_VALUE ? customServer : '',
    });
  }

  return (
    <div className="space-y-3">
      {showBroker ? (
        <div>
          <label className={label}>Broker</label>
          <input
            className={`${input} mb-2`}
            placeholder="Search brokers (Blackwell, ST Markets, ATFX…)"
            value={brokerQuery}
            onChange={(e) => setBrokerQuery(e.target.value)}
            disabled={disabled}
            autoComplete="off"
          />
          <CustomDropdown
            className="w-full"
            menuClassName="w-full"
            buttonClassName={formSelectBtn}
            ariaLabel="Broker"
            value={brokerId || ''}
            onChange={handleBroker}
            options={filteredBrokers.length ? filteredBrokers : allBrokers}
          />
        </div>
      ) : null}

      {showServer && brokerId && brokerId !== OTHER_BROKER_ID && serverOpts.some((o) => o.value !== CUSTOM_SERVER_VALUE) ? (
        <div>
          <label className={label}>Server</label>
          <CustomDropdown
            className="w-full"
            menuClassName="w-full max-h-72"
            buttonClassName={formSelectBtn}
            ariaLabel={`${platShort} server`}
            value={serverChoice || CUSTOM_SERVER_VALUE}
            onChange={(v) => patch({ serverChoice: v })}
            options={serverOpts}
          />
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Use the exact server from your broker portal / {platShort} login. Wrong server = login fails even with the right password.
          </p>
        </div>
      ) : null}

      {showCustom ? (
        <div>
          <label className={label}>
            {brokerId && brokerId !== OTHER_BROKER_ID ? 'Exact server name' : `${platShort} server name`}
          </label>
          <input
            className={input}
            placeholder={
              platShort === 'MT4'
                ? 'e.g. Blackwellglobal2-Live3 or Exness-Real'
                : 'e.g. STMarket-Live or Exness-MT5Real36'
            }
            value={customServer}
            onChange={(e) =>
              patch({
                serverChoice: CUSTOM_SERVER_VALUE,
                customServer: e.target.value,
              })
            }
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  );
}
