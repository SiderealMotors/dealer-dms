'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthBar } from '@/components/AuthBar';
import { VehicleFormDrawer } from '@/components/inventory/VehicleFormDrawer';
import { VehicleTable } from '@/components/inventory/VehicleTable';
import { useVehiclesRealtime } from '@/hooks/useVehiclesRealtime';
import { ApiError, downloadVehiclesCsv, fetchSalespeople, fetchVehiclesPage } from '@/lib/api';
import {
  VEHICLE_PAGE_SIZE_DEFAULT,
  VEHICLE_PAGE_SIZE_OPTIONS,
  type VehiclePageSize,
} from '@/lib/pagination';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Salesperson, VehicleRow } from '@/lib/types';

export default function InventoryPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState<VehiclePageSize>(VEHICLE_PAGE_SIZE_DEFAULT);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [status, setStatus] = useState<'all' | 'available' | 'pending' | 'sold'>('all');
  const [salesPersonId, setSalesPersonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [exportCsvBusy, setExportCsvBusy] = useState(false);
  const [exportCsvError, setExportCsvError] = useState<string | null>(null);

  const listKeyRef = useRef('');
  listKeyRef.current = `${status}\0${salesPersonId}\0${pageSize}`;

  const rowsRef = useRef<VehicleRow[]>([]);
  const totalRef = useRef(0);
  const loadingMoreGuardRef = useRef(false);
  rowsRef.current = rows;
  totalRef.current = total;

  const loadInitial = useCallback(async () => {
    const keyAtStart = listKeyRef.current;
    setError(null);
    setRows([]);
    setTotal(0);
    setBusy(true);
    try {
      const data = await fetchVehiclesPage({
        status: status === 'all' ? undefined : status,
        salesPersonId: salesPersonId || undefined,
        limit: pageSize,
        offset: 0,
      });
      if (listKeyRef.current !== keyAtStart) {
        return;
      }
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      if (listKeyRef.current === keyAtStart) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
      }
    } finally {
      if (listKeyRef.current === keyAtStart) {
        setBusy(false);
      }
    }
  }, [status, salesPersonId, pageSize]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMoreGuardRef.current) {
      return;
    }
    if (rowsRef.current.length >= totalRef.current) {
      return;
    }
    const keyAtStart = listKeyRef.current;
    loadingMoreGuardRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchVehiclesPage({
        status: status === 'all' ? undefined : status,
        salesPersonId: salesPersonId || undefined,
        limit: pageSize,
        offset: rowsRef.current.length,
      });
      if (listKeyRef.current !== keyAtStart) {
        return;
      }
      setRows((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (e) {
      if (listKeyRef.current === keyAtStart) {
        setError(e instanceof Error ? e.message : 'Failed to load more');
      }
    } finally {
      loadingMoreGuardRef.current = false;
      setLoadingMore(false);
    }
  }, [status, salesPersonId, pageSize]);

  const refreshLoaded = useCallback(async () => {
    const keyAtStart = listKeyRef.current;
    const want = Math.max(rowsRef.current.length, pageSize);
    const filters = {
      status: status === 'all' ? undefined : status,
      salesPersonId: salesPersonId || undefined,
    };
    const empty = rowsRef.current.length === 0;
    setError(null);
    if (empty) {
      setBusy(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const acc: VehicleRow[] = [];
      let offset = 0;
      let totalCount = 0;
      const take = pageSize;
      for (;;) {
        const data = await fetchVehiclesPage({ ...filters, limit: take, offset });
        if (listKeyRef.current !== keyAtStart) {
          return;
        }
        totalCount = data.total;
        acc.push(...data.items);
        if (acc.length >= want || acc.length >= totalCount || data.items.length < take) {
          break;
        }
        offset += take;
      }
      if (listKeyRef.current !== keyAtStart) {
        return;
      }
      setRows(acc.slice(0, want));
      setTotal(totalCount);
    } catch (e) {
      if (listKeyRef.current === keyAtStart) {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
      }
    } finally {
      if (listKeyRef.current === keyAtStart) {
        setBusy(false);
        setLoadingMore(false);
      }
    }
  }, [pageSize, status, salesPersonId]);

  useEffect(() => {
    void fetchSalespeople()
      .then(setSalespeople)
      .catch(() => {
        /* non-fatal for UI */
      });
  }, []);

  const supabase = typeof window !== 'undefined' ? getSupabaseBrowserClient() : null;
  useVehiclesRealtime(refreshLoaded, Boolean(supabase));

  const hasMore = rows.length < total;
  const rangeStart = total === 0 ? 0 : 1;
  const rangeEnd = rows.length;

  function openCreate() {
    setDrawerMode('create');
    setEditing(null);
    setDrawerOpen(true);
  }

  async function handleExportCsv() {
    setExportCsvError(null);
    setExportCsvBusy(true);
    try {
      const blob = await downloadVehiclesCsv({
        status: status === 'all' ? undefined : status,
        salesPersonId: salesPersonId || undefined,
      });
      const filename = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not export CSV. Try again.';
      setExportCsvError(msg);
    } finally {
      setExportCsvBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Dealer DMS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Inventory</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Fleet economics, lot aging, and profit — with realtime sync when data changes elsewhere.
          </p>
          {!busy && total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-700/60">
                {total} matching {status === 'all' ? 'all statuses' : status}
              </span>
              <span className="rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-700/50">
                Infinite scroll · {pageSize} rows per request (max 200)
              </span>
            </div>
          ) : null}
        </div>
        <AuthBar />
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/25 p-4 shadow-sm ring-1 ring-white/[0.02] backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Status
            <select
              className="min-w-[10rem] rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition hover:border-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Salesperson
            <select
              className="min-w-[12rem] rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition hover:border-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20"
              value={salesPersonId}
              onChange={(e) => setSalesPersonId(e.target.value)}
            >
              <option value="">Everyone</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Batch size
            <select
              className="min-w-[6rem] rounded-xl border border-slate-700/80 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-100 outline-none transition hover:border-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as VehiclePageSize)}
            >
              {VEHICLE_PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exportCsvBusy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600/90 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-slate-500 hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportCsvBusy ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/30 border-t-sky-400"
                aria-hidden
              />
            ) : (
              <svg
                className="h-4 w-4 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
            {exportCsvBusy ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-500"
          >
            <span className="text-lg leading-none">+</span>
            New vehicle
          </button>
        </div>
      </section>

      {exportCsvError ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-amber-100/90">
            <span className="font-semibold text-amber-200">Export failed.</span> {exportCsvError}
          </p>
          <button
            type="button"
            onClick={() => setExportCsvError(null)}
            className="shrink-0 text-sm font-medium text-amber-300/90 underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-500/35 bg-rose-950/30 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-rose-200">Could not load inventory</p>
            <p className="mt-1 text-sm text-rose-100/85">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadInitial()}
            disabled={busy}
            className="shrink-0 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
          >
            {busy ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : null}

      <VehicleTable
        rows={rows}
        busy={busy}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        totalCount={total}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onAddNew={openCreate}
        onEdit={(v) => {
          setDrawerMode('edit');
          setEditing(v);
          setDrawerOpen(true);
        }}
      />

      <p className="text-xs text-slate-500">
        {total === 0 && !busy
          ? 'No vehicles for this filter.'
          : 'Scroll the table to load more. Each request fetches at most your batch size (max 200).'}
      </p>

      <VehicleFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        initial={editing}
        salespeople={salespeople}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void refreshLoaded()}
      />
    </main>
  );
}
