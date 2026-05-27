import { finiteMoneyNumberToCents } from './money';
import {
  INVENTORY_TAX_RATE_PERCENT,
  computeInventoryTaxOnDecimalString,
  inventoryHstCentsOnPreTaxBase,
  inventoryHstDollarsOnPreTaxDollars,
  purchaseTaxAndTotalFromPreTaxCents,
} from './inventory-tax';
import { INVENTORY_HST_PERCENT_POINTS } from './tax-constants';

describe('inventory tax (13% HST)', () => {
  it('exposes constant 13% rate', () => {
    expect(INVENTORY_HST_PERCENT_POINTS).toBe(13);
    expect(INVENTORY_TAX_RATE_PERCENT).toBe(13);
  });

  describe('inventoryHstCentsOnPreTaxBase', () => {
    it('applies 13% to pre-tax cents', () => {
      expect(inventoryHstCentsOnPreTaxBase(1_000_000n)).toBe(130_000n);
      expect(inventoryHstCentsOnPreTaxBase(10_000n)).toBe(1300n);
    });

    it('handles zero', () => {
      expect(inventoryHstCentsOnPreTaxBase(0n)).toBe(0n);
    });
  });

  describe('purchaseTaxAndTotalFromPreTaxCents', () => {
    it('returns purchase tax and total landed cost', () => {
      const pre = finiteMoneyNumberToCents(10_000);
      const { purchaseTaxCents, totalPurchaseCents } = purchaseTaxAndTotalFromPreTaxCents(pre);
      expect(purchaseTaxCents).toBe(130_000n);
      expect(totalPurchaseCents).toBe(1_130_000n);
    });

    it('handles zero purchase', () => {
      const { purchaseTaxCents, totalPurchaseCents } = purchaseTaxAndTotalFromPreTaxCents(0n);
      expect(purchaseTaxCents).toBe(0n);
      expect(totalPurchaseCents).toBe(0n);
    });
  });

  describe('inventoryHstDollarsOnPreTaxDollars', () => {
    it('matches cents pipeline for UI convenience', () => {
      expect(inventoryHstDollarsOnPreTaxDollars(100)).toBe('13.00');
      expect(inventoryHstDollarsOnPreTaxDollars(0)).toBe('0.00');
    });
  });

  describe('computeInventoryTaxOnDecimalString', () => {
    it('parses string then applies HST', () => {
      expect(computeInventoryTaxOnDecimalString('100.00')).toBe('13.00');
    });
  });
});
