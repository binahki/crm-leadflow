import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const EDGE_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead';
const TOTAL_STEPS = 4;
const SIDEBAR_W = 232; // 224px sidebar + 8px gap

const STEPS = [
  {
    id: 1,
    emoji: '👋',
    title: 'Bem-vindo ao Floow!',
    text: 'Vamos te mostrar as principais funcionalidades em 4 passos rápidos.',
    badge: '📍 Menu → Dashboard',
    desktopPos: { left: SIDEBAR_W, top: 100 },
    primaryLabel: 'Começar',
    secondaryLabel: null as string | null,
    primaryNav: undefined as string | undefined,
  },
  {
    id: 2,
    emoji: '🔗',
    title: 'Receba leads automaticamente',
    text: 'Cole a URL do webhook no seu quiz da Inlead para receber leads em tempo real.',
    badge: '📍 Menu → Integrações → Webhook',
    desktopPos: { left: SIDEBAR_W, top: 380 },
    primaryLabel: 'Próximo',
    secondaryLabel: null as string | null,
    primaryNav: undefined as string | undefined,
  },
  {
    id: 3,
    emoji: '💬',
    title: 'WhatsApp automático',
    text: 'Conecte a Z-API para enviar mensagens automáticas quando um lead entrar.',
    badge: '📍 Menu → Integrações → WhatsApp',
    desktopPos: { left: SIDEBAR_W, top: 420 },
    primaryLabel: 'Configurar agora',
    secondaryLabel: 'Pular' as string | null,
    primaryNav: '/whatsapp',
  },
  {
    id: 4,
    emoji: '📊',
    title: 'Conecte o Meta Ads',
    text: 'Configure seu token do Facebook para ver campanhas e métricas no dashboard.',
    badge: '📍 Menu → Integrações → Meta Ads',
    desktopPos: { left: SIDEBAR_W, top: 460 },
    primaryLabel: 'Configurar agora',
    secondaryLabel: 'Concluir' as string | null,
    primaryNav: '/meta-ads',
  },
];

export function TutorialPopup() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!ready || !orgId) return;
    // Nunca mostrar para admin ou gestor acessando conta de cliente
    if (user?.email === 'admin@floow.com') return;
    if (localStorage.getItem('admin_viewing_org')) return;
    // Chave usa orgId diretamente — nunca null aqui
    if (localStorage.getItem(`tutorial_concluido_${orgId}`) === 'true') return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [ready, orgId, user?.email]); // eslint-disable-line

  useEffect(() => {
    if (step !== 2 || !orgId || webhookUrl) return;
    // Busca o webhook Principal da tabela webhooks (não mais de configuracoes_whatsapp)
    (supabase as any)
      .from('webhooks')
      .select('token')
      .eq('org_id', orgId)
      .eq('nome', 'Principal')
      .single()
      .then(({ data }: any) => {
        if (data?.token) {
          setWebhookUrl(`${EDGE_URL}?token=${data.token}`);
        }
      });
  }, [step, orgId, webhookUrl]);

  if (!open) return null;

  function close() {
    // Salva com orgId diretamente — evita bug se orgId mudou durante o tutorial
    if (orgId) localStorage.setItem(`tutorial_concluido_${orgId}`, 'true');
    setOpen(false);
  }

  function next() {
    if (step >= TOTAL_STEPS) { close(); return; }
    setStep(s => s + 1);
  }

  const current = STEPS[step - 1];

  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const bg     = dark ? '#18181b' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const shadow = dark
    ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)'
    : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)';

  // Posição do card
  const cardStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '320px',
        maxWidth: 'calc(100vw - 32px)',
      }
    : {
        position: 'fixed',
        left: `${current.desktopPos.left}px`,
        top: `${current.desktopPos.top}px`,
        width: '300px',
      };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.25)', animation: 'tut-fade 0.2s ease' }}
        onClick={close}
      />

      {/* Card */}
      <div
        style={{
          ...cardStyle,
          zIndex: 9991,
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: '16px',
          padding: '20px',
          boxShadow: shadow,
          fontFamily: FONT,
          animation: 'tut-pop 0.22s cubic-bezier(0.32,0.72,0,1)',
          position: 'fixed',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Seta apontando para a esquerda (menu) — só no desktop */}
        {!isMobile && (
          <div style={{
            position: 'absolute',
            left: '-8px',
            top: '20px',
            width: 0,
            height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: `8px solid ${bg}`,
          }} />
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{current.emoji}</span>
            <div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {STEPS.map(s => (
                  <div key={s.id} style={{ width: s.id === step ? '16px' : '6px', height: '4px', borderRadius: '99px', background: s.id === step ? '#16a34a' : (dark ? '#27272a' : '#e5e7eb'), transition: 'all 0.25s ease' }} />
                ))}
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.01em' }}>
                {current.title}
              </h3>
            </div>
          </div>
          <button
            onClick={close}
            style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px' }}
          >
            <X style={{ width: '10px', height: '10px', color: txtMid }} />
          </button>
        </div>

        {/* Badge de localização */}
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '99px', background: dark ? 'rgba(22,163,74,0.12)' : '#f0fdf4', border: '1px solid rgba(22,163,74,0.2)', fontSize: '11px', color: '#16a34a', fontWeight: 500, marginBottom: '10px' }}>
          {current.badge}
        </div>

        {/* Texto */}
        <p style={{ fontSize: '13px', color: txtMid, lineHeight: 1.6, margin: '0 0 14px' }}>
          {current.text}
        </p>

        {/* Webhook URL — só no passo 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.04)' : '#f4f4f5', border: `1px solid ${border}`, marginBottom: '14px' }}>
            <span style={{ flex: 1, fontSize: '10.5px', color: txtMid, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>
              {webhookUrl || 'Carregando…'}
            </span>
            <button
              onClick={() => {
                if (!webhookUrl) return;
                navigator.clipboard.writeText(webhookUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
              style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${border}`, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', cursor: webhookUrl ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: copied ? '#16a34a' : txtMid }}
            >
              {copied ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
            </button>
          </div>
        )}

        {/* Botões principais */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {current.secondaryLabel && (
            <button
              onClick={() => { if (current.secondaryLabel === 'Concluir') { close(); return; } next(); }}
              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}
            >
              {current.secondaryLabel}
            </button>
          )}
          <button
            onClick={() => { if (current.primaryNav) { close(); navigate(current.primaryNav); return; } next(); }}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          >
            {current.primaryLabel}
            {!current.primaryNav && step < TOTAL_STEPS && <ArrowRight style={{ width: '13px', height: '13px' }} />}
          </button>
        </div>

        {/* Pular tutorial */}
        <button
          onClick={close}
          style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: txtMid, fontSize: '12px', cursor: 'pointer', fontFamily: FONT, textAlign: 'center', textDecoration: 'underline', padding: '2px 0' }}
        >
          Pular tutorial
        </button>
      </div>

      <style>{`
        @keyframes tut-fade { from{opacity:0} to{opacity:1} }
        @keyframes tut-pop { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </>
  );
}
