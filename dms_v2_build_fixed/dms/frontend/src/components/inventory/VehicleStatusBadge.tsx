import type { VehicleRow } from '@/lib/types';

const config: Record<
  VehicleRow['status'],
  { label: string; className: string; dot: string }
> = {
  available: {
    label: 'Available',
    className: 'bg-slate-500/15 text-slate-200 ring-slate-500/35',
    dot: 'bg-slate-400',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-200 ring-amber-500/40',
    dot: 'bg-amber-400',
  },
  sold: {
    label: 'Sold',
    className: 'bg-violet-500/15 text-violet-200 ring-violet-500/35',
    dot: 'bg-violet-400',
  },
};

export function VehicleStatusBadge({ status }: { status: VehicleRow['status'] }) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${c.className}`}
      title={
        status === 'sold'
          ? 'Sale completed (date sold recorded)'
          : status === 'pending'
            ? 'Committed / in progress — not yet closed'
            : 'Open inventory'
      }
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} aria-hidden />
      {c.label}
    </span>
  );
}
