import type { VehicleRow } from '@/lib/types';

const styles: Record<VehicleRow['lotDaysColor'], string> = {
  green: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40',
  yellow: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40',
  red: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40',
};

const dotStyles: Record<VehicleRow['lotDaysColor'], string> = {
  green: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
  yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]',
  red: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.45)]',
};

export function LotDaysBadge({
  days,
  color,
  className = '',
}: {
  days: number;
  color: VehicleRow['lotDaysColor'];
  className?: string;
}) {
  return (
    <span
      title="Lot aging: under 30 days (green), 30–60 days (yellow), over 60 days (red)."
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${styles[color]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[color]}`} aria-hidden />
      {days}d
    </span>
  );
}
