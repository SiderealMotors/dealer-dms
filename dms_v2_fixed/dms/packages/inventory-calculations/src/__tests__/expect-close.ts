import { expect } from '@jest/globals';

/** Dollar amounts rounded to 2 dp; allow tiny float noise. */
export function expectMoneyClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(0.005);
}
