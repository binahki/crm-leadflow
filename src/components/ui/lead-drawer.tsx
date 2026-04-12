import { useState, useEffect } from 'react';
import { Lead } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { X, MessageCircle, MapPin, Phone, Calendar, Target, Clock, Briefcase, Home, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime, formatDate } from '@/utils/relativeTime';

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

const STATUS = [
  { label: 'Aguardando',     dot: '#f59e0b' },
  { label: 'Em atendimento', dot: '#3b82f6' },
  { label: 'Reunião',        dot: '#8b5cf6' },
  { label: 'Aprovado',       dot: '#10b981' },
];

function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function avatarBg(name: string) {
  const shades = ['#e8e8ed', '#dddde5', '#d2d2db', '#c7c7d1', '#bcbcc7'];
  return shades[(name?.charCodeAt(0) || 0) % shades.length];
}

function Section({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const kids = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  if (!kids.length) return null;

  return (
    <div style={{ borderBottom: '1px solid rgba(0,0,0,0.055)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '13px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ color: 'rgba(0,0,0,0.3)', display: 'flex' }}>{icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.82)', letterSpacing: '-0.015em' }}>
            {title}
          </span>
        </div>
        <ChevronDown style={{
          width: '15px', height: '15px', color: 'rgba(0,0,0,0.22)',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.18s ease', flexShrink: 0,
        }} />
      </button>
      {open && <div style={{ padding: '2px 20px 16px' }}>{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '-') return null;
  return (
    <div style={{ marginBottom: '13px' }}>
      <p style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(0,0,0,0.32)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.78)', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.01em' }}>
        {value}
      </p>
    </div>
  );
}

