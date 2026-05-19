import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
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
    {
      label: 'Modelo de alta conversão',
      desc: 'Perguntas validadas prontas pra copiar e colar',
      active: active(6),
    },
    {
      label: 'IA Ravena™',
      desc: 'Nossa IA otimiza e escala enquanto você dorme',
      active: active(7),
    },
    {
      label: 'Gestor de Tráfego',
      desc: 'Nossa equipe gerencia seus anúncios por você',
      active: active(8),
    },
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
    shadow: 'rgba(37,99,235,0.13)',
    ring: 'rgba(37,99,235,0.08)',
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
    shadow: 'rgba(139,92,246,0.13)',
    ring: 'rgba(139,92,246,0.08)',
    cta: 'Assinar Pro',
    current: false,
    popular: false,
    elevated: false,
  },
] as const;

function FeatureRow({ f, planColor, dark, bdr, txt, txtMid }: {
  f: Feature;
  planColor: string;
  dark: boolean;
  bdr: string;
  txt: string;
  txtMid: string;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
      padding: '9px 0',
      borderBottom: `1px solid ${bdr}`,
    }}>
      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {f.active ? (
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={11} color="#10b981" strokeWidth={2.5} />
          </div>
        ) : (
          <div style={{
            width: '18px', height: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.4,
          }}>
            <div style={{ width: '12px', height: '1.5px', borderRadius: '1px', background: txtMid }} />
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ opacity: f.active ? 1 : 0.4 }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: txt, lineHeight: 1.4, display: 'block' }}>
          {f.label}
        </span>
        {f.desc && f.active && (
          <span style={{ fontSize: '11px', color: txtMid, lineHeight: 1.4, display: 'block', marginTop: '1px' }}>
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

  const pageBg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const txt    = dark ? '#f0f0f2' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const bdr    = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ minHeight: '100vh', background: pageBg, padding: '40px 24px 64px', fontFamily: FONT }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: txtMid, margin: '0 0 10px' }}>
              Planos
            </p>
            <h1 style={{ fontSize: '30px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              Escolha seu plano
            </h1>
            <p style={{ fontSize: '14px', color: txtMid, marginTop: '10px', lineHeight: 1.5 }}>
              Comece grátis. Escale quando estiver pronto.
            </p>
          </div>

          {/* Cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            alignItems: 'stretch',
          }}>
            {PLANS.map(plan => {
              const features = planFeatures(plan.key);
              const isColored = !plan.current;

              return (
                <div
                  key={plan.key}
                  style={{
                    position: 'relative',
                    transform: plan.elevated ? 'translateY(-8px)' : 'none',
                  }}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-13px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: plan.color,
                      color: '#fff',
                      fontSize: '10px', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '3px 12px', borderRadius: '99px',
                      whiteSpace: 'nowrap',
                      zIndex: 1,
                    }}>
                      O mais popular
                    </div>
                  )}

                  {/* Card */}
                  <div style={{
                    background: cardBg,
                    border: isColored ? `2px solid ${plan.color}` : `1px solid ${bdr}`,
                    borderRadius: '18px',
                    padding: '28px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxSizing: 'border-box',
                    boxShadow: plan.elevated
                      ? `0 16px 48px ${'shadow' in plan ? plan.shadow : 'transparent'}, 0 0 0 4px ${'ring' in plan ? plan.ring : 'transparent'}`
                      : 'ring' in plan
                        ? `0 0 0 4px ${plan.ring}`
                        : 'none',
                  }}>

                    {/* Plan name */}
                    <p style={{
                      fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.09em', textTransform: 'uppercase',
                      color: plan.color, margin: '0 0 12px',
                    }}>
                      {plan.name}
                    </p>

                    {/* Price */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 800, color: txt, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {plan.price}
                      </span>
                      <span style={{ fontSize: '13px', color: txtMid }}>{plan.period}</span>
                    </div>

                    {/* Description */}
                    <p style={{
                      fontSize: '12px', color: txtMid,
                      lineHeight: 1.55, margin: '0 0 20px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as any,
                      overflow: 'hidden',
                    }}>
                      {plan.description}
                    </p>

                    {/* Divider */}
                    <div style={{ height: '1px', background: bdr, marginBottom: '4px' }} />

                    {/* Features */}
                    <div style={{ flex: 1 }}>
                      {features.map((f, i) => (
                        <FeatureRow
                          key={i}
                          f={f}
                          planColor={plan.color}
                          dark={dark}
                          bdr={i === features.length - 1 ? 'transparent' : bdr}
                          txt={txt}
                          txtMid={txtMid}
                        />
                      ))}
                    </div>

                    {/* CTA */}
                    <button style={{
                      marginTop: '20px',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: plan.current
                        ? (dark ? '#1e1e22' : '#f1f5f9')
                        : plan.color,
                      color: plan.current ? txtMid : '#fff',
                      fontSize: '13px', fontWeight: 700,
                      cursor: plan.current ? 'default' : 'pointer',
                      fontFamily: FONT,
                      letterSpacing: '-0.01em',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { if (!plan.current) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                      {plan.current ? 'Plano atual' : plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer link */}
          <p style={{ textAlign: 'center', marginTop: '36px', fontSize: '12px', color: txtMid }}>
            Precisa de mais?{' '}
            <a
              href={WA_CONSULTA}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: txtMid, textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              Fale com a gente no WhatsApp
            </a>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}
