import { create } from 'zustand';

export interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  cidade: string;
  instagram?: string;
  o_que_mais_te_atrai?: string;
  quanto_gostaria_de_ganhar_por_mes?: string;
  o_que_mais_gostaria_de_conquistar?: string;
  onde_se_imagina_em_6_meses?: string;
  qual_sua_idade?: string;
  tem_filhos?: string;
  idade_do_filho_mais_novo?: string;
  voce_tem_alguma_rede_de_apoio?: string;
  voce_mora_com_alguem?: string;
  por_quais_meios_pretende_vender?: string;
  quantas_horas_por_semana_vai_se_dedicar?: string;
  quando_gostaria_de_comecar?: string;
  situacao_atual?: string;
  experiencia_em_vendas?: string;
  ja_tentou_vender_semijoia?: string;
  para_comecar_no_consignado?: string;
  seu_nome_esta_negativado?: string;
  voce_aceita_as_regras_do_consignado?: string;
  status?: number | null;
  entrada?: string;
  wa_sent?: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  utm_source?: string;
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

export const STATUS_LABELS = ['Aguardando', 'Em atendimento', 'Reunião', 'Aprovado'];
export const STATUS_COLORS = [
  { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400'   },
  { bg: 'bg-blue-50',    text: 'text-blue-600',     dot: 'bg-blue-400'    },
  { bg: 'bg-violet-50',  text: 'text-violet-600',   dot: 'bg-violet-400'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-600',  dot: 'bg-emerald-400' },
];

interface AppState {
  leads: Lead[];
  campaigns: Campaign[];
  creatives: Creative[];
  metaAccountId: string;
  metaToken: string;
  period: string;
  theme: 'light' | 'dark';

  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
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
  metaToken: 'EAASFxUC4PS0BRKyaU0lCw6uFQowDuH9epT4Afru4AxQNbykYcngh80exvpg0yipFBBxJnvdPKiAgJxuUBTBWzyFZCZBaY0EvhiZBIeSGFNrLe8ZAkcCC29Qfsk8ZCci4j87dZBpJKvHf19aKkMp4186ZAW9NG3fKrL4FFte1UFiSVAHlcRqZAmPGKdOnBZAPEurZAxIm37VQan3gMURGVrfrmkn4V4LwohCMplaYqVl5ENpI4MXt2EsXEuANwrs8ni95eO2H0tVd5GFZAcOephEyuBCgAZCvMb0WjS2ljOfZAZBQZDZD',
  period: 'last_30d',
  theme: (typeof window !== 'undefined' ? (localStorage.getItem('theme') as 'light' | 'dark') || 'light' : 'light'),

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
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
