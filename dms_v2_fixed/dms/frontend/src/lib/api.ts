import type { Salesperson, VehicleRow } from './types';
import { VEHICLE_PAGE_SIZE_DEFAULT, type VehiclePageSize } from './pagination';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Thrown when `fetch` returns a non-OK status; includes HTTP status for UI and logging. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

async function authHeader(): Promise<HeadersInit> {
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true') {
    return {};
  }
  const { getSupabaseBrowserClient } = await import('./supabase-browser');
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {};
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...(init?.headers ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
      const j = parsed as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(j.message)) {
        message = j.message.filter(Boolean).join('. ');
      } else if (typeof j.message === 'string') {
        message = j.message;
      }
    } catch {
      /* keep raw */
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status, parsed);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export type VehiclesListResponse = {
  items: VehicleRow[];
  total: number;
  offset: number;
  limit: number;
};

/**
 * One page of vehicles (max 200 per request server-side; prefer {@link VEHICLE_PAGE_SIZE_DEFAULT}).
 */
export async function fetchVehiclesPage(params: {
  status?: 'available' | 'pending' | 'sold';
  salesPersonId?: string;
  limit?: VehiclePageSize | number;
  offset?: number;
}): Promise<VehiclesListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.salesPersonId) q.set('salesPersonId', params.salesPersonId);
  q.set('limit', String(params.limit ?? VEHICLE_PAGE_SIZE_DEFAULT));
  q.set('offset', String(params.offset ?? 0));
  const qs = q.toString();
  return apiFetch<VehiclesListResponse>(`/vehicles?${qs}`);
}

/**
 * Fetches all matching vehicles using repeated paged requests (each ≤ `pageSize`, max 200).
 * Use for dropdowns / merges where the full set is required.
 */
export async function fetchVehiclesAllPages(
  params: {
    status?: 'available' | 'pending' | 'sold';
    salesPersonId?: string;
  },
  pageSize: VehiclePageSize | number = VEHICLE_PAGE_SIZE_DEFAULT,
): Promise<VehicleRow[]> {
  const all: VehicleRow[] = [];
  let offset = 0;
  const take = Math.min(200, Math.max(1, pageSize));
  for (;;) {
    const { items, total } = await fetchVehiclesPage({ ...params, limit: take, offset });
    all.push(...items);
    if (items.length < take || all.length >= total) {
      break;
    }
    offset += take;
  }
  return all;
}

/**
 * GET /vehicles/export/csv — same query filters as the inventory list (status, salesperson).
 * Returns a CSV blob for client-side download.
 */
export async function downloadVehiclesCsv(params: {
  status?: 'available' | 'pending' | 'sold';
  salesPersonId?: string;
}): Promise<Blob> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.salesPersonId) q.set('salesPersonId', params.salesPersonId);
  const qs = q.toString();
  const path = `/vehicles/export/csv${qs ? `?${qs}` : ''}`;
  const headers: HeadersInit = {
    ...(await authHeader()),
  };
  const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
      const j = parsed as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(j.message)) {
        message = j.message.filter(Boolean).join('. ');
      } else if (typeof j.message === 'string') {
        message = j.message;
      }
    } catch {
      /* keep raw */
    }
    throw new ApiError(message || `Export failed (${res.status})`, res.status, parsed);
  }
  return res.blob();
}

export async function fetchSalespeople(): Promise<Salesperson[]> {
  return apiFetch<Salesperson[]>('/users/salespeople');
}

export async function createVehicle(body: Record<string, unknown>): Promise<VehicleRow> {
  return apiFetch<VehicleRow>('/vehicles', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateVehicle(
  id: string,
  body: Record<string, unknown>,
): Promise<VehicleRow> {
  return apiFetch<VehicleRow>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteVehicle(id: string): Promise<void> {
  await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
}

/** —— Accounting reports (GET /reports/*) —— */

export type IncomeStatementLine = {
  accountId: string;
  code: string;
  name: string;
  amount: string;
};

export type IncomeStatementResponse = {
  basis: 'gl';
  startDate: string;
  endDate: string;
  revenue: IncomeStatementLine[];
  costOfGoodsSold: IncomeStatementLine[];
  operatingExpenses: IncomeStatementLine[];
  totals: {
    totalRevenue: string;
    totalCostOfGoodsSold: string;
    grossProfit: string;
    totalExpenses: string;
    netProfit: string;
  };
};

export type BalanceSheetResponse = {
  basis: 'gl';
  asOf: string;
  assets: IncomeStatementLine[];
  liabilities: IncomeStatementLine[];
  equity: {
    accounts: IncomeStatementLine[];
    netIncome: { name: string; amount: string };
  };
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    equityFromAccounts: string;
    netIncome: string;
    balanced: boolean;
  };
};

export async function fetchIncomeStatement(params: {
  startDate?: string;
  endDate?: string;
}): Promise<IncomeStatementResponse> {
  const q = new URLSearchParams();
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  const qs = q.toString();
  return apiFetch<IncomeStatementResponse>(`/reports/income-statement${qs ? `?${qs}` : ''}`);
}

export async function fetchBalanceSheet(params: { asOf?: string }): Promise<BalanceSheetResponse> {
  const q = new URLSearchParams();
  if (params.asOf) q.set('asOf', params.asOf);
  const qs = q.toString();
  return apiFetch<BalanceSheetResponse>(`/reports/balance-sheet${qs ? `?${qs}` : ''}`);
}

async function downloadCsvBlob(pathWithQuery: string): Promise<Blob> {
  const headers: HeadersInit = {
    ...(await authHeader()),
  };
  const res = await fetch(`${API_BASE}${pathWithQuery}`, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
      const j = parsed as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(j.message)) {
        message = j.message.filter(Boolean).join('. ');
      } else if (typeof j.message === 'string') {
        message = j.message;
      }
    } catch {
      /* keep raw */
    }
    throw new ApiError(message || `Export failed (${res.status})`, res.status, parsed);
  }
  return res.blob();
}

export async function downloadIncomeStatementCsv(params: {
  startDate?: string;
  endDate?: string;
}): Promise<Blob> {
  const q = new URLSearchParams();
  q.set('format', 'csv');
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  return downloadCsvBlob(`/reports/income-statement?${q.toString()}`);
}

export async function downloadBalanceSheetCsv(params: { asOf?: string }): Promise<Blob> {
  const q = new URLSearchParams();
  q.set('format', 'csv');
  if (params.asOf) q.set('asOf', params.asOf);
  return downloadCsvBlob(`/reports/balance-sheet?${q.toString()}`);
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function fetchExpenses(params: {
  from?: string; to?: string; category?: string; limit?: number; offset?: number;
}) {
  const p = new URLSearchParams();
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  if (params.category) p.set('category', params.category);
  if (params.limit) p.set('limit', String(params.limit));
  if (params.offset) p.set('offset', String(params.offset));
  return apiFetch<{ items: any[]; total: number }>(`/expenses?${p}`);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function fetchDealerSettings() {
  return apiFetch<any>('/settings');
}

export async function updateDealerSettings(data: any) {
  return apiFetch<any>('/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// ── Public inventory (no auth) ────────────────────────────────────────────────

export async function fetchPublicInventory(params?: { make?: string; maxPrice?: string; limit?: string }) {
  const p = new URLSearchParams(params as any);
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const res = await fetch(`${base}/public/inventory?${p}`);
  return res.json();
}
