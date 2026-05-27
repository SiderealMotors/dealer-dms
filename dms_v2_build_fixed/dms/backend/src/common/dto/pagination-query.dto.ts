import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_LIST_LIMIT = 500;
export const MAX_LIST_LIMIT = 2000;
/** Inventory list: small pages for responsive APIs (frontend uses 100–200). */
export const DEFAULT_VEHICLE_LIST_LIMIT = 100;
export const MAX_VEHICLE_LIST_LIMIT = 200;

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit?: number;
}

export function resolveListPagination(
  query: { limit?: number; offset?: number },
  opts?: { defaultLimit?: number; maxLimit?: number },
): { take: number; skip: number } {
  const max = opts?.maxLimit ?? MAX_LIST_LIMIT;
  const def = opts?.defaultLimit ?? DEFAULT_LIST_LIMIT;
  return {
    take: Math.min(query.limit ?? def, max),
    skip: query.offset ?? 0,
  };
}
