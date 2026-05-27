import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Interactive transaction settings for flows that persist a vehicle sale and related
 * journal entries in one atomic unit (all commit or all rollback).
 */
export const VEHICLE_SALE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

/**
 * Runs work inside a single Prisma interactive transaction. Use for any path that
 * updates sold-vehicle inventory state and/or creates vehicle-sale GL entries so
 * partial writes cannot occur.
 */
export function runVehicleSaleDbTransaction<T>(
  prisma: PrismaService,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn, VEHICLE_SALE_TRANSACTION_OPTIONS);
}
