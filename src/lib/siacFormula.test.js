import { describe, expect, it } from 'vitest';
import {
  parseFormula,
  evalFormula,
  validateFormula,
  evaluateFormulaExpr,
} from './siacFormula.js';

describe('siacFormula', () => {
  it('parses and evaluates arithmetic with variables', () => {
    const parsed = parseFormula('win_rate * 100 + 5');
    expect(parsed.ok).toBe(true);
    expect(evalFormula(parsed.ast, { win_rate: 0.55 })).toBeCloseTo(60, 5);
  });

  it('supports parentheses and division', () => {
    const out = evaluateFormulaExpr('(gross_win - gross_loss) / base', {
      gross_win: 200,
      gross_loss: 50,
      base: 10000,
    });
    expect(out.ok).toBe(true);
    expect(out.value).toBeCloseTo(0.015, 5);
  });

  it('rejects unknown variables and illegal characters', () => {
    expect(parseFormula('foo + 1').ok).toBe(false);
    expect(parseFormula('win_rate >= 0.5').ok).toBe(false);
    expect(parseFormula('Math.max(1,2)').ok).toBe(false);
  });

  it('fails on division by zero and missing vars', () => {
    expect(evaluateFormulaExpr('1 / 0', {}).ok).toBe(false);
    expect(evaluateFormulaExpr('win_rate * 100', {}).ok).toBe(false);
    expect(evaluateFormulaExpr('win_rate * 100', { win_rate: null }).ok).toBe(false);
  });

  it('validateFormula trims and accepts unary minus', () => {
    const v = validateFormula('  -trade_count + 10 ');
    expect(v.ok).toBe(true);
    expect(evalFormula(v.ast, { trade_count: 3 })).toBe(7);
  });
});
