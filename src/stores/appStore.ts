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
  ultimo_status_change?: string;
  motivo_reprovacao?: string;
  score?: number | null;
  faixa?: 'verde' | 'amarelo' | 'vermelho' | null;
  [key: string]: unknown;
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

export interface CamposPerfil {
  label: string;
  campo: string;
}

export interface Trava {
  campo: string;
  contem: string;
}

export interface Configuracoes {
  campos_perfil: CamposPerfil[];
  faixas_score: {
    travas: Trava[];
    vermelho_se_todas: boolean;
  };
}

// Calcula faixa com base no score (lógica principal) ou travas (fallback para leads antigos)
export function calcularFaixa(
  lead: Lead,
  config: Configuracoes
): 'verde' | 'amarelo' | 'vermelho' | null {
  // 1. Se o lead já tem faixa salva no banco, usa ela
  if (lead.faixa) return lead.faixa;

  // 2. Se tem score, calcula pela pontuação
  if (lead.score != null) {
    const score = Number(lead.score);
    if (score < 55) return 'vermelho';
    if (score >= 70) return 'verde';
    return 'amarelo';
  }

  // 3. Fallback: lógica antiga por travas (leads sem score)
  if (!config?.faixas_score?.travas?.length) return null;

  const { travas, vermelho_se_todas } = config.faixas_score;

  const travaAtivada = (trava: Trava): boolean => {
    const valor = String(lead[trava.campo] || '').toLowerCase();
    return valor.includes(trava.contem.toLowerCase());
  };

  const travaCount = travas.filter(travaAtivada).length;

  if (travaCount === 0) return 'verde';
  if (vermelho_se_todas && travaCount === travas.length) return 'vermelho';
  return 'amarelo';
}

export const STATUS_LABELS = ['Em atendimento', 'Em atendimento', 'Reunião', 'Aprovado', 'Reprovado', 'Contrato/App'];
export const STATUS_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-400' },
  { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
];

interface AppState {
  leads: Lead[];
  campaigns: Campaign[];
  creatives: Creative[];
  configuracoes: Configuracoes | null;
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
  setConfiguracoes: (config: Configuracoes) => void;
}

export const useAppStore = create<AppState>((set) => ({
  leads: [],
  campaigns: [],
  creatives: [],
  configuracoes: null,
  metaAccountId: import.meta.env.VITE_META_ACCOUNT || '',
  metaToken: import.meta.env.VITE_META_TOKEN || '',
  period: 'last_30d',
  theme: (typeof window !== 'undefined'
    ? (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    : 'light'),

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
  setConfiguracoes: (configuracoes) => set({ configuracoes }),
}));
