'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type DealerSettings = {
  dealerName: string; address?: string; city?: string; province: string; postalCode?: string;
  phone?: string; email?: string; website?: string; hstNumber?: string; omvicNumber?: string;
  hstRate: string; defaultOmvicFee: string; logoUrl?: string;
};

type User = {
  id: string; fullName: string; email: string; role: string;
  commissionRule?: { ruleType: string; flatAmount?: string; percentOfProfit?: string; minProfit?: string; isActive: boolean };
};

type CommissionReport = {
  from: string; to: string;
  salespeople: { userId: string; name: string; vehicles: number; totalRevenue: number; commission: number }[];
};

const TABS = ['Dealer Info', 'Users & Commissions', 'Commission Report'] as const;

function fmt(v: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v);
}

function thisYear() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: new Date().toISOString().slice(0, 10) };
}

export default function SettingsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Dealer Info');
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [commReport, setCommReport] = useState<CommissionReport | null>(null);
  const [commRange, setCommRange] = useState(thisYear());
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Commission form state per user
  const [commForms, setCommForms] = useState<Record<string, { ruleType: string; flatAmount: string; percentOfProfit: string; minProfit: string; isActive: boolean }>>({});

  const loadSettings = useCallback(async () => {
    const d = await apiFetch<DealerSettings>('/settings');
    setSettings(d);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<User[]>('/settings/users');
      setUsers(d);
      const forms: typeof commForms = {};
      for (const u of d) {
        forms[u.id] = {
          ruleType: u.commissionRule?.ruleType ?? 'FLAT',
          flatAmount: u.commissionRule?.flatAmount ?? '300',
          percentOfProfit: u.commissionRule?.percentOfProfit ? String(Number(u.commissionRule.percentOfProfit) * 100) : '10',
          minProfit: u.commissionRule?.minProfit ?? '0',
          isActive: u.commissionRule?.isActive ?? true,
        };
      }
      setCommForms(forms);
    } finally { setLoading(false); }
  }, []);

  const loadCommReport = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<CommissionReport>(`/settings/commission-report?from=${commRange.from}&to=${commRange.to}`);
      setCommReport(d);
    } finally { setLoading(false); }
  }, [commRange]);

  useEffect(() => {
    if (tab === 'Dealer Info') loadSettings();
    else if (tab === 'Users & Commissions') loadUsers();
    else if (tab === 'Commission Report') loadCommReport();
  }, [tab, loadSettings, loadUsers, loadCommReport]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaveBusy(true); setSaveMsg(null);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          hstRate: Number(settings.hstRate),
          defaultOmvicFee: Number(settings.defaultOmvicFee),
        }),
      });
      setSaveMsg('Settings saved.');
    } catch (e: any) { setSaveMsg('Error: ' + e.message); }
    finally { setSaveBusy(false); }
  };

  const saveCommission = async (userId: string) => {
    const f = commForms[userId];
    if (!f) return;
    try {
      await apiFetch(`/settings/users/${userId}/commission`, {
        method: 'POST',
        body: JSON.stringify({
          ruleType: f.ruleType,
          flatAmount: f.ruleType === 'FLAT' ? Number(f.flatAmount) : undefined,
          percentOfProfit: f.ruleType === 'PERCENT' ? Number(f.percentOfProfit) / 100 : undefined,
          minProfit: f.minProfit ? Number(f.minProfit) : undefined,
          isActive: f.isActive,
        }),
      });
      await loadUsers();
    } catch (e: any) { alert(e.message); }
  };

  const setCommForm = (userId: string, patch: Partial<typeof commForms[string]>) => {
    setCommForms(prev => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Dealer info, user management, commissions</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
        ))}
      </div>

      {/* Dealer Info */}
      {tab === 'Dealer Info' && settings && (
        <div className="card">
          <div className="card-header"><span className="font-semibold">Dealer Information</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="label">Dealership Name</label>
                <input className="input" value={settings.dealerName} onChange={e => setSettings(s => s && ({ ...s, dealerName: e.target.value }))} />
              </div>
              <div className="form-group col-span-2">
                <label className="label">Address</label>
                <input className="input" value={settings.address ?? ''} onChange={e => setSettings(s => s && ({ ...s, address: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">City</label>
                <input className="input" value={settings.city ?? ''} onChange={e => setSettings(s => s && ({ ...s, city: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Province</label>
                <select className="select" value={settings.province} onChange={e => setSettings(s => s && ({ ...s, province: e.target.value }))}>
                  {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Postal Code</label>
                <input className="input" value={settings.postalCode ?? ''} onChange={e => setSettings(s => s && ({ ...s, postalCode: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" value={settings.phone ?? ''} onChange={e => setSettings(s => s && ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" value={settings.email ?? ''} onChange={e => setSettings(s => s && ({ ...s, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Website</label>
                <input className="input" value={settings.website ?? ''} onChange={e => setSettings(s => s && ({ ...s, website: e.target.value }))} />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Tax & Regulatory</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">HST Number</label>
                  <input className="input" placeholder="123456789 RT 0001" value={settings.hstNumber ?? ''} onChange={e => setSettings(s => s && ({ ...s, hstNumber: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">OMVIC Registration #</label>
                  <input className="input" value={settings.omvicNumber ?? ''} onChange={e => setSettings(s => s && ({ ...s, omvicNumber: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="label">HST Rate</label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.001" min="0" max="1" className="input w-28" value={settings.hstRate} onChange={e => setSettings(s => s && ({ ...s, hstRate: e.target.value }))} />
                    <span className="text-slate-400 text-sm">({(Number(settings.hstRate) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Default OMVIC Fee</label>
                  <input type="number" step="0.01" className="input w-28" value={settings.defaultOmvicFee} onChange={e => setSettings(s => s && ({ ...s, defaultOmvicFee: e.target.value }))} />
                </div>
              </div>
            </div>

            {saveMsg && <div className={`text-sm ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{saveMsg}</div>}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={saveSettings} disabled={saveBusy}>{saveBusy ? 'Saving…' : 'Save Settings'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Users & Commissions */}
      {tab === 'Users & Commissions' && !loading && (
        <div className="space-y-4">
          {users.filter(u => u.role === 'SALES' || u.role === 'ADMIN').map(u => {
            const f = commForms[u.id];
            if (!f) return null;
            return (
              <div key={u.id} className="card">
                <div className="card-header">
                  <div>
                    <span className="font-semibold">{u.fullName}</span>
                    <span className="ml-2 badge-gray text-[10px]">{u.role}</span>
                  </div>
                  <span className="text-xs text-slate-400">{u.email}</span>
                </div>
                <div className="card-body">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Commission Rule</p>
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div className="form-group">
                      <label className="label">Rule type</label>
                      <select className="select" value={f.ruleType} onChange={e => setCommForm(u.id, { ruleType: e.target.value })}>
                        <option value="FLAT">Flat amount per sale</option>
                        <option value="PERCENT">% of profit</option>
                      </select>
                    </div>
                    {f.ruleType === 'FLAT' ? (
                      <div className="form-group">
                        <label className="label">Flat amount ($)</label>
                        <input type="number" min="0" step="10" className="input" value={f.flatAmount} onChange={e => setCommForm(u.id, { flatAmount: e.target.value })} />
                      </div>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="label">% of profit</label>
                          <input type="number" min="0" max="100" step="1" className="input" value={f.percentOfProfit} onChange={e => setCommForm(u.id, { percentOfProfit: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="label">Min profit threshold ($)</label>
                          <input type="number" min="0" step="100" className="input" value={f.minProfit} onChange={e => setCommForm(u.id, { minProfit: e.target.value })} />
                        </div>
                      </>
                    )}
                    <div className="form-group">
                      <label className="label">Active</label>
                      <select className="select" value={f.isActive ? 'yes' : 'no'} onChange={e => setCommForm(u.id, { isActive: e.target.value === 'yes' })}>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <button className="btn-secondary h-9" onClick={() => saveCommission(u.id)}>Save rule</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Commission Report */}
      {tab === 'Commission Report' && (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="form-group">
              <label className="label">From</label>
              <input type="date" className="input w-40" value={commRange.from} onChange={e => setCommRange(r => ({ ...r, from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">To</label>
              <input type="date" className="input w-40" value={commRange.to} onChange={e => setCommRange(r => ({ ...r, to: e.target.value }))} />
            </div>
            <button className="btn-secondary mt-4" onClick={loadCommReport}>Refresh</button>
          </div>
          {loading && <div className="text-slate-400 text-sm">Loading…</div>}
          {!loading && commReport && (
            <div className="card">
              <table className="data-table">
                <thead><tr><th>Salesperson</th><th className="text-right">Vehicles Sold</th><th className="text-right">Total Revenue</th><th className="text-right">Commission Earned</th></tr></thead>
                <tbody>
                  {commReport.salespeople.map(sp => (
                    <tr key={sp.userId}>
                      <td className="font-medium">{sp.name}</td>
                      <td className="text-right">{sp.vehicles}</td>
                      <td className="text-right">{fmt(sp.totalRevenue)}</td>
                      <td className="text-right font-semibold text-emerald-400">{fmt(sp.commission)}</td>
                    </tr>
                  ))}
                  {commReport.salespeople.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">No sales in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
