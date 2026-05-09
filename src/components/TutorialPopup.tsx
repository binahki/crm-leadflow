import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const EDGE_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead';
const TOTAL_STEPS = 4;

export function TutorialPopup() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  // Chave única por org — cada empresa tem seu próprio tutorial
  const tutorialKey = orgId ? `tutorial_concluido_${orgId}` : null;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Só abre se não foi visto para esta org
  useEffect(() => {
    if (!ready || !orgId || !tutorialKey) return;
    if (localStorage.getItem(tutorialKey) === 'true') return;
    setOpen(true);
  }, [ready, orgId, tutorialKey]);

  // Busca o webhook_token quando chega no passo 2
  useEffect(() => {
    if (step !== 2 || !orgId || webhookUrl) return;
    supabase
      .from('configuracoes_whatsapp')
      .select('webhook_token')
      .eq('org_id', orgId)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.webhook_token) {
          setWebhookUrl(`${EDGE_URL}?token=${data.webhook_token}`);
        }
      });
  }, [step, orgId, webhookUrl]);

  if (!open) return null;

  const logoSrc = dark ? '/logo-light.png' : '/logo-dark.png';

  function close() {
    if (tutorialKey) localStorage.setItem(tutorialKey, 'true');
    setOpen(false);
  }

  const card: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '92%',
    maxWidth: '460px',
    zIndex: 9999,
    background: dark ? '#111113' : '#ffffff',
    borderRadius: '20px',
    padding: '28px 24px 24px',
    boxShadow: dark
      ? '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
      : '0 24px 80px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
    fontFamily: FONT,
    animation: 'tut-up 0.22s cubic-bezier(0.32,0.72,0,1)',
  };

  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const borderColor = dark ? '#1e1e22' : '#e5e7eb';

  const btnPrimary: React.CSSProperties = {
    flex: 1,
    padding: '11px',
    borderRadius: '10px',
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'opacity 0.15s',
  };

  const btnSecondary: React.CSSProperties = {
    flex: 1,
    padding: '11px',
    borderRadius: '10px',
    border: `1px solid ${borderColor}`,
    background: 'transparent',
    color: txtMid,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: FONT,
  };

  const skipLink: React.CSSProperties = {
    display: 'block',
    textAlign: 'center',
    marginTop: '14px',
    fontSize: '12.5px',
    color: txtMid,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: FONT,
    textDecoration: 'underline',
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'tut-fade 0.18s ease' }}
        onClick={close}
      />

      <div style={card}>
        {/* Fechar */}
        <button
          onClick={close}
          style={{ position: 'absolute', top: '16px', right: '16px', width: '26px', height: '26px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X style={{ width: '12px', height: '12px', color: txtMid }} />
        </button>

        {/* Barra de progresso */}
        <div style={{ height: '3px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', marginBottom: '22px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, background: '#16a34a', borderRadius: '99px', transition: 'width 0.3s ease' }} />
        </div>

        {/* Passo 1 — Boas-vindas */}
        {step === 1 && (
          <>
            <img
              src={logoSrc}
              alt="Floow"
              style={{ height: '48px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 16px' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', fontFamily: FONT }}>Passo 1 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: txtHi, margin: '0 0 10px', fontFamily: FONT }}>Bem-vindo ao Floow!</h2>
            <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.6, margin: '0 0 24px', fontFamily: FONT }}>
              Vamos te mostrar como configurar tudo em menos de 5 minutos.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnPrimary} onClick={() => setStep(2)}>Começar</button>
            </div>
            <button style={skipLink} onClick={close}>Pular tutorial</button>
          </>
        )}

        {/* Passo 2 — Webhook */}
        {step === 2 && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>🔗</div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', fontFamily: FONT }}>Passo 2 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: txtHi, margin: '0 0 10px', fontFamily: FONT }}>Configure o recebimento de leads</h2>
            <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.6, margin: '0 0 16px', fontFamily: FONT }}>
              Para receber leads do seu quiz automaticamente, cole esta URL no campo <strong style={{ color: txtHi }}>Webhook</strong> da Inlead:
            </p>

            {/* URL do webhook */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.04)' : '#f4f4f5', border: `1px solid ${borderColor}`, marginBottom: '20px' }}>
              <span style={{ flex: 1, fontSize: '11.5px', color: txtMid, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {webhookUrl || 'Carregando…'}
              </span>
              <button
                onClick={() => {
                  if (!webhookUrl) return;
                  navigator.clipboard.writeText(webhookUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${borderColor}`, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', cursor: webhookUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? '#16a34a' : txtMid, transition: 'color 0.2s' }}
              >
                {copied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setStep(1)}>Voltar</button>
              <button style={btnPrimary} onClick={() => setStep(3)}>Próximo</button>
            </div>
            <button style={skipLink} onClick={close}>Pular tutorial</button>
          </>
        )}

        {/* Passo 3 — WhatsApp */}
        {step === 3 && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>💬</div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', fontFamily: FONT }}>Passo 3 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: txtHi, margin: '0 0 10px', fontFamily: FONT }}>Quer enviar WhatsApp automático?</h2>
            <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.6, margin: '0 0 24px', fontFamily: FONT }}>
              Conecte sua conta Z-API para enviar mensagens automáticas quando um lead entrar. Você pode configurar depois em <strong style={{ color: txtHi }}>Integrações → WhatsApp</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setStep(4)}>Fazer depois</button>
              <button style={btnPrimary} onClick={() => { close(); navigate('/whatsapp'); }}>Configurar agora</button>
            </div>
            <button style={skipLink} onClick={close}>Pular tutorial</button>
          </>
        )}

        {/* Passo 4 — Meta Ads */}
        {step === 4 && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '14px' }}>📊</div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px', fontFamily: FONT }}>Passo 4 de {TOTAL_STEPS}</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: txtHi, margin: '0 0 10px', fontFamily: FONT }}>Conecte o Meta Ads</h2>
            <p style={{ fontSize: '14px', color: txtMid, lineHeight: 1.6, margin: '0 0 24px', fontFamily: FONT }}>
              Para ver suas campanhas e métricas de tráfego no dashboard, configure seu token em <strong style={{ color: txtHi }}>Integrações → Configurações</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={btnSecondary} onClick={close}>Concluir</button>
              <button style={btnPrimary} onClick={() => { close(); navigate('/configuracoes'); }}>Configurar agora</button>
            </div>
            <button style={skipLink} onClick={close}>Pular tutorial</button>
          </>
        )}
      </div>

      <style>{`
        @keyframes tut-fade { from{opacity:0} to{opacity:1} }
        @keyframes tut-up { from{opacity:0;transform:translate(-50%,-47%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </>
  );
}
