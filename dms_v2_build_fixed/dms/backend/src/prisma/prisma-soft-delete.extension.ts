import { Prisma } from '@prisma/client';

function mergeNotDeletedWhere(where: unknown): Record<string, unknown> {
  if (where == null || (typeof where === 'object' && Object.keys(where as object).length === 0)) {
    return { deletedAt: null };
  }
  return { AND: [where as object, { deletedAt: null }] };
}

type QueryFn = (args: { args: any; query: (a: any) => any }) => Promise<unknown>;

const withMergedWhere: QueryFn = ({ args, query }) => {
  args.where = mergeNotDeletedWhere(args.where);
  return query(args);
};

const withUpsertMergedWhere: QueryFn = ({ args, query }) => {
  args.where = mergeNotDeletedWhere(args.where);
  return query(args);
};

const withFindUniqueFiltered: QueryFn = async ({ args, query }) => {
  const result = await query(args);
  if (result && (result as { deletedAt?: Date | null }).deletedAt != null) {
    return null;
  }
  return result;
};

function softDeleteModelBlock() {
  return {
    findMany: withMergedWhere,
    findFirst: withMergedWhere,
    findUnique: withFindUniqueFiltered,
    count: withMergedWhere,
    aggregate: withMergedWhere,
    groupBy: withMergedWhere,
    update: withMergedWhere,
    updateMany: withMergedWhere,
    upsert: withUpsertMergedWhere,
  };
}

/**
 * Default scope: `deletedAt IS NULL` for reads/updates on soft-deleted domain rows.
 * `findUnique` returns `null` when the row exists but is soft-deleted.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    vehicle: softDeleteModelBlock(),
    deal: softDeleteModelBlock(),
    lead: softDeleteModelBlock(),
    customer: softDeleteModelBlock(),
    crmTask: softDeleteModelBlock(),
  },
});
