'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createLead,
  fetchCrmCustomers,
  fetchCrmLeads,
  LEAD_PIPELINE_LABELS,
  LEAD_PIPELINE_STAGES,
  type CrmCustomer,
  type CrmLead,
  type LeadPipelineStage,
  updateLead,
} from '@/lib/crm-api';
import { fetchVehiclesAllPages } from '@/lib/api';
import type { VehicleRow } from '@/lib/types';

function isPipelineStage(id: string): id is LeadPipelineStage {
  return (LEAD_PIPELINE_STAGES as readonly string[]).includes(id);
}

function PipelineColumn({
  stage,
  label,
  count,
  children,
}: {
  stage: LeadPipelineStage;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[min(70vh,520px)] min-w-[240px] flex-1 flex-col rounded-2xl border bg-slate-900/40 transition-colors ${
        isOver ? 'border-sky-500/50 ring-1 ring-sky-500/30' : 'border-slate-800/90'
      }`}
    >
      <div className="border-b border-slate-800/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-100">{label}</h3>
        <p className="text-[11px] text-slate-500">{count} leads</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">{children}</div>
    </div>
  );
}

function LeadCard({
  lead,
  disabled,
  vehicleOptions,
  onVehicleChange,
  variant = 'card',
}: {
  lead: CrmLead;
  disabled?: boolean;
  vehicleOptions: VehicleRow[];
  onVehicleChange?: (leadId: string, vehicleId: string | null) => void;
  variant?: 'card' | 'overlay';
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: disabled || variant === 'overlay',
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.45 : 1,
  };

  const vehicleLabel = lead.vehicle
    ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
    : null;

  const hasOrphanVehicle =
    lead.vehicle != null && !vehicleOptions.some((v) => v.id === lead.vehicle!.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-sm ring-1 ring-white/[0.03] transition hover:border-slate-600 ${
        disabled ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <div className="flex gap-2">
        {variant === 'card' ? (
          <button
            type="button"
            className="mt-0.5 h-8 shrink-0 cursor-grab rounded border border-transparent px-1 text-slate-500 hover:border-slate-700 hover:text-slate-300 active:cursor-grabbing"
            aria-label="Drag to move stage"
            {...listeners}
            {...attributes}
          >
            ⋮⋮
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">{lead.fullName}</p>
          <p className="mt-1 text-xs text-slate-500">
            Customer: <span className="text-slate-400">{lead.customer?.fullName ?? '—'}</span>
          </p>
          {variant === 'card' && onVehicleChange ? (
            <label className="mt-2 block text-[11px] text-slate-500">
              <span className="font-medium text-slate-400">Inventory</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                value={lead.vehicleId ?? ''}
                disabled={disabled}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const v = e.target.value;
                  onVehicleChange(lead.id, v === '' ? null : v);
                }}
              >
                <option value="">No vehicle</option>
                {hasOrphanVehicle && lead.vehicle ? (
                  <option value={lead.vehicle.id}>
                    {lead.vehicle.year} {lead.vehicle.make} {lead.vehicle.model} (current)
                  </option>
                ) : null}
                {vehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.year} {v.make} {v.model} · {v.vin.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
          ) : vehicleLabel && lead.vehicle ? (
            <p className="mt-1 text-xs text-sky-400/90">
              Vehicle: {vehicleLabel}
              <span className="ml-1 font-mono text-[10px] text-slate-500">({lead.vehicle.vin.slice(-6)})</span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-600">No vehicle linked</p>
          )}
          {lead.summary ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{lead.summary}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function LeadPipelineBoard() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<CrmLead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    customerId: '',
    vehicleId: '',
    summary: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [l, c, avail, pend] = await Promise.all([
        fetchCrmLeads(),
        fetchCrmCustomers(),
        fetchVehiclesAllPages({ status: 'available' }),
        fetchVehiclesAllPages({ status: 'pending' }),
      ]);
      setLeads(l);
      setCustomers(c);
      const merged = new Map<string, VehicleRow>();
      for (const v of [...avail, ...pend]) {
        merged.set(v.id, v);
      }
      setVehicles([...merged.values()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byStage = useMemo(() => {
    const m: Record<LeadPipelineStage, CrmLead[]> = {
      NEW_LEAD: [],
      CONTACTED: [],
      NEGOTIATING: [],
      CLOSED: [],
    };
    for (const l of leads) {
      const s = isPipelineStage(l.status) ? l.status : 'NEW_LEAD';
      m[s].push(l);
    }
    return m;
  }, [leads]);

  const handleDragStart = (e: DragStartEvent) => {
    const lead = leads.find((x) => x.id === e.active.id);
    setActive(lead ?? null);
  };

  const handleVehicleAssign = useCallback(
    async (leadId: string, vehicleId: string | null) => {
      const prev = leads;
      setSaving(true);
      setError(null);
      try {
        const updated = await updateLead(leadId, { vehicleId });
        setLeads((rows) => rows.map((r) => (r.id === leadId ? updated : r)));
      } catch (err) {
        setLeads(prev);
        setError(err instanceof Error ? err.message : 'Could not update vehicle');
      } finally {
        setSaving(false);
      }
    },
    [leads],
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const { active, over } = e;
    if (!over) {
      return;
    }
    const leadId = String(active.id);
    const lead = leads.find((x) => x.id === leadId);
    if (!lead) {
      return;
    }

    let target: LeadPipelineStage | null = null;
    const overId = String(over.id);
    if (isPipelineStage(overId)) {
      target = overId;
    } else {
      const overLead = leads.find((x) => x.id === overId);
      target = overLead && isPipelineStage(overLead.status) ? overLead.status : null;
    }
    if (!target || target === lead.status) {
      return;
    }

    const prev = leads;
    setLeads((rows) => rows.map((r) => (r.id === leadId ? { ...r, status: target } : r)));
    setSaving(true);
    try {
      const updated = await updateLead(leadId, { status: target });
      setLeads((rows) => rows.map((r) => (r.id === leadId ? updated : r)));
    } catch (err) {
      setLeads(prev);
      setError(err instanceof Error ? err.message : 'Could not move lead');
    } finally {
      setSaving(false);
    }
  };

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.customerId) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createLead({
        fullName: form.fullName.trim(),
        customerId: form.customerId,
        vehicleId: form.vehicleId || undefined,
        summary: form.summary.trim() || undefined,
        source: 'WEB',
        status: 'NEW_LEAD',
      });
      setLeads((x) => [created, ...x]);
      setForm({ fullName: '', customerId: '', vehicleId: '', summary: '' });
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create lead');
    } finally {
      setSaving(false);
    }
  }

  if (busy) {
    return (
      <div className="flex justify-center py-20 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400" />
          Loading pipeline…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Drag by the handle (⋮⋮) to change stage. Use Inventory to link a unit — it syncs with customer–vehicle
          interest in CRM. Sold units cannot be assigned.
          {saving ? <span className="ml-2 text-sky-400">Saving…</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          {formOpen ? 'Close form' : 'New lead'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={handleCreateLead}
          className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            <span className="font-medium text-slate-400">Lead name *</span>
            <input
              required
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Alex Prospect"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            <span className="font-medium text-slate-400">Customer *</span>
            <select
              required
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={form.customerId}
              onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            <span className="font-medium text-slate-400">Vehicle (optional)</span>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={form.vehicleId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
            >
              <option value="">None</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} · {v.vin.slice(-6)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            <span className="font-medium text-slate-400">Summary</span>
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Notes for the team"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Create lead
            </button>
          </div>
        </form>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
          {LEAD_PIPELINE_STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              label={LEAD_PIPELINE_LABELS[stage]}
              count={byStage[stage].length}
            >
              {byStage[stage].map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  disabled={saving}
                  vehicleOptions={vehicles}
                  onVehicleChange={handleVehicleAssign}
                />
              ))}
            </PipelineColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <LeadCard
              lead={active}
              disabled
              variant="overlay"
              vehicleOptions={vehicles}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
