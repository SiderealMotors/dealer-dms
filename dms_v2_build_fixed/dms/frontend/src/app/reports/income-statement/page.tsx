'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type IncomeStatement = {
  basis: string; startDate: string; endDate: string;
  revenue: { accountId: string; code: string; name: string; amount: string }[];
  costOfGoodsSold: { accountId: string; code: string; name: string; amount: string }[];
  operatingExpenses: { accountId: string; code: string; name: string; amount: string }[];
  totals: { totalRevenue: string; totalCogs: string; grossProfit: string; totalOpex: string; netProfit: string };
};

function fmt(v: string | number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v));
}

function thisYear() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: new Date().toISOString().slice(0, 10) };
}

function LineGroup({ title, rows, total, totalLabel, negate = false }: { title: string; rows: any[]; total: string; totalLabel: string; negate?: boolean }) {
  const v = negate ? -Number(total) : Number(total);
  return (
    <div className="mb-6">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">{title}</div>
      {rows.map(r => (
        <div key={r.accountId} className="flex justify-between py-1.5 px-1 border-b border-slate-800/40 text-sm">
          <span className="text-slate-300">{r.code} — {r.name}</span>
          <span className="text-slate-200">{fmt(r.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between py-2 px-1 font-semibold text-sm">
        <span className="text-slate-200">{totalLabel}</span>
        <span className={v >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(Math.abs(Number(total)))}</span>
      </div>
    </div>
  );
}

export default function IncomeStatementPage() {
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(thisYear());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<IncomeStatement>(`/reports/income-statement?from=${range.from}&to=${range.to}`);
      setData(d);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/reports/income-statement?from=${range.from}&to=${range.to}&format=csv`);
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `income-statement-${range.from}-${range.to}.csv`; a.click();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Income Statement</h1>
          <p className="text-sm text-slate-400 mt-1">Revenue, COGS, gross profit, operating expenses, net income</p>
        </div>
        <button className="btn-secondary" onClick={downloadCsv}>↓ Export CSV</button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="form-group">
          <label className="label">From</label>
          <input type="date" className="input w-40" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="label">To</label>
          <input type="date" className="input w-40" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
        <button className="btn-secondary mt-4" onClick={load}>Refresh</button>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading…</div>}

      {data && !loading && (
        <div className="card">
          <div className="card-header">
            <span className="font-semibold text-slate-200">Income Statement</span>
            <span className="text-sm text-slate-400">{data.startDate} – {data.endDate}</span>
          </div>
          <div className="card-body">
            <LineGroup title="Revenue" rows={data.revenue} total={data.totals.totalRevenue} totalLabel="Total Revenue" />

            <LineGroup title="Cost of Goods Sold" rows={data.costOfGoodsSold} total={data.totals.totalCogs} totalLabel="Total COGS" negate />

            {/* Gross Profit */}
            <div className="flex justify-between py-3 px-1 font-bold text-sm border-t-2 border-slate-700 mb-6">
              <span className="text-slate-100">Gross Profit</span>
              <span className={Number(data.totals.grossProfit) >= 0 ? 'text-emerald-300 text-base' : 'text-red-300 text-base'}>{fmt(data.totals.grossProfit)}</span>
            </div>

            <LineGroup title="Operating Expenses" rows={data.operatingExpenses} total={data.totals.totalOpex} totalLabel="Total Operating Expenses" negate />

            {/* Net Profit */}
            <div className="flex justify-between py-4 px-1 font-bold border-t-2 border-slate-700 mt-2">
              <span className="text-white text-lg">Net Income</span>
              <span className={`text-lg ${Number(data.totals.netProfit) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmt(data.totals.netProfit)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
