'use client';

import type { ReactNode } from 'react';
import { compareDecimalMoneyStrings, type ComputedVehicleFinancials } from '@dms/inventory-calculations';
import { LotDaysBadge } from './LotDaysBadge';
import { formatCad } from './money';

function MetricRow({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-slate-800/50 py-2.5 last:border-0 ${
        muted ? 'text-slate-500' : 'text-slate-300'
      }`}
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-sm tabular-nums ${muted ? '' : 'font-medium text-slate-100'}`}>{value}</span>
    </div>
  );
}

export function LiveMetricsPanel({ live, ready }: { live: ComputedVehicleFinancials | null; ready: boolean }) {
  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-slate-400">Preview economics</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Enter a purchase date and pre-tax purchase price. Values update as you type.
        </p>
      </div>
    );
  }

  if (!live) {
    return null;
  }

  const profitTone =
    live.profit == null
      ? 'neutral'
      : compareDecimalMoneyStrings(live.profit, '0.00') > 0
        ? 'profit'
        : compareDecimalMoneyStrings(live.profit, '0.00') < 0
          ? 'loss'
          : 'break-even';

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 transition-colors duration-200 ${
          profitTone === 'profit'
            ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 to-slate-950/80'
            : profitTone === 'loss'
              ? 'border-rose-500/35 bg-gradient-to-br from-rose-500/10 to-slate-950/80'
              : profitTone === 'break-even'
                ? 'border-slate-600/50 bg-slate-950/80'
                : 'border-slate-700/60 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Profit</span>
          {live.profit != null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                profitTone === 'profit'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : profitTone === 'loss'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-slate-600/40 text-slate-300'
              }`}
            >
              {profitTone === 'profit' ? 'Gain' : profitTone === 'loss' ? 'Loss' : 'Break-even'}
            </span>
          ) : null}
        </div>
        <p
          className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums transition-colors duration-200 ${
            live.profit == null
              ? 'text-slate-500'
              : profitTone === 'profit'
                ? 'text-emerald-300'
                : profitTone === 'loss'
                  ? 'text-rose-300'
                  : 'text-slate-200'
          }`}
        >
          {live.profit != null ? formatCad(live.profit) : '—'}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {live.profit == null
            ? 'Set a sale date and complete all sale amounts to calculate profit.'
            : 'Sell-side HST is pass-through and excluded. Deposit & safety estimate are informational.'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lot aging</span>
          <LotDaysBadge days={live.lotDays} color={live.lotDaysColor} />
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Days since purchase to sale date, or to today if still available. Green &lt;30d · yellow 30–60d · red &gt;60d.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-1">
        <h5 className="px-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Tax &amp; totals
        </h5>
        <div>
          <MetricRow label="Purchase HST (13%)" value={formatCad(live.taxCost)} />
          <MetricRow label="Total purchase (landed)" value={formatCad(live.totalPurchasePrice)} />
          <MetricRow label="Safety HST" value={formatCad(live.safetyTax)} muted />
          <MetricRow label="Gas HST" value={formatCad(live.gasTax)} muted />
          <MetricRow label="Warranty HST" value={formatCad(live.warrantyTax)} muted />
          <MetricRow
            label="Sell HST (pass-through)"
            value={live.sellTax != null ? formatCad(live.sellTax) : '—'}
            muted
          />
        </div>
      </div>
    </div>
  );
}
