'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Expense = {
  id: string;
  date: string;
  category: string;
  vendor?: string;
  description: string;
  amountPreTax: string;
  hstAmount: string;
  totalAmount: string;
  receiptUrl?: string;
  glAccount?: { code: string; name: string };
  vehicle?: { id: string; year: number; make: string; model: string };
};

type Summary = {
  from: string; to: string;
  byCategory: { category: string; amountPreTax: string; hstAmount: string; totalAmount: string }[];
  totals: { amountPreTax: string; hstAmount: string; totalAmount: string };
};

const CATEGORIES = [
  'ADVERTISING','BANK_CHARGES','FLOORPLAN_INTEREST','INSURANCE',
  'OFFICE_SUPPLIES','OMVIC_FEES','RENT','REPAIRS_MAINTENANCE',
  'SALARIES_WAGES','UTILITIES','VEHICLE_PURCHASE','OTHER',
];

const CAT_LABELS: Record<string, string> = {
  ADVERTISING: 'Advertising & Marketing', BANK_CHARGES: 'Bank Charges',
  FLOORPLAN_INTEREST: 'Floorplan Interest', INSURANCE: 'Insurance',
  OFFICE_SUPPLIES: 'Office Supplies', OMVIC_FEES: 'OMVIC Fees',
  RENT: 'Rent & Occupancy', REPAIRS_MAINTENANCE: 'Repairs & Maintenance',
  SALARIES_WAGES: 'Salaries & Wages', UTILITIES: 'Utilities',
  VEHICLE_PURCHASE: 'Vehicle Purchase', OTHER: 'Other',
};

function fmt(v: string | number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v));
}

function thisMonth() {
  const d = new Date();
  return {
    from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
    to: d.toISOString().slice(0, 10),
  };
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  category: 'RENT',
  vendor: '',
  description: '',
  amountPreTax: '',
  hstAmount: '',
  receiptUrl: '',
  vehicleId: '',
};

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'summary'>('list');
  const [dateRange, setDateRange] = useState(thisMonth());
  const [catFilter, setCatFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      if (catFilter) params.set('category', catFilter);
      params.set('limit', '100');
      const data = await apiFetch<{ items: Expense[]; total: number }>(`/expenses?${params}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [dateRange, catFilter]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Summary>(`/expenses/summary?from=${dateRange.from}&to=${dateRange.to}`);
      setSummary(data);
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => {
    if (tab === 'list') load();
    else loadSummary();
  }, [tab, load, loadSummary]);

  // Auto-calculate HST at 13% when amountPreTax changes
  const handlePreTaxChange = (val: string) => {
    const n = Number(val);
    setForm(f => ({
      ...f,
      amountPreTax: val,
      hstAmount: isNaN(n) ? '' : (n * 0.13).toFixed(2),
    }));
  };

  const submit = async () => {
    setErr(null);
    if (!form.description.trim()) { setErr('Description is required'); return; }
    if (!form.amountPreTax) { setErr('Amount is required'); return; }
    setBusy(true);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          date: form.date,
          category: form.category,
          vendor: form.vendor || undefined,
          description: form.description,
          amountPreTax: Number(form.amountPreTax),
          hstAmount: form.hstAmount ? Number(form.hstAmount) : 0,
          receiptUrl: form.receiptUrl || undefined,
          vehicleId: form.vehicleId || undefined,
        }),
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Expenses</h1>
          <p className="text-sm text-slate-400 mt-1">Track operating costs — auto-posts to GL</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Expense</button>
      </div>

      {/* New Expense Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="card-header">
            <span className="font-semibold">New Expense</span>
            <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="form-group">
                <label className="label">Date</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Category</label>
                <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Vendor</label>
                <input className="input" placeholder="e.g. Hydro One" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
              </div>
              <div className="form-group col-span-2">
                <label className="label">Description *</label>
                <input className="input" placeholder="e.g. March hydro bill" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Amount (pre-tax)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.amountPreTax} onChange={e => handlePreTaxChange(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">HST (auto 13%)</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.hstAmount} onChange={e => setForm(f => ({ ...f, hstAmount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Total</label>
                <div className="input bg-slate-700 text-slate-300 cursor-default">
                  {form.amountPreTax ? fmt(Number(form.amountPreTax) + Number(form.hstAmount || 0)) : '—'}
                </div>
              </div>
              <div className="form-group col-span-2">
                <label className="label">Receipt URL (optional)</label>
                <input className="input" placeholder="https://..." value={form.receiptUrl} onChange={e => setForm(f => ({ ...f, receiptUrl: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">Journal entry will be auto-posted to GL on save.</span>
            </div>
            {err && <div className="text-red-400 text-sm mb-3">{err}</div>}
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save & Post to GL'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters + Tabs */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl">
          {(['list', 'summary'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
          ))}
        </div>
        <input type="date" className="input w-36" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} />
        <span className="text-slate-500 text-sm">to</span>
        <input type="date" className="input w-36" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} />
        {tab === 'list' && (
          <select className="select w-52" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="text-slate-400 text-sm py-4">Loading…</div>}

      {/* List Tab */}
      {tab === 'list' && !loading && (
        <div className="card">
          <div className="card-header">
            <span className="text-sm text-slate-400">{total} expenses</span>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th className="text-right">Pre-tax</th><th className="text-right">HST</th><th className="text-right">Total</th><th>GL Account</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id}>
                  <td className="text-slate-400 text-xs">{e.date?.slice(0, 10)}</td>
                  <td><span className="badge-gray text-[10px]">{CAT_LABELS[e.category] ?? e.category}</span></td>
                  <td className="text-slate-300">{e.vendor ?? '—'}</td>
                  <td className="text-slate-100">{e.description}</td>
                  <td className="text-right text-slate-300">{fmt(e.amountPreTax)}</td>
                  <td className="text-right text-amber-400">{Number(e.hstAmount) > 0 ? fmt(e.hstAmount) : '—'}</td>
                  <td className="text-right font-semibold">{fmt(e.totalAmount)}</td>
                  <td className="text-xs text-slate-400">{e.glAccount ? `${e.glAccount.code} ${e.glAccount.name}` : '—'}</td>
                  <td>
                    <button className="text-slate-500 hover:text-red-400 text-xs" onClick={() => remove(e.id)}>✕</button>
                    {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="ml-2 text-sky-400 text-xs hover:text-sky-300">Receipt</a>}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">No expenses in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && !loading && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-label">Total Expenses (pre-tax)</div>
              <div className="stat-value text-red-400">{fmt(summary.totals.amountPreTax)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">HST Paid (ITC)</div>
              <div className="stat-value text-amber-400">{fmt(summary.totals.hstAmount)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total with HST</div>
              <div className="stat-value">{fmt(summary.totals.totalAmount)}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="font-semibold">By Category</span></div>
            <table className="data-table">
              <thead><tr><th>Category</th><th className="text-right">Pre-tax</th><th className="text-right">HST</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {summary.byCategory.sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount)).map(r => (
                  <tr key={r.category}>
                    <td>{CAT_LABELS[r.category] ?? r.category}</td>
                    <td className="text-right">{fmt(r.amountPreTax)}</td>
                    <td className="text-right text-amber-400">{Number(r.hstAmount) > 0 ? fmt(r.hstAmount) : '—'}</td>
                    <td className="text-right font-semibold">{fmt(r.totalAmount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-slate-900/50">
                  <td>Total</td>
                  <td className="text-right">{fmt(summary.totals.amountPreTax)}</td>
                  <td className="text-right text-amber-400">{fmt(summary.totals.hstAmount)}</td>
                  <td className="text-right">{fmt(summary.totals.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
