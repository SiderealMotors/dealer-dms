import {
  centsToDecimalString,
  compareDecimalMoneyStrings,
  finiteMoneyNumberToCents,
  parseFixed2DecimalMoneyString,
  percentOfCents,
} from './money';
import { INVENTORY_HST_PERCENT_POINTS } from './tax-constants';

describe('money (bigint cents)', () => {
  describe('finiteMoneyNumberToCents', () => {
    it('rounds half-up to integer cents from JSON-style number', () => {
      expect(finiteMoneyNumberToCents(19.99)).toBe(1999n);
      expect(finiteMoneyNumberToCents(10)).toBe(1000n);
      expect(finiteMoneyNumberToCents(0)).toBe(0n);
    });

    it('rejects non-finite values', () => {
      expect(() => finiteMoneyNumberToCents(Number.NaN)).toThrow();
      expect(() => finiteMoneyNumberToCents(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe('parseFixed2DecimalMoneyString / centsToDecimalString round-trip', () => {
    it('preserves 2dp values', () => {
      expect(centsToDecimalString(95450n)).toBe('954.50');
      expect(parseFixed2DecimalMoneyString('954.50')).toBe(95450n);
    });
  });

  describe('percentOfCents (13% HST pipeline)', () => {
    it('computes 13% of cents with half-up rounding', () => {
      expect(percentOfCents(1999n, INVENTORY_HST_PERCENT_POINTS)).toBe(260n);
      expect(percentOfCents(1999n, 13)).toBe(260n);
      expect(percentOfCents(1n, 13)).toBe(0n);
    });

    it('rejects non-finite percent', () => {
      expect(() => percentOfCents(100n, Number.NaN)).toThrow();
    });
  });

  describe('compareDecimalMoneyStrings', () => {
    it('orders lexicographically by monetary value', () => {
      expect(compareDecimalMoneyStrings('10.00', '9.99')).toBeGreaterThan(0);
      expect(compareDecimalMoneyStrings('0.00', '0.00')).toBe(0);
    });
  });
});
