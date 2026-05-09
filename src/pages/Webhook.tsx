import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Copy, CheckCircle2, Activity, Link } from 'lucide-react';
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

  const baseUrl = `https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead`;
  const webhookUrl = webhookToken ? `${baseUrl}?token=${webhookToken}` : baseUrl;

  // Busca webhook_token filtrado pelo org do usuário
  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase.from('configuracoes_whatsapp').select('webhook_token').eq('org_id', orgId).single()
      .then(({ data }) => { if (data) setWebhookToken((data as any).webhook_token || null); });
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
                Cole esta URL no campo de webhook do seu quiz na <strong style={{ color: txt }}>Inlead</strong>.
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
                  <strong>Como configurar:</strong> Acesse seu quiz na Inlead → Configurações → Webhook → cole a URL acima.
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
      </div>
    </AppLayout>
  );
}
