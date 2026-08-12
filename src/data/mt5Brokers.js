/**
 * Curated MT5 broker → server catalog for investor connect UX.
 * Exact `servers[].name` values are what MetaTrader / the bridge need.
 * Brokers with many numbered nodes also allow free-text custom server.
 */

export const CUSTOM_SERVER_VALUE = '__custom__';
export const OTHER_BROKER_ID = 'other';

/** @typedef {{ name: string, type?: 'live'|'demo'|'unknown' }} Mt5Server */
/** @typedef {{ id: string, name: string, region?: string, pinned?: boolean, allowCustomServer?: boolean, servers: Mt5Server[] }} Mt5Broker */

/** @type {Mt5Broker[]} */
export const MT5_BROKERS = [
  {
    id: 'stmarket',
    name: 'ST Markets',
    region: 'Cambodia',
    pinned: true,
    allowCustomServer: true,
    servers: [
      { name: 'STMarket-Live', type: 'live' },
      { name: 'STMarket-Demo', type: 'demo' },
    ],
  },
  {
    id: 'lirunex',
    name: 'Lirunex',
    region: 'Asia',
    pinned: true,
    allowCustomServer: true,
    servers: [
      { name: 'LirunexLimited-Live', type: 'live' },
      { name: 'LirunexLimited-Live-MT5', type: 'live' },
      { name: 'LirunexLimited-Demo', type: 'demo' },
      { name: 'Lirunex-Live-UK', type: 'live' },
      { name: 'Lirunex-Demo-UK', type: 'demo' },
    ],
  },
  {
    id: 'exness',
    name: 'Exness',
    region: 'Global',
    pinned: true,
    allowCustomServer: true,
    servers: [
      { name: 'Exness-MT5Real', type: 'live' },
      ...Array.from({ length: 40 }, (_, i) => ({
        name: `Exness-MT5Real${i + 1}`,
        type: 'live',
      })),
      { name: 'Exness-MT5Trial', type: 'demo' },
      { name: 'Exness-MT5Trial2', type: 'demo' },
      { name: 'Exness-MT5Trial3', type: 'demo' },
      { name: 'Exness-MT5Trial4', type: 'demo' },
      { name: 'Exness-MT5Trial5', type: 'demo' },
      { name: 'Exness-MT5Trial6', type: 'demo' },
      { name: 'Exness-MT5Trial7', type: 'demo' },
      { name: 'Exness-MT5Trial8', type: 'demo' },
    ],
  },
  {
    id: 'xm',
    name: 'XM',
    region: 'Global',
    pinned: true,
    allowCustomServer: true,
    servers: [
      { name: 'XMGlobal-MT5', type: 'live' },
      { name: 'XMGlobal-MT5 2', type: 'live' },
      { name: 'XMGlobal-MT5 3', type: 'live' },
      { name: 'XM-MT5', type: 'live' },
      { name: 'XMGlobal-Demo', type: 'demo' },
    ],
  },
  {
    id: 'icmarkets',
    name: 'IC Markets',
    region: 'Global',
    pinned: true,
    allowCustomServer: true,
    servers: [
      { name: 'ICMarketsSC-MT5', type: 'live' },
      { name: 'ICMarketsSC-MT5-2', type: 'live' },
      { name: 'ICMarketsSC-MT5-4', type: 'live' },
      { name: 'ICMarketsSC-Demo', type: 'demo' },
      { name: 'ICMarketsSC-Demo03', type: 'demo' },
      { name: 'ICMarketsEU-MT5', type: 'live' },
      { name: 'ICMarketsEU-MT5-2', type: 'live' },
      { name: 'ICMarketsEU-Demo', type: 'demo' },
    ],
  },
  {
    id: 'pepperstone',
    name: 'Pepperstone',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'Pepperstone-MT5-Live', type: 'live' },
      { name: 'Pepperstone-MT5-Live01', type: 'live' },
      { name: 'Pepperstone-Demo', type: 'demo' },
    ],
  },
  {
    id: 'fbs',
    name: 'FBS',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'FBS-Real', type: 'live' },
      { name: 'FBS-Demo', type: 'demo' },
    ],
  },
  {
    id: 'roboforex',
    name: 'RoboForex',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'RoboForex-ECN', type: 'live' },
      { name: 'RoboForex-Pro', type: 'live' },
    ],
  },
  {
    id: 'tickmill',
    name: 'Tickmill',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'Tickmill-Demo', type: 'demo' },
      { name: 'TickmillUK-Live', type: 'live' },
      { name: 'TickmillUK-Demo', type: 'demo' },
      { name: 'TickmillEU-Live', type: 'live' },
      { name: 'TickmillEU-Demo', type: 'demo' },
    ],
  },
  {
    id: 'fxpro',
    name: 'FxPro',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'FxPro-MT5', type: 'live' },
      { name: 'FxPro-MT5 Live02', type: 'live' },
      { name: 'FxPro-MT5 Demo', type: 'demo' },
    ],
  },
  {
    id: 'fusionmarkets',
    name: 'Fusion Markets',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'FusionMarkets-Live', type: 'live' },
      { name: 'FusionMarkets-Demo', type: 'demo' },
    ],
  },
  {
    id: 'litefinance',
    name: 'LiteFinance',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'LiteFinance-MT5-Live', type: 'live' },
      { name: 'LiteFinance-MT5-Demo', type: 'demo' },
    ],
  },
  {
    id: 'alpari',
    name: 'Alpari',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'Alpari-MT5', type: 'live' },
      { name: 'Alpari-MT5-Demo', type: 'demo' },
    ],
  },
  {
    id: 'forextime',
    name: 'ForexTime / FXTM',
    region: 'Global',
    allowCustomServer: true,
    servers: [
      { name: 'ForexTime-Live01', type: 'live' },
      { name: 'ForexTime-Live02', type: 'live' },
      { name: 'ForexTime-Demo01', type: 'demo' },
      { name: 'ForexTimeFXTM-Live01', type: 'live' },
      { name: 'ForexTimeFXTM-Demo01', type: 'demo' },
    ],
  },
  {
    id: OTHER_BROKER_ID,
    name: 'Other / not listed',
    region: 'Custom',
    allowCustomServer: true,
    servers: [],
  },
];

