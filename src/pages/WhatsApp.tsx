import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { toast } from 'sonner';
import {
  Settings, Save, Copy, Check, CheckCheck, Wifi, WifiOff,
  Search, Send, User, ExternalLink, RefreshCw, Link2, UserPlus,
  MessageCircle, ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PROJECT_ID = 'menowlaymlzehcpdbgks';
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`;

// ── Types ──────────────────────────────────────────────────────────────────────
interface WaAccount {
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
  lead_id: any;
  created_at: string;
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

interface LeadInfo {
  id: any;
  nome: string | null;
  cidade: string | null;
  score: number | null;
  faixa: string | null;
  status?: number | null;
  whatsapp: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#dc2626', '#d97706', '#059669', '#db2777', '#0891b2', '#ea580c'];

function avatarColor(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null) {
  if (!iso) return '';
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function groupByDate(messages: WaMessage[]) {
  const groups: { label: string; msgs: WaMessage[] }[] = [];
  let lastLabel = '';
  for (const m of messages) {
    const label = dateLabel(m.created_at);
    if (label !== lastLabel) {
      groups.push({ label, msgs: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].msgs.push(m);
  }
  return groups;
}

// ── Status icons ──────────────────────────────────────────────────────────────
function MsgStatus({ status }: { status: string | null }) {
  if (status === 'read') return <CheckCheck size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />;
  if (status === 'delivered') return <CheckCheck size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />;
  if (status === 'sent') return <Check size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />;
  return null;
}

// ── Copy button helper ─────────────────────────────────────────────────────────
function CopyBtn({ value, dark }: { value: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copiar"
      style={{
        padding: '4px 8px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
        background: copied ? '#10b981' : (dark ? '#18181b' : '#f8fafc'),
        color: copied ? '#fff' : (dark ? '#a1a1aa' : '#6b7280'),
        fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function WhatsAppPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();
  const navigate = useNavigate();

  const [view, setView] = useState<'config' | 'chat'>('chat');
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  // ── Load account ──
  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase
      .from('whatsapp_accounts' as any)
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data }: any) => {
        setAccount(data || null);
        setView(data ? 'chat' : 'config');
        setAccountLoading(false);
      });
  }, [orgId, orgReady]);

  // ── Styles ──
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const border = dark ? '#1e1e22' : 'rgba(0,0,0,0.08)';
  const cardBg = dark ? '#111113' : '#ffffff';
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '10px',
    border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: txt, fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: txtMid,
    textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px',
  };

  if (accountLoading) {
    return (
      <AppLayout leadCount={leads.length}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${dark ? '#27272a' : '#e5e7eb'}`, borderTopColor: '#2563eb', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout leadCount={leads.length}>
      {view === 'config' ? (
        <ConfigView
          dark={dark} txt={txt} txtMid={txtMid} border={border} cardBg={cardBg}
          inputStyle={inputStyle} labelStyle={labelStyle}
          orgId={orgId!} account={account}
          onSaved={(acc) => { setAccount(acc); }}
          onGoChat={() => setView('chat')}
          hasAccount={!!account}
        />
      ) : (
        <ChatView
          dark={dark} txt={txt} txtMid={txtMid} border={border}
          orgId={orgId!} account={account!}
          onSettings={() => setView('config')}
          navigate={navigate}
        />
      )}
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ConfigView({
  dark, txt, txtMid, border, cardBg, inputStyle, labelStyle,
  orgId, account, onSaved, onGoChat, hasAccount,
}: {
  dark: boolean; txt: string; txtMid: string; border: string; cardBg: string;
  inputStyle: React.CSSProperties; labelStyle: React.CSSProperties;
  orgId: string; account: WaAccount | null;
  onSaved: (acc: WaAccount) => void;
  onGoChat: () => void;
  hasAccount: boolean;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(account?.phone_number_id || '');
  const [businessAccountId, setBusinessAccountId] = useState(account?.business_account_id || '');
  const [token, setToken] = useState(account?.token || '');
  const [displayName, setDisplayName] = useState(account?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [savedAccount, setSavedAccount] = useState<WaAccount | null>(account);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const card: React.CSSProperties = {
    background: cardBg, border: `1px solid ${border}`, borderRadius: '18px',
    overflow: 'hidden', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
  };
  const cardHeader: React.CSSProperties = {
    padding: '14px 20px', borderBottom: `1px solid ${border}`,
    display: 'flex', alignItems: 'center', gap: '8px',
    background: dark ? '#18181b' : '#fafafa',
  };

  const handleSave = async () => {
    if (!phoneNumberId.trim() || !token.trim() || !businessAccountId.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    const verifyToken = account?.webhook_verify_token || crypto.randomUUID();
    const payload = {
      org_id: orgId,
      phone_number_id: phoneNumberId.trim(),
      business_account_id: businessAccountId.trim(),
      token: token.trim(),
      display_name: displayName.trim() || null,
      webhook_verify_token: verifyToken,
      status: 'active',
    };
    const { data, error } = await (supabase as any)
      .from('whatsapp_accounts')
      .upsert(payload, { onConflict: 'org_id' })
      .select()
      .single();

    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Conta salva com sucesso!');
    setSavedAccount(data as WaAccount);
    onSaved(data as WaAccount);
  };

  const handleTest = async () => {
    const acc = savedAccount || account;
    if (!acc) return;
    setTesting(true);
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${acc.phone_number_id}?access_token=${acc.token}`
      );
      if (res.ok) {
        toast.success('Conexão funcionando!');
        await (supabase as any).from('whatsapp_accounts').update({ status: 'active' }).eq('id', acc.id);
        setSavedAccount(prev => prev ? { ...prev, status: 'active' } : prev);
      } else {
        const err = await res.json();
        toast.error('Erro: ' + (err?.error?.message || res.statusText));
        await (supabase as any).from('whatsapp_accounts').update({ status: 'error' }).eq('id', acc.id);
        setSavedAccount(prev => prev ? { ...prev, status: 'error' } : prev);
      }
    } catch {
      toast.error('Falha na conexão com a Graph API');
    }
    setTesting(false);
  };

  const handleDisconnect = async () => {
    const acc = savedAccount || account;
    if (!acc) return;
    if (!confirm('Desconectar esta conta do WhatsApp?')) return;
    setDisconnecting(true);
    await (supabase as any).from('whatsapp_accounts').delete().eq('id', acc.id);
    setDisconnecting(false);
    setSavedAccount(null);
    onSaved(null as any);
    toast.success('Conta desconectada');
  };

  const displayAcc = savedAccount || account;

  return (
    <div style={{ padding: '32px', maxWidth: '760px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {hasAccount && (
          <button
            onClick={onGoChat}
            style={{ padding: '7px', borderRadius: '9px', border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: txtMid }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>
            WhatsApp Oficial
          </h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>
            Conecte via WhatsApp Cloud API (Meta)
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Conectar card */}
        <div style={card}>
          <div style={cardHeader}>
            <MessageCircle size={16} style={{ color: '#25D366' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Conectar WhatsApp Oficial</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <a
              href="https://developers.facebook.com/apps"
              target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(37,211,102,0.08)' : '#f0fdf4', border: `1px solid ${dark ? 'rgba(37,211,102,0.2)' : '#bbf7d0'}`, textDecoration: 'none' }}
            >
              <ExternalLink size={13} style={{ color: '#25D366', flexShrink: 0 }} />
              <span style={{ fontSize: '12.5px', color: dark ? '#86efac' : '#065f46' }}>
                Encontre seus dados em <strong>Meta for Developers → seu app → WhatsApp → API Setup</strong>
              </span>
            </a>

            <div>
              <label style={labelStyle}>Phone Number ID *</label>
              <input style={inputStyle} value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="Ex: 123456789012345" />
            </div>

            <div>
              <label style={labelStyle}>Business Account ID *</label>
              <input style={inputStyle} value={businessAccountId} onChange={e => setBusinessAccountId(e.target.value)} placeholder="Ex: 987654321098765" />
            </div>

            <div>
              <label style={labelStyle}>Token de acesso permanente *</label>
              <input style={inputStyle} type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} placeholder="EAABsbCS..." />
            </div>

            <div>
              <label style={labelStyle}>Nome de exibição</label>
              <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ex: Suporte FLOOW" />
            </div>

            <button
              onClick={handleSave} disabled={saving}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#25D366', color: saving ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.15s' }}
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar e conectar'}
            </button>
          </div>
        </div>

        {/* Webhook info — só aparece após salvar */}
        {displayAcc && (
          <div style={card}>
            <div style={cardHeader}>
              <Settings size={16} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Configure na Meta</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                Em seu app Meta, vá em <strong>WhatsApp → Configuration → Webhook</strong> e configure:
              </p>

              <div>
                <label style={labelStyle}>URL do Webhook</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: dark ? '#0d0d0f' : '#f3f4f6', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, fontSize: '12px', color: dark ? '#a1a1aa' : '#374151', wordBreak: 'break-all' }}>
                    {WEBHOOK_URL}
                  </code>
                  <CopyBtn value={WEBHOOK_URL} dark={dark} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Verify Token</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: dark ? '#0d0d0f' : '#f3f4f6', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, fontSize: '12px', color: dark ? '#a1a1aa' : '#374151', wordBreak: 'break-all' }}>
                    {displayAcc.webhook_verify_token}
                  </code>
                  <CopyBtn value={displayAcc.webhook_verify_token} dark={dark} />
                </div>
              </div>

              <p style={{ fontSize: '12px', color: dark ? '#71717a' : '#9ca3af', margin: 0 }}>
                Após salvar o webhook, marque o campo <strong>messages</strong> em "Webhook fields".
              </p>
            </div>
          </div>
        )}

        {/* Status card */}
        {displayAcc && (
          <div style={card}>
            <div style={cardHeader}>
              {displayAcc.status === 'active'
                ? <Wifi size={16} style={{ color: '#10b981' }} />
                : <WifiOff size={16} style={{ color: '#ef4444' }} />}
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Status da conexão</span>
              <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', background: displayAcc.status === 'active' ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (dark ? 'rgba(239,68,68,0.12)' : '#fee2e2'), color: displayAcc.status === 'active' ? '#10b981' : '#ef4444' }}>
                {displayAcc.status === 'active' ? 'Conectado' : displayAcc.status === 'error' ? 'Erro' : 'Desconhecido'}
              </span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={handleTest} disabled={testing}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txt, fontSize: '13px', fontWeight: 500, cursor: testing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                <RefreshCw size={13} style={{ animation: testing ? 'spin 0.7s linear infinite' : 'none' }} />
                {testing ? 'Testando...' : 'Testar conexão'}
              </button>
              <button
                onClick={handleDisconnect} disabled={disconnecting}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid rgba(239,68,68,0.3)', background: dark ? 'rgba(239,68,68,0.08)' : '#fff5f5', color: '#ef4444', fontSize: '13px', fontWeight: 500, cursor: disconnecting ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                <WifiOff size={13} />
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
            {displayAcc.status === 'active' && (
              <div style={{ padding: '0 20px 16px' }}>
                <button
                  onClick={onGoChat}
                  style={{ width: '100%', padding: '9px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
                >
                  <MessageCircle size={14} />
                  Ir para o chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ChatView({
  dark, txt, txtMid, border, orgId, account, onSettings, navigate,
}: {
  dark: boolean; txt: string; txtMid: string; border: string;
  orgId: string; account: WaAccount;
  onSettings: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [leadSearch, setLeadSearch] = useState<LeadInfo | null>(null);
  const [linking, setLinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sideBg = dark ? '#0f0f11' : '#ffffff';
  const chatBg = dark ? '#090909' : '#f0f2f5';
  const infoBg = dark ? '#111113' : '#ffffff';

  // ── Load conversations ──
  const loadConversations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('*')
      .eq('org_id', orgId)
      .order('last_message_at', { ascending: false });
    setConversations((data as WaConversation[]) || []);
  }, [orgId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Realtime: conversations ──
  useEffect(() => {
    const ch = supabase
      .channel('wa-convs-' + orgId)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'whatsapp_conversations',
        filter: `org_id=eq.${orgId}`,
      }, () => { loadConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, loadConversations]);

  // ── Load messages when conversation changes ──
  useEffect(() => {
    if (!selectedConv) { setMessages([]); return; }
    (supabase as any)
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', selectedConv.id)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => setMessages((data as WaMessage[]) || []));

    // Reset unread
    if ((selectedConv.unread_count ?? 0) > 0) {
      (supabase as any)
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConv.id)
        .then(() => {
          setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, unread_count: 0 } : c));
          setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : prev);
        });
    }
  }, [selectedConv?.id]);

  // ── Realtime: messages ──
  useEffect(() => {
    if (!selectedConv) return;
    const ch = supabase
      .channel('wa-msgs-' + selectedConv.id)
      .on('postgres_changes' as any, {
        event: '*', schema: 'public', table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selectedConv.id}`,
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new as WaMessage]);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedConv?.id]);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load lead info ──
  useEffect(() => {
    setLead(null);
    setLeadSearch(null);
    if (!selectedConv) return;

    if (selectedConv.lead_id) {
      (supabase as any)
        .from('leads')
        .select('id, nome, cidade, score, faixa, status, whatsapp')
        .eq('id', selectedConv.lead_id)
        .single()
        .then(({ data }: any) => setLead(data as LeadInfo));
    } else {
      // Busca por telefone
      const digits = selectedConv.contact_phone.slice(-9);
      (supabase as any)
        .from('leads')
        .select('id, nome, cidade, score, faixa, status, whatsapp')
        .ilike('whatsapp', `%${digits}`)
        .limit(1)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setLeadSearch(data as LeadInfo);
            // Auto-link
            (supabase as any)
              .from('whatsapp_conversations')
              .update({ lead_id: data.id })
              .eq('id', selectedConv.id)
              .then(() => {
                setSelectedConv(prev => prev ? { ...prev, lead_id: data.id } : prev);
                setLead(data as LeadInfo);
                setLeadSearch(null);
              });
          }
        });
    }
  }, [selectedConv?.id, selectedConv?.lead_id]);

  // ── Textarea auto-resize ──
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ── Send message ──
  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !selectedConv || sending) return;
    setSending(true);
    setMessageText('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${account.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${account.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: selectedConv.contact_phone,
            type: 'text',
            text: { body: text },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const wamid = json?.messages?.[0]?.id || null;
        const now = new Date().toISOString();

        const { data: newMsg } = await (supabase as any)
          .from('whatsapp_messages')
          .insert({
            org_id: orgId,
            conversation_id: selectedConv.id,
            wamid,
            direction: 'outbound',
            type: 'text',
            content: text,
            status: 'sent',
            created_at: now,
          })
          .select()
          .single();

        if (newMsg) setMessages(prev => [...prev, newMsg as WaMessage]);

        await (supabase as any)
          .from('whatsapp_conversations')
          .update({ last_message: text, last_message_at: now })
          .eq('id', selectedConv.id);

        setConversations(prev =>
          prev.map(c => c.id === selectedConv.id ? { ...c, last_message: text, last_message_at: now } : c)
            .sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
        );
      } else {
        const err = await res.json();
        toast.error('Erro ao enviar: ' + (err?.error?.message || 'Falha na API'));
        setMessageText(text); // restore
      }
    } catch {
      toast.error('Erro de rede ao enviar mensagem');
      setMessageText(text);
    }
    setSending(false);
  };

  const handleLinkLead = async () => {
    if (!leadSearch || !selectedConv) return;
    setLinking(true);
    await (supabase as any)
      .from('whatsapp_conversations')
      .update({ lead_id: leadSearch.id })
      .eq('id', selectedConv.id);
    setLead(leadSearch);
    setLeadSearch(null);
    setSelectedConv(prev => prev ? { ...prev, lead_id: leadSearch.id } : prev);
    setLinking(false);
    toast.success('Lead vinculado!');
  };

  const filteredConvs = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.contact_name || '').toLowerCase().includes(q) || c.contact_phone.includes(q);
  });

  // ── Faixa color ──
  const faixaColor = (f: string | null) => {
    if (f === 'verde') return '#10b981';
    if (f === 'amarelo') return '#f59e0b';
    if (f === 'vermelho') return '#ef4444';
    return txtMid;
  };

  const statusLabel = (s: number | null | undefined) => {
    const map: Record<number, string> = { 1: 'Novo', 2: 'Contato', 3: 'Qualificado', 4: 'Aprovado', 5: 'Reprovado' };
    return s != null ? (map[s] || `Status ${s}`) : '—';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Col 1: Sidebar conversations ── */}
      <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: sideBg, borderRight: `1px solid ${border}`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: txt, letterSpacing: '-0.02em' }}>WhatsApp</span>
            <button
              onClick={onSettings}
              title="Configurações"
              style={{ padding: '5px', borderRadius: '7px', border: 'none', background: 'transparent', cursor: 'pointer', color: txtMid, display: 'flex', alignItems: 'center' }}
            >
              <Settings size={16} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: txtMid }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '9px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#18181b' : '#f3f4f6', color: txt, fontSize: '12.5px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: txtMid, fontSize: '13px' }}>
              {search ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </div>
          )}
          {filteredConvs.map(conv => {
            const name = conv.contact_name || conv.contact_phone;
            const isSelected = selectedConv?.id === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: isSelected ? (dark ? '#1a1a2e' : '#eff6ff') : 'transparent', borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = dark ? '#18181b' : '#f9fafb'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                  {initials(name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{name}</span>
                    <span style={{ fontSize: '11px', color: txtMid, flexShrink: 0, marginLeft: '6px' }}>{relativeTime(conv.last_message_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: txtMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {(conv.last_message || '').slice(0, 40)}
                    </span>
                    {(conv.unread_count ?? 0) > 0 && (
                      <span style={{ minWidth: '18px', height: '18px', borderRadius: '99px', background: '#25D366', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0, marginLeft: '6px' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Col 2: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: chatBg, overflow: 'hidden', minWidth: 0 }}>
        {!selectedConv ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: txtMid }}>
            <MessageCircle size={40} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '14px', margin: 0 }}>Selecione uma conversa para começar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, background: dark ? '#111113' : '#fff', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarColor(selectedConv.contact_name || selectedConv.contact_phone), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                {initials(selectedConv.contact_name || selectedConv.contact_phone)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedConv.contact_name || selectedConv.contact_phone}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: txtMid }}>{selectedConv.contact_phone}</p>
              </div>
              {lead && (
                <button
                  onClick={() => navigate('/leads')}
                  style={{ padding: '5px 12px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <User size={12} /> Ver lead
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {groupByDate(messages).map(group => (
                <div key={group.label}>
                  {/* Date separator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: dark ? '#27272a' : '#e5e7eb' }} />
                    <span style={{ fontSize: '11px', color: txtMid, fontWeight: 500, padding: '3px 10px', borderRadius: '99px', background: dark ? '#18181b' : '#f3f4f6' }}>{group.label}</span>
                    <div style={{ flex: 1, height: '1px', background: dark ? '#27272a' : '#e5e7eb' }} />
                  </div>
                  {group.msgs.map(msg => {
                    const isOut = msg.direction === 'outbound';
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                        <div style={{ maxWidth: '68%', padding: '8px 12px', borderRadius: isOut ? '16px 4px 16px 16px' : '4px 16px 16px 16px', background: isOut ? '#2563eb' : (dark ? '#1e1e22' : '#ffffff'), boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                          <p style={{ margin: 0, fontSize: '13.5px', color: isOut ? '#fff' : txt, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {msg.content}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '3px' }}>
                            <span style={{ fontSize: '10.5px', color: isOut ? 'rgba(255,255,255,0.65)' : txtMid }}>
                              {msgTime(msg.created_at)}
                            </span>
                            {isOut && <MsgStatus status={msg.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Send box */}
            <div style={{ padding: '12px 16px', background: dark ? '#111113' : '#fff', borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'flex-end', gap: '10px', flexShrink: 0 }}>
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={handleTextareaChange}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Digite uma mensagem..."
                rows={1}
                style={{ flex: 1, padding: '9px 14px', borderRadius: '20px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#18181b' : '#f3f4f6', color: txt, fontSize: '13.5px', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, overflow: 'hidden', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend} disabled={sending || !messageText.trim()}
                style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: (sending || !messageText.trim()) ? (dark ? '#27272a' : '#e5e7eb') : '#25D366', color: '#fff', cursor: (sending || !messageText.trim()) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Col 3: Lead info ── */}
      <div style={{ width: '260px', flexShrink: 0, background: infoBg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: txt }}>Informações do Lead</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!selectedConv && (
            <p style={{ fontSize: '12.5px', color: txtMid, textAlign: 'center', marginTop: '40px' }}>Nenhuma conversa selecionada</p>
          )}

          {selectedConv && lead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarColor(lead.nome || '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', fontWeight: 700, flexShrink: 0 }}>
                  {initials(lead.nome || '?')}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txt }}>{lead.nome}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: txtMid }}>{lead.cidade || '—'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Score', value: lead.score != null ? `${lead.score} pts` : '—' },
                  { label: 'Faixa', value: lead.faixa ? <span style={{ color: faixaColor(lead.faixa), fontWeight: 600 }}>{lead.faixa}</span> : '—' },
                  { label: 'Status', value: statusLabel(lead.status) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '8px', background: dark ? '#18181b' : '#f9fafb' }}>
                    <span style={{ fontSize: '12px', color: txtMid }}>{label}</span>
                    <span style={{ fontSize: '12px', color: txt, fontWeight: 500 }}>{value as any}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/leads')}
                style={{ width: '100%', padding: '8px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                <ExternalLink size={13} /> Abrir lead
              </button>
            </div>
          )}

          {selectedConv && !lead && leadSearch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12.5px', color: txtMid, margin: 0 }}>Lead encontrado por telefone:</p>
              <div style={{ padding: '10px', borderRadius: '10px', background: dark ? '#18181b' : '#f9fafb', border: `1px solid ${border}` }}>
                <p style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 600, color: txt }}>{leadSearch.nome}</p>
                <p style={{ margin: 0, fontSize: '12px', color: txtMid }}>{leadSearch.cidade || '—'}</p>
              </div>
              <button
                onClick={handleLinkLead} disabled={linking}
                style={{ width: '100%', padding: '8px', borderRadius: '9px', border: 'none', background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: linking ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                <Link2 size={13} /> {linking ? 'Vinculando...' : 'Vincular lead'}
              </button>
            </div>
          )}

          {selectedConv && !lead && !leadSearch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
              <User size={32} style={{ color: dark ? '#27272a' : '#d1d5db' }} />
              <p style={{ fontSize: '12.5px', color: txtMid, textAlign: 'center', margin: 0 }}>Nenhum lead vinculado</p>
              <button
                onClick={() => navigate('/leads')}
                style={{ width: '100%', padding: '8px', borderRadius: '9px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txt, fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
              >
                <UserPlus size={13} /> Criar lead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
