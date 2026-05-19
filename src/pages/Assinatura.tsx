import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';

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
    { label: 'CRM completo',           active: active(2) },
    { label: 'Dashboard Meta Ads',     active: active(3) },
    { label: quizLabel,                active: active(4) },
    { label: 'Rastreamento do quiz',   active: active(5) },
    {
      label: 'Modelo de alta conversão',
      desc: 'Perguntas validadas prontas pra copiar e colar',
      active: active(6),
    },
    {
      label: 'IA Ravena™',
      desc: 'Nossa IA que trabalha enquanto você dorme — otimiza e escala para trazer revendedoras a baixo custo',
      active: active(7),
    },
    {
      label: 'Gestor de Tráfego',
      desc: 'Sim, nossa equipe gerenciando seus anúncios por você',
      active: active(8),
    },
    { label: 'API WhatsApp oficial',   active: active(9)  },
    { label: 'Múltiplos usuários',     active: active(10) },
    { label: 'Suporte prioritário',    active: active(11) },
  ];
}

const PLANS = [
  {
    key: 'gratuito' as const,
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para conhecer a plataforma e dar os primeiros passos.',
    color: '#6b7280',
    cta: 'Plano atual',
    current: true,
    popular: false,
  },
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 'R$ 497',
    period: '/mês',
    description: 'CRM completo + IA Ravena + Gestor de tráfego incluído.',
    color: '#2563eb',
    cta: 'Assinar Starter',
    current: false,
    popular: true,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 'R$ 997',
    period: '/mês',
    description: 'Para quem escala e precisa de mais volume e recursos.',
    color: '#8b5cf6',
    cta: 'Assinar Pro',
    current: false,
    popular: false,
  },
];

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const bdr    = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const cardBg = dark ? '#111113' : '#ffffff';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', fontFamily: FONT, maxWidth: '1020px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.04em' }}>
            Planos & Assinatura
          </h1>
          <p style={{ fontSize: '15px', color: txtMid, marginTop: '8px' }}>
            Escolha o plano ideal para sua operação.
          </p>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px', alignItems: 'start' }}>
          {PLANS.map(plan => {
            const features = planFeatures(plan.key);
            return (
              <div key={plan.key} style={{
                background: cardBg,
                border: `2px solid ${plan.popular ? plan.color : bdr}`,
                borderRadius: '20px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: plan.popular ? `0 8px 32px ${plan.color}20` : 'none',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: '-12px', left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff',
                    padding: '4px 14px', borderRadius: '99px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    O mais popular
                  </div>
                )}

                {/* Plan name */}
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                  {plan.name}
                </h3>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '30px', fontWeight: 800, color: txt }}>{plan.price}</span>
                  <span style={{ fontSize: '13px', color: txtMid }}>{plan.period}</span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '13px', color: txtMid, lineHeight: 1.5, margin: '0 0 20px' }}>
                  {plan.description}
                </p>

                {/* Divider */}
                <div style={{ height: '1px', background: bdr, marginBottom: '20px' }} />

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', flex: 1 }}>
                  {features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', opacity: f.active ? 1 : 0.45 }}>
                      <span style={{ fontSize: '14px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>
                        {f.active ? '✅' : '🔒'}
                      </span>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: txt, lineHeight: 1.4 }}>
                          {f.label}
                        </span>
                        {f.desc && (
                          <p style={{ fontSize: '11px', color: txtMid, margin: '2px 0 0', lineHeight: 1.4 }}>
                            {f.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button style={{
                  width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                  background: plan.current ? (dark ? '#27272a' : '#f1f5f9') : plan.color,
                  color: plan.current ? txtMid : '#fff',
                  fontSize: '14px', fontWeight: 700,
                  cursor: plan.current ? 'default' : 'pointer',
                  fontFamily: FONT,
                }}>
                  {plan.current ? 'Plano atual' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Consultation CTA */}
        <div style={{ textAlign: 'center', padding: '0 0 32px' }}>
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
    </AppLayout>
  );
}
