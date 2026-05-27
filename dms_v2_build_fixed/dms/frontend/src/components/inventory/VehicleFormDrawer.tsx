'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Salesperson, VehicleRow } from '@/lib/types';
import { computeVehicleInventorySnapshot } from '@dms/inventory-calculations';
import { validateVehicleForm } from '@/lib/inventory/vehicle-form-validation';
import { createVehicle, deleteVehicle, updateVehicle } from '@/lib/api';
import { FormSection } from './FormSection';
import { LiveMetricsPanel } from './LiveMetricsPanel';
import { VehicleStatusBadge } from './VehicleStatusBadge';
import { formatCad, parseMoneyStringToCents, parseNum } from './money';

type Mode = 'create' | 'edit';

const emptyForm = {
  datePurchased: '',
  vin: '',
  year: '',
  make: '',
  model: '',
  trim: '',
  colour: '',
  odometer: '',
  purchasePrice: '',
  safetyEstimate: '',
  safetyCost: '',
  floorplanInterestCost: '',
  gas: '',
  warrantyCost: '',
  dateSold: '',
  sellingPrice: '',
  safetyCharge: '',
  warrantyCharge: '',
  omvicFee: '',
  buyerName: '',
  referralAmount: '',
  paymentMethod: '',
  depositAmount: '',
  salesPersonId: '',
  salesPersonName: '',
  /** When unsold: listing pipeline. Ignored once date sold is set (server marks Sold). */
  listingStatus: 'available',
};

function rowToForm(v: VehicleRow): typeof emptyForm {
  return {
    datePurchased: v.datePurchased,
    vin: v.vin,
    year: String(v.year),
    make: v.make,
    model: v.model,
    trim: v.trim,
    colour: v.colour,
    odometer: String(v.odometer),
    purchasePrice: String(v.purchasePrice),
    safetyEstimate: v.safetyEstimate != null ? String(v.safetyEstimate) : '',
    safetyCost: String(v.safetyCost),
    floorplanInterestCost: String(v.floorplanInterestCost),
    gas: String(v.gas),
    warrantyCost: String(v.warrantyCost),
    dateSold: v.dateSold ?? '',
    sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : '',
    safetyCharge: v.safetyCharge != null ? String(v.safetyCharge) : '',
    warrantyCharge: v.warrantyCharge != null ? String(v.warrantyCharge) : '',
    omvicFee: v.omvicFee != null ? String(v.omvicFee) : '',
    buyerName: v.buyerName ?? '',
    referralAmount: String(v.referralAmount),
    paymentMethod: v.paymentMethod ?? '',
    depositAmount: v.depositAmount != null ? String(v.depositAmount) : '',
    salesPersonId: v.salesPersonId ?? '',
    salesPersonName: v.salesPersonName ?? '',
    listingStatus: v.status === 'pending' ? 'pending' : 'available',
  };
}

function buildPayload(f: typeof emptyForm, mode: Mode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    datePurchased: f.datePurchased,
    vin: f.vin.trim(),
    year: parseInt(f.year, 10),
    make: f.make.trim(),
    model: f.model.trim(),
    trim: f.trim.trim(),
    colour: f.colour.trim(),
    odometer: parseInt(f.odometer, 10),
    purchasePrice: parseNum(f.purchasePrice),
    safetyEstimate: f.safetyEstimate ? parseNum(f.safetyEstimate) : undefined,
    safetyCost: parseNum(f.safetyCost),
    floorplanInterestCost: parseNum(f.floorplanInterestCost),
    gas: parseNum(f.gas),
    warrantyCost: parseNum(f.warrantyCost),
    referralAmount: parseNum(f.referralAmount),
    buyerName: f.buyerName.trim() || undefined,
    paymentMethod: f.paymentMethod.trim() || undefined,
    depositAmount: f.depositAmount ? parseNum(f.depositAmount) : undefined,
    salesPersonId: f.salesPersonId || undefined,
    salesPersonName: f.salesPersonName.trim() || undefined,
  };

  if (f.dateSold?.trim()) {
    base.dateSold = f.dateSold;
    base.sellingPrice = parseNum(f.sellingPrice);
    base.safetyCharge = parseNum(f.safetyCharge);
    base.warrantyCharge = parseNum(f.warrantyCharge);
    base.omvicFee = parseNum(f.omvicFee);
  } else {
    base.status = f.listingStatus === 'pending' ? 'pending' : 'available';
    if (mode === 'edit') {
      base.dateSold = null;
    }
  }

  return base;
}

