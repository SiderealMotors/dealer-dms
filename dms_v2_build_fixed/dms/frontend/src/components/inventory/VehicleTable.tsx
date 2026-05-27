'use client';

import type { VehicleRow } from '@/lib/types';
import { sumDecimalStrings } from '@dms/inventory-calculations';
import { useEffect, useRef } from 'react';
import { formatCad } from './money';
import { LotDaysBadge } from './LotDaysBadge';
import { ProfitPill } from './ProfitPill';
import { VehicleStatusBadge } from './VehicleStatusBadge';

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-800/50">
          <td className="px-4 py-4">
            <div className="h-4 w-40 rounded bg-slate-800" />
            <div className="mt-2 h-3 w-56 rounded bg-slate-800/70" />
          </td>
          <td className="px-4 py-4">
            <div className="h-3 w-28 rounded bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-6 w-12 rounded-full bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-6 w-16 rounded-full bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-20 rounded bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-20 rounded bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-7 w-24 rounded-full bg-slate-800" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-24 rounded bg-slate-800" />
          </td>
          <td className="px-4 py-4 text-right">
            <div className="ml-auto h-8 w-14 rounded-lg bg-slate-800" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function VehicleTable({
  rows,
  onEdit,
  busy,
  onAddNew,
  totalCount,
  rangeStart,
  rangeEnd,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  rows: VehicleRow[];
  onEdit: (v: VehicleRow) => void;
  busy: boolean;
  onAddNew?: () => void;
  /** When set with range, header shows “Showing a–b of total” instead of only this page length. */
  totalCount?: number;
  rangeStart?: number;
  rangeEnd?: number;
  /** Infinite scroll: loading the next batch (does not dim the whole table). */
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  loadingMoreRef.current = Boolean(loadingMore);

  useEffect(() => {
    if (!onLoadMore || !hasMore) {
      return;
    }
    const root = scrollRootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && !loadingMoreRef.current) {
          onLoadMore();
        }
      },
      { root, rootMargin: '160px 0px', threshold: 0 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadMore, hasMore, rows.length]);

  const showSkeleton = busy && rows.length === 0;
  const dimContent = busy && rows.length > 0;

  const countLabel =
    totalCount != null && rangeStart != null && rangeEnd != null
      ? totalCount === 0
        ? '0 vehicles'
        : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`
      : `${rows.length} units`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/35 shadow-xl shadow-black/30 ring-1 ring-white/[0.03]">
      <div className="flex flex-col gap-1 border-b border-slate-800/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Fleet overview</h2>
          <p className="text-xs text-slate-500">
            Economics use 13% HST rules; profit and lot aging match the API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-sky-400/90">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400"
                aria-hidden
              />
              Syncing…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
              {loadingMore ? (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400"
                  aria-hidden
                />
              ) : null}
              {countLabel}
            </span>
          )}
        </div>
      </div>
      <div
        ref={scrollRootRef}
        className="relative max-h-[calc(100vh-240px)] min-h-[280px] overflow-auto"
      >
        {dimContent ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-slate-950/25 backdrop-blur-[1px] transition-opacity"
            aria-hidden
          />
        ) : null}
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3.5 font-medium">Vehicle</th>
              <th className="px-5 py-3.5 font-medium">VIN</th>
              <th className="px-5 py-3.5 font-medium">Lot</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Purchase</th>
              <th className="px-5 py-3.5 font-medium">Sale (pre-tax)</th>
              <th className="px-5 py-3.5 font-medium">Profit</th>
              <th className="px-5 py-3.5 font-medium">Salesperson</th>
              <th className="px-5 py-3.5 font-medium" />
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-800/80 ${dimContent ? 'opacity-60' : ''}`}>
            {showSkeleton ? (
              <TableSkeletonRows />
            ) : (
              rows.map((v) => {
                const title = `${v.year} ${v.make} ${v.model}`;
                const salePreTax =
                  v.sellingPrice != null &&
                  v.safetyCharge != null &&
                  v.warrantyCharge != null &&
                  v.omvicFee != null
                    ? sumDecimalStrings([
                        v.sellingPrice,
                        v.safetyCharge,
                        v.warrantyCharge,
                        v.omvicFee,
                      ])
                    : null;
                return (
                  <tr key={v.id} className="transition-colors hover:bg-slate-800/30">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-100">{title}</div>
                      <div className="text-xs text-slate-500">
                        {v.trim} · {v.colour} · {v.odometer.toLocaleString()} km
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">{v.vin}</td>
                    <td className="px-5 py-3.5">
                      <LotDaysBadge days={v.lotDays} color={v.lotDaysColor} />
                    </td>
                    <td className="px-5 py-3.5">
                      <VehicleStatusBadge status={v.status} />
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-200">{formatCad(v.totalPurchasePrice)}</td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-200">
                      {salePreTax != null ? formatCad(salePreTax) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <ProfitPill profit={v.profit} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-400">
                      {v.salesPerson?.fullName ?? v.salesPersonName ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(v)}
                        className="rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/50 transition hover:bg-slate-700 hover:ring-slate-500"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            {!showSkeleton && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 ring-1 ring-slate-700/60">
                      <svg
                        className="h-6 w-6 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 18.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5h9a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-9z"
                        />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5h-4.5M15 13.5h-4.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-300">No vehicles match filters</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Adjust filters or add a unit to see it here. Realtime keeps this list in sync.
                    </p>
                    {onAddNew ? (
                      <button
                        type="button"
                        onClick={onAddNew}
                        className="mt-6 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500"
                      >
                        Add vehicle
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}
            {!showSkeleton && rows.length > 0 && (hasMore || loadingMore) ? (
              <tr>
                <td colSpan={9} className="px-5 py-2">
                  <div className="flex flex-col items-center gap-1">
                    {!loadingMore && hasMore ? (
                      <span className="text-[11px] text-slate-600">Scroll for more</span>
                    ) : null}
                    <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
