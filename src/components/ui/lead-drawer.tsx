import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lead, useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import {
  X, MapPin, Phone, Clock, Briefcase,
  ChevronDown, Check, AlertTriangle, Megaphone, Save, Instagram,
} from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';
import { useTheme } from '@/hooks/useTheme';

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
}

const STATUS = [
  { id: 1, label: 'Em atendimento', color: '#3b82f6', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe', darkBg: 'rgba(59,130,246,0.15)', darkText: '#60a5fa' },
  { id: 2, label: 'Reunião', color: '#8b5cf6', bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe', darkBg: 'rgba(139,92,246,0.15)', darkText: '#a78bfa' },
  { id: 5, label: 'Contrato/App', color: '#f59e0b', bg: '#fef3c7', text: '#92400e', border: '#fde68a', darkBg: 'rgba(245,158,11,0.15)', darkText: '#fbbf24' },
  { id: 3, label: 'Aprovado', color: '#10b981', bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', darkBg: 'rgba(16,185,129,0.15)', darkText: '#34d399' },
  { id: 4, label: 'Reprovado', color: '#ef4444', bg: '#fee2e2', text: '#991b1b', border: '#fecaca', darkBg: 'rgba(239,68,68,0.15)', darkText: '#f87171' },
];

const MOTIVOS = ['Sem retorno', 'Fora de SP', 'Nome sujo', 'Sem reserva', 'Não compareceu à reunião', 'Desistiu', 'Outro'];

const GRADIENTS = [
  ['#a78bfa', '#60a5fa'], ['#f472b6', '#fb923c'],
  ['#34d399', '#60a5fa'], ['#fb923c', '#fbbf24'],
  ['#60a5fa', '#34d399'], ['#c084fc', '#f472b6'],
  ['#fbbf24', '#a78bfa'], ['#34d399', '#a78bfa'],
];

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

// ── Quiz respostas dinâmico ───────────────────────────────────
const SKIP_EXACT = new Set([
  'nome', 'whatsapp', 'telefone', 'cidade', 'score', 'status', 'email',
  'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'brid', 'code', 'ip', 'platform', 'instagram', 'wa_sent', 'created_at', 'id',
]);
const SKIP_PREFIXES = ['tracking.', 'responses.', 'score.'];
const STRIP_PREFIXES = ['voce_', 'qual_sua_', 'quanto_gostaria_de_'];
// Campos de controle da Inlead: 6 chars alfanuméricos misturados (letras + dígitos)
const INLEAD_CTRL = /^[A-Za-z0-9]{6}$/;

function isSkippedKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SKIP_EXACT.has(k)) return true;
  if (/^\d+$/.test(key)) return true;
  if (k.endsWith('_at') || k.endsWith('_id')) return true;
  if (SKIP_PREFIXES.some(p => k.startsWith(p))) return true;
  if (INLEAD_CTRL.test(key) && /[A-Z]/.test(key) && /[a-z]/.test(key) && /[0-9]/.test(key)) return true;
  return false;
}

function isSkippedValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return true;
  const s = String(val);
  if (s.includes('http://') || s.includes('https://')) return true;
  return false;
}

