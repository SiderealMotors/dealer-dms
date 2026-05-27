import { apiFetch } from './api';

export type CrmCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { deals: number; tasks: number; vehicleLinks: number };
};

export const LEAD_PIPELINE_STAGES = ['NEW_LEAD', 'CONTACTED', 'NEGOTIATING', 'CLOSED'] as const;
export type LeadPipelineStage = (typeof LEAD_PIPELINE_STAGES)[number];

export const LEAD_PIPELINE_LABELS: Record<LeadPipelineStage, string> = {
  NEW_LEAD: 'New Lead',
  CONTACTED: 'Contacted',
  NEGOTIATING: 'Negotiating',
  CLOSED: 'Closed',
};

export type CrmLead = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: LeadPipelineStage | string;
  source: string;
  summary: string | null;
  customerId: string;
  vehicleId: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; email: string | null; phone: string | null } | null;
  vehicle?: { id: string; vin: string; year: number; make: string; model: string } | null;
};

export const DEAL_STAGES = [
  'OPEN',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  OPEN: 'Open',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed won',
  CLOSED_LOST: 'Closed lost',
};

export type CrmDeal = {
  id: string;
  customerId: string;
  vehicleId: string | null;
  title: string;
  value: string | null;
  stage: DealStage | string;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; email: string | null; phone: string | null };
  vehicle?: { id: string; vin: string; year: number; make: string; model: string } | null;
  _count?: { tasks: number };
};

export type CrmTask = {
  id: string;
  customerId: string;
  dealId: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; email: string | null; phone: string | null };
  deal?: { id: string; title: string; stage: string } | null;
};

async function crmGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function fetchCrmCustomers(): Promise<CrmCustomer[]> {
  return crmGet<CrmCustomer[]>('/crm/customers');
}

export async function fetchCrmLeads(): Promise<CrmLead[]> {
  return crmGet<CrmLead[]>('/crm/leads');
}

export async function fetchCrmDeals(): Promise<CrmDeal[]> {
  return crmGet<CrmDeal[]>('/crm/deals');
}

export async function fetchCrmTasks(): Promise<CrmTask[]> {
  return crmGet<CrmTask[]>('/crm/tasks');
}

export async function updateLead(
  id: string,
  body: Partial<{
    status: LeadPipelineStage;
    fullName: string;
    phone: string;
    email: string;
    summary: string;
    vehicleId: string | null;
    customerId: string;
  }>,
): Promise<CrmLead> {
  return apiFetch<CrmLead>(`/crm/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function updateDeal(
  id: string,
  body: Partial<{
    vehicleId: string | null;
    title: string;
    value: string | null;
    stage: DealStage;
    closedAt: string | null;
    notes: string | null;
  }>,
): Promise<CrmDeal> {
  return apiFetch<CrmDeal>(`/crm/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function createLead(body: {
  fullName: string;
  customerId: string;
  vehicleId?: string;
  phone?: string;
  email?: string;
  summary?: string;
  source?: string;
  status?: LeadPipelineStage;
}): Promise<CrmLead> {
  return apiFetch<CrmLead>('/crm/leads', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
