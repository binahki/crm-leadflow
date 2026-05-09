import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const EDGE_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/criar-org';

function mascaraDocumento(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 14);
  if (nums.length <= 11) {
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return nums
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function CadastroPage() {
  const navigate = useNavigate();
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [documento, setDocumento]     = useState('');
  const [email, setEmail]             = useState('');
  const [senha, setSenha]             = useState('');
  const [confirmar, setConfirmar]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState('');

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1px solid #27272a', background: '#111113',
    color: '#f4f4f5', fontSize: '14px', outline: 'none',
    fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_empresa: nomeEmpresa, email, senha, documento: documento.replace(/\D/g, '') || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro || 'Erro ao criar conta. Tente novamente.');
      } else {
        navigate('/login', { state: { msg: 'Conta criada! Trial de 7 dias ativado. Faça login.' } });
      }
    } catch {
      setErro('Não foi possível conectar. Verifique sua internet.');
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#090909', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#f4f4f5', letterSpacing: '-0.02em' }}>Floow CRM</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f4f4f5', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            Comece seu teste grátis de 7 dias
          </h1>
          <p style={{ fontSize: '13.5px', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
            R$ 99,90/mês após o período de teste.<br />Cancele quando quiser.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#111113', border: '1px solid #1e1e22', borderRadius: '18px', padding: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                Nome da empresa
              </label>
              <input
                style={inp} type="text" required placeholder="Ex: Minha Loja" autoFocus
                value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                onBlur={e => (e.target.style.borderColor = '#27272a')}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                CNPJ / CPF <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#52525b' }}>(opcional)</span>
              </label>
              <input
                style={inp} type="text" placeholder="000.000.000-00 ou 00.000.000/0000-00" maxLength={18}
                value={documento} onChange={e => setDocumento(mascaraDocumento(e.target.value))}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                onBlur={e => (e.target.style.borderColor = '#27272a')}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                style={inp} type="email" required placeholder="seu@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                onBlur={e => (e.target.style.borderColor = '#27272a')}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                Senha
              </label>
              <input
                style={inp} type="password" required placeholder="Mínimo 8 caracteres" minLength={8}
                value={senha} onChange={e => setSenha(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                onBlur={e => (e.target.style.borderColor = '#27272a')}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                Confirmar senha
              </label>
              <input
                style={inp} type="password" required placeholder="Repita a senha"
                value={confirmar} onChange={e => setConfirmar(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                onBlur={e => (e.target.style.borderColor = '#27272a')}
              />
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '13px', lineHeight: 1.5 }}>
                {erro}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: loading ? '#27272a' : '#10b981', color: loading ? '#71717a' : '#fff', fontSize: '14px', fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: FONT, transition: 'background 0.15s', marginTop: '4px' }}
            >
              {loading ? 'Criando conta…' : 'Criar minha conta'}
            </button>
          </form>
        </div>

        {/* Link login */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13.5px', color: '#71717a' }}>
          Já tenho conta?{' '}
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
