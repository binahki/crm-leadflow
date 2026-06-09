import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';
import { Save, Building2, Lock, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { TERMINOLOGY_PRESETS, DEFAULT_TERMINOLOGY, toDb, invalidateTerminologyCache, invalidateModeloCache } from '@/hooks/useTerminology';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';


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

  const [userName, setUserName]   = useState('');
  const [nome, setNome]           = useState('');
  const [documento, setDocumento] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [modeloNegocio, setModeloNegocio] = useState('');
  const [savingModelo, setSavingModelo] = useState(false);


  useEffect(() => {
    if (!orgReady || !orgId) return;

    if (user) setUserName(user.user_metadata?.full_name || '');
    invalidateModeloCache(orgId);

    const fetchOrg = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('organizations')
          .select('nome, modelo_negocio')
          .eq('id', orgId)
          .limit(1);

        if (error) {
          console.error('[Config] erro:', error);
          return;
        }

        const org = Array.isArray(data) ? data[0] : data;
        console.log('[Config] org completo:', org);
        console.log('[Config] modelo_negocio:', org?.modelo_negocio);
        if (org) {
          setNome(org.nome || '');
          setModeloNegocio(org.modelo_negocio || 'revenda');
        } else {
          setModeloNegocio('revenda');
        }
      } catch (e) {
        console.error('[Config] catch:', e);
      } finally {
        setLoadingData(false);
      }
    };

    fetchOrg();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgReady]);

  async function handleSaveModelo() {
    if (!orgId) { toast.error('Organização não encontrada'); return; }
    setSavingModelo(true);
    try {
      const preset = TERMINOLOGY_PRESETS[modeloNegocio] ?? DEFAULT_TERMINOLOGY;
      const { error } = await (supabase as any)
        .from('organizations')
        .update({ modelo_negocio: modeloNegocio, terminology: toDb(preset) })
        .eq('id', orgId);
      if (error) throw error;
      invalidateTerminologyCache(orgId);
      invalidateModeloCache(orgId);
      toast.success('Modelo de negócio atualizado!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    }
    setSavingModelo(false);
  }

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
      // 1. Atualiza Perfil (Nome e Senha)
      const profileUpdates: any = {};
      if (userName !== user?.user_metadata?.full_name) profileUpdates.data = { full_name: userName };
      
      if (Object.keys(profileUpdates).length > 0) {
        const { error: pErr } = await supabase.auth.updateUser(profileUpdates);
        if (pErr) throw pErr;
      }

      // 2. Atualiza dados da empresa
      const { error: orgError } = await (supabase as any)
        .from('organizations')
        .update({ nome: nome.trim(), documento: documento.replace(/\D/g, '') || null })
        .eq('id', orgId);
      if (orgError) throw orgError;

      // 3. Atualiza senha via Edge Function (ou auth helper)
      if (novaSenha) {
        const { error: sErr } = await supabase.auth.updateUser({ password: novaSenha });
        if (sErr) throw sErr;
        setNovaSenha('');
        setConfirmSenha('');
      }

      toast.success('Configurações salvas!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
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
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Minha Conta</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Gerencie seus dados pessoais e da sua empresa</p>
        </div>

        {loadingData ? (
          <p style={{ color: txtMid, fontSize: '13px' }}>Carregando…</p>
        ) : (
          <>
            {/* Dados Pessoais */}
            <div style={card}>
              <div style={cardHeader}>
                <User style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Dados Pessoais</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Nome Completo</label>
                  <input
                    style={inp} value={userName} onChange={e => setUserName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input style={inpReadonly} value={user?.email || ''} readOnly />
                </div>
              </div>
            </div>

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
                  />
                </div>
                <div>
                  <label style={lbl}>CNPJ / CPF</label>
                  <input
                    style={inp}
                    value={documento}
                    onChange={e => setDocumento(mascaraDocumento(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
              </div>
            </div>

            {/* Modelo de Negócio */}
            <div style={card}>
              <div style={cardHeader}>
                <Briefcase style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Modelo de Negócio</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12px', color: txtMid, margin: 0 }}>Define a terminologia usada no CRM (leads, conversões, status).</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {([
                    { key: 'revenda', label: 'Revenda de produtos' },
                    { key: 'b2b', label: 'Vendas B2B' },
                    { key: 'corretor', label: 'Corretor / imóveis' },
                    { key: 'outro', label: 'Outro' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setModeloNegocio(opt.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${modeloNegocio === opt.key ? '#366fec' : (dark ? '#27272a' : '#e5e7eb')}`,
                        background: modeloNegocio === opt.key ? 'rgba(54,111,236,0.12)' : (dark ? '#0d0d0f' : '#f8fafc'),
                        color: modeloNegocio === opt.key ? '#7aa6f5' : txtMid,
                        fontSize: '12px',
                        fontWeight: modeloNegocio === opt.key ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: FONT,
                        textAlign: 'left',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSaveModelo}
                  disabled={savingModelo}
                  style={{ alignSelf: 'flex-start', padding: '9px 20px', borderRadius: '10px', border: 'none', background: savingModelo ? (dark ? '#27272a' : '#e5e7eb') : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: savingModelo ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: FONT, transition: 'background 0.15s' }}
                >
                  <Save style={{ width: '13px', height: '13px' }} />
                  {savingModelo ? 'Salvando…' : 'Salvar modelo'}
                </button>
              </div>
            </div>

            {/* Segurança */}
            <div style={card}>
              <div style={cardHeader}>
                <Lock style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Segurança</span>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Alterar senha <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
                  <input
                    style={inp} type="password" value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
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
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '11px 28px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#2563eb', color: '#fff', fontSize: '13.5px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}
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
