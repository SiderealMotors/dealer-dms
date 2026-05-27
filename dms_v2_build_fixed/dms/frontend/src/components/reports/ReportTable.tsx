'use client';

export type ReportTableRow = {
  accountId: string;
  code: string;
  name: string;
  amount: string;
};

type Props = {
  rows: ReportTableRow[];
  emptyMessage?: string;
  caption?: string;
};

export function ReportTable({ rows, emptyMessage = 'No line items.', caption }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/20">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-slate-800/80 bg-slate-900/50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5">
              Account ID
            </th>
            <th scope="col" className="px-4 py-2.5">
              Code
            </th>
            <th scope="col" className="px-4 py-2.5">
              Account
            </th>
            <th scope="col" className="px-4 py-2.5 text-right tabular-nums">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.accountId}
                className="border-b border-slate-800/40 last:border-0 hover:bg-slate-900/30"
              >
                <td className="max-w-[9rem] truncate px-4 py-2.5 font-mono text-[11px] text-slate-500">
                  {r.accountId}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.code}</td>
                <td className="px-4 py-2.5 text-slate-200">{r.name}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-100">
                  {r.amount}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
