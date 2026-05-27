'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type BalanceSheet = {
  basis: string; asOf: string;
  assets: { accountId: string; code: string; name: string; amount: string }[];
  liabilities: { accountId: string; code: string; name: string; amount: string }[];
  equity: {
    accounts: { accountId: string; code: string; name: string; amount: string }[];
    netIncome: string;
    totalEquity: string;
  };
  totals: { totalAssets: string; totalLiabilities: string; totalEquity: string; balanced: boolean };
};

function fmt(v: string | number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v));
}

function Section({ title, rows, subtotal, subtotalLabel }: { title: string; rows: any[]; subtotal: string; subtotalLabel: string }) {
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
        <span className="text-slate-200">{subtotalLabel}</span>
        <span className="text-sky-300">{fmt(subtotal)}</span>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<BalanceSheet>(`/reports/balance-sheet?asOf=${asOf}`);
      setData(d);
    } finally { setLoading(false); }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const downloadCsv = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/reports/balance-sheet?asOf=${asOf}&format=csv`);
    const blob = await res.blob(); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `balance-sheet-${asOf}.csv`; a.click();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Balance Sheet</h1>
          <p className="text-sm text-slate-400 mt-1">Assets, liabilities, and equity at a point in time</p>
        </div>
        <button className="btn-secondary" onClick={downloadCsv}>↓ Export CSV</button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="form-group">
          <label className="label">As of date</label>
          <input type="date" className="input w-44" value={asOf} onChange={e => setAsOf(e.target.value)} />
        </div>
        <button className="btn-secondary mt-4" onClick={load}>Refresh</button>
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading…</div>}

      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header"><span className="font-semibold">Assets</span></div>
            <div className="card-body">
              <Section title="Assets" rows={data.assets} subtotal={data.totals.totalAssets} subtotalLabel="Total Assets" />
            </div>
            <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800 flex justify-between font-bold">
              <span className="text-white">Total Assets</span>
              <span className="text-sky-300 text-lg">{fmt(data.totals.totalAssets)}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="font-semibold">Liabilities & Equity</span></div>
            <div className="card-body">
              <Section title="Liabilities" rows={data.liabilities} subtotal={data.totals.totalLiabilities} subtotalLabel="Total Liabilities" />

              <div className="mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Equity</div>
                {data.equity.accounts.map(r => (
                  <div key={r.accountId} className="flex justify-between py-1.5 px-1 border-b border-slate-800/40 text-sm">
                    <span className="text-slate-300">{r.code} — {r.name}</span>
                    <span className="text-slate-200">{fmt(r.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 px-1 border-b border-slate-800/40 text-sm">
                  <span className="text-slate-300">Current period net income</span>
                  <span className={Number(data.equity.netIncome) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(data.equity.netIncome)}</span>
                </div>
                <div className="flex justify-between py-2 px-1 font-semibold text-sm">
                  <span>Total Equity</span>
                  <span className="text-sky-300">{fmt(data.equity.totalEquity)}</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-900/50 border-t border-slate-800 flex justify-between font-bold">
              <span className="text-white">Total Liabilities & Equity</span>
              <span className="text-sky-300 text-lg">{fmt(Number(data.totals.totalLiabilities) + Number(data.equity.totalEquity))}</span>
            </div>
          </div>

          {!data.totals.balanced && (
            <div className="col-span-2 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              ⚠️ Balance sheet is out of balance — total assets do not equal total liabilities + equity. Check for unposted journals.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
