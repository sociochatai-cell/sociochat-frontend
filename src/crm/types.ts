// src/crm/types.ts
// ============================================================
// CRM data-layer types. These are the CONTRACT shared between
// crmApi (this module) and the CRM page components. Names are
// load-bearing — do not rename without updating both sides.
// ============================================================

/* ------------------------------- Leads ----------------------------------- */

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed';

export interface Lead {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    status: LeadStatus;
    source?: string;
    score?: number;
    value?: number;
    created_at?: string;
    last_interaction_at?: string;
    external_source?: string;
    external_id?: string;
    details?: any;
    workspace_id?: string;
}

/* ------------------------------- Deals ----------------------------------- */

export type DealStage =
    | 'prospect'
    | 'discovery'
    | 'qualified'
    | 'proposal'
    | 'negotiation'
    | 'won'
    | 'lost';

export interface Deal {
    id: string;
    name: string;
    value: number;
    currency?: string;
    stage: DealStage;
    probability?: number;
    status?: 'open' | 'closed' | 'archived';
    contact_id?: string;
    contact_email?: string;
    company?: string;
    close_date?: string;
    notes?: string;
    lost_reason?: string;
    created_at?: string;
}

/* ------------------------------ Contacts --------------------------------- */

export interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    role?: string;
    status?: string;
    tags?: string[];
    last_contacted?: string;
    created_at?: string;
}

/* ------------------------------ Activity --------------------------------- */

export interface Activity {
    id: string;
    type: string;
    title?: string;
    description?: string;
    created_at: string;
}

/* ----------------------------- Dashboard --------------------------------- */

export interface DashboardStats {
    total_leads: number;
    new_leads: number;
    active_leads: number;
    conversion_rate: number;
    [k: string]: any;
}

export interface ChartPoint {
    label: string;
    value: number;
}
