/**
 * Run: `npx ts-node --compiler-options {"module":"CommonJS"} src/inventory/validation/vehicle-business-rules.spec.ts`
 */
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import {
  assertDateSoldNotBeforePurchased,
  assertValidCalendarYmd,
  validateCreateVehicleBusinessRules,
} from './vehicle-business-rules';

assert.throws(() => assertValidCalendarYmd('x', 'not-a-date'), BadRequestException);
assert.throws(() => assertValidCalendarYmd('x', '2025-02-30'), BadRequestException);

assert.throws(
  () => assertDateSoldNotBeforePurchased('2025-06-01', '2025-05-01'),
  BadRequestException,
);
assert.doesNotThrow(() => assertDateSoldNotBeforePurchased('2025-06-01', '2025-06-01'));
assert.doesNotThrow(() => assertDateSoldNotBeforePurchased('2025-06-01', '2025-07-01'));

assert.throws(
  () =>
    validateCreateVehicleBusinessRules({
      datePurchased: '2025-01-10',
      dateSold: '2025-01-05',
      purchasePrice: 100,
      sellingPrice: 200,
      safetyCharge: 0,
      warrantyCharge: 0,
      omvicFee: 0,
    }),
  BadRequestException,
);

validateCreateVehicleBusinessRules({
  datePurchased: '2025-01-10',
  dateSold: '2025-02-01',
  purchasePrice: 10_000,
  sellingPrice: 12_000,
  safetyCharge: 0,
  warrantyCharge: 0,
  omvicFee: 0,
});

console.log('vehicle-business-rules.spec: all assertions passed');
