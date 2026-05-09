import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';
import { Save, Building2, Lock } from 'lucide-react';
import { toast } from 'sonner';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const ATUALIZAR_USUARIO_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/atualizar-usuario';

function mascaraDocumento(valor: string): string {
  const digits = valor.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function ConfiguracoesPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();
  const { user } = useAuth();

  const [nome, setNome]           = useState('');
  const [documento, setDocumento] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase
      .from('organizations')
      .select('nome, documento')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        if (data) {
          setNome((data as any).nome || '');
          setDocumento((data as any).documento || '');
        }
        setLoadingData(false);
      });
  }, [orgId, orgReady]);

  async function handleSave() {
    if (!orgId) { toast.error('Organização não encontrada'); return; }

    if (novaSenha && novaSenha.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (novaSenha && novaSenha !== confirmSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    setSaving(true);
    try {
      // Atualiza dados da empresa
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ nome: nome.trim(), documento: documento.replace(/\D/g, '') || null })
        .eq('id', orgId);
      if (orgError) { toast.error('Erro ao salvar dados da empresa'); setSaving(false); return; }

      // Atualiza senha se preenchida
      if (novaSenha) {
        const { data: mem } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('org_id', orgId)
          .single();
        const userId = (mem as any)?.user_id;
        if (!userId) { toast.error('Usuário não encontrado'); setSaving(false); return; }

        const res = await fetch(ATUALIZAR_USUARIO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, password: novaSenha }),
        });
        const data = await res.json();
        if (!data.ok) { toast.error(data.erro || 'Erro ao atualizar senha'); setSaving(false); return; }
        setNovaSenha('');
        setConfirmSenha('');
      }

      toast.success('Configurações salvas!');
    } catch {
      toast.error('Erro de conexão');
    }
    setSaving(false);
  }

  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px', overflow: 'hidden',
    boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
    maxWidth: '520px', marginBottom: '16px',
  };
  const cardHeader: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`,
    display: 'flex', alignItems: 'center', gap: '8px',
    background: dark ? '#18181b' : '#fafafa',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: dark ? '#f4f4f5' : '#111827',
    fontSize: '13.5px', outline: 'none', fontFamily: FONT, boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const inpReadonly: React.CSSProperties = {
    ...inp,
    background: dark ? '#0a0a0c' : '#f1f5f9',
    color: dark ? '#52525b' : '#9ca3af',
    cursor: 'default',
  };
  const lbl: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 600,
    color: dark ? '#71717a' : '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    display: 'block', marginBottom: '6px',
  };
  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', fontFamily: FONT }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Configurações</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Dados da empresa e acesso à conta</p>
        </div>

        {loadingData ? (
          <p style={{ color: txtMid, fontSize: '13px' }}>Carregando…</p>
        ) : (
          <>
            {/* Dados da Empresa */}
            <div style={card}>
              <div style={cardHeader}>
                <Building2 style={{ width: '16px', height: '16px', color: '#10b981' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Dados da Empresa</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Nome da empresa</label>
                  <input
                    style={inp} value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Nome da sua empresa"
                    onFocus={e => (e.target.style.borderColor = '#10b981')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                </div>
                <div>
                  <label style={lbl}>CNPJ / CPF</label>
                  <input
                    style={inp}
                    value={documento}
                    onChange={e => setDocumento(mascaraDocumento(e.target.value))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
                    onFocus={e => (e.target.style.borderColor = '#10b981')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                </div>
              </div>
            </div>

            {/* Dados de Acesso */}
            <div style={card}>
              <div style={cardHeader}>
                <Lock style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Dados de Acesso</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Email</label>
                  <input style={inpReadonly} value={user?.email || ''} readOnly />
                </div>
                <div>
                  <label style={lbl}>Nova senha <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
                  <input
                    style={inp} type="password" value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    onFocus={e => (e.target.style.borderColor = '#8b5cf6')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                </div>
                {novaSenha && (
                  <div>
                    <label style={lbl}>Confirmar nova senha</label>
                    <input
                      style={{ ...inp, borderColor: confirmSenha && confirmSenha !== novaSenha ? '#ef4444' : (dark ? '#27272a' : '#e5e7eb') }}
                      type="password" value={confirmSenha}
                      onChange={e => setConfirmSenha(e.target.value)}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      onFocus={e => (e.target.style.borderColor = '#8b5cf6')}
                      onBlur={e => (e.target.style.borderColor = confirmSenha && confirmSenha !== novaSenha ? '#ef4444' : (dark ? '#27272a' : '#e5e7eb'))}
                    />
                    {confirmSenha && confirmSenha !== novaSenha && (
                      <p style={{ fontSize: '12px', color: '#ef4444', margin: '4px 0 0' }}>As senhas não coincidem</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '11px 28px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#10b981', color: saving ? txtMid : '#fff', fontSize: '13.5px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}
            >
              <Save style={{ width: '14px', height: '14px' }} />
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
}
