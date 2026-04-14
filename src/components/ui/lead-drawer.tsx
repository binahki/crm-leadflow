import { useState, useEffect, useRef } from 'react';
import { Lead } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import {
  X, MapPin, Phone, Clock, Target, Home,
  Briefcase, ChevronDown, Check, Trash2, Instagram,
  AlertTriangle, Megaphone, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

const STATUS = [
  { label: 'Aguardando', color: '#f59e0b', bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  { label: 'Em atendimento', color: '#3b82f6', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  { label: 'Reunião', color: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  { label: 'Aprovado', color: '#10b981', bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
];

const GRADIENTS = [
  ['#a78bfa', '#60a5fa'], ['#f472b6', '#fb923c'],
  ['#34d399', '#60a5fa'], ['#fb923c', '#fbbf24'],
  ['#60a5fa', '#34d399'], ['#c084fc', '#f472b6'],
  ['#fbbf24', '#a78bfa'], ['#34d399', '#a78bfa'],
];

function getGradient(name: string) {
  return GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length];
}
function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function cleanCampaignName(raw?: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/\|\d+$/, '').trim();
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Section com accordion fluido ──────────────────────────────

function Section({
  icon, title, children, openKey, activeKey, setActiveKey,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  openKey: string;
  activeKey: string | null;
  setActiveKey: (k: string | null) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const kids = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  if (!kids.length) return null;
  const open = activeKey === openKey;

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight : 0);
    }
  }, [open, children]);

  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <button
        onClick={() => setActiveKey(open ? null : openKey)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}>{icon}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#1f2937', letterSpacing: '-0.01em', fontFamily: FONT }}>{title}</span>
        </div>
        <ChevronDown style={{
          width: '14px', height: '14px', color: '#d1d5db', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'transform',
        }} />
      </button>

      <div style={{
        height: `${height}px`,
        overflow: 'hidden',
        transition: 'height 0.28s cubic-bezier(0.4,0,0.2,1)',
        willChange: 'height',
      }}>
        <div ref={contentRef} style={{ paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px', willChange: 'transform' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '-') return null;
  return (
    <div>
      <p style={{ fontSize: '10.5px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px', fontFamily: FONT }}>{label}</p>
      <p style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.5, fontFamily: FONT }}>{value}</p>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 62, background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)' }} onClick={onCancel} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 63, background: '#fff', borderRadius: '16px',
        padding: '24px', width: '88%', maxWidth: '340px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
        fontFamily: FONT, animation: 'ld-up 0.2s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#dc2626' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em', fontFamily: FONT }}>Excluir lead?</h3>
        </div>
        <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.55, margin: '0 0 20px', fontFamily: FONT }}>
          Tem certeza que deseja excluir <strong style={{ color: '#111827' }}>{name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: FONT, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Excluindo…' : 'Sim, excluir'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────

export function LeadDrawer({ lead, isOpen, onClose, onUpdate }: LeadDrawerProps) {
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [obsChanged, setObsChanged] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setObs(lead.observacoes || '');
      setStatus(lead.status === null || lead.status === undefined ? 0 : Number(lead.status));
      setObsChanged(false);
      setShowDel(false);
      setActiveSection(null);
    }
  }, [lead?.id]);

  async function handleStatus(i: number) {
    if (!lead || status === i) return;
    const prev = status;
    setStatus(i); // otimista
    const { error } = await supabase.from('leads').update({ status: String(i) }).eq('id', lead.id);
    if (error) {
      setStatus(prev);
      toast.error('Erro ao atualizar status');
    } else {
      onUpdate({ ...lead, status: i });
      toast.success(STATUS[i].label);
    }
  }

  async function handleSaveObs() {
    if (!lead || !obsChanged) return;
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ observacoes: obs })
      .eq('id', lead.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar observação');
    } else {
      onUpdate({ ...lead, observacoes: obs });
      setObsChanged(false);
      toast.success('Observação salva!');
    }
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    setDeleting(false);
    if (error) { toast.error('Erro ao excluir'); setShowDel(false); }
    else { toast.success('Lead excluído'); setShowDel(false); onClose(); }
  }

  if (!isOpen || !lead) return null;

  const [g1, g2] = getGradient(lead.nome);
  const l = lead as any;
  const hasTraffic = l.utm_source || l.utm_campaign || l.utm_medium || l.utm_content || l.utm_term;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.18)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        animation: 'ld-fade 0.18s ease',
      }} />

      {showDel && (
        <DeleteConfirm name={lead.nome} onConfirm={handleDelete} onCancel={() => setShowDel(false)} loading={deleting} />
      )}

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '92%', maxWidth: '480px', maxHeight: '90vh',
        zIndex: 51, fontFamily: FONT,
        animation: 'ld-up 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
        borderRadius: '22px',
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.13), 0 0 0 1px rgba(255,255,255,0.7), inset 0 1px 0 rgba(255,255,255,0.9)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 22px 16px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '26px', height: '26px', background: 'rgba(0,0,0,0.06)',
            border: 'none', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
          >
            <X style={{ width: '12px', height: '12px', color: '#6b7280' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginRight: '36px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
              background: `linear-gradient(135deg, ${g1}, ${g2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', fontWeight: 700, color: '#fff',
              letterSpacing: '-0.02em', boxShadow: `0 4px 14px ${g1}60`,
              fontFamily: FONT,
            }}>
              {initials(lead.nome)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#111827', letterSpacing: '-0.022em', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>
                {lead.nome}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                {lead.cidade && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#6b7280', fontFamily: FONT }}>
                    <MapPin style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.cidade}
                  </span>
                )}
                {lead.whatsapp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#6b7280', fontFamily: FONT }}>
                    <Phone style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.whatsapp}
                  </span>
                )}
                {lead.instagram && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#6b7280', fontFamily: FONT }}>
                    <Instagram style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.instagram}
                  </span>
                )}
                {lead.created_at && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#b0b7c3', fontFamily: FONT }}>
                    <Clock style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{getRelativeTime(lead.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Status */}
        <div style={{ padding: '14px 22px', flexShrink: 0 }}>
          <p style={{ fontSize: '10.5px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '9px', fontFamily: FONT }}>Status</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {STATUS.map((s, i) => {
              const active = status === i;
              return (
                <button key={i} onClick={() => handleStatus(i)} style={{
                  padding: '5px 11px', borderRadius: '8px', flexShrink: 1,
                  border: `1px solid ${active ? s.border : '#e5e7eb'}`,
                  background: active ? s.bg : 'rgba(0,0,0,0.02)',
                  color: active ? s.text : '#6b7280',
                  fontSize: '12px', fontWeight: active ? 600 : 400,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                  fontFamily: FONT, whiteSpace: 'nowrap',
                  willChange: 'background, border-color, color',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: s.color, flexShrink: 0,
                    transition: 'transform 0.18s',
                    transform: active ? 'scale(1.2)' : 'scale(1)',
                  }} />
                  {active && <Check style={{ width: '10px', height: '10px', strokeWidth: 2.5, flexShrink: 0 }} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '4px 22px 8px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '8px 0 4px', fontFamily: FONT }}>
              Informações do Lead
            </p>

            <Section openKey="goals" activeKey={activeSection} setActiveKey={setActiveSection}
              icon={<Target style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Objetivos">
              <Field label="O que mais te atrai" value={lead.o_que_mais_te_atrai} />
              <Field label="Quanto quer ganhar" value={lead.quanto_ganha} />
              <Field label="O que quer conquistar" value={lead.o_que_conquistar} />
              <Field label="Onde se imagina em 6 meses" value={lead.imagina_6_meses} />
            </Section>

            <Section openKey="profile" activeKey={activeSection} setActiveKey={setActiveSection}
              icon={<Home style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Perfil Pessoal">
              <Field label="Idade" value={lead.idade} />
              <Field label="Tem filhos" value={lead.tem_filhos} />
              <Field label="Mora com alguém" value={lead.mora_com} />
              <Field label="Situação atual" value={lead.situacao_atual} />
              <Field label="Rede de apoio" value={lead.rede_apoio} />
            </Section>

            <Section openKey="exp" activeKey={activeSection} setActiveKey={setActiveSection}
              icon={<Briefcase style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Experiência">
              <Field label="Experiência em vendas" value={lead.experiencia_vendas} />
              <Field label="Já tentou vender semijoia" value={lead.tentou_semijoia} />
              <Field label="Consignado" value={lead.consignado} />
              <Field label="Nome negativado" value={lead.negativado} />
              <Field label="Aceita regras" value={lead.aceita_regras} />
            </Section>

            {hasTraffic && (
              <Section openKey="traffic" activeKey={activeSection} setActiveKey={setActiveSection}
                icon={<Megaphone style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Origem do Tráfego">
                <Field label="Fonte" value={l.utm_source} />
                <Field label="Campanha" value={cleanCampaignName(l.utm_campaign)} />
                <Field label="Conjunto" value={cleanCampaignName(l.utm_medium)} />
                <Field label="Anúncio" value={l.utm_content} />
                <Field label="Posicionamento" value={l.utm_term} />
                {l.ip && <Field label="IP" value={l.ip} />}
              </Section>
            )}
          </div>

          {/* Observações */}
          <div style={{ padding: '0 22px 20px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', fontFamily: FONT }}>
              Observações
            </p>
            <textarea
              value={obs}
              onChange={e => { setObs(e.target.value); setObsChanged(true); }}
              placeholder="Anotações sobre este lead..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '13.5px', lineHeight: 1.55,
                fontFamily: FONT, color: '#374151',
                background: 'rgba(0,0,0,0.025)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '10px', resize: 'none', outline: 'none',
                transition: 'border-color 0.18s cubic-bezier(0.4,0,0.2,1)',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.45)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
            />
          </div>
        </div>

        {/* Buttons: WhatsApp | Salvar */}
        <div style={{ padding: '10px 22px 20px', display: 'flex', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>

          {/* WhatsApp — botão principal */}
          <button
            onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank')}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: '#25D366', border: 'none',
              color: '#fff', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '7px',
              transition: 'opacity 0.15s',
              fontFamily: FONT,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <WaIcon />
            Chamar no WhatsApp
          </button>

          {/* Salvar observação */}
          <button
            onClick={handleSaveObs}
            disabled={saving || !obsChanged}
            style={{
              flex: '0 0 auto', padding: '10px 16px', borderRadius: '10px',
              background: obsChanged ? '#f0fdf4' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${obsChanged ? '#bbf7d0' : 'rgba(0,0,0,0.08)'}`,
              color: obsChanged ? '#15803d' : '#9ca3af',
              fontSize: '13px', fontWeight: 500,
              cursor: obsChanged ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
              fontFamily: FONT,
            }}
            onMouseEnter={e => { if (obsChanged) (e.currentTarget.style.background = '#dcfce7'); }}
            onMouseLeave={e => { if (obsChanged) (e.currentTarget.style.background = '#f0fdf4'); }}
          >
            <Save style={{ width: '13px', height: '13px', strokeWidth: 1.8 }} />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>

        </div>
      </div>

      <style>{`
        @keyframes ld-fade { from{opacity:0}to{opacity:1} }
        @keyframes ld-up {
          from{opacity:0;transform:translate(-50%,-48%) scale(0.96)}
          to{opacity:1;transform:translate(-50%,-50%) scale(1)}
        }
      `}</style>
    </>
  );
}
