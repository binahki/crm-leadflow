import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_CONFIG, STATUS_SEQUENCE } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Settings, Check, CheckCheck, Search, Send, User, 
  ExternalLink, MessageCircle, ArrowLeft, MoreVertical, 
  MapPin, Instagram, Clock, Shield, Info, Smile, 
  Paperclip, ChevronDown, UserPlus, Trash2, LogOut,
  X, Filter, MoreHorizontal, Loader2, AlertTriangle, Megaphone,
  ChevronRight, Timer, UserCheck, Share2, MessageSquare, Zap
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface WaAccount {
  id: string;
  org_id: string;
  phone_number_id: string;
  business_account_id: string;
  token: string;
  webhook_verify_token: string;
  display_name: string | null;
  status: string | null;
}

interface WaConversation {
  id: string;
  org_id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  lead_id: string | null;
  created_at: string;
  session_active: boolean;
  session_expires_at: string | null;
  internal_notes: string | null;
  is_hot_lead: boolean;
  metadata: Record<string, any> | null;
  lead?: any;
}

interface WaMessage {
  id: string;
  org_id: string;
  conversation_id: string;
  wamid: string | null;
  direction: string | null;
  type: string | null;
  content: string | null;
  status: string | null;
  created_at: string;
}

const QUIZ_LABELS: Record<string, string> = {
  situacao_atual: 'Situação atual',
  oque_mais_te_atrai: 'O que mais te atrai',
  quanto_gostaria_de_ganhar_por_mes: 'Renda desejada',
  qual_sua_idade: 'Idade',
  tem_filhos: 'Tem filhos',
  idade_do_filho_mais_novo: 'Idade do filho mais novo',
  voce_tem_alguma_rede_de_apoio: 'Rede de apoio',
  voce_mora_com_alguem: 'Mora com alguém',
  por_quais_meios_pretende_vender: 'Meios de venda',
  quantas_horas_por_semana_vai_se_dedicar: 'Horas por semana',
  quando_gostaria_de_comecar: 'Quando quer começar',
  experiencia_em_vendas: 'Experiência em vendas',
  ja_tentou_vender_semijoia: 'Tentou vender semijoia',
  para_comecar_no_consignado: 'Para começar',
  seu_nome_esta_negativado: 'Nome negativado',
  voce_aceita_as_regras_do_consignado: 'Aceita as regras',
  opcoes_DA8DjT: 'Situação atual',
  opcoes_ycxX5F: 'O que mais te atrai',
  opcoes_9kTTVs: 'Renda desejada',
  opcoes_yh5Vjx: 'Tem filhos',
  opcoes_I82ixf: 'Idade do filho mais novo',
  opcoes_pFlzeQ: 'Rede de apoio',
  opcoes_mhhj1z: 'Área de atuação',
  opcoes_dWlnR5: 'Já vende',
  opcoes_dX55lt: 'Meios de venda',
  opcoes_VzQ35i: 'Horas por semana',
  opcoes_H9Q1lM: 'Quando quer começar',
  opcoes_VsNjuc: 'Tentou semijoia',
  opcoes_u5gvVw: 'Instagram ativo',
  opcoes_qhtsek: 'Para começar',
  opcoes_zs2MuV: 'Nome negativado',
  opcoes_sN46It: 'Aceita as regras',
};

const CRM_STATUS_LABELS: Record<number, string> = Object.entries(STATUS_CONFIG).reduce((acc, [id, s]) => ({ ...acc, [id]: s.label }), {});
const CRM_STATUS_COLORS: Record<number, any> = STATUS_CONFIG;


// ── Constants & Theme ─────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getMediaSrc(msg: any, orgId: string): string | null {
  if (msg.media_id) {
    return `${SUPABASE_URL}/functions/v1/whatsapp-webhook?action=media&media_id=${msg.media_id}&org_id=${orgId}`;
  }
  if (msg.media_url) return msg.media_url;
  return null;
}
export const WA_COLORS = {
  light: {
    sidebarBg: '#ffffff',
    chatBg: '#efeae2',
    headerBg: '#f0f2f5',
    inputAreaBg: '#f0f2f5',
    inputBg: '#ffffff',
    bubbleOut: '#dcf8c6',
    bubbleIn: '#ffffff',
    textPrimary: '#111b21',
    textSecondary: '#667781',
    border: '#e9edef',
    hover: '#f5f6f6',
    selected: '#eff2f5',
    badge: '#25d366',
  },
  dark: {
    sidebarBg: '#111b21',
    chatBg: '#0d1117',
    headerBg: '#202c33',
    inputAreaBg: '#202c33',
    inputBg: '#2a3942',
    bubbleOut: '#005c4b',
    bubbleIn: '#202c33',
    textPrimary: '#111b21', // Conforme solicitado: #111b21
    textSecondary: '#8696a0',
    border: '#222d34',
    hover: '#202c33',
    selected: '#2a3942',
    badge: '#00a884',
  }
};


const PROJECT_ID = 'obguidmfvfjaekaskgob';
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

// ── Helpers ────────────────────────────────────────────────────────────────────
const waRelativeTime = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const isToday = date.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' }) === 
                  now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' });
  if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ontem';

  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const avatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#ef4444', 
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#4f46e5'
  ];
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

const formatPhone = (phone: string) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

