/**
 * Curated MetaTrader broker → server catalog for investor connect UX.
 * Exact `servers[].name` / `serversMt4[].name` values are what MetaTrader / the bridge need.
 * Names are taken from MetaQuotes directories / broker help centers / live latency scans.
 * Brokers always allow free-text custom server because node assignment is per-account.
 */

export const CUSTOM_SERVER_VALUE = '__custom__';
export const OTHER_BROKER_ID = 'other';

/** @typedef {{ name: string, type?: 'live'|'demo'|'unknown' }} MtServer */
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   region?: string,
 *   logo?: string,
 *   pinned?: boolean,
 *   pinRank?: number,
 *   allowCustomServer?: boolean,
 *   servers: MtServer[],
 *   serversMt4?: MtServer[] | null,
 * }} MtBroker
 */

const brokerLogo = (id, ext = 'svg') => `/brokers/${id}.${ext}`;

/** @param {string[]} names @param {'live'|'demo'|'unknown'} [type] */
function live(names) {
  return names.map((name) => ({ name, type: 'live' }));
}
/** @param {string[]} names */
function demo(names) {
  return names.map((name) => ({ name, type: 'demo' }));
}

/** Build Exness-MT5Real / Exness-MT5RealN */
function exnessMt5Servers() {
  return [
    { name: 'Exness-MT5Real', type: 'live' },
    ...Array.from({ length: 40 }, (_, i) => ({ name: `Exness-MT5Real${i + 1}`, type: 'live' })),
    { name: 'Exness-MT5Trial', type: 'demo' },
    ...Array.from({ length: 16 }, (_, i) => ({ name: `Exness-MT5Trial${i + 2}`, type: 'demo' })),
  ];
}

/** Verified Exness MT4 Real/Trial nodes (gaps are intentional — those nodes are unused). */
function exnessMt4Servers() {
  const real = [null, 2, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38];
  const trial = [null, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16];
  return [
    { name: 'Exness-Real', type: 'live' },
    ...real.filter(Boolean).map((n) => ({ name: `Exness-Real${n}`, type: 'live' })),
    { name: 'Exness-Trial', type: 'demo' },
    ...trial.filter(Boolean).map((n) => ({ name: `Exness-Trial${n}`, type: 'demo' })),
  ];
}

/** XM MT4 uses a space before the node number: "XMGlobal-Real 1" */
function xmMt4Servers() {
  const reals = [1, 2, 3, 5, 6, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 32, 33, 35, 36, 38, 39, 41, 42, 43, 44, 46];
  return [
    { name: 'XMGlobal-Real', type: 'live' },
    ...reals.map((n) => ({ name: `XMGlobal-Real ${n}`, type: 'live' })),
    { name: 'XMGlobal-Demo', type: 'demo' },
    { name: 'XMGlobal-Demo 2', type: 'demo' },
    { name: 'XMGlobal-Demo 4', type: 'demo' },
    { name: 'XMGlobal-Demo 8', type: 'demo' },
  ];
}

/** XM MT5 uses a space before the node number: "XMGlobal-MT5 2" */
function xmMt5Servers() {
  return [
    { name: 'XMGlobal-MT5', type: 'live' },
    ...Array.from({ length: 30 }, (_, i) => ({ name: `XMGlobal-MT5 ${i + 2}`, type: 'live' })),
    { name: 'XMGlobal-Demo', type: 'demo' },
    { name: 'XM-MT5', type: 'live' },
  ];
}

