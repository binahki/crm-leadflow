import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore, Lead, calcularFaixa } from '@/stores/appStore';
import { 
  Zap, Check, X, AlertCircle, Loader2, 
  Search, CheckSquare, Square, Send, 
  ArrowRight, MessageSquare, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  body: string;
  variables: string[];
}

const TEMPLATES: Template[] = [
  {
    id: 'abordagem_inicial',
    name: 'abordagem_inicial',
    body: "Oi {{1}}!\n\nSeu perfil foi pré-aprovado! 🎉\n\nFico feliz em te dar as boas-vindas e explicar os próximos passos.\n\nPode falar comigo aqui? 😊",
    variables: ['nome']
  }
];

interface DisparoProgress {
  total: number;
  current: number;
  success: number;
  errors: Array<{ name: string; phone: string; error: string }>;
  status: 'idle' | 'sending' | 'finished';
}

export default function DisparosPage() {
  const { orgId, ready: orgReady } = useOrgId();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();
  const { configuracoes } = useAppStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  
  const [progress, setProgress] = useState<DisparoProgress>({
    total: 0, current: 0, success: 0, errors: [], status: 'idle'
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const [hasAccount, setHasAccount] = useState<boolean | null>(null);

  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase
      .from('whatsapp_accounts')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setHasAccount(!!data));
  }, [orgId, orgReady]);

  const fetchData = useCallback(async () => {
    if (!orgReady || !orgId) return;
    setLoadingLeads(true);

    const { data: acc } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();
    setAccount(acc);

    const { data: convs } = await supabase
      .from('whatsapp_conversations')
      .select('contact_phone')
      .eq('org_id', orgId);
    
    const convPhones = new Set(convs?.map(c => c.contact_phone.slice(-9)) || []);

    const { data: leadData, error } = await supabase
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .neq('status', 4);

    if (error) {
      toast.error('Erro ao buscar leads: ' + error.message);
    } else {
      const filtered = (leadData as unknown as Lead[]).filter(l => {
        const faixa = calcularFaixa(l, configuracoes!);
        const isEligibleFaixa = faixa === 'verde' || faixa === 'amarelo';
        const cleanPhone = (l.whatsapp || '').replace(/\D/g, '').slice(-9);
        const hasNoConv = !convPhones.has(cleanPhone);
        return isEligibleFaixa && hasNoConv;
      });
      setLeads(filtered);
    }
    setLoadingLeads(false);
  }, [orgId, orgReady, configuracoes]);

  useEffect(() => { if (hasAccount) fetchData(); }, [fetchData, hasAccount]);

  if (hasAccount === null && orgReady) return <div className="flex-1 flex items-center justify-center h-screen">Carregando...</div>;

  if (hasAccount === false) {
    return (
      <AppLayout leadCount={0}>
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
            Para disparar mensagens em massa, configure sua conta do WhatsApp Cloud API da Meta.
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

  // ── Handlers ──
  const handleSelectAll = () => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id)));
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const runDisparo = async () => {
    if (!account) return;
    setShowConfirm(false);
    
    const selectedLeads = leads.filter(l => selectedIds.has(l.id));
    setProgress({
      total: selectedLeads.length,
      current: 0,
      success: 0,
      errors: [],
      status: 'sending'
    });

    for (let i = 0; i < selectedLeads.length; i++) {
      const lead = selectedLeads[i];
      const cleanPhone = (lead.whatsapp || '').replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      
      try {
        const payload = {
          messaging_product: "whatsapp",
          to: fullPhone,
          type: "template",
          template: {
            name: selectedTemplate.name,
            language: { code: "pt_BR" },
            components: [{
              type: "body",
              parameters: [{ type: "text", text: lead.nome }]
            }]
          }
        };

        const res = await fetch(`https://graph.facebook.com/v18.0/${account.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error?.message || 'Erro na API da Meta');

        const wamid = data.messages?.[0]?.id;

        // 1. Update/Create Conversation
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .upsert({
            org_id: orgId,
            contact_phone: fullPhone,
            contact_name: lead.nome,
            lead_id: lead.id,
            last_message: selectedTemplate.body.replace('{{1}}', lead.nome),
            last_message_at: new Date().toISOString(),
            session_active: false // Template doesn't open session usually, but status will tell
          }, { onConflict: 'org_id,contact_phone' })
          .select()
          .single();

        // 2. Insert Message
        if (conv) {
          await supabase.from('whatsapp_messages').insert({
            org_id: orgId,
            conversation_id: conv.id,
            wamid: wamid,
            direction: 'outbound',
            type: 'template',
            content: selectedTemplate.body.replace('{{1}}', lead.nome),
            status: 'sent',
            raw_payload: data
          });
        }

        setProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
      } catch (err: any) {
        console.error('Erro no disparo:', err);
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          errors: [...prev.errors, { name: lead.nome, phone: fullPhone, error: err.message }]
        }));
      }

      // Delay 500ms
      if (i < selectedLeads.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setProgress(prev => ({ ...prev, status: 'finished' }));
    toast.success('Disparo concluído!');
    fetchData(); // Refresh list
  };

  // ── Styles ──
  const bg = dark ? '#090909' : '#f8fafc';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e2e8f0';
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#64748b';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', background: bg, minHeight: '100vh' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.02em' }}>Disparo em Massa</h1>
            <p style={{ color: txtMid, fontSize: '14px', marginTop: '6px' }}>Inicie conversas com leads qualificados automaticamente.</p>
          </div>
          {account && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: dark ? '#1a1a1f' : '#fff', border: `1px solid ${border}`, borderRadius: '12px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              API Conectada: {account.display_name || account.phone_number_id}
            </div>
          )}
        </div>

        {!account ? (
          <div style={{ background: '#fff1f2', border: '1px solid #fecaca', padding: '24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', color: '#991b1b' }}>
            <AlertCircle size={24} />
            <div>
              <p style={{ fontWeight: 700, margin: 0 }}>API do WhatsApp não configurada</p>
              <p style={{ fontSize: '14px', margin: '4px 0 0' }}>Você precisa configurar sua API oficial do WhatsApp em configurações para realizar disparos.</p>
              <button onClick={() => navigate('/whatsapp')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#991b1b', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Configurar Agora</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            
            {/* Column 1: Leads List */}
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: txt, margin: 0 }}>Leads Qualificados <span style={{ color: txtMid, fontWeight: 400, fontSize: '13px' }}>({leads.length})</span></h3>
                <button 
                  onClick={handleSelectAll}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {selectedIds.size === leads.length ? <CheckSquare size={16} /> : <Square size={16} />}
                  {selectedIds.size === leads.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: dark ? '#18181b' : '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={{ width: '48px', padding: '12px' }}></th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase' }}>Nome</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase' }}>WhatsApp</th>
                      <th style={{ textAlign: 'left', padding: '12px', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase' }}>Cidade</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase' }}>Faixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLeads ? (
                      <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin mx-auto" /></td></tr>
                    ) : leads.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: txtMid }}>Nenhum lead novo para disparar no momento.</td></tr>
                    ) : leads.map(l => {
                      const sel = selectedIds.has(l.id);
                      const f = calcularFaixa(l, configuracoes!);
                      return (
                        <tr key={l.id} onClick={() => handleSelectOne(l.id)} style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer', background: sel ? (dark ? 'rgba(37,99,235,0.08)' : '#eff6ff') : 'transparent' }}>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {sel ? <CheckSquare size={18} color="#2563eb" /> : <Square size={18} color={border} />}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: txt, fontWeight: 500 }}>{l.nome}</td>
                          <td style={{ padding: '12px', fontSize: '13px', color: txtMid }}>{l.whatsapp}</td>
                          <td style={{ padding: '12px', fontSize: '13px', color: txtMid }}>{l.cidade}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: f === 'verde' ? '#dcfce7' : '#fef9c3', color: f === 'verde' ? '#166534' : '#854d0e' }}>
                              {f?.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column 2: Template & Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Template Card */}
              <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: txt, margin: '0 0 16px' }}>Template Selecionado</h3>
                <div style={{ padding: '16px', background: dark ? '#1a1a1f' : '#f8fafc', borderRadius: '12px', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', marginBottom: '8px', textTransform: 'uppercase' }}>{selectedTemplate.name}</div>
                  <div style={{ fontSize: '14px', color: txt, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedTemplate.body.replace('{{1}}', '[Nome do Lead]')}
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: txtMid, marginTop: '12px' }}>* Este template é enviado via API oficial e requer aprovação da Meta.</p>
              </div>

              {/* Action Card */}
              <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 10px 30px rgba(37,99,235,0.1)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: txtMid, textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Resumo do Disparo</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: txt }}>{selectedIds.size} <span style={{ fontSize: '14px', fontWeight: 500, color: txtMid }}>leads selecionados</span></div>
                </div>

                <button 
                  disabled={selectedIds.size === 0 || progress.status === 'sending'}
                  onClick={() => setShowConfirm(true)}
                  style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', background: selectedIds.size > 0 ? '#2563eb' : (dark ? '#1e1e22' : '#e2e8f0'), color: '#fff', fontSize: '15px', fontWeight: 700, cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' }}
                >
                  <Zap size={18} fill={selectedIds.size > 0 ? '#fff' : 'transparent'} />
                  Iniciar Disparo
                </button>
              </div>

              {/* Progress Card (if active) */}
              {(progress.status !== 'idle') && (
                <div style={{ background: cardBg, border: `1px solid ${progress.status === 'finished' ? '#10b981' : '#2563eb'}`, borderRadius: '20px', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: txt }}>
                      {progress.status === 'sending' ? 'Enviando...' : 'Concluído!'}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{progress.current} / {progress.total}</span>
                  </div>
                  
                  <div style={{ width: '100%', height: '8px', background: dark ? '#1e1e22' : '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: progress.status === 'finished' ? '#10b981' : '#2563eb', transition: 'width 0.3s ease' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ textAlign: 'center', padding: '10px', background: dark ? '#1a1a1f' : '#f0fdf4', borderRadius: '10px', border: `1px solid ${dark ? '#065f46' : '#bbf7d0'}` }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981' }}>{progress.success}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>Sucesso</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px', background: dark ? '#1a1a1f' : '#fef2f2', borderRadius: '10px', border: `1px solid ${dark ? '#991b1b' : '#fecaca'}` }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>{progress.errors.length}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>Falhas</div>
                    </div>
                  </div>

                  {progress.status === 'finished' && (
                    <button 
                      onClick={() => navigate('/whatsapp')}
                      style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '10px', border: `1px solid ${border}`, background: 'transparent', color: txt, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <MessageSquare size={16} /> Ver Conversas
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {showConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: cardBg, padding: '32px', borderRadius: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: `1px solid ${border}` }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#2563eb' }}>
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: txt, textAlign: 'center', margin: '0 0 12px' }}>Confirmar Disparo?</h3>
              <p style={{ fontSize: '14px', color: txtMid, textAlign: 'center', lineHeight: 1.6, margin: '0 0 24px' }}>
                Você vai disparar para <strong>{selectedIds.size} leads</strong>. <br />
                Isso consumirá créditos da sua API da Meta. <br />
                As conversas serão criadas automaticamente no CRM.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${border}`, background: 'transparent', color: txt, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={runDisparo} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Sim, Disparar!</button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `}</style>
    </AppLayout>
  );
}
