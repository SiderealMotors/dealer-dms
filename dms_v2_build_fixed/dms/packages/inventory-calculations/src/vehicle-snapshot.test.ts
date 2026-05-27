import { finiteMoneyNumberToCents } from './money';
import { computeVehicleInventorySnapshot, computeInventoryTaxOnDollars } from './vehicle-snapshot';

describe('computeVehicleInventorySnapshot', () => {
  const ref = new Date(Date.UTC(2025, 2, 21, 15, 30, 0));

  const fullNumsCents = {
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

  it('matches golden tax, sell tax, profit, and lot metrics when sold', () => {
    const fin = computeVehicleInventorySnapshot(
      { datePurchased: '2025-01-01', dateSold: '2025-02-01' },
      fullNumsCents,
      ref,
    );

    expect(fin.taxCost).toBe('1300.00');
    expect(fin.totalPurchasePrice).toBe('11300.00');
    expect(fin.safetyTax).toBe('13.00');
    expect(fin.gasTax).toBe('6.50');
    expect(fin.warrantyTax).toBe('26.00');
    expect(fin.sellTax).not.toBeNull();
    expect(fin.sellTax).toBe('1673.75');
    expect(fin.profit).toBe('954.50');
    expect(fin.lotDays).toBe(31);
    expect(fin.lotDaysColor).toBe('yellow');
  });

  it('leaves profit and sell tax null when not sold', () => {
    const fin = computeVehicleInventorySnapshot(
      { datePurchased: '2025-01-01', dateSold: null },
      fullNumsCents,
      ref,
    );
    expect(fin.profit).toBeNull();
    expect(fin.sellTax).toBeNull();
    expect(fin.taxCost).toBe('1300.00');
    expect(fin.totalPurchasePrice).toBe('11300.00');
  });

  it('leaves profit and sell tax null when dateSold is empty string', () => {
    const fin = computeVehicleInventorySnapshot(
      { datePurchased: '2025-01-01', dateSold: '' },
      fullNumsCents,
      ref,
    );
    expect(fin.profit).toBeNull();
    expect(fin.sellTax).toBeNull();
  });

  it('does not set profit or sell tax when sold but sale bundle fails validation', () => {
    const fin = computeVehicleInventorySnapshot(
      { datePurchased: '2025-01-01', dateSold: '2025-02-01' },
      { ...fullNumsCents, omvicFeeCents: null },
      ref,
    );
    expect(fin.profit).toBeNull();
    expect(fin.sellTax).toBeNull();
  });

  it('still computes cost-side taxes when purchase price is zero', () => {
    const fin = computeVehicleInventorySnapshot(
      { datePurchased: '2025-06-01', dateSold: null },
      {
        ...fullNumsCents,
        purchasePriceCents: 0n,
      },
      ref,
    );
    expect(fin.taxCost).toBe('0.00');
    expect(fin.totalPurchasePrice).toBe('0.00');
    expect(fin.safetyTax).toBe('13.00');
  });
});

describe('computeInventoryTaxOnDollars', () => {
  it('delegates to 13% HST on dollars (boundary)', () => {
    expect(computeInventoryTaxOnDollars(100)).toBe('13.00');
    expect(computeInventoryTaxOnDollars(0)).toBe('0.00');
  });
});
