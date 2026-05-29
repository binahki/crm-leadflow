import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

const FONT = '"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif';
const WA_CONSULTA = 'https://wa.me/5519993929168?text=Olá!%20Preciso%20de%20um%20plano%20personalizado%20para%20minha%20operação.';

type Feature = { label: string; sub?: string; enabled: boolean };
type Plan = { key: string; name: string; price: string; period: string; description: string; color: string; features: Feature[]; cta: string; ctaHref?: string; current: boolean; popular: boolean };

const PLANS: Plan[] = [
  {
    key: 'gratuito',
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para conhecer a plataforma',
    color: '#6b7280',
    features: [
      { label: 'Até 50 leads/mês', enabled: true },
      { label: 'CRM completo', enabled: true },
      { label: 'Dashboard Meta Ads', enabled: true },
      { label: '1 Quiz (crie do zero)', enabled: true },
      { label: 'Rastreamento de sessões do quiz', enabled: true },
      { label: 'Modelo de alta conversão', sub: 'Perguntas validadas prontas pra copiar e colar', enabled: false },
      { label: 'IA Ravena™', sub: 'Nossa IA que trabalha enquanto você dorme — otimiza e escala para trazer revendedoras a baixo custo', enabled: false },
      { label: 'Gestor de Tráfego', sub: 'Nossa equipe gerenciando seus anúncios por você', enabled: false },
      { label: 'API WhatsApp oficial', enabled: false },
      { label: 'Múltiplos usuários', enabled: false },
      { label: 'Suporte prioritário', enabled: false },
    ] as Feature[],
    cta: 'Plano atual',
    current: true,
    popular: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 'R$ 497',
    period: '/mês',
    description: 'Para quem já tem tráfego rodando',
    color: '#2563eb',
    features: [
      { label: 'Até 250 leads/mês', enabled: true },
      { label: 'CRM completo', enabled: true },
      { label: 'Dashboard Meta Ads', enabled: true },
      { label: '1 Quiz + Modelo validado', enabled: true },
      { label: 'Rastreamento de sessões do quiz', enabled: true },
      { label: 'Modelo de alta conversão', sub: 'Perguntas validadas prontas pra copiar e colar', enabled: true },
      { label: 'IA Ravena™', sub: 'Nossa IA que trabalha enquanto você dorme — otimiza e escala para trazer revendedoras a baixo custo', enabled: true },
      { label: 'Gestor de Tráfego', sub: 'Nossa equipe gerenciando seus anúncios por você', enabled: true },
      { label: 'API WhatsApp oficial', enabled: true },
      { label: 'Múltiplos usuários', enabled: false },
      { label: 'Suporte prioritário', enabled: false },
    ] as Feature[],
    cta: 'Assinar Starter',
    current: false,
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 997',
    period: '/mês',
    description: 'Para operações que escalam',
    color: '#8b5cf6',
    features: [
      { label: 'Até 600 leads/mês', enabled: true },
      { label: 'CRM completo', enabled: true },
      { label: 'Dashboard Meta Ads', enabled: true },
      { label: '3 Quizzes + Modelo validado', enabled: true },
      { label: 'Rastreamento de sessões do quiz', enabled: true },
      { label: 'Modelo de alta conversão', sub: 'Perguntas validadas prontas pra copiar e colar', enabled: true },
      { label: 'IA Ravena™', sub: 'Nossa IA que trabalha enquanto você dorme — otimiza e escala para trazer revendedoras a baixo custo', enabled: true },
      { label: 'Gestor de Tráfego', sub: 'Nossa equipe gerenciando seus anúncios por você', enabled: true },
      { label: 'API WhatsApp oficial', enabled: true },
      { label: 'Múltiplos usuários', enabled: true },
      { label: 'Suporte prioritário', enabled: true },
    ] as Feature[],
    cta: 'Assinar Pro',
    current: false,
    popular: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    description: 'Para operações multi-marca e multi-equipe',
    color: '#0ea5e9',
    features: [
      { label: 'Leads ilimitados', enabled: true },
      { label: 'Tudo do plano Pro', enabled: true },
      { label: 'Multi-marca / multi-equipe', enabled: true },
      { label: 'Onboarding dedicado', enabled: true },
      { label: 'Integrações sob medida', enabled: true },
      { label: 'SLA garantido', enabled: true },
      { label: 'Gerente de conta exclusivo', enabled: true },
    ] as Feature[],
    cta: 'Falar com especialista',
    ctaHref: WA_CONSULTA,
    current: false,
    popular: false,
  },
];

