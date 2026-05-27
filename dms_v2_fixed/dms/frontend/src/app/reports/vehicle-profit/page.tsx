'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type VehicleProfitRow = {
  vehicleId: string;
  vin: string;
  title: string;
  dateSold: string;
  sellingPrice: string;
  acquisitionCost: string;
  profit: string;
  lotDays: number;
  salesPersonName?: string;
};

type ProfitReport = {
  from: string; to: string;
  items: VehicleProfitRow[];
  total: number;
  totals: { revenue: string; cost: string; profit: string };
};

function fmt(v: string | number) {
  const n = Number(v);
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function thisYear() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: new Date().toISOString().slice(0, 10) };
}

export default function VehicleProfitPage() {
  const [data, setData] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(thisYear());
  const [sort, setSort] = useState<'profit' | 'date' | 'lotDays'>('date');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<ProfitReport>(`/accounting/reports/vehicle-profit?from=${range.from}&to=${range.to}&pageSize=200`);
      setData(d);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const sorted = [...(data?.items ?? [])].sort((a, b) => {
    if (sort === 'profit') return Number(b.profit) - Number(a.profit);
    if (sort === 'lotDays') return b.lotDays - a.lotDays;
    return new Date(b.dateSold).getTime() - new Date(a.dateSold).getTime();
  });

  const downloadCsv = () => {
    if (!data) return;
    const rows = [
      ['VIN', 'Vehicle', 'Date Sold', 'Selling Price', 'Acquisition Cost', 'Profit', 'Lot Days', 'Salesperson'],
      ...sorted.map(r => [r.vin, r.title, r.dateSold?.slice(0, 10), fmt(r.sellingPrice), fmt(r.acquisitionCost), fmt(r.profit), r.lotDays, r.salesPersonName ?? '']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vehicle-profit-${range.from}-${range.to}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Vehicle Profit Report</h1>
          <p className="text-sm text-slate-400 mt-1">Profit per vehicle sold — inventory cost engine</p>
        </div>
        <button className="btn-secondary" onClick={downloadCsv} disabled={!data}>↓ Export CSV</button>
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
        <div className="form-group">
          <label className="label">Sort</label>
          <select className="select w-36" value={sort} onChange={e => setSort(e.target.value as any)}>
            <option value="date">Date sold</option>
            <option value="profit">Profit ↓</option>
            <option value="lotDays">Lot days ↓</option>
          </select>
        </div>
        <button className="btn-secondary mt-4" onClick={load}>Refresh</button>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value text-sky-400">{fmt(data.totals.revenue)}</div>
            <div className="stat-sub">{data.total} vehicles sold</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Cost</div>
            <div className="stat-value text-slate-300">{fmt(data.totals.cost)}</div>
            <div className="stat-sub">acquisition + reconditioning</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Profit</div>
            <div className={`stat-value ${Number(data.totals.profit) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(data.totals.profit)}</div>
            <div className="stat-sub">{data.totals.revenue && data.total ? `avg ${fmt(Number(data.totals.profit) / data.total)}/unit` : ''}</div>
          </div>
        </div>
      )}

      {loading && <div className="text-slate-400 text-sm">Loading…</div>}

      {!loading && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th><th>VIN</th><th>Date Sold</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Margin</th>
                <th className="text-right">Lot Days</th>
                <th>Salesperson</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const profit = Number(r.profit);
                const revenue = Number(r.sellingPrice);
                const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
                return (
                  <tr key={r.vehicleId}>
                    <td className="font-medium text-slate-100">{r.title}</td>
                    <td className="font-mono text-xs text-slate-400">{r.vin?.slice(-8)}</td>
                    <td className="text-slate-400 text-xs">{r.dateSold?.slice(0, 10)}</td>
                    <td className="text-right text-slate-300">{fmt(r.sellingPrice)}</td>
                    <td className="text-right text-slate-400">{fmt(r.acquisitionCost)}</td>
                    <td className={`text-right font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(r.profit)}</td>
                    <td className={`text-right text-xs ${Number(margin) >= 10 ? 'text-emerald-400' : Number(margin) >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{margin}%</td>
                    <td className={`text-right text-xs ${r.lotDays < 30 ? 'text-emerald-400' : r.lotDays < 60 ? 'text-amber-400' : 'text-red-400'}`}>{r.lotDays}d</td>
                    <td className="text-slate-400 text-xs">{r.salesPersonName ?? '—'}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">No vehicles sold in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