/** @type {MtBroker[]} */
export const MT5_BROKERS = [
  // --- Cambodia (SERC derivatives / popular local MT brokers) ---
  {
    id: 'blackwell',
    name: 'Blackwell Global',
    region: 'Cambodia',
    logo: brokerLogo('blackwell', 'png'),
    pinned: true,
    pinRank: 10,
    allowCustomServer: true,
    servers: [
      ...live([
        'BlackwellGlobalInvestments-MT5-Server',
        'BlackwellGlobalFutures-MT5-Server',
        'BlackwellGlobalInvestmentsUK-Live',
      ]),
      ...demo(['BlackwellGlobalInvestments-Demo_Server']),
    ],
    serversMt4: [
      // Exact company node name inside the .srv (capital G)
      { name: 'BlackwellGlobal2-Live3', type: 'live' },
      { name: 'Blackwellglobal2-Live3', type: 'live' },
      { name: 'BlackwellGlobal-Live', type: 'live' },
      { name: 'BlackwellGlobal1-Live5', type: 'live' },
      { name: 'BGPreciousMetals-Live', type: 'live' },
      { name: 'BlackwellGlobal2-Demo3', type: 'demo' },
      { name: 'BlackwellGlobal-Demo', type: 'demo' },
      { name: 'BGPreciousMetals-Demo', type: 'demo' },
    ],
  },
  {
    id: 'stmarket',
    name: 'ST Markets',
    region: 'Cambodia',
    logo: brokerLogo('stmarket', 'png'),
    pinned: true,
    pinRank: 20,
    allowCustomServer: true,
    // MetaQuotes directory currently lists MT5 Live only.
    servers: live(['STMarket-Live']),
    // No verified ST Markets MT4 company node — force exact/custom entry.
    serversMt4: [],
  },
  {
    id: 'atfx',
    name: 'ATFX',
    region: 'Cambodia',
    logo: brokerLogo('atfx', 'png'),
    pinned: true,
    pinRank: 30,
    allowCustomServer: true,
    servers: live(['ATFXKH-LIVE2']),
    serversMt4: live([
      'ATFXGM1-Live',
      'ATFXGM12-Live01',
      'ATFXGM8-Live',
      'ATFXGM3-Live01',
    ]),
  },
  {
    id: 'lirunex',
    name: 'Lirunex',
    region: 'Cambodia',
    logo: brokerLogo('lirunex', 'png'),
    pinned: true,
    pinRank: 40,
    allowCustomServer: true,
    servers: live(['LirunexLimited-Live-MT5', 'LirunexLimited-Live2']),
    serversMt4: live(['LirunexLimited-Live', 'LirunexLimited-Live2']),
  },
  {
    id: 'alphagold',
    name: 'Alpha Gold Futures',
    region: 'Cambodia',
    logo: brokerLogo('alphagold'),
    pinned: true,
    pinRank: 50,
    allowCustomServer: true,
    servers: live(['AlphaGoldFutures-Live']),
    serversMt4: [],
  },
  {
    id: 'bfx',
    name: 'BFX Capital',
    region: 'Cambodia',
    logo: brokerLogo('bfx'),
    pinned: true,
    pinRank: 60,
    allowCustomServer: true,
    servers: live(['BFXCapital-Server']),
    serversMt4: [],
  },
  {
    id: 'brokerjet',
    name: 'Broker Jet',
    region: 'Cambodia',
    logo: brokerLogo('brokerjet'),
    pinned: true,
    pinRank: 70,
    allowCustomServer: true,
    servers: live(['BrokerJetLtd-Live']),
    serversMt4: [],
  },
  {
    id: 'xaumerlion',
    name: 'XAU Merlion Financial',
    region: 'Cambodia',
    logo: brokerLogo('xaumerlion'),
    pinned: true,
    pinRank: 80,
    allowCustomServer: true,
    servers: [],
    serversMt4: live(['XAUMerlion-Live1']),
  },
  {
    id: 'tridentpro',
    name: 'TridentPro Future',
    region: 'Cambodia',
    logo: brokerLogo('tridentpro'),
    pinned: true,
    pinRank: 90,
    allowCustomServer: true,
    servers: live(['TridentproFuture-Live', 'TridentproFuture-Global']),
    serversMt4: [],
  },
  {
    id: 'pplink',
    name: 'PP Link Securities',
    region: 'Cambodia',
    logo: brokerLogo('pplink'),
    pinned: true,
    pinRank: 100,
    allowCustomServer: true,
    servers: live(['PPLinkSecurities-Live']),
    serversMt4: [],
  },
  {
    id: 'yai',
    name: 'YAI Trading',
    region: 'Cambodia',
    logo: brokerLogo('yai'),
    pinned: true,
    pinRank: 110,
    allowCustomServer: true,
    servers: live(['YAITrading-Live', 'YAITrading-Live3', 'YAITradingCoLtd-Real']),
    serversMt4: [],
  },

  // --- Global ---
  {
    id: 'exness',
    name: 'Exness',
    region: 'Global',
    logo: brokerLogo('exness'),
    pinned: true,
    pinRank: 200,
    allowCustomServer: true,
    servers: exnessMt5Servers(),
    serversMt4: exnessMt4Servers(),
  },
  {
    id: 'xm',
    name: 'XM',
    region: 'Global',
    logo: brokerLogo('xm'),
    pinned: true,
    pinRank: 210,
    allowCustomServer: true,
    servers: xmMt5Servers(),
    serversMt4: xmMt4Servers(),
  },
  {
    id: 'icmarkets',
    name: 'IC Markets',
    region: 'Global',
    logo: brokerLogo('icmarkets'),
    pinned: true,
    pinRank: 220,
    allowCustomServer: true,
    servers: [
      ...live([
        'ICMarketsSC-MT5',
        'ICMarketsSC-MT5-2',
        'ICMarketsSC-MT5-4',
        'ICMarketsSC-MT5-6',
        'ICMarketsEU-MT5',
        'ICMarketsEU-MT5-2',
        'ICMarketsEU-MT5-4',
        'ICMarketsEU-MT5-5',
        'ICMarketsInternational-MT5',
        'ICMarketsInternational-MT5-2',
        'ICMarketsGRP-MT5',
      ]),
      ...demo([
        'ICMarketsSC-Demo',
        'ICMarketsSC-Demo03',
        'ICMarketsEU-Demo',
        'ICMarketsEU-Demo01',
        'ICMarketsEU-Demo02',
        'ICMarketsEU-Demo03',
      ]),
    ],
    serversMt4: [
      ...live([
        'ICMarketsSC-Live',
        'ICMarketsSC-Live01',
        'ICMarketsSC-Live02',
        'ICMarketsSC-Live03',
        'ICMarketsEU-Live28',
        'ICMarketsInternational-Live29',
        'ICMarketsGRP-Live01',
        'ICMarketsGRP-Live35',
      ]),
      ...demo([
        'ICMarketsSC-Demo',
        'ICMarketsSC-Demo01',
        'ICMarketsEU-Demo01',
        'ICMarketsInternational-Demo05',
        'ICMarketsGRP-Demo01',
      ]),
    ],
  },
  {
    id: 'pepperstone',
    name: 'Pepperstone',
    region: 'Global',
    logo: brokerLogo('pepperstone'),
    allowCustomServer: true,
    // Company directory nodes are EdgeNN (not "Pepperstone-Live" / "Pepperstone-MT5-Live").
    servers: [
      ...live([
        'Pepperstone-Edge01',
        'Pepperstone-Edge02',
        'Pepperstone-Edge03',
        'Pepperstone-Edge04',
        'Pepperstone-Edge05',
        'Pepperstone-Edge06',
        'Pepperstone-Edge08',
        'Pepperstone-Edge09',
        'Pepperstone-Edge12',
        'Pepperstone-Edge14',
        'mt5-1.pepperstone.com',
      ]),
      ...demo(['Pepperstone-Demo01', 'mt5-demo01.pepperstone.com']),
    ],
    serversMt4: [
      ...live([
        'Pepperstone-Edge01',
        'Pepperstone-Edge02',
        'Pepperstone-Edge03',
        'Pepperstone-Edge04',
        'Pepperstone-Edge05',
        'Pepperstone-Edge06',
        'Pepperstone-Edge08',
        'Pepperstone-Edge09',
        'Pepperstone-Edge12',
        'Pepperstone-Edge14',
      ]),
      ...demo(['Pepperstone-Demo01', 'Pepperstone-Demo02']),
    ],
  },
  {
    id: 'fbs',
    name: 'FBS',
    region: 'Global',
    logo: brokerLogo('fbs'),
    allowCustomServer: true,
    servers: [
      { name: 'FBS-Real', type: 'live' },
      ...Array.from({ length: 12 }, (_, i) => ({ name: `FBS-Real-${i + 1}`, type: 'live' })),
      { name: 'FBS-Demo', type: 'demo' },
    ],
    serversMt4: [
      { name: 'FBS-Real', type: 'live' },
      ...Array.from({ length: 12 }, (_, i) => ({ name: `FBS-Real-${i + 1}`, type: 'live' })),
      { name: 'FBS-Demo', type: 'demo' },
    ],
  },
  {
    id: 'roboforex',
    name: 'RoboForex',
    region: 'Global',
    logo: brokerLogo('roboforex'),
    allowCustomServer: true,
    servers: [
      ...live([
        'RoboForex-ECN',
        'RoboForex-ECN-2',
        'RoboForex-ECN-3',
        'RoboForex-Pro',
        'RoboForex-Pro-2',
        'RoboForex-Pro-3',
        'RoboForex-Pro-4',
        'RoboForex-Pro-5',
        'RoboForex-Pro-6',
        'RoboForex-Prime',
        'RoboForex-ProCent',
        'RoboForex-ProCent-2',
        'RoboForex-ProCent-3',
        'RoboForex-ProCent-4',
        'RoboForex-ProCent-5',
        'RoboForex-ProCent-6',
        'RoboForex-ProCent-7',
        'RoboForex-ProCent-8',
      ]),
      ...demo(['RoboForex-Demo', 'RoboForex-DemoPro']),
    ],
    serversMt4: [
      ...live([
        'RoboForex-ECN',
        'RoboForex-ECN-2',
        'RoboForex-ECN-3',
        'RoboForex-Pro',
        'RoboForex-Pro-2',
        'RoboForex-Pro-3',
        'RoboForex-Pro-4',
        'RoboForex-Pro-5',
        'RoboForex-Pro-6',
        'RoboForex-Prime',
        'RoboForex-ProCent',
        'RoboForex-ProCent-2',
        'RoboForex-ProCent-3',
        'RoboForex-ProCent-4',
        'RoboForex-ProCent-5',
        'RoboForex-ProCent-6',
        'RoboForex-ProCent-7',
        'RoboForex-ProCent-8',
      ]),
      ...demo(['RoboForex-Demo', 'RoboForex-DemoPro']),
    ],
  },
  {
    id: 'tickmill',
    name: 'Tickmill',
    region: 'Global',
    logo: brokerLogo('tickmill'),
    allowCustomServer: true,
    servers: [
      ...live([
        'Tickmill-Live',
        'Tickmill-Live02',
        'Tickmill-Live04',
        'Tickmill-Live05',
        'Tickmill-Live06',
        'Tickmill-Live08',
        'Tickmill-Live09',
        'Tickmill-Live10',
        'TickmillUK-Live',
        'TickmillUK-Live03',
        'TickmillEU-Live',
      ]),
      ...demo(['Tickmill-Demo', 'Tickmill-DemoUK', 'TickmillUK-Demo', 'TickmillEU-Demo']),
    ],
    serversMt4: [
      ...live([
        'Tickmill-Live',
        'Tickmill-Live02',
        'Tickmill-Live04',
        'Tickmill-Live05',
        'Tickmill-Live06',
        'Tickmill-Live08',
        'Tickmill-Live09',
        'Tickmill-Live10',
        'TickmillUK-Live',
        'TickmillUK-Live03',
        'TickmillEU-Live',
      ]),
      ...demo(['Tickmill-Demo', 'Tickmill-DemoUK', 'TickmillUK-Demo', 'TickmillEU-Demo']),
    ],
  },
  {
    id: 'fxpro',
    name: 'FxPro',
    region: 'Global',
    logo: brokerLogo('fxpro'),
    allowCustomServer: true,
    servers: [
      ...live([
        'FxPro-MT5',
        'FxPro-MT5 Live02',
        'FxPro-MT5 Live03',
        'FxPro.Global-MT5 Live02',
      ]),
      ...demo(['FxPro-MT5 Demo']),
    ],
    serversMt4: [
      ...live([
        'FxPro.com-Real01',
        'FxPro.com-Real02',
        'FxPro.com-Real03',
        'FxPro.com-Real04',
        'FxPro.com-Real05',
        'FxPro.com-Real06',
        'FxPro.com-Real07',
        'FxPro.com-Real08',
        'FxPro.com-Real09',
      ]),
      ...demo(['FxPro.com-Demo01', 'FxPro.com-Demo05', 'FxPro.com-Demo06']),
    ],
  },
  {
    id: 'fusionmarkets',
    name: 'Fusion Markets',
    region: 'Global',
    logo: brokerLogo('fusionmarkets'),
    allowCustomServer: true,
    servers: live(['FusionMarketsAU-Live', 'GlobalPrime-Live', 'GlobalPrime-Trade']),
    serversMt4: [
      ...live(['FusionMarkets-Live', 'FusionMarkets-Live 2', 'FusionMarkets-Live 3']),
      ...demo(['FusionMarkets-Demo']),
    ],
  },
  {
    id: 'litefinance',
    name: 'LiteFinance',
    region: 'Global',
    logo: brokerLogo('litefinance'),
    allowCustomServer: true,
    servers: [
      ...live([
        'LiteFinanceVC-Live-02',
        'LiteFinanceVC-Live-03',
        'LiteFinanceVC-Live-04',
        'LiteFinanceVC-Live-05',
        'LiteFinanceVC-Live-06',
        'LiteFinanceVC-Live-07',
        'LiteFinanceVC-Live-08',
        'LiteFinanceVC-Live-09',
        'LiteFinanceMU-Live-10',
        'LiteFinanceMU-Live-11',
      ]),
      ...demo(['LiteFinanceVC-Demo', 'LiteFinanceMU-Demo']),
    ],
    serversMt4: [
      ...live([
        'LiteFinanceVC-Live-02',
        'LiteFinanceVC-Live-03',
        'LiteFinanceVC-Live-04',
        'LiteFinanceVC-Live-05',
        'LiteFinanceVC-Live-06',
        'LiteFinanceVC-Live-07',
        'LiteFinanceVC-Live-08',
        'LiteFinanceVC-Live-09',
        'LiteFinanceMU-Live-10',
        'LiteFinanceMU-Live-11',
      ]),
      ...demo(['LiteFinanceVC-Demo', 'LiteFinanceMU-Demo']),
    ],
  },
  {
    id: 'alpari',
    name: 'Alpari',
    region: 'Global',
    logo: brokerLogo('alpari'),
    allowCustomServer: true,
    servers: [
      ...live(['Alpari-MT5']),
      ...demo(['Alpari-MT5-Demo']),
    ],
    serversMt4: [
      ...live([
        'Alpari-ECN1',
        'Alpari-Pro.ECN',
        'Alpari-Pro.ECN2',
        'Alpari-Pro.ECN3',
        'Alpari-Standard1',
        'Alpari-Standard2',
        'Alpari-Standard3',
      ]),
      ...demo(['Alpari-Demo', 'Alpari-ECN-Demo', 'Alpari-Pro.ECN-Demo']),
    ],
  },
  {
    id: 'forextime',
    name: 'ForexTime / FXTM',
    region: 'Global',
    logo: brokerLogo('forextime'),
    allowCustomServer: true,
    servers: [
      ...live([
        'ForexTime-Standard',
        'ForexTime-Cent',
        'ForexTime-Cent2',
        'ForexTime-ECN',
        'ForexTime-ECN2',
        'ForexTime-ECN-Zero',
        'ForexTimeFXTM-Standard',
        'ForexTimeFXTM-Cent',
        'ForexTimeFXTM-Cent2',
        'ForexTimeFXTM-ECN',
        'ForexTimeFXTM-ECN2',
        'ForexTimeFXTM-ECN-Zero',
      ]),
      ...demo([
        'ForexTime-Standard-demo',
        'ForexTime-Cent-demo',
        'ForexTime-ECN-demo',
        'ForexTime-ECN-Zero-demo',
        'ForexTimeFXTM-Standard-demo',
        'ForexTimeFXTM-Cent-demo',
        'ForexTimeFXTM-ECN-demo',
        'ForexTimeFXTM-ECN-Zero-demo',
      ]),
    ],
    serversMt4: [
      ...live([
        'ForexTime-Standard',
        'ForexTime-Cent',
        'ForexTime-Cent2',
        'ForexTime-ECN',
        'ForexTime-ECN2',
        'ForexTime-ECN-Zero',
        'ForexTimeFXTM-Standard',
        'ForexTimeFXTM-Cent',
        'ForexTimeFXTM-Cent2',
        'ForexTimeFXTM-ECN',
        'ForexTimeFXTM-ECN2',
        'ForexTimeFXTM-ECN-Zero',
      ]),
      ...demo([
        'ForexTime-Standard-demo',
        'ForexTime-Cent-demo',
        'ForexTime-ECN-demo',
        'ForexTime-ECN-Zero-demo',
        'ForexTimeFXTM-Standard-demo',
        'ForexTimeFXTM-Cent-demo',
        'ForexTimeFXTM-ECN-demo',
        'ForexTimeFXTM-ECN-Zero-demo',
      ]),
    ],
  },
  {
    id: OTHER_BROKER_ID,
    name: 'Other / not listed',
    region: 'Custom',
    logo: brokerLogo('other'),
    allowCustomServer: true,
    servers: [],
    serversMt4: [],
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
    const ar = Number.isFinite(a.pinRank) ? a.pinRank : 500;
    const br = Number.isFinite(b.pinRank) ? b.pinRank : 500;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });
}