export function getMt5Broker(id) {
  return MT5_BROKERS.find((b) => b.id === id) || null;
}

export function listMt5BrokersSorted() {
  return [...MT5_BROKERS].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (a.id === OTHER_BROKER_ID) return 1;
    if (b.id === OTHER_BROKER_ID) return -1;
    return a.name.localeCompare(b.name);
  });
}

export function brokerSelectOptions({ includePlaceholder = false } = {}) {
  const opts = listMt5BrokersSorted().map((b) => ({
    value: b.id,
    label: b.region && b.id !== OTHER_BROKER_ID ? `${b.name} · ${b.region}` : b.name,
  }));
  if (includePlaceholder) {
    return [{ value: '', label: 'Select broker…' }, ...opts];
  }
  return opts;
}

export function serverSelectOptions(brokerId) {
  const broker = getMt5Broker(brokerId);
  if (!broker) return [{ value: CUSTOM_SERVER_VALUE, label: 'Type exact server…' }];
  const opts = broker.servers.map((s) => ({
    value: s.name,
    label: s.type === 'demo' ? `${s.name} (demo)` : s.name,
  }));
  if (broker.allowCustomServer || broker.servers.length === 0) {
    opts.push({ value: CUSTOM_SERVER_VALUE, label: 'Type exact server…' });
  }
  return opts;
}

/** Resolve the exact MT5 server string to send to the bridge. */
export function resolveMt5Server(brokerId, serverChoice, customServer) {
  if (!serverChoice || serverChoice === CUSTOM_SERVER_VALUE) {
    return (customServer || '').trim();
  }
  return String(serverChoice).trim();
}

export function brokerDisplayName(brokerId) {
  return getMt5Broker(brokerId)?.name || '';
}
