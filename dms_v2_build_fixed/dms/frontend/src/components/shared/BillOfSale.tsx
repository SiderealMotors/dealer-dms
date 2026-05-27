'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Vehicle = {
  id: string; vin: string; year: number; make: string; model: string; trim: string; colour: string; odometer: number;
  sellingPrice?: string; safetyCharge?: string; warrantyCharge?: string; omvicFee?: string;
  buyerName?: string; paymentMethod?: string; depositAmount?: string; dateSold?: string;
  salesPersonName?: string;
};

type DealerSettings = {
  dealerName: string; address?: string; city?: string; province: string; postalCode?: string;
  phone?: string; email?: string; website?: string; hstNumber?: string; omvicNumber?: string; hstRate: string;
};

function fmt(v: string | number | null | undefined) {
  if (v == null) return '$0.00';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(v));
}

export default function BillOfSalePage({ vehicleId }: { vehicleId?: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string>(vehicleId ?? '');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [buyerOverride, setBuyerOverride] = useState('');

  useEffect(() => {
    apiFetch<{ items: Vehicle[] }>('/vehicles?status=sold&limit=100').then(d => setVehicles(d.items ?? []));
    apiFetch<DealerSettings>('/settings').then(setSettings);
  }, []);

  useEffect(() => {
    if (selected) {
      const v = vehicles.find(v => v.id === selected) ?? null;
      setVehicle(v);
      setBuyerOverride(v?.buyerName ?? '');
    }
  }, [selected, vehicles]);

  const print = () => window.print();

  if (!vehicle || !settings) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-white mb-4">Bill of Sale</h1>
        <div className="form-group">
          <label className="label">Select sold vehicle</label>
          <select className="select" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">Choose vehicle…</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} — {v.buyerName ?? 'No buyer'} ({v.dateSold?.slice(0, 10)})</option>)}
          </select>
        </div>
        {!settings && <div className="text-slate-400 text-sm mt-4">Loading dealer settings…</div>}
      </div>
    );
  }

  const hstRate = Number(settings.hstRate ?? 0.13);
  const selling = Number(vehicle.sellingPrice ?? 0);
  const safety = Number(vehicle.safetyCharge ?? 0);
  const warranty = Number(vehicle.warrantyCharge ?? 0);
  const omvic = Number(vehicle.omvicFee ?? 0);
  const subTotal = selling + safety + warranty + omvic;
  const hst = subTotal * hstRate;
  const grandTotal = subTotal + hst;
  const deposit = Number(vehicle.depositAmount ?? 0);
  const balance = grandTotal - deposit;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Screen controls — hidden when printing */}
      <div className="print:hidden mb-6 flex items-center gap-4">
        <div className="form-group flex-1">
          <label className="label">Vehicle</label>
          <select className="select" value={selected} onChange={e => setSelected(e.target.value)}>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} — {v.dateSold?.slice(0, 10)}</option>)}
          </select>
        </div>
        <div className="form-group flex-1">
          <label className="label">Buyer name override</label>
          <input className="input" value={buyerOverride} onChange={e => setBuyerOverride(e.target.value)} />
        </div>
        <button className="btn-primary mt-4" onClick={print}>🖨️ Print / Save PDF</button>
      </div>

      {/* Bill of Sale — printable */}
      <div className="bg-white text-gray-900 p-8 rounded-xl shadow-xl print:shadow-none print:rounded-none" style={{ fontFamily: 'Georgia, serif' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{settings.dealerName}</h1>
            {settings.address && <p className="text-sm text-gray-600 mt-1">{settings.address}</p>}
            {settings.city && <p className="text-sm text-gray-600">{settings.city}, {settings.province} {settings.postalCode}</p>}
            {settings.phone && <p className="text-sm text-gray-600">Tel: {settings.phone}</p>}
            {settings.omvicNumber && <p className="text-xs text-gray-500">OMVIC Reg: {settings.omvicNumber}</p>}
            {settings.hstNumber && <p className="text-xs text-gray-500">HST/BN: {settings.hstNumber}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-700">Bill of Sale</h2>
            <p className="text-sm text-gray-500 mt-1">Date: {vehicle.dateSold?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        {/* Buyer & Vehicle */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Buyer</h3>
            <p className="font-semibold text-gray-900 text-lg">{buyerOverride || vehicle.buyerName || '________________________'}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Salesperson</h3>
            <p className="text-gray-700">{vehicle.salesPersonName || '—'}</p>
          </div>
        </div>

        <div className="mb-8 bg-gray-50 rounded-lg p-5 border border-gray-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Vehicle Details</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            {[
              ['Year / Make / Model', `${vehicle.year} ${vehicle.make} ${vehicle.model}`],
              ['Trim', vehicle.trim],
              ['Colour', vehicle.colour],
              ['Odometer', `${Number(vehicle.odometer).toLocaleString('en-CA')} km`],
              ['VIN', vehicle.vin],
              ['Payment Method', vehicle.paymentMethod || '—'],
            ].map(([label, val]) => (
              <div key={label as string} className="flex flex-col">
                <span className="text-gray-400 text-xs">{label}</span>
                <span className="font-medium text-gray-900">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Price Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {selling > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Selling Price</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#111827' }}>{fmt(selling)}</td>
                </tr>
              )}
              {safety > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Safety & Certification</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#111827' }}>{fmt(safety)}</td>
                </tr>
              )}
              {warranty > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Warranty</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#111827' }}>{fmt(warranty)}</td>
                </tr>
              )}
              {omvic > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 0', color: '#374151' }}>OMVIC Fee</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#111827' }}>{fmt(omvic)}</td>
                </tr>
              )}
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Subtotal</td>
                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(subTotal)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0', color: '#374151' }}>HST ({(hstRate * 100).toFixed(0)}%)</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: '#111827' }}>{fmt(hst)}</td>
              </tr>
              <tr style={{ borderBottom: '2px solid #111827' }}>
                <td style={{ padding: '10px 0', fontWeight: 700, fontSize: 16, color: '#111827' }}>Total</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#111827' }}>{fmt(grandTotal)}</td>
              </tr>
              {deposit > 0 && (
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px 0', color: '#374151' }}>Less: Deposit</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: '#059669' }}>({fmt(deposit)})</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '10px 0', fontWeight: 700, color: '#111827' }}>Balance Due</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#111827' }}>{fmt(balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-10 pt-8 border-t border-gray-200">
          <div>
            <div style={{ borderBottom: '1px solid #9ca3af', marginBottom: 8, paddingBottom: 24 }}></div>
            <p style={{ fontSize: 12, color: '#6b7280' }}>Buyer Signature & Date</p>
          </div>
          <div>
            <div style={{ borderBottom: '1px solid #9ca3af', marginBottom: 8, paddingBottom: 24 }}></div>
            <p style={{ fontSize: 12, color: '#6b7280' }}>Dealer Representative</p>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 24, textAlign: 'center' }}>
          This bill of sale is subject to OMVIC regulations. The vehicle is sold as-is unless otherwise specified in writing. All prices in CAD.
        </p>
      </div>
    </div>
  );
}
