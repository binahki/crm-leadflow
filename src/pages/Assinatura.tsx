import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check, MessageCircle } from 'lucide-react';

const FONT = '"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif';
const WA_CONSULTA = 'https://wa.me/5519993929168?text=Olá!%20Preciso%20de%20um%20plano%20personalizado%20para%20minha%20operação.';

interface Feature { label: string; desc?: string; active: boolean; }

function planFeatures(key: 'gratuito' | 'starter' | 'pro'): Feature[] {
  const quizLabel =
    key === 'gratuito' ? '1 Quiz (crie do zero)' :
    key === 'starter'  ? '1 Quiz + Modelo com perguntas validadas' :
                         '3 Quizzes + Modelo com perguntas validadas';

  const active = (n: number) =>
    key === 'gratuito' ? n <= 4 :
    key === 'starter'  ? n <= 9 :
    true;

  return [
    { label: `Leads/mês: ${{ gratuito: '50', starter: '250', pro: '600' }[key]}`, active: active(1) },
    { label: 'CRM completo',         active: active(2) },
    { label: 'Dashboard Meta Ads',   active: active(3) },
    { label: quizLabel,              active: active(4) },
    { label: 'Rastreamento do quiz', active: active(5) },
    { label: 'Modelo de alta conversão', desc: 'Perguntas validadas prontas pra copiar e colar', active: active(6) },
    { label: 'IA Ravena™',           desc: 'Nossa IA otimiza e escala enquanto você dorme',        active: active(7) },
    { label: 'Gestor de Tráfego',    desc: 'Nossa equipe gerencia seus anúncios por você',          active: active(8) },
    { label: 'API WhatsApp oficial', active: active(9)  },
    { label: 'Múltiplos usuários',   active: active(10) },
    { label: 'Suporte prioritário',  active: active(11) },
  ];
}

const PLANS = [
  {
    key: 'gratuito' as const,
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para dar os primeiros passos e conhecer a plataforma.',
    color: '#6b7280',
    cta: 'Plano atual',
    current: true,
    popular: false,
    elevated: false,
  },
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 'R$ 497',
    period: '/mês',
    description: 'CRM, IA Ravena e Gestor de Tráfego incluídos.',
    color: '#2563eb',
    shadow: '0 24px 64px rgba(37,99,235,0.22), 0 0 0 4px rgba(37,99,235,0.1)',
    cta: 'Assinar Starter',
    current: false,
    popular: true,
    elevated: true,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 'R$ 997',
    period: '/mês',
    description: 'Volume maior, WhatsApp oficial e equipe dedicada.',
    color: '#8b5cf6',
    shadow: '0 8px 24px rgba(139,92,246,0.12), 0 0 0 4px rgba(139,92,246,0.08)',
    cta: 'Assinar Pro',
    current: false,
    popular: false,
    elevated: false,
  },
] as const;

