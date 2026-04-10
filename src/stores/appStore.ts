import { create } from 'zustand';

export interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  cidade: string;
  status: number;
  entrada: string;
  wa_sent: boolean;
  observacoes?: string;
  created_at?: string;
  user_id?: string;
  quiz_data?: Record<string, unknown>;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
  budget_type: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  roas: number;
  leads_api: number;
  reach: number;
}

export interface Creative {
  id: string;
  name: string;
  thumbnail_url?: string;
  effective_status: string;
  adset_name?: string;
  campaign_name?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpl?: number;
  leads?: number;
}

export const STATUS_LABELS = ['Aguardando', 'Em atendimento', 'Proposta enviada', 'Convertida'];
export const STATUS_COLORS = [
  { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
];

interface AppState {
  leads: Lead[];
  campaigns: Campaign[];
  creatives: Creative[];
  metaAccountId: string;
  metaToken: string;
  period: string;

  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
  setCreatives: (creatives: Creative[]) => void;
  setPeriod: (period: string) => void;
  setMetaAccountId: (id: string) => void;
  setMetaToken: (token: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  leads: [],
  campaigns: [],
  creatives: [],
  metaAccountId: '1667716164425149',
  metaToken: '',
  period: 'last_30d',

  setLeads: (leads) => set({ leads }),
  addLead: (lead) => set((s) => ({ leads: [lead, ...s.leads] })),
  updateLead: (id, updates) =>
    set((s) => ({
      leads: s.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  setCampaigns: (campaigns) => set({ campaigns }),
  setCreatives: (creatives) => set({ creatives }),
  setPeriod: (period) => set({ period }),
  setMetaAccountId: (metaAccountId) => set({ metaAccountId }),
  setMetaToken: (metaToken) => set({ metaToken }),
}));
