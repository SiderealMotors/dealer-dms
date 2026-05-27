'use client';

import Link from 'next/link';
import { AuthBar } from '@/components/AuthBar';
import { LeadPipelineBoard } from '@/components/crm/LeadPipelineBoard';

export default function LeadPipelinePage() {
  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/crm" className="text-xs font-medium text-sky-400 hover:text-sky-300">
            ← CRM overview
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Pipeline</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Lead board</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Kanban by stage. Every lead is tied to a customer; optionally link inventory. Drag a card to a new
            column to update its stage in the database.
          </p>
        </div>
        <AuthBar />
      </header>

      <LeadPipelineBoard />
    </main>
  );
}