function formatKey(key: string): string {
  let k = key;
  for (const prefix of STRIP_PREFIXES) {
    if (k.startsWith(prefix)) { k = k.slice(prefix.length); break; }
  }
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getGradient(name: string) { return GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length]; }
function initials(name: string) { if (!name) return '?'; return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function cleanCampaignName(raw?: string | null) { if (!raw) return null; return raw.replace(/\|\d+$/, '').trim(); }

function ScoreTag({ score, faixa, dark }: { score?: number | null; faixa?: string | null; dark: boolean }) {
  if (score == null || score === undefined) return null;
  const isVerde = faixa === 'verde';
  const isAmarelo = faixa === 'amarelo';
  const color = isVerde ? '#10b981' : isAmarelo ? '#f59e0b' : '#6b7280';
  const bg = isVerde ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : isAmarelo ? (dark ? 'rgba(245,158,11,0.15)' : '#fef3c7') : (dark ? 'rgba(107,114,128,0.15)' : '#f3f4f6');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '99px', background: bg, border: `1px solid ${color}30` }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: FONT }}>{score} pts</span>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function Section({ icon, title, children, openKey, activeKey, setActiveKey, dark }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  openKey: string; activeKey: string | null; setActiveKey: (k: string | null) => void; dark: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const open = activeKey === openKey;
  useEffect(() => { if (contentRef.current) setHeight(open ? contentRef.current.scrollHeight : 0); }, [open, children]);
  return (
    <div style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
      <button onClick={() => setActiveKey(open ? null : openKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, WebkitTapHighlightColor: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: dark ? '#52525b' : '#9ca3af', display: 'flex', alignItems: 'center' }}>{icon}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 500, color: dark ? '#f4f4f5' : '#1f2937', fontFamily: FONT }}>{title}</span>
        </div>
        <ChevronDown style={{ width: '14px', height: '14px', color: '#d1d5db', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }} />
      </button>
      <div style={{ height: `${height}px`, overflow: 'hidden', transition: 'height 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        <div ref={contentRef} style={{ paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, dark }: { label: string; value?: string | null; dark: boolean }) {
  const display = (!value || String(value).trim() === '' || value === 'false') ? '—' : String(value);
  return (
    <div>
      <p style={{ fontSize: '10.5px', fontWeight: 500, color: dark ? '#52525b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px', fontFamily: FONT }}>{label}</p>
      <p style={{ fontSize: '13.5px', color: display === '—' ? (dark ? '#3f3f46' : '#d1d5db') : (dark ? '#d4d4d8' : '#374151'), lineHeight: 1.5, fontFamily: FONT }}>{display}</p>
    </div>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel, loading, dark }: { name: string; onConfirm: () => void; onCancel: () => void; loading: boolean; dark: boolean }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 62, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)' }} onClick={onCancel} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 999999, background: dark ? '#111113' : '#fff', borderRadius: '16px', padding: '24px', width: '88%', maxWidth: '340px', boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)', fontFamily: FONT, animation: 'ld-up 0.2s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: dark ? 'rgba(220,38,38,0.1)' : '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#dc2626' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dark ? '#fff' : '#111827', fontFamily: FONT }}>Excluir lead?</h3>
        </div>
        <p style={{ fontSize: '13.5px', color: dark ? '#9ca3af' : '#6b7280', lineHeight: 1.55, margin: '0 0 20px', fontFamily: FONT }}>
          Tem certeza que deseja excluir <strong style={{ color: dark ? '#fff' : '#111827' }}>{name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: loading ? 'default' : 'pointer', fontFamily: FONT, opacity: loading ? 0.7 : 1 }}>{loading ? 'Excluindo…' : 'Sim, excluir'}</button>
        </div>
      </div>
    </>
  );
}

