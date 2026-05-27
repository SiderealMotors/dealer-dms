'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type HstSummary = {
  from: string; to: string;
  hstCollected: string;
  hstPaid: string;
  netOwing: string;
};

function fmt(v: string | number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v));
}

function quarterRange(offset = 0) {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + offset;
  const year = d.getFullYear() + Math.floor(q / 4);
  const qMod = ((q % 4) + 4) % 4;
  const startMonth = qMod * 3;
  const from = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endMonth = startMonth + 2;
  const endDate = new Date(year, endMonth + 1, 0);
  const to = endDate.toISOString().slice(0, 10);
  return { from, to };
}

export default function HstPage() {
  const [data, setData] = useState<HstSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(quarterRange(0));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<HstSummary>(`/expenses/hst-summary?from=${range.from}&to=${range.to}`);
      setData(d);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const netOwing = Number(data?.netOwing ?? 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">HST Summary</h1>
        <p className="text-sm text-slate-400 mt-1">Ontario 13% HST — quarterly remittance overview</p>
      </div>

      {/* Quick quarter buttons */}
      <div className="flex gap-2 mb-4">
        {[-1, 0].map(offset => {
          const r = quarterRange(offset);
          const label = offset === 0 ? 'Current quarter' : 'Last quarter';
          return (
            <button key={offset} className="btn-secondary btn-sm" onClick={() => setRange(r)}>
              {label} ({r.from.slice(0, 7)} – {r.to.slice(0, 7)})
            </button>
          );
        })}
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
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card border-emerald-800/40">
              <div className="stat-label">HST Collected</div>
              <div className="stat-value text-emerald-400">{fmt(data.hstCollected)}</div>
              <div className="stat-sub">from vehicle sales (owing to CRA)</div>
            </div>
            <div className="stat-card border-sky-800/40">
              <div className="stat-label">HST Paid (ITC)</div>
              <div className="stat-value text-sky-400">{fmt(data.hstPaid)}</div>
              <div className="stat-sub">input tax credits on expenses</div>
            </div>
            <div className={`stat-card ${netOwing > 0 ? 'border-red-800/40' : 'border-emerald-800/40'}`}>
              <div className="stat-label">Net HST Owing to CRA</div>
              <div className={`stat-value ${netOwing > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(data.netOwing)}</div>
              <div className="stat-sub">{netOwing > 0 ? 'remittance due' : 'refund position'}</div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-4 text-slate-200">How to calculate your remittance</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">HST collected on sales</span>
                <span className="text-emerald-400 font-semibold">{fmt(data.hstCollected)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Less: HST paid on expenses (ITC)</span>
                <span className="text-sky-400 font-semibold">− {fmt(data.hstPaid)}</span>
              </div>
              <div className="flex justify-between py-2 pt-3">
                <span className="font-semibold text-slate-200">Net HST remittance / (refund)</span>
                <span className={`font-bold text-lg ${netOwing > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(data.netOwing)}</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-sm text-slate-400">
              <p className="font-semibold text-slate-300 mb-1">Filing reminder</p>
              <p>Most small businesses file HST quarterly. Your HST number and filing frequency are set in Settings. Remit to the CRA by the due date (one month after quarter end). Keep all receipts for HST paid as ITCs.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