function inputBaseClass(err: boolean, disabled: boolean) {
  return `rounded-lg border bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition ${
    err ? 'border-rose-500/70 ring-1 ring-rose-500/20' : 'border-slate-700/80'
  } ${
    disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:border-slate-600 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25'
  }`;
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/25 border-t-white ${className}`}
      aria-hidden
    />
  );
}

export function VehicleFormDrawer({
  open,
  mode,
  initial,
  salespeople,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: Mode;
  initial: VehicleRow | null;
  salespeople: Salesperson[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setFieldErrors({});
    if (mode === 'edit' && initial) {
      setForm(rowToForm(initial));
    } else {
      setForm({
        ...emptyForm,
        datePurchased: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, mode, initial]);

  const liveReady = Boolean(form.datePurchased && form.purchasePrice);

  const live = useMemo(() => {
    if (!liveReady) {
      return null;
    }
    const nums = {
      purchasePriceCents: parseMoneyStringToCents(form.purchasePrice),
      safetyCostCents: parseMoneyStringToCents(form.safetyCost),
      gasCents: parseMoneyStringToCents(form.gas),
      warrantyCostCents: parseMoneyStringToCents(form.warrantyCost),
      floorplanInterestCents: parseMoneyStringToCents(form.floorplanInterestCost),
      referralCents: parseMoneyStringToCents(form.referralAmount),
      sellingPriceCents: form.dateSold ? parseMoneyStringToCents(form.sellingPrice) : null,
      safetyChargeCents: form.dateSold ? parseMoneyStringToCents(form.safetyCharge) : null,
      warrantyChargeCents: form.dateSold ? parseMoneyStringToCents(form.warrantyCharge) : null,
      omvicFeeCents: form.dateSold ? parseMoneyStringToCents(form.omvicFee) : null,
    };
    return computeVehicleInventorySnapshot(
      { datePurchased: form.datePurchased, dateSold: form.dateSold || null },
      nums,
      new Date(),
    );
  }, [form]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const validation = validateVehicleForm(form);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      setError(validation.summary);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form, mode);
      if (mode === 'create') {
        await createVehicle(payload);
      } else if (initial) {
        await updateVehicle(initial.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial || mode !== 'edit') return;
    if (!window.confirm('Delete this vehicle permanently?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteVehicle(initial.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  function field<K extends keyof typeof form>(
    key: K,
    label: string,
    props?: React.InputHTMLAttributes<HTMLInputElement>,
  ) {
    const err = fieldErrors[key as string];
    const disabled = saving || props?.disabled;
    return (
      <label className="flex flex-col gap-1.5 text-xs text-slate-500">
        <span className="font-medium text-slate-400">{label}</span>
        <input
          className={inputBaseClass(Boolean(err), Boolean(disabled))}
          value={form[key]}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          disabled={disabled}
          {...props}
        />
        {err ? <span className="text-[11px] font-medium text-rose-300">{err}</span> : null}
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="vehicle-drawer-title"
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(100vw,56rem)] flex-col overflow-hidden border-l border-slate-800/90 bg-slate-950 shadow-2xl shadow-black/50"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800/80 bg-slate-950/95 px-5 py-4 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400/90">Inventory</p>
            <h3 id="vehicle-drawer-title" className="mt-1 text-lg font-semibold tracking-tight text-white">
              {mode === 'create' ? 'Add vehicle' : 'Edit vehicle'}
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              Live preview uses the same 13% rules as the server. Invalid dates, negatives, or incomplete sales are
              blocked on save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/80 hover:text-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-sm"
              >
                <p className="font-medium text-rose-200">Could not save</p>
                <p className="mt-1 text-rose-100/90">{error}</p>
              </div>
            ) : null}

            <FormSection
              title="Vehicle & identification"
              description="Core unit details and purchase date."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {field('datePurchased', 'Date purchased', { type: 'date', required: true })}
                {field('vin', 'VIN', { required: true, maxLength: 17 })}
                {field('year', 'Year', { type: 'number', required: true })}
                {field('make', 'Make', { required: true })}
                {field('model', 'Model', { required: true })}
                {field('trim', 'Trim', { required: true })}
                {field('colour', 'Colour', { required: true })}
                {field('odometer', 'Odometer (km)', { type: 'number', required: true })}
              </div>
            </FormSection>

            <FormSection
              title="Acquisition & carrying costs"
              description="Pre-tax amounts; HST on purchase and cost lines is computed automatically."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {field('purchasePrice', 'Purchase price (pre-tax)', { type: 'number', step: '0.01', required: true })}
                {field('safetyEstimate', 'Safety estimate (informational)', { type: 'number', step: '0.01' })}
                {field('safetyCost', 'Safety cost (pre-tax)', { type: 'number', step: '0.01' })}
                {field('floorplanInterestCost', 'Floorplan interest', { type: 'number', step: '0.01' })}
                {field('gas', 'Gas (pre-tax)', { type: 'number', step: '0.01' })}
                {field('warrantyCost', 'Warranty cost (pre-tax)', { type: 'number', step: '0.01' })}
                {field('referralAmount', 'Referral amount', { type: 'number', step: '0.01' })}
              </div>
            </FormSection>

            <FormSection
              title="Sale & buyer"
              description="While no sale date is set, choose Available or Pending. Entering a sale date saves as Sold automatically."
            >
              <div className="mb-4 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
                {form.dateSold?.trim() ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit status</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Sale date is set — this unit is treated as <span className="text-slate-200">Sold</span> on save.
                      </p>
                    </div>
                    <VehicleStatusBadge status="sold" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="flex min-w-[12rem] flex-col gap-1.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-400">Listing status</span>
                      <select
                        className={inputBaseClass(false, saving)}
                        disabled={saving}
                        value={form.listingStatus}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            listingStatus: e.target.value as 'available' | 'pending',
                          }))
                        }
                      >
                        <option value="available">Available — on lot</option>
                        <option value="pending">Pending — in progress</option>
                      </select>
                    </label>
                    <VehicleStatusBadge status={form.listingStatus} />
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field('dateSold', 'Date sold', { type: 'date' })}
                {field('sellingPrice', 'Selling price (vehicle, pre-tax)', { type: 'number', step: '0.01' })}
                {field('safetyCharge', 'Safety charge', { type: 'number', step: '0.01' })}
                {field('warrantyCharge', 'Warranty charge', { type: 'number', step: '0.01' })}
                {field('omvicFee', 'OMVIC fee', { type: 'number', step: '0.01' })}
                {field('buyerName', 'Buyer name')}
                {field('paymentMethod', 'Payment method')}
                {field('depositAmount', 'Deposit (informational)', { type: 'number', step: '0.01' })}
              </div>
            </FormSection>

            <FormSection title="Team" description="Link a salesperson or override the display name.">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs text-slate-500 sm:col-span-2">
                  <span className="font-medium text-slate-400">Linked user</span>
                  <select
                    className={inputBaseClass(false, saving)}
                    value={form.salesPersonId}
                    disabled={saving}
                    onChange={(e) => {
                      const id = e.target.value;
                      const sp = salespeople.find((s) => s.id === id);
                      setForm((s) => ({
                        ...s,
                        salesPersonId: id,
                        salesPersonName: sp ? sp.fullName : s.salesPersonName,
                      }));
                    }}
                  >
                    <option value="">Unassigned</option>
                    {salespeople.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.role})
                      </option>
                    ))}
                  </select>
                </label>
                {field('salesPersonName', 'Display name override (optional)')}
              </div>
            </FormSection>
          </div>

          <aside className="flex w-full shrink-0 flex-col border-t border-slate-800/80 bg-slate-900/40 lg:w-[min(100%,20rem)] lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">Live economics</h4>
                {liveReady ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90 ring-1 ring-emerald-500/25">
                    Live
                  </span>
                ) : null}
              </div>
              <LiveMetricsPanel live={live} ready={liveReady} />
            </div>

            <div className="space-y-2 border-t border-slate-800/80 bg-slate-950/80 p-5 backdrop-blur-sm">
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving ? (
                  <>
                    <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                    Saving…
                  </>
                ) : (
                  'Save vehicle'
                )}
              </button>
              {mode === 'edit' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saving ? <Spinner className="h-4 w-4 border-rose-200/30 border-t-rose-200" /> : null}
                  Delete vehicle
                </button>
              ) : null}
              {live ? (
                <p className="pt-1 text-center text-[10px] text-slate-600">
                  Preview total purchase {formatCad(live.totalPurchasePrice)}
                </p>
              ) : null}
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
