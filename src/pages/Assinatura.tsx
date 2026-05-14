import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check, Zap, Star, Shield } from 'lucide-react';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

const PLANS = [
  {
    name: 'Essencial',
    price: 'R$ 197',
    period: '/mês',
    description: 'Para quem está começando e precisa do básico para gerenciar seus leads.',
    features: [
      'Até 500 leads/mês',
      'Integração Meta Ads (1 conta)',
      'Inbox WhatsApp Básico',
      'Dashboard de Métricas',
      'Suporte via Email'
    ],
    current: true,
    color: '#3b82f6'
  },
  {
    name: 'Pro',
    price: 'R$ 397',
    period: '/mês',
    description: 'O plano mais popular para empresas em crescimento.',
    features: [
      'Leads Ilimitados',
      'Múltiplas Contas de Anúncios',
      'Inbox WhatsApp Profissional',
      'CRM Kanban Avançado',
      'Disparos em Massa (2.000/dia)',
      'Suporte Prioritário'
    ],
    current: false,
    popular: true,
    color: '#8b5cf6'
  },
  {
    name: 'Elite',
    price: 'R$ 797',
    period: '/mês',
    description: 'Para grandes operações que buscam escala e automação total.',
    features: [
      'Tudo do Plano Pro',
      'Treinamento VIP Mensal',
      'Account Manager Dedicado',
      'API Aberta para Integrações',
      'Customização de Funil Extra',
      'Fila de Atendimento Inteligente'
    ],
    current: false,
    color: '#10b981'
  }
];

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const bdr = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', fontFamily: FONT, maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.04em' }}>Minha Assinatura</h1>
          <p style={{ fontSize: '16px', color: txtMid, marginTop: '8px' }}>Gerencie seu plano e turbine seus resultados com o Floow Pro.</p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px',
          marginBottom: '48px'
        }}>
          {PLANS.map((plan) => (
            <div key={plan.name} style={{
              background: dark ? '#111113' : '#ffffff',
              border: `2px solid ${plan.popular ? plan.color : bdr}`,
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: plan.popular ? `0 20px 40px ${plan.color}20` : 'none',
              transform: plan.popular ? 'scale(1.05)' : 'none',
              zIndex: plan.popular ? 1 : 0
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: plan.color,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Mais Popular
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{plan.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: txt }}>{plan.price}</span>
                  <span style={{ fontSize: '14px', color: txtMid }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: '14px', color: txtMid, marginTop: '12px', lineHeight: 1.5 }}>{plan.description}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '32px' }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '20px', height: '20px', borderRadius: '50%', 
                      background: `${plan.color}20`, display: 'flex', 
                      alignItems: 'center', justifyContent: 'center' 
                    }}>
                      <Check size={12} color={plan.color} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: '14px', color: txt }}>{feature}</span>
                  </div>
                ))}
              </div>

              <button style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: plan.current ? (dark ? '#27272a' : '#f1f5f9') : plan.color,
                color: plan.current ? txtMid : '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: plan.current ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}>
                {plan.current ? 'Seu Plano Atual' : `Mudar para ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div style={{ 
          background: dark ? '#18181b' : '#f8fafc',
          borderRadius: '24px',
          padding: '40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Zap size={24} color="#f59e0b" style={{ marginBottom: '16px' }} />
            <h4 style={{ color: txt, fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Ativação Instantânea</h4>
            <p style={{ color: txtMid, fontSize: '13px', lineHeight: 1.5 }}>Seu upgrade é liberado imediatamente após a confirmação.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Shield size={24} color="#10b981" style={{ marginBottom: '16px' }} />
            <h4 style={{ color: txt, fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Pagamento Seguro</h4>
            <p style={{ color: txtMid, fontSize: '13px', lineHeight: 1.5 }}>Criptografia de ponta a ponta em todas as transações.</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Star size={24} color="#8b5cf6" style={{ marginBottom: '16px' }} />
            <h4 style={{ color: txt, fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Sem Fidelidade</h4>
            <p style={{ color: txtMid, fontSize: '13px', lineHeight: 1.5 }}>Cancele ou altere seu plano a qualquer momento sem taxas.</p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
