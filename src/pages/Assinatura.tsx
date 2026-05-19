import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';

const FONT = '"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif';
const WA_CONSULTA = 'https://wa.me/5519993929168?text=Olá!%20Preciso%20de%20um%20plano%20personalizado%20para%20minha%20operação.';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 'R$ 497',
    color: '#2563eb',
    current: true,
    popular: false,
    description: 'Para quem quer começar a captar revendedoras com automação.',
    cta: 'Seu Plano Atual',
    features: [
      'Até 500 leads/mês',
      '1 quiz ativo',
      '1 usuário',
      'CRM completo',
      'WhatsApp integrado',
      'Dashboard Meta Ads',
      'Automação de atendimento',
      'IA Ravena™ otimizando campanhas diariamente',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 997',
    color: '#7c3aed',
    current: false,
    popular: true,
    description: 'Para empresas que querem escalar com suporte profissional.',
    cta: 'Mudar para Pro',
    features: [
      'Até 2.000 leads/mês',
      '3 quizzes ativos',
      '3 usuários',
      'Tudo do Starter',
      'API oficial do WhatsApp',
      'Inbox profissional em tempo real',
      'Gestor de tráfego dedicado',
      'Campanhas criadas por nossa equipe',
      'IA Ravena™ com otimização avançada diária',
    ],
  },
  {
    key: 'elite',
    name: 'Elite',
    price: 'R$ 1.497',
    color: '#059669',
    current: false,
    popular: false,
    description: 'Para operações que querem crescimento acelerado e máxima automação.',
    cta: 'Mudar para Elite',
    features: [
      'Leads ilimitados',
      'Quizzes ilimitados',
      'Usuários ilimitados',
      'Tudo do Pro',
      'Reunião mensal',
      'Prioridade máxima',
      'Recursos premium e beta',
    ],
  },
];

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const pageBg  = dark ? '#0f0f11' : '#f5f5f7';
  const cardBg  = dark ? '#1a1a1e' : '#ffffff';
  const txt     = dark ? '#f4f4f5' : '#111827';
  const txtMid  = dark ? '#71717a' : '#6b7280';
  const bdr     = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <AppLayout leadCount={leads.length}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');`}</style>

      <div style={{ minHeight: '100vh', background: pageBg, padding: '44px 24px 72px', fontFamily: FONT }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h1 style={{
              fontSize: '36px', fontWeight: 800, color: txt,
              margin: '0 0 10px', letterSpacing: '-0.04em', lineHeight: 1.1,
            }}>
              Minha Assinatura
            </h1>
            <p style={{ fontSize: '15px', color: txtMid, margin: 0, lineHeight: 1.6 }}>
              Gerencie seu plano e turbine seus resultados com o Floow Pro.
            </p>
          </div>

          {/* Cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            alignItems: 'start',
          }}>
            {PLANS.map(plan => (
              <div
                key={plan.key}
                style={{
                  position: 'relative',
                  transform: plan.popular ? 'translateY(-12px)' : 'none',
                }}
              >
                {/* Badge */}
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: '-14px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '4px 14px', borderRadius: '99px',
                    whiteSpace: 'nowrap', zIndex: 2,
                    boxShadow: `0 4px 14px ${plan.color}55`,
                  }}>
                    Mais Popular
                  </div>
                )}

                {/* Card */}
                <div style={{
                  background: cardBg,
                  border: plan.popular
                    ? `2px solid ${plan.color}`
                    : `1px solid ${bdr}`,
                  borderRadius: '16px',
                  padding: '32px 28px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: plan.popular
                    ? `0 8px 40px rgba(124,58,237,0.15)`
                    : '0 4px 24px rgba(0,0,0,0.07)',
                }}>

                  {/* Plan name */}
                  <p style={{
                    fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: plan.color, margin: '0 0 12px',
                  }}>
                    {plan.name}
                  </p>

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                    <span style={{
                      fontSize: '48px', fontWeight: 800, color: txt,
                      letterSpacing: '-0.04em', lineHeight: 1,
                    }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: '14px', color: txtMid, fontWeight: 500 }}>/mês</span>
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '13px', color: txtMid,
                    lineHeight: 1.6, margin: '0 0 20px',
                  }}>
                    {plan.description}
                  </p>

                  {/* Divider */}
                  <div style={{ height: '1px', background: bdr, marginBottom: '16px' }} />

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginBottom: '28px' }}>
                    {plan.features.map((f, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '8px 0',
                          borderBottom: i < plan.features.length - 1 ? `1px solid ${bdr}` : 'none',
                        }}
                      >
                        {/* Check circle */}
                        <div style={{
                          flexShrink: 0, marginTop: '1px',
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: 'rgba(16,185,129,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={11} color="#10b981" strokeWidth={3} />
                        </div>
                        {/* Label */}
                        <span style={{
                          fontSize: '13px', fontWeight: 500, color: txt,
                          lineHeight: 1.45, wordBreak: 'break-word',
                        }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    style={{
                      width: '100%', padding: '13px',
                      borderRadius: '10px', border: 'none',
                      background: plan.current
                        ? (dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9')
                        : plan.color,
                      color: plan.current ? txtMid : '#fff',
                      fontSize: '14px', fontWeight: 700,
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
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: '48px', fontSize: '13px', color: txtMid }}>
            Precisa de um plano personalizado?{' '}
            <a
              href={WA_CONSULTA}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#25d366', fontWeight: 600, textDecoration: 'none' }}
            >
              Fale com a gente no WhatsApp
            </a>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}
