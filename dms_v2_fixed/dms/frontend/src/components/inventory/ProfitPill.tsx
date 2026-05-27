import { compareDecimalMoneyStrings } from '@dms/inventory-calculations';
import { formatCad } from './money';

export function ProfitPill({ profit }: { profit: string | null }) {
  if (profit == null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-800/60 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-500 ring-1 ring-slate-700/60">
        —
      </span>
    );
  }
  const positive = compareDecimalMoneyStrings(profit, '0.00') > 0;
  const negative = compareDecimalMoneyStrings(profit, '0.00') < 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ${
        positive
          ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35'
          : negative
            ? 'bg-rose-500/15 text-rose-300 ring-rose-500/35'
            : 'bg-slate-600/25 text-slate-300 ring-slate-500/40'
      }`}
    >
      {formatCad(profit)}
    </span>
  );
}