const PLAN_ORDER: Record<string, number> = { gratuito: 0, starter: 1, pro: 2, enterprise: 3 };
const KNOWN = ['gratuito', 'starter', 'pro', 'enterprise'];

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { plano: rawPlano, orgId, loading: loadingPlano } = usePlanFeatures();
  // Normalise unknown values (null, 'basic', 'trial', …) to 'gratuito'
  const orgPlano = KNOWN.includes(rawPlano) ? rawPlano : 'gratuito';

  useEffect(() => {
    console.log('[Assinatura] orgId:', orgId, '| plano:', orgPlano, '| loading:', loadingPlano);
  }, [orgId, orgPlano, loadingPlano]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pageBg = dark ? '#0f0f11' : '#f5f5f7';
  const cardBg = dark ? '#1a1a1e' : '#ffffff';
  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const bdr    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <AppLayout leadCount={leads.length}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');`}</style>

      <div style={{ minHeight: '100vh', background: pageBg, fontFamily: FONT }}>
        <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: isMobile ? '24px' : '40px', textAlign: 'center', padding: isMobile ? '0 4px' : '0' }}>
            <h1 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.04em' }}>
              Assinatura
            </h1>
            <p style={{ fontSize: isMobile ? '14px' : '16px', color: txtMid, marginTop: '8px', margin: '8px 0 0' }}>
              Escolha o plano ideal para o seu negócio
            </p>
          </div>

          {/* Plan Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? '16px' : '20px',
            marginBottom: '32px',
          }}>
            {PLANS.map(plan => {
              // Don't commit to any "current" state until the plan is loaded from DB
              const isCurrent     = !loadingPlano && plan.key === orgPlano;
              const cardOrder     = PLAN_ORDER[plan.key] ?? 0;
              const curOrder      = PLAN_ORDER[orgPlano]  ?? 0;
              const isUpgrade     = !loadingPlano && cardOrder > curOrder;
              const isDowngrade   = !loadingPlano && cardOrder < curOrder;
              // "Mais popular" só aparece para quem ainda está no gratuito
              const mostrarPopular = plan.popular && (!loadingPlano && orgPlano === 'gratuito');
              return (
              <div key={plan.key} style={{
                background: cardBg,
                border: `2px solid ${isCurrent ? plan.color : plan.popular ? plan.color : bdr}`,
                borderRadius: '20px',
                padding: isMobile ? '20px' : '28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: plan.popular ? `0 8px 32px ${plan.color}20` : 'none',
              }}>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: '-12px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff',
                    padding: '4px 14px', borderRadius: '99px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    ✓ Plano atual
                  </div>
                )}
                {!isCurrent && mostrarPopular && (
                  <div style={{
                    position: 'absolute', top: '-12px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff',
                    padding: '4px 14px', borderRadius: '99px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    Mais popular
                  </div>
                )}

                {/* Card header */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{
                    fontSize: '13px', fontWeight: 700, color: plan.color,
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px',
                  }}>
                    {plan.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '30px', fontWeight: 800, color: txt, letterSpacing: '-0.03em' }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: '13px', color: txtMid }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: txtMid, lineHeight: 1.4, margin: 0 }}>
                    {plan.description}
                  </p>
                </div>

                {/* Feature list */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '12px',
                  flex: 1, marginBottom: '24px',
                }}>
                  {plan.features.map((feat, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      opacity: feat.enabled ? 1 : 0.35,
                    }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: feat.enabled ? `${plan.color}20` : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}>
                        {feat.enabled ? (
                          <Check size={12} color={plan.color} strokeWidth={3} />
                        ) : (
                          <div style={{
                            width: '10px', height: '2px', borderRadius: '1px',
                            background: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: txt, margin: 0, lineHeight: 1.4 }}>
                          {feat.label}
                        </p>
                        {feat.sub && (
                          <p style={{ fontSize: '11.5px', color: txtMid, margin: '2px 0 0', lineHeight: 1.3 }}>
                            {feat.sub}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {plan.ctaHref && !isCurrent ? (
                  <a
                    href={plan.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block', width: '100%', padding: '13px', borderRadius: '12px',
                      background: plan.color, color: '#fff',
                      fontSize: '14px', fontWeight: 700,
                      textAlign: 'center', textDecoration: 'none',
                      fontFamily: FONT, transition: 'all 0.2s', boxSizing: 'border-box',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {isDowngrade ? 'Fazer downgrade' : plan.cta}
                  </a>
                ) : (
                  <button
                    disabled={isCurrent}
                    style={{
                      width: '100%', padding: '13px', borderRadius: '12px',
                      border: isDowngrade ? `1.5px solid ${dark ? '#3f3f46' : '#d1d5db'}` : 'none',
                      background: isCurrent
                        ? (dark ? '#27272a' : '#f1f5f9')
                        : isDowngrade
                        ? 'transparent'
                        : plan.color,
                      color: isCurrent ? txtMid : isDowngrade ? (dark ? '#a1a1aa' : '#6b7280') : '#fff',
                      fontSize: '14px', fontWeight: 700,
                      cursor: isCurrent ? 'default' : 'pointer',
                      fontFamily: FONT, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {isCurrent ? 'Plano atual' : isUpgrade ? 'Fazer upgrade' : 'Fazer downgrade'}
                  </button>
                )}
              </div>
              );
            })}
          </div>

          {/* Consultation CTA */}
          <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
            <p style={{ fontSize: '13px', color: txtMid, margin: '0 0 12px' }}>
              Precisa de mais volume ou recursos personalizados?
            </p>
            <a
              href={WA_CONSULTA}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '10px',
                border: `1px solid ${bdr}`, background: 'transparent',
                color: txtMid, fontSize: '13px', fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#25d366'; e.currentTarget.style.color = '#25d366'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = txtMid; }}
            >
              💬 Falar com especialista → WhatsApp
            </a>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
