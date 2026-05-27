'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type DashSummary = {
  available: number;
  pending: number;
  sold: number;
  totalCapitalOnLot: string;
  realizedProfitMtd: string;
  realizedProfitYtd: string;
  avgDaysOnLot: number;
};

function fmt(val: string | number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(val));
}

export default function DashboardPage() {
  const [data, setData] = useState<DashSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashSummary>('/dashboard/summary')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Live overview of your dealership</p>
      </div>

      {err && <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-label">Available</div>
          <div className="stat-value text-emerald-400">{data?.available ?? '—'}</div>
          <div className="stat-sub">units on lot</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value text-amber-400">{data?.pending ?? '—'}</div>
          <div className="stat-sub">awaiting completion</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sold MTD</div>
          <div className="stat-value text-sky-400">{data?.sold ?? '—'}</div>
          <div className="stat-sub">this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg days on lot</div>
          <div className="stat-value">{data?.avgDaysOnLot ?? '—'}</div>
          <div className="stat-sub">available units</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-label">Capital on lot</div>
          <div className="stat-value text-white">{data ? fmt(data.totalCapitalOnLot) : '—'}</div>
          <div className="stat-sub">total cost basis in inventory</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit MTD</div>
          <div className={`stat-value ${data && Number(data.realizedProfitMtd) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data ? fmt(data.realizedProfitMtd) : '—'}
          </div>
          <div className="stat-sub">month to date</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit YTD</div>
          <div className={`stat-value ${data && Number(data.realizedProfitYtd) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data ? fmt(data.realizedProfitYtd) : '—'}
          </div>
          <div className="stat-sub">year to date</div>
        </div>
      </div>
    </div>
  );
}