// ── Message formatter ─────────────────────────────────────────────────────────
function formatWAText(text: string): string {
  // 1. Escapa HTML para evitar XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return escaped
    // 2. Links (https:// ou http://)
    .replace(
      /(https?:\/\/[^\s<&]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;word-break:break-all;">$1</a>'
    )
    // 3. Negrito (*texto*)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    // 4. Itálico (_texto_)
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    // 5. Tachado (~texto~)
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    // 6. Monospace (```texto```)
    .replace(/```([^`]+)```/g, '<code style="font-family:monospace;background:rgba(0,0,0,0.08);padding:1px 4px;border-radius:3px;">$1</code>')
    // 7. Quebras de linha
    .replace(/\n/g, '<br/>');
}

// Mensagens prontas — salvas no localStorage por org
const DEFAULT_QUICK_REPLIES = [
  {
    id: '1',
    titulo: 'Cadastro aprovado',
    texto: 'Oi, {{nome}}!\n\n*Seu cadastro foi aprovado na Becker* ✅\n\nAgora falta só a *etapa final*: uma *reunião obrigatória* por vídeo (15 min).\n\nNela, explicamos os benefícios, tiramos dúvidas e alinhamos os próximos passos.\n\n*Importante*: sem essa reunião, *não liberamos as semijoias.*\n\nHoje tenho estes horários:\n12h | 15h | 17h\n\n*Qual deles você consegue participar?*\n\nSe hoje não funcionar, me responde com o melhor período e eu verifico o próximo encaixe.',
  },
  {
    id: '2',
    titulo: 'Link da reunião',
    texto: 'Oii {{nome}}, segue o link da reunião 👇🏻\n\nhttps://meet.google.com/auj-kupq-rax\n\nEstou enviando agora, mas a reunião começa às (HORÁRIO) em ponto 😉',
  },
  {
    id: '3',
    titulo: 'Baixar app',
    texto: 'Segue o passo a passo:\n\n1) Baixar aplicativo Executiva Becker.\n\nSe o seu celular for Android 👇\n https://play.google.com/store/apps/details?id=com.upvendas.becker\n\nSe for iPhone 👇\n https://apps.apple.com/us/app/executiva-becker/id6504882086',
  },
  {
    id: '4',
    titulo: 'Assinar contrato',
    texto: '2)Ler e assinar o contrato virtual. Abaixo o link para assinatura. 👇\n\nhttps://app.zapsign.com.br/verificar/doc/e961bbff-950d-43aa-a32a-5820ee34c012',
  },
  {
    id: '5',
    titulo: 'Referências e Instagram',
    texto: 'Me manda por favor:\n\n• Seu Instagram @\n• 3 contatos de referência que sejam parentes e maiores de idade, enviar telefone + nome + grau de parentesco',
  },
  {
    id: '6',
    titulo: 'Formulário mostruário',
    texto: 'Vamos iniciar a montagem do seu mostruário, me conte neste formulário o que você gostaria que fosse enviado na sua maleta 💖\n\nhttps://docs.google.com/forms/d/e/1FAIpQLScf-_ZNfTgX9LUEINY2AgyqjXWyZ6eJuvkFErh45R96wedddg/viewform?usp=header',
  },
];

// ── Components ────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? WA_COLORS.dark : WA_COLORS.light;
  const { orgId, ready: orgReady } = useOrgId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { leads: storeLeads } = useAppStore();

  const [account, setAccount] = useState<WaAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const initialPhone = searchParams.get('phone');
  const initialConvId = searchParams.get('conversation');

  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data }) => {
        setAccount(data as WaAccount);
        setLoading(false);
      });
  }, [orgId, orgReady]);

  if (!loading && !account) {
    return (
      <AppLayout leadCount={storeLeads.length}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: '16px', padding: '32px',
          background: '#f9fafb', textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: '#dcfce7', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Zap size={32} style={{ color: '#16a34a' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            WhatsApp Oficial não configurado
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px', lineHeight: 1.6, margin: 0 }}>
            Para usar o inbox de mensagens, configure sua conta do WhatsApp Cloud API da Meta.
          </p>
          <button
            onClick={() => navigate('/whatsapp/configuracoes')}
            style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none',
              background: '#2563eb', color: '#fff', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Configurar WhatsApp API
          </button>
        </div>
      </AppLayout>
    );
  }

  if (loading) return (
    <AppLayout leadCount={storeLeads.length} hideSidebar>
      <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
        <div style={{ width: '360px', borderRight: '1px solid #e9edef', background: '#fff' }} />
        <div style={{ flex: 1, background: '#efeae2' }} />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout leadCount={storeLeads.length} hideSidebar>
      <div className="h-screen w-full flex overflow-hidden" style={{ background: colors.chatBg, color: colors.textPrimary }}>
        <ChatInbox 
          colors={colors} orgId={orgId!} account={account} user={user}
          initialPhone={initialPhone} initialConvId={initialConvId}
          onOpenSettings={() => navigate('/whatsapp/configuracoes')}
        />
      </div>
    </AppLayout>
  );
}

// ── Chat Inbox ──
function ChatInbox({ colors, orgId, account, user, initialPhone, initialConvId, onOpenSettings }: {
  colors: any, orgId: string, account: WaAccount | null, user: any,
  initialPhone?: string | null, initialConvId?: string | null,
  onOpenSettings: () => void
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConvId || null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread
  const [statusFilter, setStatusFilter] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(window.innerWidth > 1200);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Constantes dos status (ordem correta do CRM)
  const CRM_STATUS = [
    { value: 1, label: 'Em atendimento', dot: '#3b82f6' },
    { value: 2, label: 'Reunião', dot: '#8b5cf6' },
    { value: 5, label: 'Contrato/App', dot: '#f59e0b' },
    { value: 3, label: 'Aprovado', dot: '#10b981' },
    { value: 4, label: 'Reprovado', dot: '#ef4444' },
  ];

  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const statusDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target as Node)) {
        setShowStatusDrop(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const [quickStatusId, setQuickStatusId] = useState<string | null>(null);
  const [showQuickEditor, setShowQuickEditor] = useState(false);


  const fetchConvs = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('*, lead:leads(*)')
      .eq('org_id', orgId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });
    
    setConversations(data as WaConversation[]);
  }, [orgId]);

  useEffect(() => { 
    fetchConvs();
  }, [fetchConvs]);

  useEffect(() => {
    const interval = setInterval(fetchConvs, 5000);
    return () => clearInterval(interval);
  }, [fetchConvs]);

  useEffect(() => {
    const ch = supabase.channel('wa-inbox-' + orgId)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `org_id=eq.${orgId}` }, () => {
        fetchConvs();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, fetchConvs]);

  useEffect(() => {
    if (!initialPhone || !orgId || conversations.length === 0) return;
    const cleanPhone = initialPhone.replace(/\D/g, '');
    const existing = conversations.find(c => c.contact_phone === cleanPhone || c.contact_phone.endsWith(cleanPhone.slice(-9)));
    if (existing && selectedId !== existing.id) {
      setSelectedId(existing.id);
    }
  }, [initialPhone, conversations, orgId, selectedId]);

  const fetchMessages = useCallback(async () => {
    if (!selectedId) return;
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', selectedId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }, [selectedId]);

  useEffect(() => {
    fetchMessages();
    if (selectedId) {
      supabase.from('whatsapp_conversations').update({ unread_count: 0 }).eq('id', selectedId).then(() => fetchConvs());
    }
  }, [selectedId, fetchMessages, fetchConvs]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel(`wa-msgs-${selectedId}`)
      .on('postgres_changes' as any, { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'whatsapp_messages', 
        filter: `conversation_id=eq.${selectedId}` 
      }, (payload) => {
        setMessages(prev => {
          // Evita duplicatas se o fetchMessages e o realtime dispararem quase juntos
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as any];
        });
        setTimeout(scrollToBottom, 100);
      })
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selectedId}`
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, scrollToBottom]);

  const filteredConvs = useMemo(() => {
    return conversations.filter(c => {
      // Se tinha um lead_id mas o lead não veio no join, significa que foi excluído
      if (c.lead_id && !c.lead) return false;

      const q = searchText.toLowerCase();
      const searchMatch = (c.contact_name || '').toLowerCase().includes(q) || c.contact_phone.includes(q) || (c.lead?.nome || '').toLowerCase().includes(q);
      const unreadMatch = filter === 'unread' ? (c.unread_count || 0) > 0 : true;
      let statusMatch = statusFilter === null;
      if (statusFilter !== null) {
        if (statusFilter === 1) {
          statusMatch = c.lead?.status === 0 || c.lead?.status === 1;
        } else {
          statusMatch = c.lead?.status === statusFilter;
        }
      }
      return searchMatch && unreadMatch && statusMatch;
    }).sort((a, b) => {
      const timeA = new Date(a.last_message_at || 0).getTime();
      const timeB = new Date(b.last_message_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
  }, [conversations, searchText, filter, statusFilter]);

  const activeConv = conversations.find(c => c.id === selectedId);
  
  const lastInboundTime = messages
    .filter(m => m.direction === 'inbound')
    .map(m => new Date(m.created_at).getTime())
    .sort((a, b) => b - a)[0] || null;

  const sessionFromInbound = lastInboundTime 
    ? (Date.now() - lastInboundTime) < 24 * 60 * 60 * 1000 
    : false;

  const sessionFromDb = activeConv?.session_expires_at 
    ? new Date(activeConv.session_expires_at).getTime() > Date.now() 
    : false;

  const isExpired = !sessionFromInbound && !sessionFromDb;

  return (
    <>
      <div 
        className={`${isMobile && selectedId ? 'hidden' : 'flex'} flex-col border-r w-[320px] lg:w-[360px] flex-shrink-0 relative z-20`}
        style={{ background: colors.sidebarBg, borderColor: colors.border }}
      >
        <SidebarHeader colors={colors} user={user} onOpenSettings={onOpenSettings} />
        <SidebarSearch colors={colors} value={searchText} onChange={setSearchText} />
        
        <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: colors.border }}>
          {/* Todas */}
          <button
            onClick={() => { setFilter('all'); setStatusFilter(null); }}
            style={{
              padding: '4px 12px', borderRadius: '99px', fontSize: '12px',
              fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filter === 'all' && statusFilter === null ? '#2563eb' : 'transparent',
              color: filter === 'all' && statusFilter === null ? '#fff' : colors.textSecondary,
            }}
          >
            Todas
          </button>

          {/* Não lidas */}
          <button
            onClick={() => { setFilter('unread'); setStatusFilter(null); }}
            style={{
              padding: '4px 12px', borderRadius: '99px', fontSize: '12px',
              fontWeight: 600, border: `1px solid ${colors.border}`, cursor: 'pointer',
              background: filter === 'unread' ? '#2563eb' : 'transparent',
              color: filter === 'unread' ? '#fff' : colors.textSecondary,
            }}
          >
            Não lidas
          </button>

          {/* Status dropdown */}
          <div ref={statusDropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowStatusDrop(v => !v)}
              style={{
                padding: '4px 10px', borderRadius: '99px', fontSize: '12px',
                fontWeight: 600, border: `1px solid ${colors.border}`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                background: statusFilter !== null ? '#2563eb' : 'transparent',
                color: statusFilter !== null ? '#fff' : colors.textSecondary,
              }}
            >
              {statusFilter !== null
                ? CRM_STATUS.find(s => s.value === statusFilter)?.label
                : 'Status'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </button>

            {showStatusDrop && (
              <>
                <div
                  onClick={() => setShowStatusDrop(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: '12px', padding: '4px', minWidth: '180px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                }}>
                  <button
                    onClick={() => { setStatusFilter(null); setFilter('all'); setShowStatusDrop(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 12px',
                      borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '13px', background: 'transparent', color: '#6b7280',
                    }}
                  >
                    Todos os status
                  </button>
                  {STATUS_SEQUENCE.map(idx => (
                    <button
                      key={idx}
                      onClick={() => {
                        setStatusFilter(idx);
                        setFilter('status');
                        setShowStatusDrop(false);
                      }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                        background: statusFilter === idx ? '#eff6ff' : 'transparent',
                        color: statusFilter === idx ? '#2563eb' : '#374151',
                      }}
                    >
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: STATUS_CONFIG[idx].dot, flexShrink: 0,
                      }} />
                      {STATUS_CONFIG[idx].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        
        <ConversationList 
          colors={colors} list={filteredConvs} selectedId={selectedId} theme={theme}
          quickStatusId={quickStatusId} onSetQuickStatus={setQuickStatusId}
          onUpdateLead={() => fetchConvs()}
          orgId={orgId}
          onSelect={(id: string) => { setSelectedId(id); navigate(`/whatsapp?conversation=${id}`, { replace: true }); }} 
        />

      </div>

      <div 
        className={`${isMobile && !selectedId ? 'hidden' : 'flex'} flex-1 flex-col relative z-10`}
        style={{ background: colors.chatBg }}
      >
        {!account ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" style={{ background: colors.headerBg }}>
             <div className="w-16 h-16 mb-6 text-amber-500"><AlertTriangle size={64} /></div>
             <h2 className="text-2xl font-bold mb-2">WhatsApp não configurado</h2>
             <p className="text-[14px] text-gray-500 max-w-sm mb-8">
               Você precisa configurar sua API oficial do WhatsApp para começar a enviar e receber mensagens.
             </p>
             <button 
               onClick={onOpenSettings}
               className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
             >
               Configurar API Agora
             </button>
           </div>
        ) : !selectedId ? (
          <EmptyState colors={colors} />
        ) : (
          <>
            <ChatHeader 
              colors={colors} conv={activeConv} messages={messages} theme={theme}
              onBack={isMobile ? () => setSelectedId(null) : undefined}
              onToggleInfo={() => { setShowInfo(!showInfo); setShowQuickEditor(false); }}
              onToggleQuickEditor={() => { setShowQuickEditor(v => !v); setShowInfo(true); }}
            />
            <MessageArea 
              colors={colors} messages={messages} theme={theme}
              scrollRef={scrollRef}
            />
            <ChatInput 
              colors={colors} orgId={orgId} conv={activeConv} account={account}
              isExpired={isExpired} messages={messages}
              onSent={() => { fetchMessages(); fetchConvs(); }}
              lead={activeConv?.lead}
            />
          </>
        )}
      </div>

      {showInfo && selectedId && (
        <div 
          className={`${isMobile ? 'fixed inset-0 z-50' : 'w-[280px] lg:w-[320px] border-l'} flex flex-col flex-shrink-0 relative z-30`}
          style={{ background: colors.sidebarBg, borderColor: colors.border }}
        >
          {showQuickEditor ? (
            <QuickRepliesEditor 
              colors={colors} 
              orgId={orgId} 
              onClose={() => setShowQuickEditor(false)} 
            />
          ) : (
            <LeadInfoPanel 
              colors={colors} conv={activeConv} theme={theme}
              onClose={() => setShowInfo(false)} 
              onUpdate={() => fetchConvs()}
            />
          )}
        </div>
      )}
    </>
  );
}

// ── Sub-components ──

function FilterChip({ label, active, onClick, colors }: { label: string, active: boolean, onClick: () => void, colors: any }) {
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-all font-medium border
        ${active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-transparent text-gray-500 border-gray-200 hover:border-gray-300'}`}
    >
      {label}
    </button>
  );
}

function SidebarHeader({ colors, user, onOpenSettings }: { colors: any, user: any, onOpenSettings: () => void }) {
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const initials = user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <div className="h-[52px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ background: colors.headerBg, borderColor: colors.border }}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-400 flex items-center justify-center text-white font-bold text-xs">
            {avatarUrl ? <img src={avatarUrl} alt="Me" className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white bg-green-500" />
        </div>
        <span className="font-bold text-[14px] hidden sm:inline">Floow Inbox</span>
      </div>
      <div className="flex items-center gap-1 text-gray-400">
        <button className="hover:bg-gray-200/50 p-1.5 rounded-full transition-colors"><MessageSquare size={18} /></button>
        <button onClick={onOpenSettings} className="hover:bg-gray-200/50 p-1.5 rounded-full transition-colors"><MoreVertical size={18} /></button>
      </div>
    </div>
  );
}

function SidebarSearch({ colors, value, onChange }: { colors: any, value: string, onChange: (v: string) => void }) {
  return (
    <div className="p-2 px-3">
      <div className="relative flex items-center h-[32px] rounded-lg bg-gray-100 px-3 gap-3 border border-transparent focus-within:border-blue-500 focus-within:bg-white transition-all">
        <Search size={14} className="text-gray-400" />
        <input 
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-gray-400"
          placeholder="Pesquisar conversa..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {value && <X size={12} className="text-gray-400 cursor-pointer" onClick={() => onChange('')} />}
      </div>
    </div>
  );
}

function ConversationList({ colors, list, selectedId, onSelect, theme, quickStatusId, onSetQuickStatus, onUpdateLead, orgId }: { 
  colors: any, list: WaConversation[], selectedId: string | null, onSelect: (id: string) => void, theme: string,
  quickStatusId: string | null, onSetQuickStatus: (id: string | null) => void, onUpdateLead: () => void, orgId: string
}) {
  const dark = theme === 'dark';

  const handleStatusUpdate = async (leadId: string, status: number, orgId: string) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', leadId).eq('org_id', orgId);
    if (error) toast.error('Erro ao atualizar status');
    else {
      toast.success('Status atualizado');
      onUpdateLead();
    }
    onSetQuickStatus(null);
  };

  if (list.length === 0) {
    return <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 text-sm">Nenhuma conversa encontrada.</div>;
  }
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      {list.map(c => {
        const isSelected = selectedId === c.id;
        const name = c.lead?.nome || c.contact_name || formatPhone(c.contact_phone);
        const color = avatarColor(name);
        const statusIdx = c.lead?.status;
        const isQuickOpen = quickStatusId === c.id;
        
        return (
          <div 
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all relative border-b last:border-0"
            style={{ 
              background: isSelected ? colors.selected : 'transparent',
              borderColor: colors.border
            }}
          >
            <div className="relative flex-shrink-0">
              <div 
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm"
                style={{ background: color }}
              >
                {getInitials(name)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-0.5 gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-semibold text-[14px] truncate text-gray-800 dark:text-gray-200 block">{name}</span>
                  {statusIdx !== null && statusIdx !== undefined && CRM_STATUS_COLORS[statusIdx] && (
                    <span 
                      className="flex-shrink-0 whitespace-nowrap"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 6px',
                        borderRadius: '99px',
                        fontSize: '9px',
                        fontWeight: 700,
                        background: dark ? CRM_STATUS_COLORS[statusIdx].darkBg : CRM_STATUS_COLORS[statusIdx].lightBg,
                        color: dark ? CRM_STATUS_COLORS[statusIdx].darkText : CRM_STATUS_COLORS[statusIdx].lightText,
                      }}
                    >
                      <span style={{width:'4px',height:'4px',borderRadius:'50%',background:CRM_STATUS_COLORS[statusIdx].dot}}/>
                      {CRM_STATUS_LABELS[statusIdx]}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end flex-shrink-0 relative mt-0.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`text-[9px] ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                      {waRelativeTime(c.last_message_at)}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetQuickStatus(isQuickOpen ? null : c.id);
                      }}
                      className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                    >
                      <ChevronDown size={12} className={isQuickOpen ? 'rotate-180' : ''} />
                    </button>
                  </div>

                  {isQuickOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); onSetQuickStatus(null); }} />
                      <div 
                        className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-[70] overflow-hidden dropdown-animate"
                        onClick={e => e.stopPropagation()}
                      >
                        {STATUS_SEQUENCE.map(idx => {
                          const label = CRM_STATUS_LABELS[idx];
                          return (
                            <button
                              key={idx}
                              onClick={() => c.lead_id && c.lead?.org_id && handleStatusUpdate(c.lead_id, idx, c.lead.org_id || orgId)}
                              className="w-full px-3 py-2 text-left text-[11px] hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                              disabled={!c.lead_id}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: CRM_STATUS_COLORS[idx]?.dot }} />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                <p className="text-[12.5px] text-gray-500 truncate max-w-[180px] flex-1">
                  {c.last_message || '...'}
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.unread_count && c.unread_count > 0 ? (
                    <div className="bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">
                      {c.unread_count}
                    </div>
                  ) : null}
                  {c.is_hot_lead && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="Lead Quente" />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function ChatHeader({ colors, conv, messages, onBack, onToggleInfo, onToggleQuickEditor, theme }: { 
  colors: any, conv: any, messages: WaMessage[], 
  onBack?: () => void, onToggleInfo: () => void, onToggleQuickEditor: () => void, theme: string
}) {
  const dark = theme === 'dark';
  const name = conv?.lead?.nome || conv?.contact_name || formatPhone(conv?.contact_phone || '');
  const color = avatarColor(name);
  const statusIdx = conv?.lead?.status;
  
  const lastInboundTime = messages
    .filter(m => m.direction === 'inbound')
    .map(m => new Date(m.created_at).getTime())
    .sort((a, b) => b - a)[0] || null;

  const sessionFromInbound = lastInboundTime 
    ? (Date.now() - lastInboundTime) < 24 * 60 * 60 * 1000 
    : false;

  const sessionFromDb = conv?.session_expires_at 
    ? new Date(conv.session_expires_at).getTime() > Date.now() 
    : false;

  const isExpired = !sessionFromInbound && !sessionFromDb;

  return (
    <div className="h-[52px] flex items-center px-4 gap-3 border-b flex-shrink-0 z-20 shadow-sm" style={{ background: colors.headerBg, borderColor: colors.border }}>
      {onBack && <button onClick={onBack} className="p-1 -ml-1 text-gray-500 hover:bg-gray-200 rounded-full"><ArrowLeft size={18} /></button>}
      <div 
        onClick={onToggleInfo}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold cursor-pointer shadow-sm text-sm"
        style={{ background: color }}
      >
        {getInitials(name)}
      </div>
      <div className="flex-1 cursor-pointer overflow-hidden" onClick={onToggleInfo}>
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-[14px] truncate text-gray-800 dark:text-gray-200">{name}</h3>
          {statusIdx !== null && statusIdx !== undefined && CRM_STATUS_COLORS[statusIdx] && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              borderRadius: '99px',
              fontSize: '9px',
              fontWeight: 700,
              background: dark ? CRM_STATUS_COLORS[statusIdx].darkBg : CRM_STATUS_COLORS[statusIdx].lightBg,
              color: dark ? CRM_STATUS_COLORS[statusIdx].darkText : CRM_STATUS_COLORS[statusIdx].lightText,
            }}>
              <span style={{width:'4px',height:'4px',borderRadius:'50%',background:CRM_STATUS_COLORS[statusIdx].dot}}/>
              {CRM_STATUS_LABELS[statusIdx]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <p className={`text-[10px] font-medium flex items-center gap-1 ${isExpired ? 'text-rose-500' : 'text-emerald-500'}`}>
            <span className={`w-1 h-1 rounded-full ${isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
            {isExpired ? 'Janela Fechada' : 'Janela Aberta'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-gray-400">
        <button onClick={onToggleQuickEditor} className="hover:bg-gray-200/50 p-1.5 rounded-full transition-colors">
          <MessageSquare size={18} />
        </button>
        <button className="hover:bg-gray-200/50 p-1.5 rounded-full transition-colors"><Search size={18} /></button>
        <button onClick={onToggleInfo} className="hover:bg-gray-200/50 p-1.5 rounded-full transition-colors"><Info size={20} /></button>
      </div>
    </div>
  );
}


function MessageArea({ colors, messages, conv, lead, theme, scrollRef }: { colors: any, messages: WaMessage[], conv: any, lead: any, theme: string, scrollRef: React.RefObject<HTMLDivElement> }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, scrollRef]);

  const groups = useMemo(() => {
    const r: { label: string, msgs: WaMessage[] }[] = [];
    messages.forEach(m => {
      const date = new Date(m.created_at);
      const now = new Date();
      let label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      if (date.toDateString() === now.toDateString()) label = 'HOJE';
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) label = 'ONTEM';
      
      if (r.length === 0 || r[r.length - 1].label !== label) {
        r.push({ label, msgs: [m] });
      } else {
        r[r.length - 1].msgs.push(m);
      }
    });
    return r;
  }, [messages]);

  return (
    <div 
      ref={scrollRef} 
      className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1 relative z-0"
      style={{ 
        backgroundColor: theme === 'dark' ? '#0b141a' : '#efeae2',
        backgroundImage: theme === 'dark' 
          ? 'url("https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-dark-patterns-background-designs-thumbnail.jpg")' 
          : 'url("https://i.pinimg.com/736x/8c/98/99/8c98994518b575bfd8d994e51d1a22a2.jpg")',
        backgroundSize: '400px',
        backgroundBlendMode: theme === 'dark' ? 'overlay' : 'normal',
        backgroundRepeat: 'repeat'
      }}
    >

      {groups.map(g => (
        <div key={g.label} className="flex flex-col gap-1 z-10">
          <div className="self-center my-4 px-4 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 bg-gray-200/60 backdrop-blur-sm dark:bg-gray-800/80 dark:text-gray-400">
            {g.label}
          </div>
          {g.msgs.map(m => (
            <MessageBubble key={m.id} msg={m} colors={colors} onImageClick={setLightboxSrc} />
          ))}
        </div>
      ))}

      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <button
            onClick={e => { e.stopPropagation(); setLightboxSrc(null); }}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: '50%', width: '44px', height: '44px',
              color: '#fff', fontSize: '22px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
          <img
            src={lightboxSrc}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: '12px',
              objectFit: 'contain',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function MsgStatus({ status }: { status: string | null }) {
  if (status === 'pending') return <Clock size={10} className="text-gray-400" />;
  if (status === 'failed') return <span style={{ color: '#ef4444', fontSize: '12px' }}>✗</span>;
  
  const isRead = status === 'read';
  const isDelivered = status === 'delivered' || status === 'read';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '14px' }}>
      <CheckCheck 
        size={13} 
        style={{ 
          color: isRead ? '#53bdeb' : '#9ca3af',
          position: 'absolute',
          right: 0
        }} 
      />
    </div>
  );
}

function MessageBubble({ msg, colors, onImageClick }: { msg: WaMessage, colors: any, onImageClick: (src: string) => void }) {
  const { theme } = useTheme();
  const { orgId: msgOrgId } = useOrgId();
  const isMe = msg.direction === 'outbound';
  const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  function renderMensagemConteudo(msg: WaMessage, orgId: string, isDark: boolean) {
    const src = getMediaSrc(msg, orgId);

    // IMAGEM
    if (msg.type === 'image') {
      if (!src) return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>🖼️ Imagem</span>;
      return (
        <div className="relative">
          <img
            src={src}
            alt="Imagem"
            style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: '8px', cursor: 'zoom-in', display: 'block' }}
            onClick={() => onImageClick?.(src)}
            onError={e => { 
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
              const parent = el.parentElement;
              if (parent) {
                const span = document.createElement('span');
                span.innerText = '🖼️ Imagem (Erro ao carregar)';
                span.style.color = '#9ca3af';
                span.style.fontStyle = 'italic';
                span.style.fontSize = '13px';
                parent.appendChild(span);
              }
            }}
          />
        </div>
      );
    }

    // ÁUDIO
    if (msg.type === 'audio') {
      if (!src) return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>🎵 Áudio</span>;
      return (
        <audio
          controls
          preload="metadata"
          style={{ width: '220px', height: '40px', borderRadius: '20px', display: 'block' }}
          src={src}
        />
      );
    }

    // VÍDEO
    if (msg.type === 'video') {
      if (!src) return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>🎥 Vídeo</span>;
      return (
        <video controls style={{ maxWidth: '240px', borderRadius: '8px', display: 'block' }}>
          <source src={src} />
        </video>
      );
    }

    // DOCUMENTO
    if (msg.type === 'document') {
      if (!src) return <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '13px' }}>📎 {msg.content}</span>;
      return (
        <a href={src} target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderRadius: '8px', textDecoration: 'none', color: isDark ? '#f4f4f5' : '#111',
            fontSize: '13px', fontWeight: 500 }}>
          📎 {msg.content?.replace('[Documento]', '').replace('[Documento: ', '').replace(']', '') || 'Documento'}
        </a>
      );
    }

    // STICKER
    if (msg.type === 'sticker') {
      if (!src) return <span>😊</span>;
      return <img src={src} alt="Figurinha" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />;
    }

    // CONTACTS
    if (msg.type === 'contacts') {
      const names = msg.content?.split(', ') || ['Contato'];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
          {names.map((name: string, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '10px',
              background: 'rgba(0,0,0,0.06)',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: '#25d366', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700,
                flexShrink: 0,
              }}>
                {name[0]?.toUpperCase() || '?'}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{name}</span>
            </div>
          ))}
        </div>
      );
    }

    // REACTION
    if (msg.type === 'reaction') {
      return (
        <div style={{ fontSize: '24px', lineHeight: 1, padding: '4px 0' }}>
          {msg.content || '❤️'}
        </div>
      );
    }

    // TEXTO padrão
    return (
      <span
        style={{ fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: formatWAText(msg.content || '') }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', marginBottom: '4px', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '70%', 
        padding: msg.type === 'sticker' || msg.type === 'reaction' ? '4px' : '6px 10px',
        borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px',
        background: msg.type === 'sticker' || msg.type === 'reaction' ? 'transparent' : (isMe ? (theme === 'dark' ? '#005c4b' : '#dcf8c6') : (theme === 'dark' ? '#1e1e22' : '#f0f0f0')),
        boxShadow: msg.type === 'sticker' || msg.type === 'reaction' ? 'none' : '0 1px 0.5px rgba(0,0,0,0.13)',
        border: 'none',
        position: 'relative',
        color: isMe ? (theme === 'dark' ? '#e9edef' : '#111') : (theme === 'dark' ? '#f4f4f5' : '#111')
      }}>
        {renderMensagemConteudo(msg, msgOrgId || '', theme === 'dark')}
        {msg.type !== 'sticker' && msg.type !== 'reaction' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            gap: '3px', 
            marginTop: '2px',
            marginLeft: '20px'
          }}>
            <span style={{ 
              fontSize: '10px', 
              color: isMe ? (theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)') : 'rgba(0,0,0,0.45)',
              fontWeight: 500 
            }}>{time}</span>
            {isMe && <MsgStatus status={msg.status} />}
          </div>
        )}
      </div>
    </div>
  );
}