export function brokerSelectOptions({ includePlaceholder = false } = {}) {
  const opts = listMt5BrokersSorted().map((b) => ({
    value: b.id,
    label: b.region && b.id !== OTHER_BROKER_ID ? `${b.name} · ${b.region}` : b.name,
    logo: b.logo || '',
  }));
  if (includePlaceholder) {
    return [{ value: '', label: 'Select broker…', logo: '' }, ...opts];
  }
  return opts;
}

export function brokerLogoSrc(brokerId) {
  return getMt5Broker(brokerId)?.logo || '';
}

function serversForPlatform(broker, platform = 'mt5') {
  const isMt4 = String(platform || 'mt5').toLowerCase() === 'mt4';
  // Explicit empty array means "no known nodes for this platform" → custom only.
  if (isMt4 && broker.serversMt4 != null) return broker.serversMt4;
  return broker.servers || [];
}

export function serverSelectOptions(brokerId, platform = 'mt5') {
  const broker = getMt5Broker(brokerId);
  if (!broker) return [{ value: CUSTOM_SERVER_VALUE, label: 'Type exact server…' }];
  const servers = serversForPlatform(broker, platform);
  const opts = servers.map((s) => ({
    value: s.name,
    label: s.type === 'demo' ? `${s.name} (demo)` : s.name,
  }));
  if (broker.allowCustomServer || servers.length === 0) {
    opts.push({ value: CUSTOM_SERVER_VALUE, label: 'Type exact server…' });
  }
  return opts;
}

/** Resolve the exact MetaTrader server string to send to the bridge. */
export function resolveMt5Server(brokerId, serverChoice, customServer) {
  if (!serverChoice || serverChoice === CUSTOM_SERVER_VALUE) {
    return (customServer || '').trim();
  }
  return String(serverChoice).trim();
}

export function brokerDisplayName(brokerId) {
  return getMt5Broker(brokerId)?.name || '';
}
