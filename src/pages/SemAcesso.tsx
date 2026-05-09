import { useTheme } from '@/hooks/useTheme';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const SUPORTE_WA = 'https://wa.me/5567999999999';

export default function SemAcessoPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const bg     = dark ? '#090909' : '#f4f4f5';
  const card   = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  return (
    <div style={{
      minHeight: '100vh', background: bg, fontFamily: FONT,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo */}
      <img
        src={dark ? '/logo-light.png' : '/logo-dark.png'}
        alt="Floow CRM"
        style={{ height: '28px', objectFit: 'contain', marginBottom: '36px' }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Card */}
      <div style={{
        background: card, border: `1px solid ${border}`, borderRadius: '20px',
        padding: '40px 32px', maxWidth: '420px', width: '100%', textAlign: 'center',
        boxShadow: dark ? '0 4px 32px rgba(0,0,0,0.45)' : '0 2px 20px rgba(0,0,0,0.07)',
      }}>
        {/* Ícone */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 20px',
          background: dark ? 'rgba(239,68,68,0.12)' : '#fff1f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px',
        }}>
          🔒
        </div>

        <h1 style={{
          fontSize: '22px', fontWeight: 800, color: txt,
          margin: '0 0 10px', letterSpacing: '-0.03em',
        }}>
          Sua assinatura está inativa
        </h1>

        <p style={{
          fontSize: '14px', color: txtMid, lineHeight: 1.65, margin: '0 0 32px',
        }}>
          Para continuar usando o Floow CRM, regularize sua assinatura.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Botão WhatsApp */}
          <a
            href={SUPORTE_WA}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '13px', borderRadius: '12px', border: 'none',
              background: '#25D366', color: '#fff',
              fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(37,211,102,0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com suporte
          </a>

          {/* Botão Tentar novamente */}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '13px', borderRadius: '12px', fontFamily: FONT,
              border: `1px solid ${border}`,
              background: 'transparent', color: txtMid,
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
