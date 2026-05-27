'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  {
    label: 'Main',
    items: [
      { href: '/', icon: '◈', label: 'Dashboard' },
      { href: '/inventory', icon: '🚗', label: 'Inventory' },
      { href: '/crm', icon: '👥', label: 'CRM' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/accounting', icon: '📒', label: 'Accounting' },
      { href: '/expenses', icon: '💳', label: 'Expenses' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/reports/income-statement', icon: '📈', label: 'Income Statement' },
      { href: '/reports/balance-sheet', icon: '⚖️', label: 'Balance Sheet' },
      { href: '/reports/vehicle-profit', icon: '🏷️', label: 'Vehicle Profit' },
      { href: '/reports/hst', icon: '🧾', label: 'HST Summary' },
      { href: '/reports/bill-of-sale', icon: '📄', label: 'Bill of Sale' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', icon: '⚙️', label: 'Settings' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[220px] min-w-[220px] bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">Dealer DMS</div>
        <div className="text-xs text-slate-500 mt-0.5">Operations hub</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-4">
        {nav.map((section) => (
          <div key={section.label}>
            <div className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {section.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(item.href)
                      ? 'bg-sky-600/20 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800">
        <div className="text-[10px] text-slate-600">v2.0 — Sidereal Motors</div>
      </div>
    </aside>
  );
}