function MotivoModal({ onConfirm, onCancel, dark, motivoAtual }: { onConfirm: (m: string) => void; onCancel: () => void; dark: boolean; motivoAtual?: string }) {
  const outroDefault = motivoAtual && !MOTIVOS.slice(0, -1).includes(motivoAtual) ? motivoAtual : '';
  const selectedDefault = motivoAtual ? (MOTIVOS.slice(0, -1).includes(motivoAtual) ? motivoAtual : 'Outro') : '';
  const [selected, setSelected] = useState(selectedDefault);
  const [outro, setOutro] = useState(outroDefault);
  const motivo = selected === 'Outro' ? outro.trim() : selected;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'rgba(0,0,0,0.55)' }} onClick={onCancel} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 999999, background: dark ? '#111113' : '#fff', borderRadius: '18px', padding: '24px', width: '90%', maxWidth: '360px', boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.7)' : '0 24px 60px rgba(0,0,0,0.18)', fontFamily: FONT, animation: 'ld-up 0.2s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>❌</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dark ? '#fff' : '#111827' }}>{motivoAtual ? 'Alterar motivo' : 'Motivo da reprovação'}</h3>
            <p style={{ margin: 0, fontSize: '12px', color: dark ? '#71717a' : '#9ca3af' }}>Selecione o motivo para registrar</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {MOTIVOS.map(m => (
            <button key={m} onClick={() => setSelected(m)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${selected === m ? '#ef4444' : (dark ? '#1e1e22' : '#e5e7eb')}`, background: selected === m ? (dark ? 'rgba(239,68,68,0.12)' : '#fff1f2') : (dark ? 'rgba(255,255,255,0.02)' : '#f9fafb'), color: selected === m ? '#ef4444' : (dark ? '#d4d4d8' : '#374151'), fontSize: '13px', fontWeight: selected === m ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s', fontFamily: FONT }}>
              {m}{selected === m && <Check style={{ width: '14px', height: '14px', color: '#ef4444', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
        {selected === 'Outro' && <input autoFocus placeholder="Descreva o motivo..." value={outro} onChange={e => setOutro(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as any, fontFamily: FONT }} />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: motivo ? '#ef4444' : (dark ? '#27272a' : '#e5e7eb'), color: motivo ? '#fff' : (dark ? '#52525b' : '#9ca3af'), fontSize: '13px', fontWeight: 600, cursor: motivo ? 'pointer' : 'default', transition: 'all 0.15s', fontFamily: FONT }}>Confirmar</button>
        </div>
      </div>
    </>
  );
}

export function LeadDrawer({ lead, isOpen, onClose, onUpdate }: LeadDrawerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { updateLead } = useAppStore();

  const [obs, setObs] = useState('');
  const [status, setStatus] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [obsChanged, setObsChanged] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [showMotivo, setShowMotivo] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setObs(lead.observacoes || '');
      let s = lead.status === null || lead.status === undefined ? 1 : Number(lead.status);
      if (s === 0) s = 1;
      setStatus(s);
      setObsChanged(false);
      setShowDel(false);
      setShowMotivo(false);
      setPendingStatus(null);
      setActiveSection(null);
    }
  }, [lead?.id]);

  async function applyStatus(newStatus: number, motivo?: string) {
    if (!lead) return;
    const prev = status;
    setStatus(newStatus);
    const updates: any = { status: String(newStatus), ultimo_status_change: new Date().toISOString() };
    if (motivo) updates.motivo_reprovacao = motivo;
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
    if (error) { setStatus(prev); toast.error('Erro ao atualizar status'); }
    else { onUpdate({ ...lead, status: newStatus, ...(motivo ? { motivo_reprovacao: motivo } : {}) }); toast.success(STATUS.find(s => s.id === newStatus)?.label || 'Atualizado'); }
  }

  function handleStatus(i: number) {
    if (!lead) return;
    if (i === 4) { setPendingStatus(4); setShowMotivo(true); return; }
    if (status === i) return;
    applyStatus(i);
  }

  async function handleMotivoConfirm(motivo: string) {
    setShowMotivo(false);
    if (pendingStatus !== null) { await applyStatus(pendingStatus, motivo); setPendingStatus(null); }
  }

  async function handleSaveObs() {
    if (!lead || !obsChanged) return;
    setSaving(true);
    const { error } = await supabase.from('leads').update({ observacoes: obs }).eq('id', lead.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar observação');
    else { onUpdate({ ...lead, observacoes: obs }); setObsChanged(false); toast.success('Observação salva!'); }
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
  const hasTraffic = l.utm_source || l.utm_campaign || l.utm_medium;
  const score = l.score != null ? Number(l.score) : null;
  const faixa = l.faixa || null;
  const instagramValue = l.instagram ? String(l.instagram).trim() : '';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'ld-fade 0.18s ease' }} />
      {showDel && <DeleteConfirm name={lead.nome} onConfirm={handleDelete} onCancel={() => setShowDel(false)} loading={deleting} dark={dark} />}
      {showMotivo && createPortal(
        <MotivoModal onConfirm={handleMotivoConfirm} onCancel={() => { setShowMotivo(false); setPendingStatus(null); }} dark={dark} motivoAtual={lead.motivo_reprovacao} />,
        document.body
      )}

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '92%', maxWidth: '480px', maxHeight: '90vh', zIndex: 51, fontFamily: FONT, animation: 'ld-up 0.24s cubic-bezier(0.32, 0.72, 0, 1)', borderRadius: '22px', background: dark ? 'rgba(18,18,20,0.96)' : 'rgba(255,255,255,0.94)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', boxShadow: dark ? '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' : '0 24px 80px rgba(0,0,0,0.13), 0 0 0 1px rgba(255,255,255,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '22px 22px 16px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '26px', height: '26px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)')}>
            <X style={{ width: '12px', height: '12px', color: dark ? '#52525b' : '#6b7280' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginRight: '36px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `linear-gradient(135deg, ${g1}, ${g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#fff', boxShadow: `0 4px 14px ${g1}60`, fontFamily: FONT }}>
                {initials(lead.nome)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: dark ? '#f4f4f5' : '#111827', letterSpacing: '-0.022em', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>{lead.nome}</h2>
                <ScoreTag score={score} faixa={faixa} dark={dark} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {lead.cidade && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#71717a' : '#6b7280', fontFamily: FONT }}><MapPin style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.cidade}</span>}
                {lead.whatsapp && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#71717a' : '#6b7280', fontFamily: FONT }}><Phone style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.whatsapp}</span>}
                {instagramValue && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#71717a' : '#6b7280', fontFamily: FONT }}><Instagram style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{instagramValue}</span>}
                {lead.created_at && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#52525b' : '#b0b7c3', fontFamily: FONT }}><Clock style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{getRelativeTime(lead.created_at)}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Status */}
        <div style={{ padding: '14px 22px', flexShrink: 0 }}>
          <p style={{ fontSize: '10.5px', fontWeight: 500, color: dark ? '#52525b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '9px', fontFamily: FONT }}>Status</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS.map(s => {
              const active = status === s.id;
              return (
                <button key={s.id} onClick={() => handleStatus(s.id)} style={{ padding: '5px 11px', borderRadius: '8px', flexShrink: 1, border: `1px solid ${active ? s.border : dark ? '#1e1e22' : '#e5e7eb'}`, background: active ? (dark ? s.darkBg : s.bg) : 'rgba(0,0,0,0.02)', color: active ? (dark ? s.darkText : s.text) : (dark ? '#71717a' : '#6b7280'), fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.18s', fontFamily: FONT, whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, flexShrink: 0, transform: active ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.18s' }} />
                  {active && <Check style={{ width: '10px', height: '10px', strokeWidth: 2.5, flexShrink: 0 }} />}
                  {s.label}
                </button>
              );
            })}
          </div>
          {status === 4 && lead.motivo_reprovacao && (
            <div style={{ marginTop: '10px', padding: '7px 12px', borderRadius: '8px', background: dark ? 'rgba(239,68,68,0.08)' : '#fff1f2', border: `1px solid ${dark ? 'rgba(239,68,68,0.2)' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500, fontFamily: FONT }}>Motivo:</span>
              <span style={{ fontSize: '12px', color: dark ? '#f87171' : '#dc2626', fontFamily: FONT }}>{lead.motivo_reprovacao}</span>
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Conteúdo rolável */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '4px 22px 8px' }}>

            {/* Respostas do Quiz — lê de quiz_respostas (jsonb), totalmente dinâmico */}
            {(() => {
              let respostas: Record<string, unknown> | null = null;
              try {
                const raw = l.quiz_respostas;
                if (raw) respostas = typeof raw === 'string' ? JSON.parse(raw) : raw;
              } catch { respostas = null; }
              const entries = respostas
                ? Object.entries(respostas).filter(([k, v]) => !isSkippedKey(k) && !isSkippedValue(v))
                : [];
              return (
                <Section openKey="quiz_respostas" activeKey={activeSection} setActiveKey={setActiveSection} dark={dark}
                  icon={<Briefcase style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Ver respostas do quiz">
                  {entries.length === 0
                    ? <p style={{ fontSize: '13px', color: dark ? '#52525b' : '#9ca3af', margin: 0, fontFamily: FONT }}>Nenhuma resposta do quiz disponível.</p>
                    : entries.map(([key, val]) => (
                        <Field key={key} label={formatKey(key)} value={formatValue(val)} dark={dark} />
                      ))
                  }
                </Section>
              );
            })()}

            {/* Origem do Tráfego */}
            {hasTraffic && (
              <Section openKey="traffic" activeKey={activeSection} setActiveKey={setActiveSection} dark={dark}
                icon={<Megaphone style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Origem do Tráfego">
                <Field label="Fonte" value={l.utm_source} dark={dark} />
                <Field label="Campanha" value={cleanCampaignName(l.utm_campaign)} dark={dark} />
                <Field label="Conjunto" value={cleanCampaignName(l.utm_medium)} dark={dark} />
                <Field label="Anúncio" value={l.utm_content} dark={dark} />
                {l.ip && <Field label="IP" value={l.ip} dark={dark} />}
              </Section>
            )}
          </div>

          {/* Observações */}
          <div style={{ padding: '0 22px 20px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 500, color: dark ? '#52525b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', fontFamily: FONT }}>Observações</p>
            <textarea value={obs} onChange={e => { setObs(e.target.value); setObsChanged(true); }} placeholder="Anotações sobre este lead..." rows={3}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px', lineHeight: 1.55, fontFamily: FONT, color: dark ? '#f4f4f5' : '#374151', background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.025)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '10px', resize: 'none', outline: 'none', transition: 'border-color 0.18s', boxSizing: 'border-box' as any }}
              onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.45)')}
              onBlur={e => (e.target.style.borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 22px 20px', display: 'flex', gap: '8px', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0 }}>
          <button onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank')} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#25D366', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'opacity 0.15s', fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            <WaIcon /> Chamar no WhatsApp
          </button>
          <button onClick={handleSaveObs} disabled={saving || !obsChanged} style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: '10px', background: obsChanged ? (dark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'), border: `1px solid ${obsChanged ? (dark ? 'rgba(16,185,129,0.3)' : '#bbf7d0') : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`, color: obsChanged ? (dark ? '#34d399' : '#15803d') : (dark ? '#52525b' : '#9ca3af'), fontSize: '13px', fontWeight: 500, cursor: obsChanged ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.18s', fontFamily: FONT }}>
            <Save style={{ width: '13px', height: '13px', strokeWidth: 1.8 }} />{saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ld-fade { from{opacity:0}to{opacity:1} }
        @keyframes ld-up { from{opacity:0;transform:translate(-50%,-48%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </>
  );
}