export function LeadDrawer({ lead, isOpen, onClose, onUpdate }: LeadDrawerProps) {
  const [obs, setObs]               = useState('');
  const [status, setStatus]         = useState(0);
  const [saving, setSaving]         = useState(false);
  const [obsChanged, setObsChanged] = useState(false);

  useEffect(() => {
    if (lead) {
      setObs(lead.observacoes || '');
      setStatus(lead.status === null || lead.status === undefined ? 0 : Number(lead.status));
      setObsChanged(false);
    }
  }, [lead?.id]);

  async function handleStatus(i: number) {
    if (!lead || status === i) return;
    const prev = status;
    setStatus(i);
    const { error } = await supabase.from('leads').update({ status: String(i) }).eq('id', lead.id);
    if (error) { setStatus(prev); toast.error('Erro ao atualizar status'); }
    else { onUpdate({ ...lead, status: i }); toast.success(STATUS[i].label); }
  }

  async function handleSaveObs() {
    if (!lead) return;
    setSaving(true);
    const { error } = await supabase.from('leads').update({ observacoes: obs }).eq('id', lead.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar');
    else { onUpdate({ ...lead, observacoes: obs }); setObsChanged(false); toast.success('Salvo'); }
  }

  if (!isOpen || !lead) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50, animation: 'ld-fade 0.18s ease',
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '92%', maxWidth: '452px', maxHeight: '88vh',
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 44px 120px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.07)',
        zIndex: 51, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'ld-up 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(0,0,0,0.055)', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '26px', height: '26px', background: 'rgba(0,0,0,0.055)',
            border: 'none', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.055)')}
          >
            <X style={{ width: '13px', height: '13px', color: 'rgba(0,0,0,0.45)' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '15px',
              background: avatarBg(lead.nome),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '17px', fontWeight: 700, color: 'rgba(0,0,0,0.5)',
              letterSpacing: '-0.02em', flexShrink: 0,
            }}>
              {initials(lead.nome)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0, fontSize: '17px', fontWeight: 700,
                color: '#000', letterSpacing: '-0.025em',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}>
                {lead.nome}
              </h2>
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                {lead.cidade && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>
                    <MapPin style={{ width: '11px', height: '11px' }} />{lead.cidade}
                  </span>
                )}
                {lead.whatsapp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>
                    <Phone style={{ width: '11px', height: '11px' }} />{lead.whatsapp}
                  </span>
                )}
                {lead.created_at && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'rgba(0,0,0,0.38)' }}>
                    <Calendar style={{ width: '11px', height: '11px' }} />{getRelativeTime(lead.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank')}
            style={{
              marginTop: '14px', width: '100%', padding: '10px',
              borderRadius: '11px', background: '#000', border: 'none',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '7px', letterSpacing: '-0.01em',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <MessageCircle style={{ width: '14px', height: '14px' }} />
            Abrir no WhatsApp
          </button>
        </div>

        {/* Status */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.055)', flexShrink: 0 }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '9px' }}>
            Status
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS.map((s, i) => {
              const active = status === i;
              return (
                <button key={i} onClick={() => handleStatus(i)} style={{
                  padding: '6px 12px', borderRadius: '20px',
                  border: active ? '1.5px solid #000' : '1.5px solid rgba(0,0,0,0.1)',
                  background: active ? '#000' : 'transparent',
                  color: active ? '#fff' : 'rgba(0,0,0,0.48)',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'all 0.15s ease', letterSpacing: '-0.01em',
                }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.28)'; (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.72)'; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.48)'; } }}
                >
                  {active && <Check style={{ width: '11px', height: '11px' }} />}
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? '#fff' : s.dot, flexShrink: 0 }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable sections */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          <Section icon={<Phone style={{ width: '13px', height: '13px' }} />} title="Identificação" defaultOpen>
            <Field label="Instagram" value={lead.instagram} />
            <Field label="Idade" value={lead.idade} />
            <Field label="Data de entrada" value={lead.created_at ? formatDate(lead.created_at) : undefined} />
          </Section>

          <Section icon={<Target style={{ width: '13px', height: '13px' }} />} title="Objetivos">
            <Field label="O que mais te atrai" value={lead.o_que_mais_te_atrai} />
            <Field label="Quanto quer ganhar" value={lead.quanto_ganha} />
            <Field label="O que quer conquistar" value={lead.o_que_conquistar} />
            <Field label="Onde se imagina em 6 meses" value={lead.imagina_6_meses} />
          </Section>

          <Section icon={<Home style={{ width: '13px', height: '13px' }} />} title="Perfil Pessoal">
            <Field label="Tem filhos" value={lead.tem_filhos} />
            <Field label="Idade do filho mais novo" value={lead.idade_filho} />
            <Field label="Rede de apoio" value={lead.rede_apoio} />
            <Field label="Mora com alguém" value={lead.mora_com} />
            <Field label="Situação atual" value={lead.situacao_atual} />
          </Section>

          <Section icon={<Clock style={{ width: '13px', height: '13px' }} />} title="Disponibilidade">
            <Field label="Meios de venda" value={lead.meios_venda} />
            <Field label="Horas por semana" value={lead.horas_semana} />
            <Field label="Quando quer começar" value={lead.quando_comecar} />
          </Section>

          <Section icon={<Briefcase style={{ width: '13px', height: '13px' }} />} title="Experiência">
            <Field label="Experiência em vendas" value={lead.experiencia_vendas} />
            <Field label="Já tentou vender semijoia" value={lead.tentou_semijoia} />
            <Field label="Para começar no consignado" value={lead.consignado} />
            <Field label="Nome negativado" value={lead.negativado} />
            <Field label="Aceita regras do consignado" value={lead.aceita_regras} />
          </Section>

          {/* Observações */}
          <div style={{ padding: '16px 20px 28px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '9px' }}>
              Observações
            </p>
            <textarea
              value={obs}
              onChange={e => { setObs(e.target.value); setObsChanged(true); }}
              placeholder="Adicione anotações sobre este lead..."
              rows={3}
              style={{
                width: '100%', padding: '11px 13px',
                fontSize: '13.5px', lineHeight: 1.55,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                color: 'rgba(0,0,0,0.78)',
                background: 'rgba(0,0,0,0.025)',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '11px', resize: 'none', outline: 'none',
                transition: 'border-color 0.15s', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(0,0,0,0.22)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
            />
            <button
              onClick={handleSaveObs}
              disabled={saving || !obsChanged}
              style={{
                marginTop: '9px', padding: '9px 18px', borderRadius: '10px',
                background: obsChanged ? '#000' : 'rgba(0,0,0,0.05)',
                border: 'none',
                color: obsChanged ? '#fff' : 'rgba(0,0,0,0.28)',
                fontSize: '13px', fontWeight: 600,
                cursor: obsChanged ? 'pointer' : 'default',
                transition: 'all 0.15s', letterSpacing: '-0.01em',
              }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ld-fade { from { opacity:0 } to { opacity:1 } }
        @keyframes ld-up {
          from { opacity:0; transform:translate(-50%,-47%) scale(0.97) }
          to   { opacity:1; transform:translate(-50%,-50%) scale(1) }
        }
      `}</style>
    </>
  );
}
