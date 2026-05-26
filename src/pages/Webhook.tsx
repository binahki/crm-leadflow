import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Copy, CheckCircle2, Activity, Link, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';

interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

export default function WebhookPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);

  const [usaQuizExterno, setUsaQuizExterno] = useState(false);
  const [scoreVerde, setScoreVerde] = useState(35);
  const [scoreAmarelo, setScoreAmarelo] = useState(25);
  const [savingScore, setSavingScore] = useState(false);

  const baseUrl = `https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead`;
  const webhookUrl = webhookToken ? `${baseUrl}?token=${webhookToken}` : baseUrl;

  // Busca webhook_token e configurações de score
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
  }, [orgId, orgReady]);

  // Logs em tempo real filtrados pelo org_id
  useEffect(() => {
    if (!orgReady || !orgId) return;

    supabase
      .from('webhook_logs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setLogs(data as unknown as WebhookLog[]); });

    const channel = supabase.channel(`webhook-logs-${orgId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'webhook_logs',
        filter: `org_id=eq.${orgId}`,
      }, p => {
        setLogs(prev => [p.new as unknown as WebhookLog, ...prev].slice(0, 50));
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, orgReady]);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('URL copiada!');
  };

  const handleSaveScore = async () => {
    if (!orgId) return;
    setSavingScore(true);
    const { error } = await supabase
      .from('organizations')
      .update({
        usa_quiz_externo: usaQuizExterno,
        score_corte_verde: scoreVerde,
        score_corte_amarelo: scoreAmarelo,
      })
      .eq('id', orgId);
    setSavingScore(false);
    if (error) toast.error('Erro ao salvar configurações');
    else toast.success('Configurações salvas!');
  };

  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px',
    overflow: 'hidden',
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

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', maxWidth: '860px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Webhook</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Receba leads automaticamente do seu quiz</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* URL card */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>URL do Webhook</span>
              </div>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                Cole esta URL no campo de webhook do seu quiz externo.
                {webhookToken && <> O token garante segurança no recebimento.</>}
              </p>

              <div style={{ background: dark ? '#0d0d0f' : '#f8fafc', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Endpoint</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ flex: 1, fontSize: '12.5px', color: txt, wordBreak: 'break-all', lineHeight: 1.5 }}>{webhookUrl}</span>
                  <button
                    onClick={handleCopy}
                    style={{ flexShrink: 0, padding: '6px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#18181b' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? '#10b981' : txtMid, transition: 'all 0.15s' }}
                  >
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
                    const nome = (log.payload as any)?.nome || 'Lead';
                    const ok = log.status === 'success';
                    return (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', background: dark ? '#18181b' : '#f8fafc', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}` }}>
                        <span style={{ fontSize: '11.5px', color: txtMid, flexShrink: 0, minWidth: '52px' }}>
                          {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Score config card */}
        <div style={{ ...card, marginTop: '16px' }}>
          <div style={{ ...cardHeader }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Régua de pontuação</span>
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Explicação */}
            <div style={{ padding: '14px 16px', background: dark ? '#18181b' : '#f8fafc', borderRadius: '12px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}` }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0, lineHeight: 1.6 }}>
                Quando um lead chega pelo webhook, o sistema precisa saber se ela entra como
                <span style={{ color: '#10b981', fontWeight: 700 }}> Verde</span> (prioridade alta) ou
                <span style={{ color: '#f59e0b', fontWeight: 700 }}> Amarela</span> (prioridade normal),
                baseado na pontuação que o quiz dela mandou. Defina aqui qual pontuação mínima
                vale cada cor — você pode ajustar quando quiser.
              </p>
            </div>

            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: txt, margin: '0 0 4px' }}>
                  Usar pontuação do quiz externo
                </p>
                <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                  {usaQuizExterno
                    ? 'Ativo — os cortes abaixo estão sendo usados para classificar os leads.'
                    : 'Inativo — os cortes são definidos dentro do Quiz Builder do Floow.'}
                </p>
              </div>
              <button
                onClick={() => setUsaQuizExterno(v => !v)}
                style={{
                  width: '44px', height: '24px', borderRadius: '999px', border: 'none',
                  background: usaQuizExterno ? '#0044fd' : (dark ? '#3f3f46' : '#d1d5db'),
                  cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s'
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: usaQuizExterno ? '23px' : '3px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}/>
              </button>
            </div>

            {/* Campos de corte */}
            {usaQuizExterno && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '16px', background: dark ? '#18181b' : '#f0fdf4', borderRadius: '12px', border: `1px solid ${dark ? '#27272a' : '#bbf7d0'}` }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🟢 Verde — pontuação mínima
                    </label>
                    <input
                      type="number"
                      min={1} max={200}
                      value={scoreVerde}
                      onChange={e => setScoreVerde(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${dark ? '#3f3f46' : '#bbf7d0'}`, background: dark ? '#111113' : '#fff', color: txt, fontSize: '20px', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any, textAlign: 'center' }}
                    />
                    <p style={{ fontSize: '12px', color: txtMid, margin: '8px 0 0', textAlign: 'center' }}>
                      {scoreVerde} pontos ou mais → Verde
                    </p>
                  </div>

                  <div style={{ padding: '16px', background: dark ? '#18181b' : '#fffbeb', borderRadius: '12px', border: `1px solid ${dark ? '#27272a' : '#fde68a'}` }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🟡 Amarelo — pontuação mínima
                    </label>
                    <input
                      type="number"
                      min={1} max={200}
                      value={scoreAmarelo}
                      onChange={e => setScoreAmarelo(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${dark ? '#3f3f46' : '#fde68a'}`, background: dark ? '#111113' : '#fff', color: txt, fontSize: '20px', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any, textAlign: 'center' }}
                    />
                    <p style={{ fontSize: '12px', color: txtMid, margin: '8px 0 0', textAlign: 'center' }}>
                      Entre {scoreAmarelo} e {scoreVerde - 1} pontos → Amarelo
                    </p>
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

            <button
              onClick={handleSaveScore}
              disabled={savingScore}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '9px', border: 'none', background: '#0044fd', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: savingScore ? 'default' : 'pointer', opacity: savingScore ? 0.7 : 1, fontFamily: 'inherit' }}
            >
              <Save style={{ width: '13px', height: '13px' }}/>
              {savingScore ? 'Salvando…' : 'Salvar régua'}
            </button>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}
