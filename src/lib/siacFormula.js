/** Safe SIAC arithmetic formulas over allowlisted journal metrics. */

export const FORMULA_MAX_LEN = 200;

/** @type {Record<string, string>} */
export const FORMULA_VARS = {
  history_days: 'Trading history (days)',
  trade_count: 'Closed trades',
  win_rate: 'Win rate (0–1)',
  profit_factor: 'Profit factor',
  total_pnl_pct: 'Total PnL % (0–1)',
  daily_loss_pct: 'Max daily loss % (0–1)',
  overall_loss_pct: 'Max overall loss % (0–1)',
  max_dd_pct: 'Max drawdown % (0–1)',
  risk_breaches: 'Risk-per-trade breaches',
  wins: 'Win count',
  losses: 'Loss count',
  gross_win: 'Gross win $',
  gross_loss: 'Gross loss $',
  total_pnl: 'Total PnL $',
  base: 'Equity base $',
};

const VAR_NAMES = Object.keys(FORMULA_VARS).sort((a, b) => b.length - a.length);

export function formulaVarOptions() {
  return VAR_NAMES.map((value) => ({
    value,
    label: FORMULA_VARS[value],
  }));
}

/**
 * @param {string} expr
 * @returns {{ ok: true, ast: object } | { ok: false, error: string }}
 */
export function parseFormula(expr) {
  const raw = String(expr || '').trim();
  if (!raw) return { ok: false, error: 'Formula is required.' };
  if (raw.length > FORMULA_MAX_LEN) {
    return { ok: false, error: `Formula must be ${FORMULA_MAX_LEN} characters or fewer.` };
  }
  if (!/^[0-9a-zA-Z_+\-*/().\s]+$/.test(raw)) {
    return { ok: false, error: 'Formula can only use numbers, + − × ÷, parentheses, and metric names.' };
  }

  let i = 0;
  function skip() {
    while (i < raw.length && /\s/.test(raw[i])) i += 1;
  }
  function peek() {
    skip();
    return raw[i] || '';
  }
  function fail(msg) {
    const err = new Error(msg);
    err.code = 'PARSE';
    throw err;
  }

  function parseNumber() {
    skip();
    const start = i;
    if (raw[i] === '.') fail('Invalid number.');
    while (i < raw.length && /[0-9]/.test(raw[i])) i += 1;
    if (raw[i] === '.') {
      i += 1;
      if (!/[0-9]/.test(raw[i])) fail('Invalid number.');
      while (i < raw.length && /[0-9]/.test(raw[i])) i += 1;
    }
    if (start === i) fail('Expected a number.');
    const n = Number(raw.slice(start, i));
    if (!Number.isFinite(n)) fail('Invalid number.');
    return { type: 'num', value: n };
  }

  function parseIdent() {
    skip();
    const start = i;
    if (!/[a-zA-Z_]/.test(raw[i])) fail('Expected a metric name.');
    while (i < raw.length && /[a-zA-Z0-9_]/.test(raw[i])) i += 1;
    const name = raw.slice(start, i);
    if (!FORMULA_VARS[name]) {
      fail(`Unknown metric "${name}". Use a listed variable.`);
    }
    return { type: 'var', name };
  }

  function parsePrimary() {
    const ch = peek();
    if (!ch) fail('Unexpected end of formula.');
    if (ch === '(') {
      i += 1;
      const inner = parseExpr();
      if (peek() !== ')') fail('Missing closing parenthesis.');
      i += 1;
      return inner;
    }
    if (/[0-9]/.test(ch)) return parseNumber();
    if (/[a-zA-Z_]/.test(ch)) return parseIdent();
    fail(`Unexpected "${ch}".`);
  }

  function parseUnary() {
    const ch = peek();
    if (ch === '+' || ch === '-') {
      i += 1;
      const arg = parseUnary();
      return ch === '+' ? arg : { type: 'neg', arg };
    }
    return parsePrimary();
  }

  function parseMul() {
    let left = parseUnary();
    for (;;) {
      const ch = peek();
      if (ch !== '*' && ch !== '/') break;
      i += 1;
      const right = parseUnary();
      left = { type: 'bin', op: ch, left, right };
    }
    return left;
  }

  function parseExpr() {
    let left = parseMul();
    for (;;) {
      const ch = peek();
      if (ch !== '+' && ch !== '-') break;
      i += 1;
      const right = parseMul();
      left = { type: 'bin', op: ch, left, right };
    }
    return left;
  }

  try {
    const ast = parseExpr();
    skip();
    if (i < raw.length) {
      return { ok: false, error: `Unexpected "${raw[i]}" near end of formula.` };
    }
    return { ok: true, ast };
  } catch (e) {
    return { ok: false, error: e.message || 'Invalid formula.' };
  }
}

/**
 * @param {object} ast
 * @param {Record<string, number|null|undefined>} vars
 * @returns {number|null}
 */
export function evalFormula(ast, vars) {
  if (!ast || typeof ast !== 'object') return null;

  function walk(node) {
    if (!node) return null;
    if (node.type === 'num') {
      return Number.isFinite(node.value) ? node.value : null;
    }
    if (node.type === 'var') {
      const v = vars?.[node.name];
      if (v == null || !Number.isFinite(Number(v))) return null;
      return Number(v);
    }
    if (node.type === 'neg') {
      const a = walk(node.arg);
      if (a == null) return null;
      return -a;
    }
    if (node.type === 'bin') {
      const l = walk(node.left);
      const r = walk(node.right);
      if (l == null || r == null) return null;
      let out;
      if (node.op === '+') out = l + r;
      else if (node.op === '-') out = l - r;
      else if (node.op === '*') out = l * r;
      else if (node.op === '/') {
        if (r === 0) return null;
        out = l / r;
      } else return null;
      return Number.isFinite(out) ? out : null;
    }
    return null;
  }

  return walk(ast);
}

/**
 * @param {string} expr
 * @returns {{ ok: true, formula: string, ast: object } | { ok: false, error: string }}
 */
export function validateFormula(expr) {
  const parsed = parseFormula(expr);
  if (!parsed.ok) return parsed;
  return { ok: true, formula: String(expr || '').trim(), ast: parsed.ast };
}

/**
 * Parse + eval in one step.
 * @param {string} expr
 * @param {Record<string, number|null|undefined>} vars
 * @returns {{ ok: true, value: number } | { ok: false, error: string, value: null }}
 */
export function evaluateFormulaExpr(expr, vars) {
  const parsed = parseFormula(expr);
  if (!parsed.ok) return { ok: false, error: parsed.error, value: null };
  const value = evalFormula(parsed.ast, vars);
  if (value == null || !Number.isFinite(value)) {
    return { ok: false, error: 'Formula result is not a finite number.', value: null };
  }
  return { ok: true, value };
}
