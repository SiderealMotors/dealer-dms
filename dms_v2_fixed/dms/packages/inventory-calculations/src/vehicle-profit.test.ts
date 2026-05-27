import { finiteMoneyNumberToCents } from './money';
import { computeVehicleProfit, computeVehicleProfitFromCents } from './vehicle-profit';

function baseInputCents() {
  return {
    purchasePriceCents: finiteMoneyNumberToCents(10_000),
    safetyCostCents: finiteMoneyNumberToCents(100),
    gasCents: finiteMoneyNumberToCents(50),
    warrantyCostCents: finiteMoneyNumberToCents(200),
    floorplanInterestCents: finiteMoneyNumberToCents(75),
    referralCents: finiteMoneyNumberToCents(150),
    sellingPriceCents: finiteMoneyNumberToCents(12_000),
    safetyChargeCents: finiteMoneyNumberToCents(500),
    warrantyChargeCents: finiteMoneyNumberToCents(300),
    omvicFeeCents: finiteMoneyNumberToCents(75),
  };
}

describe('computeVehicleProfitFromCents', () => {
  it('matches golden profit for standard acquisition + sale', () => {
    const r = computeVehicleProfitFromCents(baseInputCents());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.profit).toBe('954.50');
      expect(r.profitCents).toBe(95_450n);
    }
  });

  it('allows high selling price with zero ancillary charges', () => {
    const r = computeVehicleProfitFromCents({
      ...baseInputCents(),
      safetyChargeCents: 0n,
      warrantyChargeCents: 0n,
      omvicFeeCents: 0n,
      sellingPriceCents: finiteMoneyNumberToCents(20_000),
      referralCents: 0n,
    });
    expect(r.success).toBe(true);
  });

  describe('missing sale line values', () => {
    it('fails when omvicFee is undefined', () => {
      const r = computeVehicleProfitFromCents({ ...baseInputCents(), omvicFeeCents: undefined });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('MISSING_SALE_LINE');
        expect(r.field).toBe('omvicFee');
      }
    });

    it('fails when sellingPrice is null', () => {
      const r = computeVehicleProfitFromCents({ ...baseInputCents(), sellingPriceCents: null });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('MISSING_SALE_LINE');
      }
    });
  });

  describe('non-finite inputs (legacy number path)', () => {
    it('rejects NaN on acquisition', () => {
      const r = computeVehicleProfit({ ...baseNumeric(), purchasePrice: Number.NaN });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('NON_FINITE_INPUT');
      }
    });

    it('rejects infinity on sale line', () => {
      const r = computeVehicleProfit({
        ...baseNumeric(),
        sellingPrice: Number.POSITIVE_INFINITY,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('NON_FINITE_INPUT');
      }
    });

    it('attributes NaN on sellingPrice', () => {
      const r = computeVehicleProfit({ ...baseNumeric(), sellingPrice: Number.NaN });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('NON_FINITE_INPUT');
        expect(r.field).toBe('sellingPrice');
      }
    });
  });

  describe('negative amounts', () => {
    it('rejects negative gas by default', () => {
      const r = computeVehicleProfitFromCents({ ...baseInputCents(), gasCents: -1n });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('NEGATIVE_AMOUNT');
      }
    });

    it('rejects negative selling price by default', () => {
      const r = computeVehicleProfitFromCents({
        ...baseInputCents(),
        sellingPriceCents: -10_000n,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.code).toBe('NEGATIVE_AMOUNT');
      }
    });

    it('allows negative referral when opted in', () => {
      const r = computeVehicleProfitFromCents(
        { ...baseInputCents(), referralCents: -5000n },
        { allowNegativeAmounts: true },
      );
      expect(r.success).toBe(true);
    });
  });

  describe('edge values', () => {
    it('allows negative profit (loss)', () => {
      const r = computeVehicleProfitFromCents({
        purchasePriceCents: finiteMoneyNumberToCents(50_000),
        safetyCostCents: 0n,
        gasCents: 0n,
        warrantyCostCents: 0n,
        floorplanInterestCents: 0n,
        referralCents: 0n,
        sellingPriceCents: finiteMoneyNumberToCents(10_000),
        safetyChargeCents: 0n,
        warrantyChargeCents: 0n,
        omvicFeeCents: 0n,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.profit.startsWith('-')).toBe(true);
        expect(r.profitCents < 0n).toBe(true);
      }
    });

    it('zero acquisition cost with positive sale yields full revenue minus taxes', () => {
      const r = computeVehicleProfitFromCents({
        purchasePriceCents: 0n,
        safetyCostCents: 0n,
        gasCents: 0n,
        warrantyCostCents: 0n,
        floorplanInterestCents: 0n,
        referralCents: 0n,
        sellingPriceCents: finiteMoneyNumberToCents(5_000),
        safetyChargeCents: 0n,
        warrantyChargeCents: 0n,
        omvicFeeCents: 0n,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.profit).toBe('5000.00');
      }
    });

    it('small cent amounts stay consistent', () => {
      expect(finiteMoneyNumberToCents(0.01)).toBe(1n);
      const r = computeVehicleProfitFromCents({
        purchasePriceCents: 1n,
        safetyCostCents: 0n,
        gasCents: 0n,
        warrantyCostCents: 0n,
        floorplanInterestCents: 0n,
        referralCents: 0n,
        sellingPriceCents: finiteMoneyNumberToCents(1),
        safetyChargeCents: 0n,
        warrantyChargeCents: 0n,
        omvicFeeCents: 0n,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.profit).toBe('0.99');
      }
    });

    it('large dollar amounts remain representable', () => {
      const r = computeVehicleProfitFromCents({
        purchasePriceCents: finiteMoneyNumberToCents(999_999.99),
        safetyCostCents: 0n,
        gasCents: 0n,
        warrantyCostCents: 0n,
        floorplanInterestCents: 0n,
        referralCents: 0n,
        sellingPriceCents: finiteMoneyNumberToCents(1_000_000),
        safetyChargeCents: 0n,
        warrantyChargeCents: 0n,
        omvicFeeCents: 0n,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.profit.length).toBeGreaterThan(0);
      }
    });

    it('zero profit when revenue matches fully-loaded cost', () => {
      const r = computeVehicleProfitFromCents({
        purchasePriceCents: finiteMoneyNumberToCents(100),
        safetyCostCents: 0n,
        gasCents: 0n,
        warrantyCostCents: 0n,
        floorplanInterestCents: 0n,
        referralCents: finiteMoneyNumberToCents(87),
        sellingPriceCents: finiteMoneyNumberToCents(200),
        safetyChargeCents: 0n,
        warrantyChargeCents: 0n,
        omvicFeeCents: 0n,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.profit).toBe('0.00');
        expect(r.profitCents).toBe(0n);
      }
    });
  });
});

function baseNumeric() {
  return {
    purchasePrice: 10_000,
    safetyCost: 100,
    gas: 50,
    warrantyCost: 200,
    floorplanInterestCost: 75,
    referralAmount: 150,
    sellingPrice: 12_000,
    safetyCharge: 500,
    warrantyCharge: 300,
    omvicFee: 75,
  };
}