function FeatureRow({ f, isLast, dark, bdr, txt, txtMid }: {
  f: Feature; isLast: boolean; dark: boolean; bdr: string; txt: string; txtMid: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: isLast ? 'none' : `1px solid ${bdr}`,
    }}>
      <div style={{ flexShrink: 0, marginTop: '2px' }}>
        {f.active ? (
          <div style={{
            width: '17px', height: '17px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={10} color="#10b981" strokeWidth={3} />
          </div>
        ) : (
          <div style={{
            width: '17px', height: '17px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.35,
          }}>
            <div style={{ width: '10px', height: '1.5px', borderRadius: '1px', background: txtMid }} />
          </div>
        )}
      </div>
      <div style={{ opacity: f.active ? 1 : 0.38 }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: txt, lineHeight: 1.35, display: 'block' }}>
          {f.label}
        </span>
        {f.desc && f.active && (
          <span style={{ fontSize: '11px', color: txtMid, lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
            {f.desc}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const pageBg  = dark ? '#0a0a0c' : '#f3f4f6';
  const cardBg  = dark ? 'rgba(16,16,20,0.85)' : '#ffffff';
  const txt     = dark ? '#f0f0f2' : '#0f172a';
  const txtMid  = dark ? '#6b7280' : '#64748b';
  const bdr     = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <AppLayout leadCount={leads.length}>
      {/* DM Sans font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');`}</style>

      <div style={{ minHeight: '100vh', background: pageBg, padding: '48px 24px 72px', fontFamily: FONT }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <p style={{
              display: 'inline-block',
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#2563eb',
              background: dark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)',
              padding: '4px 12px', borderRadius: '99px',
              margin: '0 0 16px',
            }}>
              Planos & Assinatura
            </p>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: txt, margin: '0 0 12px', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              Escolha seu plano
            </h1>
            <p style={{ fontSize: '15px', color: txtMid, lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
              Comece grátis. Escale quando estiver pronto.
            </p>
          </div>

          {/* Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            alignItems: 'stretch',
          }}>
            {PLANS.map(plan => {
              const features = planFeatures(plan.key);

              return (
                <div key={plan.key} style={{ position: 'relative', transform: plan.elevated ? 'translateY(-10px)' : 'none' }}>

                  {/* Popular badge */}
                  {plan.popular && (
                    <div style={{
                      position: 'absolute', top: '-14px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#2563eb', color: '#fff',
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '4px 14px', borderRadius: '99px',
                      whiteSpace: 'nowrap', zIndex: 2,
                      boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                    }}>
                      O mais popular
                    </div>
                  )}

                  {/* Card */}
                  <div style={{
                    height: '100%',
                    background: dark ? cardBg : '#ffffff',
                    backdropFilter: dark ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: dark ? 'blur(12px)' : 'none',
                    border: plan.current
                      ? `1px solid ${bdr}`
                      : `2px solid ${plan.color}`,
                    borderRadius: '20px',
                    padding: '28px 22px 22px',
                    display: 'flex', flexDirection: 'column',
                    boxSizing: 'border-box',
                    boxShadow: plan.elevated
                      ? ('shadow' in plan ? plan.shadow : 'none')
                      : 'shadow' in plan
                        ? plan.shadow
                        : (dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)'),
                    transition: 'box-shadow 0.2s',
                  }}>

                    {/* Plan label */}
                    <p style={{
                      fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: plan.color, margin: '0 0 14px',
                    }}>
                      {plan.name}
                    </p>

                    {/* Price */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '42px', fontWeight: 800, color: txt, letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {plan.price}
                      </span>
                      <span style={{ fontSize: '13px', color: txtMid, fontWeight: 500 }}>{plan.period}</span>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: '13px', color: txtMid, lineHeight: 1.55, margin: '0 0 20px', minHeight: '38px' }}>
                      {plan.description}
                    </p>

                    {/* Divider */}
                    <div style={{ height: '1px', background: bdr, marginBottom: '2px' }} />

                    {/* Features */}
                    <div style={{ flex: 1 }}>
                      {features.map((f, i) => (
                        <FeatureRow
                          key={i} f={f}
                          isLast={i === features.length - 1}
                          dark={dark} bdr={bdr} txt={txt} txtMid={txtMid}
                        />
                      ))}
                    </div>

                    {/* CTA button */}
                    <button
                      style={{
                        marginTop: '20px',
                        width: '100%', padding: '13px',
                        borderRadius: '11px', border: 'none',
                        background: plan.current
                          ? (dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9')
                          : plan.color,
                        color: plan.current ? txtMid : '#fff',
                        fontSize: '13px', fontWeight: 700,
                        cursor: plan.current ? 'default' : 'pointer',
                        fontFamily: FONT,
                        letterSpacing: '-0.01em',
                        transition: 'opacity 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!plan.current) {
                          e.currentTarget.style.opacity = '0.88';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {plan.current ? 'Plano atual' : plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer WA link */}
          <div style={{ textAlign: 'center', marginTop: '44px' }}>
            <a
              href={WA_CONSULTA}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '99px',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
                color: txtMid, fontSize: '13px', fontWeight: 600,
                textDecoration: 'none',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#25d366';
                e.currentTarget.style.color = '#25d366';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
                e.currentTarget.style.color = txtMid;
              }}
            >
              <MessageCircle size={15} />
              Precisa de mais? Fale com a gente
            </a>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
