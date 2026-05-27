'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AuthBar } from '@/components/AuthBar';
import { formatCad } from '@/components/inventory/money';
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGES,
  fetchCrmCustomers,
  fetchCrmDeals,
  fetchCrmLeads,
  fetchCrmTasks,
  LEAD_PIPELINE_LABELS,
  updateDeal,
  type CrmCustomer,
  type CrmDeal,
  type CrmLead,
  type CrmTask,
  type DealStage,
  type LeadPipelineStage,
} from '@/lib/crm-api';

type Tab = 'customers' | 'leads' | 'deals' | 'tasks';

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>('customers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [c, l, d, t] = await Promise.all([
        fetchCrmCustomers(),
        fetchCrmLeads(),
        fetchCrmDeals(),
        fetchCrmTasks(),
      ]);
      setCustomers(c);
      setLeads(l);
      setDeals(d);
      setTasks(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CRM');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'customers', label: 'Customers' },
    { id: 'leads', label: 'Leads' },
    { id: 'deals', label: 'Deals' },
    { id: 'tasks', label: 'Tasks' },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/" className="text-xs font-medium text-sky-400 hover:text-sky-300">
            ← Home
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">CRM</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Customers, leads, deals, and follow-ups. Link people to vehicles and opportunities; log calls
            and notes via the API.
          </p>
          <p className="mt-3">
            <Link
              href="/crm/pipeline"
              className="text-sm font-semibold text-sky-400 hover:text-sky-300"
            >
              Open lead pipeline (Kanban) →
            </Link>
          </p>
        </div>
        <AuthBar />
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-2 ring-1 ring-white/[0.02]">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === x.id
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-950/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            {x.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="ml-auto rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {tab === 'deals' ? (
        <p className="text-xs text-slate-500">
          <span className="text-slate-400">Closed won</span> requires a vehicle on the deal: inventory is updated to sold, buyer name is taken from the customer, and sale price uses the deal value when present.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/25 ring-1 ring-white/[0.02]">
        {tab === 'customers' ? (
          <EntityTable
            title="Customers"
            empty="No customers yet."
            rows={customers}
            columns={[
              { key: 'fullName', header: 'Name' },
              { key: 'email', header: 'Email' },
              { key: 'phone', header: 'Phone' },
              {
                key: '_count',
                header: 'Links',
                render: (r) =>
                  r._count
                    ? `${r._count.vehicleLinks} vehicles · ${r._count.deals} deals · ${r._count.tasks} tasks`
                    : '—',
              },
            ]}
          />
        ) : null}
        {tab === 'leads' ? (
          <EntityTable
            title="Leads"
            empty="No leads yet."
            rows={leads}
            columns={[
              { key: 'fullName', header: 'Name' },
              {
                key: 'status',
                header: 'Stage',
                render: (r) =>
                  LEAD_PIPELINE_LABELS[r.status as LeadPipelineStage] ?? String(r.status),
              },
              { key: 'source', header: 'Source' },
              {
                key: 'vehicle',
                header: 'Vehicle interest',
                render: (r) =>
                  r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : '—',
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (r) => r.customer?.fullName ?? '—',
              },
            ]}
          />
        ) : null}
        {tab === 'deals' ? (
          <EntityTable
            title="Deals"
            empty="No deals yet."
            rows={deals}
            columns={[
              { key: 'title', header: 'Title' },
              {
                key: 'stage',
                header: 'Stage',
                render: (r) => (
                  <select
                    className="max-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                    value={r.stage}
                    onChange={async (e) => {
                      const stage = e.target.value as DealStage;
                      const prev = deals;
                      setDeals((d) => d.map((x) => (x.id === r.id ? { ...x, stage } : x)));
                      try {
                        const u = await updateDeal(r.id, { stage });
                        setDeals((d) => d.map((x) => (x.id === r.id ? u : x)));
                      } catch (err) {
                        setDeals(prev);
                        setError(err instanceof Error ? err.message : 'Could not update deal');
                      }
                    }}
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {DEAL_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: 'value',
                header: 'Value',
                render: (r) => (r.value != null ? formatCad(r.value) : '—'),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (r) => r.customer?.fullName ?? '—',
              },
              {
                key: 'vehicle',
                header: 'Vehicle',
                render: (r) =>
                  r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : '—',
              },
            ]}
          />
        ) : null}
        {tab === 'tasks' ? (
          <EntityTable
            title="Tasks & follow-ups"
            empty="No tasks yet."
            rows={tasks}
            columns={[
              { key: 'title', header: 'Task' },
              { key: 'status', header: 'Status' },
              {
                key: 'dueAt',
                header: 'Due',
                render: (r) =>
                  r.dueAt ? new Date(r.dueAt).toLocaleString(undefined, { dateStyle: 'medium' }) : '—',
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (r) => r.customer?.fullName ?? '—',
              },
              {
                key: 'deal',
                header: 'Deal',
                render: (r) => r.deal?.title ?? '—',
              },
            ]}
          />
        ) : null}
      </section>

      <p className="text-center text-xs text-slate-600">
        Create and update records through the REST API (e.g.{' '}
        <code className="font-mono text-slate-500">POST /crm/customers</code>,{' '}
        <code className="font-mono text-slate-500">PATCH /crm/leads/:id</code> for stage changes).
      </p>
    </main>
  );
}

function EntityTable<T extends Record<string, unknown>>({
  title,
  empty,
  rows,
  columns,
}: {
  title: string;
  empty: string;
  rows: T[];
  columns: {
    key: string;
    header: string;
    render?: (row: T) => ReactNode;
  }[];
}) {
  return (
    <>
      <div className="border-b border-slate-800/80 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500">{rows.length} rows</p>
      </div>
      <div className="max-h-[min(70vh,560px)] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-950/95 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-5 py-3">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-slate-800/20">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-3 text-slate-200">
                      {c.render ? (
                        c.render(row)
                      ) : (
                        <Cell value={(row as Record<string, unknown>)[c.key]} />
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value == null || value === '') {
    return <span className="text-slate-500">—</span>;
  }
  return <>{String(value)}</>;
}