function substituirVariaveis(texto: string, conversa: any): string {
  if (!conversa) return texto;
  const nome = conversa.contact_name || conversa.contact_phone || '';
  const primeiroNome = nome.split(' ')[0];
  
  return texto
    .replace(/\{\{nome\}\}/gi, primeiroNome)
    .replace(/\{\{nome_completo\}\}/gi, nome)
    .replace(/\{\{telefone\}\}/gi, conversa.contact_phone || '')
    .replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'));
}

function ChatInput({ colors, orgId, conv, account, isExpired, messages, onSent, lead }: { 
  colors: any, orgId: string, conv: any, account: WaAccount, isExpired: boolean, messages: WaMessage[], onSent: () => void, lead: Lead | null
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [quickReplies, setQuickReplies] = useState(() => {
    try {
      const saved = localStorage.getItem(`quick_replies_${orgId}`);
      return saved ? JSON.parse(saved) : DEFAULT_QUICK_REPLIES;
    } catch { return DEFAULT_QUICK_REPLIES; }
  });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');

  // Detecta "/" no início da mensagem
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    
    if (val === '/' || val.startsWith('/')) {
      setShowQuickReplies(true);
      setQuickFilter(val.slice(1).toLowerCase());
    } else {
      setShowQuickReplies(false);
      setQuickFilter('');
    }
  };

  // Substitui {{nome}} pelo nome do lead
  function applyTemplate(texto: string): string {
    const nomeDoLead = lead?.nome?.trim().split(' ')[0] || conv?.contact_name?.trim().split(' ')[0] || '';
    return texto.replace(/\{\{nome\}\}/g, nomeDoLead);
  }

  // Filtra as mensagens prontas
  const filteredReplies = quickReplies.filter((r: any) =>
    !quickFilter || r.titulo.toLowerCase().includes(quickFilter) || r.texto.toLowerCase().includes(quickFilter)
  );

  const handleSend = async () => {
    if (!text.trim() || sending || isExpired || !conv) return;
    setSending(true);
    
    // Substitui variáveis antes de enviar
    const textoFinal = substituirVariaveis(text.trim(), conv);
    
    const msg = textoFinal;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      // Busca token e phone_number_id da conta
      const { data: acc } = await supabase
        .from('whatsapp_accounts')
        .select('token, phone_number_id')
        .eq('org_id', orgId)
        .single();

      if (!acc) throw new Error('Conta não encontrada');

      const res = await fetch(
        `https://graph.facebook.com/v18.0/${acc.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${acc.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: conv.contact_phone,
            type: 'text',
            text: { body: msg },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Falha no envio');
      }

      const json = await res.json();
      const wamid = json?.messages?.[0]?.id || null;
      const now = new Date().toISOString();

      // Salva no banco
      await supabase
        .from('whatsapp_messages')
        .insert({
          org_id: orgId,
          conversation_id: conv.id,
          wamid,
          direction: 'outbound',
          type: 'text',
          content: msg,
          status: 'sent',
          created_at: now,
        });

      // Atualiza conversa
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message: msg, last_message_at: now })
        .eq('id', conv.id);

      onSent();
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  const handleOpenWA = () => {
    const phone = conv?.contact_phone?.replace(/\D/g, '') || '';
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div className="min-h-[52px] flex flex-col flex-shrink-0 z-20 border-t relative" style={{ background: colors.inputAreaBg, borderColor: colors.border }}>
      {showQuickReplies && filteredReplies.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: colors.sidebarBg || '#fff',
          border: `1px solid ${colors.border}`,
          borderRadius: '12px 12px 0 0',
          maxHeight: '280px', overflowY: 'auto',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          zIndex: 100,
        }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}`, fontSize: '11px', color: colors.textSecondary, fontWeight: 600 }}>
            RESPOSTAS RÁPIDAS
          </div>
          {filteredReplies.map((r: any) => (
            <div
              key={r.id}
              onClick={() => {
                setText(applyTemplate(r.texto));
                setShowQuickReplies(false);
                setQuickFilter('');
                textareaRef.current?.focus();
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                  }
                }, 10);
              }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = colors.hover || '#f5f5f5'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary, marginBottom: '2px' }}>
                /{r.titulo}
              </div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.texto.slice(0, 60)}...
              </div>
            </div>
          ))}
        </div>
      )}
      {isExpired && (
        <div className="bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800 flex items-center justify-between border-b border-amber-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" /> 
            <span className="font-semibold">Janela de 24h expirada.</span>
            <span className="hidden sm:inline opacity-70">Envie um modelo ou aguarde o contato.</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowTemplates(true)}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Zap size={13} fill="white" /> Enviar Modelo
            </button>
            <button 
              onClick={handleOpenWA}
              className="bg-white text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-50 transition-colors"
            >
              Abrir WhatsApp Externo
            </button>
          </div>
        </div>
      )}

      {showTemplates && (
        <TemplateModal 
          acc={account} 
          conv={conv} 
          onClose={() => setShowTemplates(false)} 
          onSent={() => { onSent(); }} 
        />
      )}
      <div className="flex items-end gap-2 px-3 py-2">
        <div className="flex items-center gap-1 pb-1 text-gray-500">
          <button className="p-1.5 hover:text-gray-700 transition-colors"><Smile size={22} /></button>
          <button className="p-1.5 hover:text-gray-700 transition-colors"><Paperclip size={22} /></button>
        </div>
        <div className="flex-1">
          <textarea 
            ref={textareaRef}
            rows={1}
            disabled={isExpired}
            placeholder={isExpired ? "Conversa bloqueada" : "Digite uma mensagem"}
            className="w-full bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2 text-[14px] outline-none border-none resize-none no-scrollbar shadow-sm transition-all focus:ring-1 focus:ring-blue-500/20"
            style={{ 
              background: colors.inputBg, 
              maxHeight: '120px', 
              color: colors.textPrimary,
              cursor: isExpired ? 'not-allowed' : 'text'
            }}
            value={text}
            onChange={handleTextareaChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
        </div>
        <div className="pb-1">
          <button 
            onClick={handleSend}
            disabled={!text.trim() || sending || isExpired}
            className={`p-2.5 rounded-full transition-all shadow-md ${text.trim() && !isExpired ? 'bg-blue-600 text-white scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}


function EmptyState({ colors }: { colors: any }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center" style={{ background: colors.headerBg }}>
      <div className="w-16 h-16 mb-6 opacity-10"><Zap size={64} /></div>
      <h2 className="text-2xl font-light mb-2 text-gray-700">Floow Inbox</h2>
      <p className="text-[14px] text-gray-400 max-w-sm leading-relaxed mb-10">
        Gerencie seus leads e responda mensagens em tempo real com a inteligência do CRM integrada ao seu WhatsApp.
      </p>
      <div className="flex items-center gap-4 text-[12px] text-gray-400">
        <div className="flex items-center gap-1.5"><Shield size={14} /> Seguro</div>
        <div className="w-1 h-1 rounded-full bg-gray-300" />
        <div className="flex items-center gap-1.5"><Check size={14} /> Oficial Meta</div>
      </div>
    </div>
  );
}

function LeadInfoPanel({ colors, conv, onClose, onUpdate, theme }: { colors: any, conv: any, onClose: () => void, onUpdate: () => void, theme: string }) {
  const navigate = useNavigate();
  const [lead, setLead] = useState(conv?.lead);
  const name = lead?.nome || conv?.contact_name || formatPhone(conv?.contact_phone || '');
  const color = avatarColor(name);
  const [updating, setUpdating] = useState(false);
  const [statusDropOpen, setStatusDropOpen] = useState(false);

  useEffect(() => {
    setLead(conv?.lead);
  }, [conv]);

  const STATUS_OPTIONS_PANEL = [
    { value: 1, label: 'Em atendimento', dot: '#3b82f6' },
    { value: 2, label: 'Reunião', dot: '#8b5cf6' },
    { value: 5, label: 'Contrato/App', dot: '#f59e0b' },
    { value: 3, label: 'Aprovado', dot: '#10b981' },
    { value: 4, label: 'Reprovado', dot: '#ef4444' },
  ];

  const currentStatus = STATUS_OPTIONS_PANEL.find(s => s.value === (lead?.status ?? 1));

  const handleNotesUpdate = async (val: string) => {
    if (!conv?.id) return;
    const { error } = await supabase.from('whatsapp_conversations').update({ internal_notes: val }).eq('id', conv.id);
    if (error) toast.error('Erro ao salvar notas');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-[52px] flex items-center px-4 gap-4 border-b flex-shrink-0" style={{ background: colors.headerBg, borderColor: colors.border }}>
        <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 p-1 rounded-full"><X size={18} /></button>
        <span className="font-bold text-[10px] uppercase tracking-widest text-gray-400">Dados da Lead</span>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="flex flex-col items-center p-6 bg-white border-b" style={{ background: colors.sidebarBg, borderColor: colors.border }}>
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-3 ring-4 ring-offset-2 ring-gray-50"
            style={{ background: color }}
          >
            {getInitials(name)}
          </div>
          <h2 className="text-[16px] font-bold text-center mb-0.5 flex items-center gap-1.5">
            {name}
            {lead?.faixa && (
              <div className={`w-2 h-2 rounded-full ${lead.faixa === 'verde' ? 'bg-emerald-500' : lead.faixa === 'amarelo' ? 'bg-amber-500' : 'bg-rose-500'}`} />
            )}
          </h2>
          <p className="text-gray-400 text-xs font-medium mb-4">{formatPhone(conv?.contact_phone || '')}</p>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {lead && (
              <button 
                onClick={() => navigate(`/leads?search=${lead.id}`)}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold hover:bg-blue-100 transition-colors"
              >
                <ExternalLink size={13} /> Abrir Lead
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-5 flex flex-col gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Painel do Funil</h4>
              {updating && <Loader2 size={11} className="animate-spin text-blue-500" />}
            </div>
            
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStatusDropOpen(v => !v)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: currentStatus?.dot || '#3b82f6', flexShrink: 0,
                  }} />
                  {currentStatus?.label || 'Em atendimento'}
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {statusDropOpen && (
                <>
                  <div
                    onClick={() => setStatusDropOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '10px', padding: '4px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}>
                    {STATUS_OPTIONS_PANEL.map(opt => (
                      <button
                        key={opt.value}
                        onClick={async () => {
                          setStatusDropOpen(false);
                          if (!lead) return;
                          setUpdating(true);
                          const { error } = await supabase
                            .from('leads')
                            .update({
                              status: opt.value,
                              ultimo_status_change: new Date().toISOString(),
                            })
                            .eq('id', lead.id);
                          if (error) toast.error('Erro ao atualizar status');
                          else {
                            toast.success('Status atualizado!');
                            setLead(prev => prev ? { ...prev, status: opt.value } : prev);
                            onUpdate();
                          }
                          setUpdating(false);
                        }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          borderRadius: '8px', border: 'none', cursor: 'pointer',
                          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                          background: (lead?.status ?? 1) === opt.value ? '#eff6ff' : 'transparent',
                          color: (lead?.status ?? 1) === opt.value ? '#2563eb' : '#374151',
                        }}
                      >
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: opt.dot, flexShrink: 0,
                        }} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Métricas</h4>
            <div className="grid grid-cols-2 gap-2">
              <MetricBox icon={<Shield size={12} />} label="Score" value={lead?.score ? `${lead.score} pts` : '—'} color="text-emerald-600" />
              <MetricBox icon={<MessageCircle size={12} />} label="Msgs" value={lead?.messages_count || 0} color="text-blue-600" />
              <MetricBox icon={<MapPin size={12} />} label="Cidade" value={lead?.cidade || '—'} color="text-violet-600" />
              <MetricBox icon={<Megaphone size={12} />} label="Origem" value={lead?.utm_source || 'Indireto'} color="text-amber-600" />
            </div>
          </section>

          {lead?.quiz_respostas && (
             <section>
                <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Quiz</h4>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <QuizAnswers data={lead.quiz_respostas} colors={colors} />
                </div>
             </section>
          )}

          <section>
            <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Notas Internas</h4>
            <textarea 
              key={conv?.id}
              defaultValue={conv?.internal_notes || ''}
              onBlur={(e) => handleNotesUpdate(e.target.value)}
              placeholder="Notas sobre este lead..."
              className="w-full min-h-[80px] p-2.5 rounded-xl border border-gray-100 text-[12.5px] bg-gray-50 resize-none outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  return (
    <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 flex flex-col gap-0.5">
      <div className={`flex items-center gap-1 ${color} mb-0.5 opacity-80`}>
        {icon}
        <span className="text-[8px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[12px] font-bold text-gray-700 truncate">{value}</div>
    </div>
  );
}

function QuizAnswers({ data, colors }: { data: any, colors: any }) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const filteredEntries = Object.entries(parsed).filter(([key]) => QUIZ_LABELS[key]);
  
  return (
    <div className="flex flex-col gap-2.5">
      {filteredEntries.map(([key, val]) => (
        <div key={key} className="flex flex-col border-b border-gray-200/50 last:border-0 pb-1.5 mb-0.5">
          <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">{QUIZ_LABELS[key]}</span>
          <span className="text-[12px] font-medium text-gray-700">{String(val)}</span>
        </div>
      ))}
    </div>
  );
}

function QuickRepliesEditor({ colors, orgId, onClose }: any) {
  const [replies, setReplies] = useState(() => {
    try {
      const saved = localStorage.getItem(`quick_replies_${orgId}`);
      return saved ? JSON.parse(saved) : DEFAULT_QUICK_REPLIES;
    } catch { return DEFAULT_QUICK_REPLIES; }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitulo, setNewTitulo] = useState('');
  const [newTexto, setNewTexto] = useState('');

  function save(updated: any[]) {
    setReplies(updated);
    localStorage.setItem(`quick_replies_${orgId}`, JSON.stringify(updated));
  }

  function handleAdd() {
    if (!newTitulo.trim() || !newTexto.trim()) return;
    const novo = { id: Date.now().toString(), titulo: newTitulo.trim(), texto: newTexto.trim() };
    save([...replies, novo]);
    setNewTitulo('');
    setNewTexto('');
  }

  function handleDelete(id: string) {
    save(replies.filter((r: any) => r.id !== id));
  }

  function handleEdit(r: any) {
    setEditingId(r.id);
    setNewTitulo(r.titulo);
    setNewTexto(r.texto);
  }

  function handleSaveEdit() {
    save(replies.map((r: any) => r.id === editingId ? { ...r, titulo: newTitulo, texto: newTexto } : r));
    setEditingId(null);
    setNewTitulo('');
    setNewTexto('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: colors.textPrimary }}>Respostas Rápidas</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {replies.map((r: any) => (
          <div key={r.id} style={{ marginBottom: '8px', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: colors.sidebarBg }}>
            {editingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input value={newTitulo} onChange={e => setNewTitulo(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: 'transparent', color: colors.textPrimary }} />
                <textarea value={newTexto} onChange={e => setNewTexto(e.target.value)} rows={4}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', background: 'transparent', color: colors.textPrimary }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSaveEdit} style={{ flex: 1, padding: '6px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Salvar</button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '6px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textSecondary, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: colors.textPrimary }}>/{r.titulo}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, fontSize: '11px' }}>Editar</button>
                    <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '11px' }}>Remover</button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.texto}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Adicionar nova */}
      <div style={{ padding: '12px', borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nova resposta rápida</p>
        <input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} placeholder="Título (ex: link reunião)"
          style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: 'transparent', color: colors.textPrimary }} />
        <textarea value={newTexto} onChange={e => setNewTexto(e.target.value)} placeholder="Texto da mensagem..." rows={3}
          style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'none', background: 'transparent', color: colors.textPrimary }} />
        <button onClick={handleAdd} disabled={!newTitulo.trim() || !newTexto.trim()}
          style={{ padding: '8px', borderRadius: '8px', border: 'none', background: newTitulo.trim() && newTexto.trim() ? '#2563eb' : '#e5e7eb', color: newTitulo.trim() && newTexto.trim() ? '#fff' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Adicionar
        </button>
      </div>
    </div>
  );
}


// ── Config View ──
export function ConfigView({ colors, orgId, account, onSaved, onCancel }: { colors: any, orgId: string, account: WaAccount | null, onSaved: (acc: WaAccount) => void, onCancel?: () => void }) {
  const [formData, setFormData] = useState({
    phone_number_id: account?.phone_number_id || '',
    business_account_id: account?.business_account_id || '',
    token: account?.token || '',
    webhook_verify_token: account?.webhook_verify_token || 'floow_verify_token',
    display_name: account?.display_name || ''
  });
  const [saving, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .upsert({
        org_id: orgId,
        ...formData,
        status: 'active'
      })
      .select()
      .single();

    if (error) toast.error('Erro ao salvar configuração');
    else { toast.success('Configuração salva!'); onSaved(data as WaAccount); }
    setSending(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{ background: colors.sidebarBg }}>
        <div className="p-8 border-b" style={{ borderColor: colors.border }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Settings size={32} /></div>
            <div>
              <h1 className="text-2xl font-bold">Configuração WhatsApp Cloud API</h1>
              <p className="text-gray-500 text-sm">Integre sua conta oficial da Meta para disparar mensagens.</p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">ID do Número de Telefone</label>
              <input 
                required className="p-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-gray-50"
                value={formData.phone_number_id} onChange={e => setFormData({...formData, phone_number_id: e.target.value})}
                placeholder="Ex: 123456789012345"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">ID da Conta de Negócio</label>
              <input 
                required className="p-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-gray-50"
                value={formData.business_account_id} onChange={e => setFormData({...formData, business_account_id: e.target.value})}
                placeholder="Ex: 987654321098765"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Token de Acesso Permanente</label>
            <input 
              required className="p-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-gray-50"
              value={formData.token} onChange={e => setFormData({...formData, token: e.target.value})}
              placeholder="EAAG..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Verify Token (Webhook)</label>
            <input 
              required className="p-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all bg-gray-50"
              value={formData.webhook_verify_token} onChange={e => setFormData({...formData, webhook_verify_token: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" onClick={onCancel}
              className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Configuração'}
            </button>
          </div>
        </form>
        
        <div className="p-6 bg-gray-50 text-[11px] text-gray-400 flex flex-col gap-1 border-t">
          <p>● Certifique-se de configurar a URL de Callback no Painel da Meta:</p>
          <code className="bg-white p-1 rounded border block truncate">{WEBHOOK_URL}</code>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ acc, conv, onClose, onSent }: { acc: WaAccount, conv: any, onClose: () => void, onSent: () => void }) {
  const [loading, setLoading] = useState(false);
  
  const templates = [
    {
      id: 'abordagem_inicial',
      name: 'abordagem_inicial',
      label: 'Abordagem Inicial (Aprovada)',
      body: "Oi {{1}}!\n\nSeu perfil foi pré-aprovado! 🎉\n\nFico feliz em te dar as boas-vindas e explicar os próximos passos.\n\nPode falar comigo aqui? 😊"
    }
  ];

  const handleSend = async (temp: any) => {
    setLoading(true);
    try {
      const fullPhone = conv.contact_phone;
      const leadName = conv.lead?.nome || conv.contact_name || 'Amiga';

      const payload = {
        messaging_product: "whatsapp",
        to: fullPhone,
        type: "template",
        template: {
          name: temp.name,
          language: { code: "pt_BR" },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: leadName }]
          }]
        }
      };

      const res = await fetch(`https://graph.facebook.com/v18.0/${acc.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${acc.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Erro na API');

      // Registrar no Supabase
      const { error: msgErr } = await supabase.from('whatsapp_messages').insert({
        org_id: acc.org_id,
        conversation_id: conv.id,
        wamid: data.messages?.[0]?.id,
        direction: 'outbound',
        type: 'template',
        content: temp.body.replace('{{1}}', leadName),
        status: 'sent',
        raw_payload: data
      });

      if (msgErr) throw msgErr;

      await supabase.from('whatsapp_conversations').update({
        last_message: temp.body.replace('{{1}}', leadName),
        last_message_at: new Date().toISOString()
      }).eq('id', conv.id);

      toast.success('Modelo enviado com sucesso!');
      onSent();
      onClose();
    } catch (err: any) {
      toast.error('Erro ao enviar modelo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-bold">Enviar Modelo</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-500 mb-2">Selecione um modelo aprovado para reativar a conversa.</p>
          
          {templates.map(t => (
            <button 
              key={t.id}
              disabled={loading}
              onClick={() => handleSend(t)}
              className="group p-4 border rounded-2xl text-left hover:border-blue-500 hover:bg-blue-50/30 transition-all flex flex-col gap-2 relative"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-blue-600 uppercase tracking-wider">{t.label}</span>
                <Send size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                {t.body.replace('{{1}}', conv.lead?.nome || conv.contact_name || '...') }
              </p>
            </button>
          ))}

          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10 rounded-3xl">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}
        </div>
        
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
