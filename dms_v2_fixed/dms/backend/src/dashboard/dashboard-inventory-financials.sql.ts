import { Prisma } from '@prisma/client';

/**
 * Single-pass aggregates over `Vehicle` — matches {@link computeVehicleProfitFromCents} and
 * landed purchase for inventory capital (same basis as `computeVehicleInventorySnapshot`’s
 * `totalPurchasePrice` for non-complete rows).
 *
 * Amounts are **integer cents** in SQL. `hstPoints` must match
 * {@link INVENTORY_HST_PERCENT_POINTS} from `@dms/inventory-calculations`.
 */
export function inventoryFinancialsAggregateSql(hstPoints: number): Prisma.Sql {
  const h = hstPoints;
  return Prisma.sql`
    WITH t AS (
      SELECT
        v."dateSold",
        (ROUND(v."purchasePrice"::numeric * 100))::bigint AS pp_cents,
        (ROUND(COALESCE(v."safetyCost", 0)::numeric * 100))::bigint AS safety_cents,
        (ROUND(COALESCE(v."gas", 0)::numeric * 100))::bigint AS gas_cents,
        (ROUND(COALESCE(v."warrantyCost", 0)::numeric * 100))::bigint AS warranty_cents,
        (ROUND(COALESCE(v."floorplanInterestCost", 0)::numeric * 100))::bigint AS floor_cents,
        (ROUND(COALESCE(v."referralAmount", 0)::numeric * 100))::bigint AS ref_cents,
        (ROUND(COALESCE(v."sellingPrice", 0)::numeric * 100))::bigint AS sp_cents,
        (ROUND(COALESCE(v."safetyCharge", 0)::numeric * 100))::bigint AS sch_cents,
        (ROUND(COALESCE(v."warrantyCharge", 0)::numeric * 100))::bigint AS wch_cents,
        (ROUND(COALESCE(v."omvicFee", 0)::numeric * 100))::bigint AS om_cents,
        (
          v."dateSold" IS NOT NULL
          AND v."sellingPrice" IS NOT NULL
          AND v."safetyCharge" IS NOT NULL
          AND v."warrantyCharge" IS NOT NULL
          AND v."omvicFee" IS NOT NULL
        ) AS sale_complete
      FROM "Vehicle" v
      WHERE v."deletedAt" IS NULL
    ),
    m AS (
      SELECT
        t."dateSold",
        t.sale_complete,
        t.pp_cents,
        t.safety_cents,
        t.gas_cents,
        t.warranty_cents,
        t.floor_cents,
        t.ref_cents,
        t.sp_cents,
        t.sch_cents,
        t.wch_cents,
        t.om_cents,
        (t.pp_cents * ${h}::bigint + 50) / 100 AS purchase_tax_cents,
        (t.safety_cents * ${h}::bigint + 50) / 100 AS safety_tax_cents,
        (t.gas_cents * ${h}::bigint + 50) / 100 AS gas_tax_cents,
        (t.warranty_cents * ${h}::bigint + 50) / 100 AS warranty_tax_cents
      FROM t
    ),
    n AS (
      SELECT
        m."dateSold",
        m.sale_complete,
        m.pp_cents + m.purchase_tax_cents AS landed_purchase_cents,
        m.sp_cents + m.sch_cents + m.wch_cents + m.om_cents AS revenue_cents,
        m.pp_cents
          + m.purchase_tax_cents
          + m.safety_cents
          + m.safety_tax_cents
          + m.floor_cents
          + m.gas_cents
          + m.gas_tax_cents
          + m.warranty_cents
          + m.warranty_tax_cents
          + m.ref_cents AS cost_cents
      FROM m
    )
    SELECT
      COALESCE(
        SUM(CASE WHEN sale_complete THEN revenue_cents - cost_cents ELSE 0::bigint END),
        0::bigint
      ) AS "realizedProfitCents",
      COALESCE(SUM(CASE WHEN sale_complete THEN revenue_cents ELSE 0::bigint END), 0::bigint) AS "soldRevenueCents",
      COALESCE(SUM(CASE WHEN sale_complete THEN cost_cents ELSE 0::bigint END), 0::bigint) AS "soldCostCents",
      COALESCE(
        SUM(
          CASE
            WHEN "dateSold" IS NULL OR NOT sale_complete THEN landed_purchase_cents
            ELSE 0::bigint
          END
        ),
        0::bigint
      ) AS "inventoryCapitalCents"
    FROM n
  `;
}
