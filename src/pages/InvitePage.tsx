import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, User, Send, Check } from 'lucide-react';

export default function InvitePage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [nome,    setNome]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const bg     = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi  = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px 11px 40px',
    borderRadius: '10px', border: `1px solid ${border}`,
    background: dark ? '#1a1a1e' : '#f9fafb',
    color: txtHi, fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
  };

  async function handleInvite() {
    if (!nome.trim() || !email.trim()) { toast.error('Preencha nome e email'); return; }
    if (!email.includes('@')) { toast.error('Email inválido'); return; }
    setLoading(true);

    // Usa signInWithOtp (magic link) — envia email imediatamente sem precisar de admin API
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        data: { full_name: nome.trim() },
        // Redireciona para a raiz do app após clicar no link
        emailRedirectTo: window.location.origin + '/',
      },
    });

    setLoading(false);

    if (error) {
      toast.error(`Erro ao enviar convite: ${error.message}`);
    } else {
      setSent(true);
      toast.success('Convite enviado! Email de acesso enviado para ' + email.trim());
      setNome(''); setEmail('');
    }
  }

  return (
    <AppLayout>
      <div style={{ padding: '32px', background: bg, minHeight: '100vh' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>

          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>
              Convidar Usuário
            </h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '6px' }}>
              A pessoa receberá um email com link de acesso imediato ao dashboard.
            </p>
          </div>

          <div style={{ background: cardBg, borderRadius: '18px', border: `1px solid ${border}`, padding: '28px' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: txtHi, margin: '0 0 8px' }}>Convite enviado!</h3>
                <p style={{ fontSize: '13px', color: txtMid, margin: '0 0 20px', lineHeight: 1.6 }}>
                  Um link de acesso foi enviado para o email informado. A pessoa clica no link e já entra no dashboard.
                </p>
                <button onClick={() => setSent(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Convidar outra pessoa
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: txtMid, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome completo</label>
                    <div style={{ position: 'relative' }}>
                      <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: dark ? '#52525b' : '#9ca3af' }} />
                      <input placeholder="Nome e sobrenome" value={nome} onChange={e => setNome(e.target.value)} style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#2563eb')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: txtMid, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: dark ? '#52525b' : '#9ca3af' }} />
                      <input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#2563eb')}
                        onBlur={e => (e.target.style.borderColor = border)}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', background: dark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: `1px solid ${dark ? 'rgba(37,99,235,0.2)' : '#bfdbfe'}` }}>
                  <p style={{ fontSize: '12.5px', color: dark ? '#93c5fd' : '#1e40af', margin: 0, lineHeight: 1.6 }}>
                    📧 A pessoa receberá um <strong>Magic Link</strong> por email. Ao clicar, ela entra direto no dashboard sem precisar de senha. O link expira em 24h.
                  </p>
                </div>

                <button onClick={handleInvite} disabled={loading || !nome.trim() || !email.trim()} style={{
                  width: '100%', marginTop: '16px', padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: loading || !nome.trim() || !email.trim() ? (dark ? '#27272a' : '#e5e7eb') : '#2563eb',
                  color: loading || !nome.trim() || !email.trim() ? (dark ? '#52525b' : '#9ca3af') : '#fff',
                  fontSize: '14px', fontWeight: 600,
                  cursor: loading || !nome.trim() || !email.trim() ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                  {loading
                    ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Enviando…</>
                    : <><Send style={{ width: '15px', height: '15px' }} /> Enviar convite</>
                  }
                </button>
              </>
            )}
          </div>

          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: cardBg, border: `1px solid ${border}` }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: txtHi, margin: '0 0 8px' }}>Como funciona</h4>
            <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                'Você preenche o nome e email da pessoa',
                'Ela recebe um email com o Magic Link em segundos',
                'Clica no link e já entra no dashboard',
                'Pode configurar senha depois em Configurações',
              ].map((step, i) => (
                <li key={i} style={{ fontSize: '12.5px', color: txtMid, lineHeight: 1.6 }}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </AppLayout>
  );
}
