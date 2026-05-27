import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Copy, CheckCircle2, Activity, Link, Save, Settings, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';

const BASE_URL = `https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead`;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface Webhook {
  id: string;
  nome: string;
  token: string;
  ativo: boolean;
  tipo: 'receber_lead' | 'atualizar_status';
  created_at: string;
  isPrincipal?: boolean;
}

export default function WebhookPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();

  // Existing state
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [usaQuizExterno, setUsaQuizExterno] = useState(false);
  const [scoreVerde, setScoreVerde] = useState(35);
  const [scoreAmarelo, setScoreAmarelo] = useState(25);
  const [savingScore, setSavingScore] = useState(false);

  // Webhooks management state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTipo, setNewTipo] = useState<'receber_lead' | 'atualizar_status'>('receber_lead');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const webhookUrl = webhookToken ? `${BASE_URL}?token=${webhookToken}` : BASE_URL;

  useEffect(() => {
    if (!orgReady || !orgId) return;

    supabase.from('configuracoes_whatsapp').select('webhook_token').eq('org_id', orgId).single()
      .then(({ data }) => { if (data) setWebhookToken((data as any).webhook_token || null); });

    supabase.from('organizations').select('usa_quiz_externo, score_corte_verde, score_corte_amarelo').eq('id', orgId).single()
      .then(({ data }) => {
        if (data) {
          setUsaQuizExterno(!!(data as any).usa_quiz_externo);
          setScoreVerde((data as any).score_corte_verde ?? 35);
          setScoreAmarelo((data as any).score_corte_amarelo ?? 25);
        }
      });

    fetchWebhooks();
  }, [orgId, orgReady]); // eslint-disable-line

  useEffect(() => {
    if (!orgReady || !orgId) return;

    supabase.from('webhook_logs').select('*').eq('org_id', orgId)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setLogs(data as unknown as WebhookLog[]); });

    const channel = supabase.channel(`webhook-logs-${orgId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs', filter: `org_id=eq.${orgId}` },
        p => { setLogs(prev => [p.new as unknown as WebhookLog, ...prev].slice(0, 50)); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, orgReady]); // eslint-disable-line

  async function fetchWebhooks() {
    if (!orgId) return;
    setLoadingWebhooks(true);
    const { data } = await (supabase as any).from('webhooks').select('*').eq('org_id', orgId).order('created_at', { ascending: true });
    setWebhooks(data || []);
    setLoadingWebhooks(false);
  }

  async function createWebhook() {
    if (!orgId || !newNome.trim()) return;
    setCreating(true);
    const { error } = await (supabase as any).from('webhooks').insert({ org_id: orgId, nome: newNome.trim(), tipo: newTipo });
    if (error) {
      toast.error('Erro ao criar webhook');
    } else {
      toast.success('Webhook criado!');
      setShowCreateModal(false);
      setNewNome('');
      setNewTipo('receber_lead');
      fetchWebhooks();
    }
    setCreating(false);
  }

  async function toggleWebhook(wh: Webhook) {
    setTogglingId(wh.id);
    await (supabase as any).from('webhooks').update({ ativo: !wh.ativo }).eq('id', wh.id);
    setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, ativo: !wh.ativo } : w));
    setTogglingId(null);
  }

  async function deleteWebhook(id: string) {
    await (supabase as any).from('webhooks').delete().eq('id', id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
    setDeleteId(null);
    toast.success('Webhook excluído');
  }

  async function saveEditNome(id: string) {
    if (!editNome.trim()) return;
    await (supabase as any).from('webhooks').update({ nome: editNome.trim() }).eq('id', id);
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, nome: editNome.trim() } : w));
    setEditingId(null);
  }

  function copyWebhookUrl(id: string, token: string | null) {
    const u = token ? `${BASE_URL}?token=${token}` : BASE_URL;
    navigator.clipboard.writeText(u);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('URL copiada!');
  };

  const handleSaveScore = async () => {
    if (!orgId) return;
    setSavingScore(true);
    const { error } = await supabase.from('organizations').update({
      usa_quiz_externo: usaQuizExterno,
      score_corte_verde: scoreVerde,
      score_corte_amarelo: scoreAmarelo,
    }).eq('id', orgId);
    setSavingScore(false);
    if (error) toast.error('Erro ao salvar configurações');
    else toast.success('Configurações salvas!');
  };

  // Styles
  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px', overflow: 'hidden',
    boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
  };
  const cardHeader: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: dark ? '#18181b' : '#fafafa',
  };
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const border = dark ? '#27272a' : '#e5e7eb';
  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: '9px', border: `1px solid ${border}`,
    background: dark ? '#0d0d0f' : '#f8fafc', color: txt, fontSize: '13px',
    outline: 'none', fontFamily: FONT, width: '100%', boxSizing: 'border-box' as const,
  };

  // Build unified list: Principal first (virtual), then DB webhooks
  const principalItem: Webhook | null = webhookToken !== undefined ? {
    id: 'principal', nome: 'Principal', token: webhookToken || '',
    ativo: true, tipo: 'receber_lead', created_at: '', isPrincipal: true,
  } : null;
  const allWebhooks: Webhook[] = [
    ...(principalItem ? [principalItem] : []),
    ...webhooks.map(w => ({ ...w, isPrincipal: false })),
  ];

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', maxWidth: '860px', fontFamily: FONT }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Webhook</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Receba leads automaticamente do seu quiz</p>
        </div>

        {/* ── Meus Webhooks ─────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <div style={cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Meus Webhooks</span>
              {!loadingWebhooks && (
                <span style={{ fontSize: '11px', color: txtMid, background: dark ? '#27272a' : '#f4f4f5', padding: '2px 8px', borderRadius: '99px', fontWeight: 500 }}>
                  {allWebhooks.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
            >
              <Plus style={{ width: '13px', height: '13px' }} />
              Criar novo webhook
            </button>
          </div>

          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingWebhooks ? (
              [1, 2].map(i => (
                <div key={i} style={{ height: '66px', borderRadius: '12px', background: dark ? '#18181b' : '#f8fafc', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}`, animation: 'wh-pulse 1.5s ease-in-out infinite' }} />
              ))
            ) : allWebhooks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>Nenhum webhook. Crie um para começar.</p>
              </div>
            ) : (
              allWebhooks.map(wh => {
                const whUrl = wh.token ? `${BASE_URL}?token=${wh.token}` : BASE_URL;
                const isEditing = editingId === wh.id;
                const isCopied = copiedId === wh.id;
                const isToggling = togglingId === wh.id;

                return (
                  <div key={wh.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: dark ? '#18181b' : '#f8fafc', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}`, opacity: wh.ativo ? 1 : 0.6, transition: 'opacity 0.2s' }}>

                    {/* Left: name + badge */}
                    <div style={{ flex: '0 0 160px', minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <input
                            value={editNome}
                            onChange={e => setEditNome(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditNome(wh.id); if (e.key === 'Escape') setEditingId(null); }}
                            autoFocus
                            style={{ ...inputStyle, padding: '5px 8px', fontSize: '13px', height: '28px' }}
                          />
                          <button onClick={() => saveEditNome(wh.id)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check style={{ width: '11px', height: '11px' }} />
                          </button>
                          <button onClick={() => setEditingId(null)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <X style={{ width: '11px', height: '11px' }} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.nome}</span>
                          {!wh.isPrincipal && (
                            <button onClick={() => { setEditingId(wh.id); setEditNome(wh.nome); }}
                              style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '4px', border: 'none', background: 'transparent', color: txtMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                              <Pencil style={{ width: '10px', height: '10px' }} />
                            </button>
                          )}
                        </div>
                      )}
                      <span style={{
                        display: 'inline-block', marginTop: '4px',
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                        padding: '1px 7px', borderRadius: '99px',
                        background: wh.tipo === 'receber_lead' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
                        color: wh.tipo === 'receber_lead' ? '#3b82f6' : '#8b5cf6',
                      }}>
                        {wh.tipo === 'receber_lead' ? 'Receber Lead' : 'Atualizar Status'}
                      </span>
                    </div>

                    {/* Middle: URL */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', background: dark ? '#0d0d0f' : '#fff', border: `1px solid ${border}`, borderRadius: '9px', padding: '7px 10px' }}>
                      <span style={{ flex: 1, fontSize: '11px', color: txtMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {whUrl}
                      </span>
                      <button
                        onClick={() => copyWebhookUrl(wh.id, wh.token)}
                        title={isCopied ? 'Copiado!' : 'Copiar URL'}
                        style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '6px', border: `1px solid ${border}`, background: dark ? '#18181b' : '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isCopied ? '#10b981' : txtMid, transition: 'color 0.15s' }}
                      >
                        {isCopied ? <CheckCircle2 style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                      </button>
                    </div>

                    {/* Right: toggle + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {!wh.isPrincipal && (
                        <button
                          onClick={() => toggleWebhook(wh)}
                          disabled={isToggling}
                          title={wh.ativo ? 'Desativar' : 'Ativar'}
                          style={{ width: '36px', height: '20px', borderRadius: '99px', border: 'none', background: wh.ativo ? '#10b981' : (dark ? '#3f3f46' : '#d1d5db'), position: 'relative', cursor: 'pointer', transition: 'background 0.2s', opacity: isToggling ? 0.6 : 1 }}
                        >
                          <span style={{ position: 'absolute', top: '2px', left: wh.ativo ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </button>
                      )}
                      <button
                        onClick={() => !wh.isPrincipal && setDeleteId(wh.id)}
                        title={wh.isPrincipal ? 'Webhook principal não pode ser excluído' : 'Excluir webhook'}
                        style={{ width: '30px', height: '30px', borderRadius: '7px', border: wh.isPrincipal ? 'none' : `1px solid ${border}`, background: 'transparent', color: wh.isPrincipal ? 'transparent' : (dark ? '#52525b' : '#9ca3af'), cursor: wh.isPrincipal ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {!wh.isPrincipal && <Trash2 style={{ width: '13px', height: '13px' }} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── URL + Log grid ─────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* URL card */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>URL do Webhook Principal</span>
              </div>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                Cole esta URL no campo de webhook do seu quiz externo.
                {webhookToken && <> O token garante segurança no recebimento.</>}
              </p>
              <div style={{ background: dark ? '#0d0d0f' : '#f8fafc', border: `1px solid ${border}`, borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Endpoint</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ flex: 1, fontSize: '12.5px', color: txt, wordBreak: 'break-all', lineHeight: 1.5 }}>{webhookUrl}</span>
                  <button onClick={handleCopy} style={{ flexShrink: 0, padding: '6px', borderRadius: '8px', border: `1px solid ${border}`, background: dark ? '#18181b' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? '#10b981' : txtMid, transition: 'all 0.15s' }}>
                    {copied ? <CheckCircle2 style={{ width: '15px', height: '15px' }} /> : <Copy style={{ width: '15px', height: '15px' }} />}
                  </button>
                </div>
              </div>
              <div style={{ background: dark ? 'rgba(59,130,246,0.08)' : '#eff6ff', border: `1px solid ${dark ? 'rgba(59,130,246,0.2)' : '#bfdbfe'}`, borderRadius: '10px', padding: '12px 14px' }}>
                <p style={{ fontSize: '12.5px', color: dark ? '#93c5fd' : '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
                  <strong>Como configurar:</strong> Acesse seu quiz externo → Configurações → Webhook → cole a URL acima.
                  {webhookToken && <> O token na URL garante que apenas requisições autorizadas são aceitas.</>}
                </p>
              </div>
            </div>
          </div>

          {/* Log card */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Log em tempo real</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', color: txtMid }}>ao vivo</span>
              </div>
            </div>
            <div style={{ padding: '12px', maxHeight: '360px', overflowY: 'auto' }}>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Activity style={{ width: '28px', height: '28px', color: dark ? '#27272a' : '#e5e7eb', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>Nenhum evento ainda</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {logs.map(log => {
                    const nome = (log.payload as any)?.nome || (log.payload as any)?.whatsapp || 'Lead';
                    const webhookName = (log.payload as any)?.webhook as string | undefined;
                    const ok = log.status === 'success';
                    return (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: dark ? '#18181b' : '#f8fafc', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}` }}>
                        <span style={{ fontSize: '11px', color: txtMid, flexShrink: 0, minWidth: '50px' }}>
                          {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', color: txt, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                        {webhookName && (
                          <span style={{ fontSize: '10px', color: txtMid, background: dark ? '#27272a' : '#f4f4f5', padding: '1px 6px', borderRadius: '5px', flexShrink: 0, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {webhookName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Score config ───────────────────────────────────────── */}
        <div style={{ ...card, marginTop: '16px' }}>
          <div style={{ ...cardHeader }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Régua de pontuação</span>
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '14px 16px', background: dark ? '#18181b' : '#f8fafc', borderRadius: '12px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0, lineHeight: 1.6 }}>
                Quando um lead chega pelo webhook, o sistema precisa saber se ela entra como
                <span style={{ color: '#10b981', fontWeight: 700 }}> Verde</span> (prioridade alta) ou
                <span style={{ color: '#f59e0b', fontWeight: 700 }}> Amarela</span> (prioridade normal),
                baseado na pontuação que o quiz dela mandou. Defina aqui qual pontuação mínima
                vale cada cor — você pode ajustar quando quiser.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: txt, margin: '0 0 4px' }}>Usar pontuação do quiz externo</p>
                <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                  {usaQuizExterno ? 'Ativo — os cortes abaixo estão sendo usados para classificar os leads.' : 'Inativo — os cortes são definidos dentro do Quiz Builder do Floow.'}
                </p>
              </div>
              <button onClick={() => setUsaQuizExterno(v => !v)}
                style={{ width: '44px', height: '24px', borderRadius: '999px', border: 'none', background: usaQuizExterno ? '#0044fd' : (dark ? '#3f3f46' : '#d1d5db'), cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: '3px', left: usaQuizExterno ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
            {usaQuizExterno && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '16px', background: dark ? '#18181b' : '#f0fdf4', borderRadius: '12px', border: `1px solid ${dark ? border : '#bbf7d0'}` }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🟢 Verde — pontuação mínima</label>
                    <input type="number" min={1} max={200} value={scoreVerde} onChange={e => setScoreVerde(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${dark ? '#3f3f46' : '#bbf7d0'}`, background: dark ? '#111113' : '#fff', color: txt, fontSize: '20px', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'center' }} />
                    <p style={{ fontSize: '12px', color: txtMid, margin: '8px 0 0', textAlign: 'center' }}>{scoreVerde} pontos ou mais → Verde</p>
                  </div>
                  <div style={{ padding: '16px', background: dark ? '#18181b' : '#fffbeb', borderRadius: '12px', border: `1px solid ${dark ? border : '#fde68a'}` }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🟡 Amarelo — pontuação mínima</label>
                    <input type="number" min={1} max={200} value={scoreAmarelo} onChange={e => setScoreAmarelo(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${dark ? '#3f3f46' : '#fde68a'}`, background: dark ? '#111113' : '#fff', color: txt, fontSize: '20px', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', textAlign: 'center' }} />
                    <p style={{ fontSize: '12px', color: txtMid, margin: '8px 0 0', textAlign: 'center' }}>Entre {scoreAmarelo} e {scoreVerde - 1} pontos → Amarelo</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: dark ? 'rgba(255,42,76,0.08)' : '#fff1f2', border: `1px solid ${dark ? 'rgba(255,42,76,0.2)' : '#fecaca'}`, borderRadius: '10px' }}>
                  <span style={{ fontSize: '18px' }}>🔴</span>
                  <span style={{ fontSize: '13px', color: dark ? '#f87171' : '#dc2626', lineHeight: 1.5 }}>
                    Abaixo de <strong>{scoreAmarelo}</strong> pontos → lead não entra no sistema (reprovada no quiz)
                  </span>
                </div>
              </div>
            )}
            <button onClick={handleSaveScore} disabled={savingScore}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '9px', border: 'none', background: '#0044fd', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: savingScore ? 'default' : 'pointer', opacity: savingScore ? 0.7 : 1, fontFamily: 'inherit' }}>
              <Save style={{ width: '13px', height: '13px' }} />
              {savingScore ? 'Salvando…' : 'Salvar régua'}
            </button>
          </div>
        </div>

        {/* ── Create Modal ───────────────────────────────────────── */}
        {showCreateModal && (
          <div onClick={() => setShowCreateModal(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: dark ? '#111113' : '#fff', borderRadius: '18px', border: `1px solid ${dark ? '#27272a' : 'rgba(0,0,0,0.08)'}`, width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: txt, margin: 0 }}>Novo webhook</h3>
                <button onClick={() => setShowCreateModal(false)} style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: txtMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X style={{ width: '13px', height: '13px' }} />
                </button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>Nome do webhook</label>
                  <input
                    value={newNome}
                    onChange={e => setNewNome(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newNome.trim()) createWebhook(); }}
                    placeholder="Ex: Pós-Webinar Becker"
                    autoFocus
                    style={{ ...inputStyle }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '8px' }}>Tipo</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      { value: 'receber_lead' as const, label: 'Receber Lead', desc: 'Cria um novo lead no CRM.', color: '#3b82f6' },
                      { value: 'atualizar_status' as const, label: 'Atualizar Status', desc: 'Busca o lead pelo WhatsApp e move para Contrato/App.', color: '#8b5cf6' },
                    ]).map(opt => (
                      <div key={opt.value} onClick={() => setNewTipo(opt.value)}
                        style={{ padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', border: `2px solid ${newTipo === opt.value ? opt.color : border}`, background: newTipo === opt.value ? `${opt.color}14` : 'transparent', transition: 'all 0.15s' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: newTipo === opt.value ? opt.color : txt }}>{opt.label}</div>
                        <div style={{ fontSize: '12px', color: txtMid, marginTop: '2px' }}>{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button onClick={() => setShowCreateModal(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                    Cancelar
                  </button>
                  <button onClick={createWebhook} disabled={creating || !newNome.trim()}
                    style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: creating || !newNome.trim() ? (dark ? '#27272a' : '#e5e7eb') : '#3b82f6', color: creating || !newNome.trim() ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: creating || !newNome.trim() ? 'default' : 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {creating ? (
                      <><span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'wh-spin 0.7s linear infinite', display: 'inline-block' }} /> Criando…</>
                    ) : 'Criar webhook'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ──────────────────────────── */}
        {deleteId && (
          <div onClick={() => setDeleteId(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: dark ? '#111113' : '#fff', borderRadius: '18px', border: `1px solid ${dark ? '#27272a' : 'rgba(0,0,0,0.08)'}`, width: '100%', maxWidth: '340px', padding: '28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>🗑️</div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: txt, margin: '0 0 8px' }}>Excluir este webhook?</h3>
              <p style={{ fontSize: '13px', color: txtMid, margin: '0 0 20px', lineHeight: 1.5 }}>
                Integrações usando esta URL vão parar de funcionar.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  Cancelar
                </button>
                <button onClick={() => deleteWebhook(deleteId)}
                  style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes wh-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes wh-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>

      </div>
    </AppLayout>
  );
}
