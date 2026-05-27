'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type GlAccount = { id: string; code: string; name: string; type: string; normalBalance: string; isActive: boolean; description?: string };
type JournalLine = { id: string; lineNumber: number; debitAmount: string; creditAmount: string; memo?: string; account: { code: string; name: string } };
type JournalEntry = { id: string; entryNum: number; entryDate: string; description: string; status: string; lines: JournalLine[] };
type TrialBalanceLine = { accountId: string; code: string; name: string; type: string; debitBalance: string; creditBalance: string };

const TABS = ['Journal Entries', 'Chart of Accounts', 'Trial Balance'] as const;
type Tab = typeof TABS[number];

function fmt(v: string | number) {
  const n = Number(v);
  if (isNaN(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function statusBadge(s: string) {
  return s === 'POSTED'
    ? <span className="badge-green">{s}</span>
    : <span className="badge-gray">{s}</span>;
}

function AccountTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = { ASSET: 'badge-blue', LIABILITY: 'badge-yellow', EQUITY: 'badge-purple', REVENUE: 'badge-green', EXPENSE: 'badge-red' };
  return <span className={map[type] ?? 'badge-gray'}>{type}</span>;
}

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('Journal Entries');
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceLine[]>([]);
  const [expandedJe, setExpandedJe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));

  // New journal entry form
  const [showNewJe, setShowNewJe] = useState(false);
  const [newJeDesc, setNewJeDesc] = useState('');
  const [newJeDate, setNewJeDate] = useState(new Date().toISOString().slice(0, 10));
  const [newJeLines, setNewJeLines] = useState([
    { accountId: '', debitAmount: '', creditAmount: '', memo: '' },
    { accountId: '', debitAmount: '', creditAmount: '', memo: '' },
  ]);
  const [jeErr, setJeErr] = useState<string | null>(null);
  const [jeBusy, setJeBusy] = useState(false);

  const loadJournals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: JournalEntry[] }>('/accounting/journal-entries?limit=100');
      setJournals(data.items ?? []);
    } finally { setLoading(false); }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: GlAccount[] }>('/accounting/accounts?limit=100');
      setAccounts(data.items ?? []);
    } finally { setLoading(false); }
  }, []);

  const loadTrialBalance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ lines: TrialBalanceLine[] }>(`/accounting/trial-balance?asOf=${asOf}`);
      setTrialBalance(data.lines ?? []);
    } finally { setLoading(false); }
  }, [asOf]);

  useEffect(() => {
    if (tab === 'Journal Entries') loadJournals();
    else if (tab === 'Chart of Accounts') loadAccounts();
    else if (tab === 'Trial Balance') loadTrialBalance();
  }, [tab, loadJournals, loadAccounts, loadTrialBalance]);

  const postJe = async (id: string) => {
    await apiFetch(`/accounting/journal-entries/${id}/post`, { method: 'POST' });
    loadJournals();
  };

  const submitNewJe = async () => {
    setJeErr(null);
    const lines = newJeLines.filter(l => l.accountId);
    if (!newJeDesc.trim()) { setJeErr('Description is required'); return; }
    if (lines.length < 2) { setJeErr('At least 2 lines required'); return; }
    const totalDebits = lines.reduce((s, l) => s + Number(l.debitAmount || 0), 0);
    const totalCredits = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) { setJeErr(`Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`); return; }
    setJeBusy(true);
    try {
      await apiFetch('/accounting/journal-entries', {
        method: 'POST',
        body: JSON.stringify({
          entryDate: newJeDate,
          description: newJeDesc,
          lines: lines.map((l, i) => ({
            lineNumber: i + 1,
            accountId: l.accountId,
            debitAmount: Number(l.debitAmount || 0),
            creditAmount: Number(l.creditAmount || 0),
            memo: l.memo,
          })),
        }),
      });
      setShowNewJe(false);
      setNewJeDesc('');
      setNewJeLines([{ accountId: '', debitAmount: '', creditAmount: '', memo: '' }, { accountId: '', debitAmount: '', creditAmount: '', memo: '' }]);
      loadJournals();
    } catch (e: any) { setJeErr(e.message); }
    finally { setJeBusy(false); }
  };

  const tbTotals = trialBalance.reduce((acc, l) => ({
    debit: acc.debit + Number(l.debitBalance),
    credit: acc.credit + Number(l.creditBalance),
  }), { debit: 0, credit: 0 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Accounting</h1>
          <p className="text-sm text-slate-400 mt-1">Double-entry general ledger</p>
        </div>
        {tab === 'Journal Entries' && (
          <button className="btn-primary" onClick={() => setShowNewJe(true)}>+ New Journal Entry</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="text-slate-400 text-sm">Loading…</div>}

      {/* Journal Entries */}
      {tab === 'Journal Entries' && !loading && (
        <>
          {showNewJe && (
            <div className="card mb-6">
              <div className="card-header">
                <span className="font-semibold">New Journal Entry</span>
                <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowNewJe(false)}>✕</button>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Date</label>
                    <input type="date" className="input" value={newJeDate} onChange={e => setNewJeDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="label">Description</label>
                    <input className="input" placeholder="e.g. Monthly rent payment" value={newJeDesc} onChange={e => setNewJeDesc(e.target.value)} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2">Lines</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400">
                        <th className="text-left pb-2 pr-2">Account</th>
                        <th className="text-right pb-2 pr-2 w-32">Debit</th>
                        <th className="text-right pb-2 pr-2 w-32">Credit</th>
                        <th className="text-left pb-2 w-48">Memo</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newJeLines.map((line, i) => (
                        <tr key={i}>
                          <td className="pr-2 pb-2">
                            <select className="select" value={line.accountId} onChange={e => setNewJeLines(ls => ls.map((l, j) => j === i ? { ...l, accountId: e.target.value } : l))}>
                              <option value="">Select account…</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                            </select>
                          </td>
                          <td className="pr-2 pb-2"><input className="input text-right" type="number" min="0" step="0.01" value={line.debitAmount} onChange={e => setNewJeLines(ls => ls.map((l, j) => j === i ? { ...l, debitAmount: e.target.value } : l))} /></td>
                          <td className="pr-2 pb-2"><input className="input text-right" type="number" min="0" step="0.01" value={line.creditAmount} onChange={e => setNewJeLines(ls => ls.map((l, j) => j === i ? { ...l, creditAmount: e.target.value } : l))} /></td>
                          <td className="pr-2 pb-2"><input className="input" value={line.memo} onChange={e => setNewJeLines(ls => ls.map((l, j) => j === i ? { ...l, memo: e.target.value } : l))} /></td>
                          <td className="pb-2"><button className="text-slate-500 hover:text-red-400 text-xs" onClick={() => setNewJeLines(ls => ls.filter((_, j) => j !== i))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="text-sky-400 text-xs hover:text-sky-300 mt-1" onClick={() => setNewJeLines(ls => [...ls, { accountId: '', debitAmount: '', creditAmount: '', memo: '' }])}>+ Add line</button>
                </div>
                {jeErr && <div className="text-red-400 text-sm">{jeErr}</div>}
                <div className="flex gap-2 justify-end">
                  <button className="btn-secondary" onClick={() => setShowNewJe(false)}>Cancel</button>
                  <button className="btn-primary" onClick={submitNewJe} disabled={jeBusy}>{jeBusy ? 'Saving…' : 'Save as Draft'}</button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Date</th><th>Description</th><th>Lines</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {journals.map(je => (
                  <>
                    <tr key={je.id} className="cursor-pointer" onClick={() => setExpandedJe(expandedJe === je.id ? null : je.id)}>
                      <td className="font-mono text-slate-400 text-xs">{je.entryNum}</td>
                      <td className="text-slate-300">{je.entryDate?.slice(0, 10)}</td>
                      <td className="font-medium text-slate-100">{je.description}</td>
                      <td className="text-slate-400 text-xs">{je.lines?.length ?? 0} lines</td>
                      <td>{statusBadge(je.status)}</td>
                      <td>
                        {je.status === 'DRAFT' && (
                          <button className="btn-secondary btn-sm" onClick={e => { e.stopPropagation(); postJe(je.id); }}>Post</button>
                        )}
                      </td>
                    </tr>
                    {expandedJe === je.id && je.lines && (
                      <tr key={`${je.id}-lines`}>
                        <td colSpan={6} className="bg-slate-900/50 px-8 py-3">
                          <table className="w-full text-xs">
                            <thead><tr className="text-slate-500"><th className="text-left pr-4">Account</th><th className="text-right pr-4">Debit</th><th className="text-right pr-4">Credit</th><th className="text-left">Memo</th></tr></thead>
                            <tbody>
                              {je.lines.map(l => (
                                <tr key={l.id}>
                                  <td className="pr-4 py-1 text-slate-300">{l.account?.code} — {l.account?.name}</td>
                                  <td className="pr-4 py-1 text-right text-emerald-400">{Number(l.debitAmount) > 0 ? fmt(l.debitAmount) : ''}</td>
                                  <td className="pr-4 py-1 text-right text-sky-400">{Number(l.creditAmount) > 0 ? fmt(l.creditAmount) : ''}</td>
                                  <td className="py-1 text-slate-500">{l.memo}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {journals.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">No journal entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Chart of Accounts */}
      {tab === 'Chart of Accounts' && !loading && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal</th><th>Status</th></tr></thead>
            <tbody>
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map(type => {
                const group = accounts.filter(a => a.type === type);
                if (!group.length) return null;
                return [
                  <tr key={`header-${type}`}><td colSpan={5} className="bg-slate-900 text-xs font-bold text-slate-400 py-2 px-3">{type}</td></tr>,
                  ...group.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono text-sky-400 text-xs">{a.code}</td>
                      <td className="font-medium">{a.name}</td>
                      <td><AccountTypeBadge type={a.type} /></td>
                      <td className="text-slate-400 text-xs">{a.normalBalance}</td>
                      <td>{a.isActive ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Trial Balance */}
      {tab === 'Trial Balance' && !loading && (
        <>
          <div className="flex items-center gap-4 mb-4">
            <div className="form-group">
              <label className="label">As of date</label>
              <input type="date" className="input w-44" value={asOf} onChange={e => setAsOf(e.target.value)} />
            </div>
            <button className="btn-secondary mt-4" onClick={loadTrialBalance}>Refresh</button>
          </div>
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
              <tbody>
                {trialBalance.map(l => (
                  <tr key={l.accountId}>
                    <td className="font-mono text-sky-400 text-xs">{l.code}</td>
                    <td>{l.name}</td>
                    <td><AccountTypeBadge type={l.type} /></td>
                    <td className="text-right text-emerald-400">{Number(l.debitBalance) ? fmt(l.debitBalance) : ''}</td>
                    <td className="text-right text-sky-400">{Number(l.creditBalance) ? fmt(l.creditBalance) : ''}</td>
                  </tr>
                ))}
                {trialBalance.length > 0 && (
                  <tr className="font-semibold bg-slate-900/50">
                    <td colSpan={3} className="text-right pr-4">Totals</td>
                    <td className="text-right text-emerald-300">{fmt(tbTotals.debit)}</td>
                    <td className="text-right text-sky-300">{fmt(tbTotals.credit)}</td>
                  </tr>
                )}
                {trialBalance.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">No data for this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
