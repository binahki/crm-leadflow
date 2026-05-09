import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Check, Copy, MessageCircle, Webhook, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { invalidateOnboardingCache } from '@/components/ProtectedRoute';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const EDGE_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead';

const STEPS = ['Boas-vindas', 'WhatsApp', 'Webhook'];

export default function OnboardingPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Step 2
  const [waEnabled, setWaEnabled] = useState(false);
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [msgTemplate, setMsgTemplate] = useState(
    'Olá {{nome}}! 👋 Recebemos seu contato e em breve nossa equipe entrará em contato com você.'
  );
  const [saving, setSaving] = useState(false);

  // Step 3
  const [webhookToken, setWebhookToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('[Onboarding] memberships query error:', error);
          return;
        }
        if (data?.org_id) setOrgId(data.org_id);
        else console.warn('[Onboarding] membership found but org_id is empty');
      });
  }, [user?.id]);

  // ── Colors ───────────────────────────────────────────────────
  const bg     = dark ? '#090909' : '#f4f4f5';
  const card   = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${border}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: txt, fontSize: '13.5px', outline: 'none',
    fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  // ── Handlers ─────────────────────────────────────────────────
  async function handleStep2Continue() {
    if (!orgId) {
      toast.error('Organização não encontrada. Tente recarregar a página.');
      return;
    }
    setSaving(true);
    try {
      const newToken = crypto.randomUUID().replace(/-/g, '');
      const payload: Record<string, unknown> = {
        webhook_token: newToken,
      };
      if (waEnabled) {
        payload.instance_id       = instanceId.trim();
        payload.token             = token.trim();
        payload.client_token      = clientToken.trim();
        payload.mensagem_template = msgTemplate.trim();
        payload.auto_send         = true;
      }

      // Verifica se já existe registro para esse org_id
      const { data: existing } = await supabase
        .from('configuracoes_whatsapp')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);

      let error;
      if (existing && existing.length > 0) {
        // Já existe → UPDATE
        ({ error } = await supabase
          .from('configuracoes_whatsapp')
          .update(payload)
          .eq('org_id', orgId));
      } else {
        // Não existe → INSERT
        ({ error } = await supabase
          .from('configuracoes_whatsapp')
          .insert({ ...payload, org_id: orgId }));
      }

      if (error) throw error;
      setWebhookToken(newToken);
      setStep(3);
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const url = `${EDGE_URL}?token=${webhookToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }

  function handleConcluir() {
    invalidateOnboardingCache();
    navigate('/');
  }

  const webhookUrl = `${EDGE_URL}?token=${webhookToken}`;
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${border}`,
        background: dark ? '#0f0f11' : '#ffffff',
        flexShrink: 0,
      }}>
        <img
          src={dark ? '/logo-light.png' : '/logo-dark.png'}
          alt="Floow CRM"
          style={{ height: '24px', objectFit: 'contain' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </header>

      {/* Progress bar */}
      <div style={{ height: '3px', background: dark ? '#1e1e22' : '#e5e7eb' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg,#22c55e,#16a34a)',
          transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '22px 16px 0', gap: '0' }}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done   = step > n;
          const active = step === n;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#22c55e' : active ? '#2563eb' : (dark ? '#1e1e22' : '#e5e7eb'),
                  fontSize: '12px', fontWeight: 700,
                  color: done || active ? '#fff' : txtMid,
                  transition: 'background 0.3s',
                  boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none',
                }}>
                  {done ? <Check style={{ width: '14px', height: '14px' }} /> : n}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: active ? 600 : 400, color: active ? txt : txtMid, whiteSpace: 'nowrap' }}>
                  {label}
                </span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div style={{
                  width: '64px', height: '2px', marginBottom: '18px',
                  background: done ? '#22c55e' : (dark ? '#1e1e22' : '#e5e7eb'),
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Card content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px 48px' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* ── STEP 1: Boas-vindas ────────────────────────────── */}
          {step === 1 && (
            <div style={{
              background: card, borderRadius: '20px', border: `1px solid ${border}`,
              padding: '48px 32px', textAlign: 'center',
              boxShadow: dark ? '0 4px 32px rgba(0,0,0,0.45)' : '0 2px 20px rgba(0,0,0,0.07)',
            }}>
              <div style={{ fontSize: '56px', marginBottom: '20px', lineHeight: 1 }}>🎉</div>
              <h1 style={{
                fontSize: '26px', fontWeight: 800, color: txt,
                margin: '0 0 12px', letterSpacing: '-0.04em',
              }}>
                Bem-vindo ao Floow CRM!
              </h1>
              <p style={{ fontSize: '15px', color: txtMid, lineHeight: 1.65, margin: '0 0 36px' }}>
                Vamos configurar tudo em 2 passos rápidos.
              </p>
              <button
                onClick={() => setStep(2)}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                  background: '#22c55e', color: '#fff', fontSize: '15px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 2px 12px rgba(34,197,94,0.35)',
                }}
              >
                Começar <ChevronRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          )}

          {/* ── STEP 2: WhatsApp ───────────────────────────────── */}
          {step === 2 && (
            <div style={{
              background: card, borderRadius: '20px', border: `1px solid ${border}`,
              overflow: 'hidden',
              boxShadow: dark ? '0 4px 32px rgba(0,0,0,0.45)' : '0 2px 20px rgba(0,0,0,0.07)',
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px 16px', borderBottom: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: '12px',
                background: dark ? '#18181b' : '#fafafa',
              }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '11px',
                  background: dark ? 'rgba(34,197,94,0.14)' : '#f0fdf4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <MessageCircle style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: txt, margin: 0 }}>
                    Quer enviar WhatsApp automático para seus leads?
                  </h2>
                  <span style={{
                    display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '99px',
                    background: dark ? 'rgba(255,255,255,0.07)' : '#f3f4f6',
                    color: txtMid, fontSize: '11px', fontWeight: 500,
                  }}>
                    Opcional
                  </span>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.65, margin: 0 }}>
                  Quando um lead passar pelo quiz, o sistema envia uma mensagem automática no WhatsApp.
                  Para isso você precisa de uma conta na{' '}
                  <a href="https://z-api.io" target="_blank" rel="noreferrer"
                    style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}>
                    Z-API (z-api.io)
                  </a>.
                </p>

                {/* Toggle */}
                <div
                  onClick={() => setWaEnabled(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: '12px',
                    border: `1px solid ${waEnabled ? '#22c55e' : border}`,
                    background: waEnabled ? (dark ? 'rgba(34,197,94,0.08)' : '#f0fdf4') : 'transparent',
                    cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600, color: waEnabled ? '#22c55e' : txtMid }}>
                    Ativar WhatsApp automático
                  </span>
                  <div style={{
                    width: '46px', height: '26px', borderRadius: '99px',
                    background: waEnabled ? '#22c55e' : (dark ? '#27272a' : '#d1d5db'),
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: '4px',
                      left: waEnabled ? '24px' : '4px',
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
                    }} />
                  </div>
                </div>

                {/* Fields */}
                {waEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                        Instance ID
                      </label>
                      <input
                        style={inp} value={instanceId} onChange={e => setInstanceId(e.target.value)}
                        placeholder="Ex: 3D5C1234ABCD..."
                        onFocus={e => (e.target.style.borderColor = '#22c55e')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                        Token da instância
                      </label>
                      <input
                        style={inp} value={token} onChange={e => setToken(e.target.value)}
                        placeholder="Token gerado na Z-API"
                        onFocus={e => (e.target.style.borderColor = '#22c55e')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                        Client Token
                      </label>
                      <input
                        style={inp} value={clientToken} onChange={e => setClientToken(e.target.value)}
                        placeholder="Security → Client-Token na Z-API"
                        onFocus={e => (e.target.style.borderColor = '#22c55e')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                        Template da mensagem{' '}
                        <span style={{
                          padding: '2px 7px', borderRadius: '99px',
                          background: dark ? 'rgba(34,197,94,0.12)' : '#dcfce7',
                          color: '#22c55e', fontSize: '10.5px', fontWeight: 600,
                          textTransform: 'none', letterSpacing: 0,
                        }}>
                          {'{{nome}}'} disponível
                        </span>
                      </label>
                      <textarea
                        style={{ ...inp, resize: 'vertical', minHeight: '90px', lineHeight: 1.6 } as React.CSSProperties}
                        value={msgTemplate}
                        onChange={e => setMsgTemplate(e.target.value)}
                        placeholder="Olá {{nome}}! ..."
                        onFocus={e => (e.target.style.borderColor = '#22c55e')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStep2Continue}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    background: saving ? (dark ? '#1e1e22' : '#e5e7eb') : '#22c55e',
                    color: saving ? txtMid : '#fff', fontSize: '14px', fontWeight: 700,
                    cursor: saving ? 'default' : 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'background 0.15s',
                    boxShadow: saving ? 'none' : '0 2px 10px rgba(34,197,94,0.3)',
                  }}
                >
                  {saving
                    ? 'Salvando…'
                    : waEnabled
                      ? <><span>Salvar e continuar</span><ChevronRight style={{ width: '16px', height: '16px' }} /></>
                      : <><span>Continuar sem WhatsApp</span><ChevronRight style={{ width: '16px', height: '16px' }} /></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Webhook ────────────────────────────────── */}
          {step === 3 && (
            <div style={{
              background: card, borderRadius: '20px', border: `1px solid ${border}`,
              overflow: 'hidden',
              boxShadow: dark ? '0 4px 32px rgba(0,0,0,0.45)' : '0 2px 20px rgba(0,0,0,0.07)',
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px 16px', borderBottom: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: '12px',
                background: dark ? '#18181b' : '#fafafa',
              }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '11px',
                  background: dark ? 'rgba(59,130,246,0.14)' : '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Webhook style={{ width: '18px', height: '18px', color: '#3b82f6' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: txt, margin: 0 }}>
                    Configure o recebimento de leads
                  </h2>
                  <p style={{ fontSize: '12px', color: txtMid, margin: '3px 0 0' }}>
                    Cole no seu quiz da Inlead
                  </p>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.6, margin: 0 }}>
                  Cole esta URL no campo de Webhook do seu quiz na Inlead:
                </p>

                {/* URL box */}
                <div style={{
                  background: dark ? '#0d0d0f' : '#f8fafc',
                  border: `1px solid ${border}`, borderRadius: '12px',
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <span style={{
                    flex: 1, fontSize: '12px', color: dark ? '#93c5fd' : '#1d4ed8',
                    wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace', lineHeight: 1.6,
                  }}>
                    {webhookUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    style={{
                      flexShrink: 0, padding: '8px 14px', borderRadius: '9px',
                      border: `1px solid ${copied ? '#22c55e' : border}`,
                      background: copied
                        ? (dark ? 'rgba(34,197,94,0.12)' : '#f0fdf4')
                        : (dark ? 'rgba(255,255,255,0.05)' : '#fff'),
                      color: copied ? '#22c55e' : txtMid,
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontFamily: FONT, transition: 'all 0.18s', whiteSpace: 'nowrap',
                    }}
                  >
                    {copied
                      ? <><Check style={{ width: '13px', height: '13px' }} /> Copiado!</>
                      : <><Copy style={{ width: '13px', height: '13px' }} /> Copiar</>
                    }
                  </button>
                </div>

                {/* Instruction */}
                <div style={{
                  padding: '14px 16px', borderRadius: '12px',
                  background: dark ? 'rgba(59,130,246,0.07)' : '#eff6ff',
                  border: `1px solid ${dark ? 'rgba(59,130,246,0.18)' : '#bfdbfe'}`,
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: dark ? '#93c5fd' : '#1d4ed8', lineHeight: 1.65 }}>
                    <strong>Na Inlead:</strong> Configurações → Integrações → Webhook → cole a URL acima
                  </p>
                </div>

                <button
                  onClick={handleConcluir}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    background: '#22c55e', color: '#fff', fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 2px 12px rgba(34,197,94,0.35)',
                  }}
                >
                  <Check style={{ width: '16px', height: '16px' }} />
                  Concluir e ir para o Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
