import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import type { Lead } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useModeloNegocio } from '@/hooks/useTerminology';
import { useStatusConfig } from '@/hooks/useStatusConfig';
import { supabase } from '@/integrations/supabase/client';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { safeName, safeInitials } from '@/utils/safeName';
import { getAvatarColor, getAvatarTextColor } from '@/utils/avatarColor';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  MeasuringStrategy,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Clock,
  X,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────

type ViewMode = 'mes' | 'semana' | 'dia';

type CalLead = Lead & {
  reuniao_agendada_at?: string | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function mesLabel(date: Date): string {
  const m = date.toLocaleString('pt-BR', { month: 'long' });
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + date.getFullYear();
}

function semanaLabel(date: Date): string {
  const dom = new Date(date);
  dom.setDate(date.getDate() - date.getDay());
  const sab = new Date(dom);
  sab.setDate(dom.getDate() + 6);
  const m1 = dom.toLocaleString('pt-BR', { month: 'short' });
  const m2 = sab.toLocaleString('pt-BR', { month: 'short' });
  const y = sab.getFullYear();
  if (m1 === m2) return `${dom.getDate()} – ${sab.getDate()} ${m1} ${y}`;
  return `${dom.getDate()} ${m1} – ${sab.getDate()} ${m2} ${y}`;
}

function diaLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getWeekDays(date: Date): Date[] {
  const dom = new Date(date);
  dom.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dom); d.setDate(dom.getDate() + i); return d;
  });
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const grid: (Date | null)[] = Array(firstDay.getDay()).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function groupByDate(leads: CalLead[]): Record<string, CalLead[]> {
  const map: Record<string, CalLead[]> = {};
  for (const l of leads) {
    if (!l.reuniao_agendada_at) continue;
    const key = l.reuniao_agendada_at.slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(l);
  }
  for (const key of Object.keys(map))
    map[key].sort((a, b) => (a.reuniao_agendada_at! < b.reuniao_agendada_at! ? -1 : 1));
  return map;
}

function isAtrasado(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso) < new Date();
}

// ─── AgendamentoReuniaoModal ──────────────────────────────────────────────────

interface AgendamentoProps {
  leadId: string;
  leadNome: string;
  orgId: string;
  dataInicial?: string;
  dark: boolean;
  onClose: () => void;
  onSalvo: (reuniaoAt: string) => void;
}

function AgendamentoReuniaoModal({ leadId, leadNome, orgId, dataInicial, dark, onClose, onSalvo }: AgendamentoProps) {
  const hoje = isoDate(new Date());
  const [selData, setSelData] = useState(dataInicial || hoje);
  const [selHora, setSelHora] = useState('');
  const [calMes, setCalMes] = useState<Date>(() => dataInicial ? new Date(dataInicial + 'T12:00:00') : new Date());
  const [horariosOrg, setHorariosOrg] = useState<string[]>(['10:00', '12:00', '15:00', '17:00', '19:00']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).from('organizations').select('reuniao_horarios').eq('id', orgId).single()
      .then(({ data }: any) => {
        const h = data?.reuniao_horarios;
        if (Array.isArray(h) && h.length > 0) setHorariosOrg(h);
      });
  }, [orgId]);

  const bg     = dark ? '#18181b' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
  const txtHi  = dark ? '#f0f0f0' : '#111827';
  const txtMid = dark ? '#a0a0a8' : '#6b7280';
  const txtLow = dark ? '#6a6a74' : '#9ca3af';
  const FONT   = 'Inter, sans-serif';
  const DIAS   = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const grid = buildMonthGrid(calMes.getFullYear(), calMes.getMonth());
  const mesNome = calMes.toLocaleString('pt-BR', { month: 'long' });
  const mesStr = mesNome.charAt(0).toUpperCase() + mesNome.slice(1) + ' ' + calMes.getFullYear();

  async function confirmar() {
    if (!selData || !selHora) return;
    setSaving(true);
    const reuniaoAt = `${selData}T${selHora}:00-03:00`;
    const { error } = await (supabase as any).from('leads').update({ reuniao_agendada_at: reuniaoAt }).eq('id', leadId);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    onSalvo(reuniaoAt);
    onClose();
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'relative', zIndex: 1, background: bg, borderRadius: '18px', padding: '22px', width: '90%', maxWidth: '360px', border: `1px solid ${border}`, boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.7)' : '0 24px 60px rgba(0,0,0,0.18)', fontFamily: FONT }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: dark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={18} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: txtHi }}>Quando é a reunião?</div>
              <div style={{ fontSize: '12px', color: txtLow, marginTop: '1px' }}>{safeName(leadNome) || 'Lead'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtLow, padding: '2px', display: 'flex', flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Mini calendário */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button onClick={() => { const d = new Date(calMes); d.setMonth(d.getMonth() - 1); setCalMes(d); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, padding: '2px 8px', borderRadius: '6px', fontSize: '17px', lineHeight: 1 }}>‹</button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: txtHi }}>{mesStr}</span>
            <button onClick={() => { const d = new Date(calMes); d.setMonth(d.getMonth() + 1); setCalMes(d); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, padding: '2px 8px', borderRadius: '6px', fontSize: '17px', lineHeight: 1 }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
            {DIAS.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: txtLow, paddingBottom: '3px' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {grid.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const ds = isoDate(day);
              const isPast = ds < hoje;
              const isSel = ds === selData;
              const isHoje = ds === hoje;
              return (
                <button key={ds}
                  disabled={isPast}
                  onClick={() => !isPast && setSelData(ds)}
                  style={{
                    padding: '5px 0', borderRadius: '6px', border: 'none', cursor: isPast ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, fontSize: '12px',
                    fontWeight: isSel ? 700 : isHoje ? 600 : 400,
                    opacity: isPast ? 0.35 : 1,
                    background: isSel ? '#8b5cf6' : isHoje ? (dark ? 'rgba(0,68,253,0.2)' : 'rgba(0,68,253,0.1)') : 'transparent',
                    color: isSel ? '#fff' : isHoje ? '#0044fd' : (dark ? '#e0e0e8' : '#374151'),
                  }}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chips de hora */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {horariosOrg.map(h => {
              const sel = h === selHora;
              return (
                <button key={h} onClick={() => setSelHora(h)}
                  style={{
                    padding: '6px 14px', borderRadius: '99px',
                    border: `1px solid ${sel ? '#8b5cf6' : (dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb')}`,
                    background: sel ? '#8b5cf6' : 'transparent',
                    color: sel ? '#fff' : (dark ? '#a0a0a8' : '#374151'),
                    fontSize: '13px', fontWeight: sel ? 600 : 400,
                    cursor: 'pointer', fontFamily: FONT,
                  }}>
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: '10px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>
            Pular
          </button>
          <button onClick={confirmar} disabled={saving || !selData || !selHora}
            style={{ flex: 2, padding: '10px 0', borderRadius: '10px', border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: (saving || !selData || !selHora) ? 'not-allowed' : 'pointer', opacity: (saving || !selData || !selHora) ? 0.55 : 1, fontFamily: FONT }}>
            {saving ? 'Salvando…' : 'Confirmar reunião'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── SemDataDropZone ─────────────────────────────────────────────────────────

function SemDataDropZone({ dark, border, txtLow }: { dark: boolean; border: string; txtLow: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'sem-data' });
  return (
    <div ref={setNodeRef} style={{
      margin: '8px', padding: '12px', borderRadius: '10px',
      border: `2px dashed ${isOver ? '#8b5cf6' : border}`,
      background: isOver ? (dark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)') : 'transparent',
      textAlign: 'center', transition: 'all 0.15s',
    }}>
      <p style={{ fontSize: '11px', color: isOver ? '#8b5cf6' : txtLow, margin: 0, fontWeight: isOver ? 600 : 400 }}>
        {isOver ? 'Solte para remover a data' : 'Arraste aqui para remover data'}
      </p>
    </div>
  );
}

// ─── WeekDraggableChip ────────────────────────────────────────────────────────

function WeekDraggableChip({ lead, dark, border, txtHi, onOpenDrawer }: {
  lead: CalLead; dark: boolean; border: string; txtHi: string;
  onOpenDrawer: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lead-${lead.id}` });
  const color = getAvatarColor(lead.nome, dark, lead.id);
  const tc = getAvatarTextColor(color);
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      onClick={!isDragging ? onOpenDrawer : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 6px 3px 3px',
        borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${border}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        opacity: isDragging ? 0 : 1,
        maxWidth: '100%', overflow: 'hidden',
      }}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: color, color: tc, fontSize: '7px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {safeInitials(lead.nome).charAt(0)}
      </div>
      <span style={{ fontSize: '10.5px', fontWeight: 500, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
        {(safeName(lead.nome) || '').split(' ')[0]}
      </span>
    </div>
  );
}

// ─── WeekDroppableCell ────────────────────────────────────────────────────────

function WeekDroppableCell({ id, children, dark, isToday, border }: {
  id: string; children: React.ReactNode; dark: boolean; isToday: boolean; border: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{
      position: 'relative',
      padding: '4px', borderRight: `1px solid ${border}`,
      background: isOver
        ? (dark ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.07)')
        : isToday ? (dark ? 'rgba(0,68,253,0.04)' : 'rgba(0,68,253,0.02)') : 'transparent',
      transition: 'background 0.12s',
      minHeight: '54px',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}

// ─── DiaDroppableSlot ─────────────────────────────────────────────────────────

function DiaDroppableSlot({ hora, children, dark, border }: {
  hora: string; children: React.ReactNode; dark: boolean; border: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `diaslot:${hora}` });
  return (
    <div ref={setNodeRef} style={{
      position: 'relative',
      flex: 1, padding: '6px 10px', minHeight: '60px',
      background: isOver ? (dark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.05)') : 'transparent',
      borderRadius: '8px', transition: 'background 0.12s',
    }}>
      {children}
    </div>
  );
}

// ─── DiaLeadCard ─────────────────────────────────────────────────────────────

function DiaLeadCard({ lead, dark, border, txtHi, FONT, onReagendar }: {
  lead: CalLead; dark: boolean; border: string; txtHi: string;
  FONT: string; onReagendar: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lead-${lead.id}` });
  const rawPhone = (lead.whatsapp || '').replace(/\D/g, '');
  const wPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
  const ac = getAvatarColor(lead.nome, dark, lead.id);
  const tc = getAvatarTextColor(ac);
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
        borderRadius: '10px', border: `1px solid ${border}`,
        background: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
        opacity: isDragging ? 0 : 1, marginBottom: '5px',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: ac, color: tc, fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {safeInitials(lead.nome)}
      </div>
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeName(lead.nome)}</span>
      {lead.reuniao_agendada_at && (
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#8b5cf6', flexShrink: 0 }}>
          {fmtHora(lead.reuniao_agendada_at)}
        </span>
      )}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {rawPhone && (
          <a href={`https://wa.me/${wPhone}`} target="_blank" rel="noreferrer"
            style={{ width: '26px', height: '26px', borderRadius: '7px', background: dark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', textDecoration: 'none' }}>
            <MessageCircle size={12} />
          </a>
        )}
        <button onClick={onReagendar}
          style={{ height: '26px', borderRadius: '7px', padding: '0 7px', background: dark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: 600, fontFamily: FONT }}>
          <Calendar size={11} />Reagendar
        </button>
      </div>
    </div>
  );
}

// ─── DragOverlayChip ──────────────────────────────────────────────────────────

function DragOverlayChip({ lead, dark }: { lead: CalLead; dark: boolean }) {
  const color = getAvatarColor(lead.nome, dark, lead.id);
  const tc = getAvatarTextColor(color);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px 5px 6px', borderRadius: '8px', background: dark ? '#2a2a30' : '#fff', border: '1px solid #8b5cf6', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', cursor: 'grabbing', pointerEvents: 'none', width: 'fit-content' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color, color: tc, fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {safeInitials(lead.nome).charAt(0)}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: dark ? '#f0f0f0' : '#111827' }}>
        {(safeName(lead.nome) || '').split(' ')[0]}
      </span>
    </div>
  );
}

// ─── CalendarioPage ───────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();
  const modelo = useModeloNegocio();
  const { config: statusConfig } = useStatusConfig(modelo);
  const { updateLead } = useAppStore();
  const [searchParams] = useSearchParams();

  const bg         = dark ? '#111113' : '#f4f4f7';
  const cardBg     = dark ? '#1b1b1d' : '#ffffff';
  const border     = dark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';
  const txtHi      = dark ? '#f0f0f0' : '#111827';
  const txtMid     = dark ? '#a0a0a8' : '#6b7280';
  const txtLow     = dark ? '#6a6a74' : '#9ca3af';
  const cardShadow = dark ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.06)';
  const FONT       = 'Inter, sans-serif';

  // ── state ──────────────────────────────────────────────────────────────────

  const [viewMode, setViewMode]       = useState<ViewMode>('mes');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leads, setLeads]             = useState<CalLead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filtroQuadro, setFiltroQuadro] = useState<number | 'todos'>('todos');
  const [selectedLead, setSelectedLead] = useState<CalLead | null>(null);
  const [semDataOpen, setSemDataOpen] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [horariosOrg, setHorariosOrg] = useState<string[]>(['10:00', '12:00', '15:00', '17:00', '19:00']);
  const [savingHorarios, setSavingHorarios] = useState(false);
  const [modalDia, setModalDia]       = useState<{ dateStr: string; leads: CalLead[] } | null>(null);
  const [drawerModal, setDrawerModal] = useState<CalLead | null>(null);
  // AgendamentoReuniaoModal — null = fechado; { lead, fromModalDia } = aberto
  const [agendando, setAgendando]     = useState<{ lead: CalLead; fromModalDia: boolean } | null>(null);
  // Config add-horario popover state
  const [addHorOpen, setAddHorOpen]   = useState(false);
  const [addHorVal, setAddHorVal]     = useState('');
  const [addHorErr, setAddHorErr]     = useState('');
  // Week slot overflow popover
  const [weekPopover, setWeekPopover] = useState<{ key: string; leads: CalLead[] } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Protege o estado otimista de DnD contra sobrescrita do realtime
  const dndProtect = useRef<{ leadId: string; at: string | null; exp: number } | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (searchParams.get('semdata') === '1') setSemDataOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!orgId) return;
    (supabase as any).from('organizations').select('reuniao_horarios').eq('id', orgId).single()
      .then(({ data }: any) => {
        const h = data?.reuniao_horarios;
        if (Array.isArray(h) && h.length > 0) setHorariosOrg(h);
      });
  }, [orgId]);

  const reuniaoStatuses = useMemo(
    () => statusConfig.statuses.filter(s => (s as any).tipo === 'reuniao'),
    [statusConfig]
  );
  const reuniaoStatusIds = useMemo(() => reuniaoStatuses.map(s => s.id), [reuniaoStatuses]);
  const reuniaoIdsKey    = reuniaoStatusIds.join(',');

  useEffect(() => {
    if (!orgReady || !orgId) return;
    if (reuniaoStatusIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from('leads')
        .select('id, nome, whatsapp, cidade, status, score, faixa, reuniao_agendada_at, utm_campaign, observacoes, created_at, motivo_reprovacao, ultimo_status_change, avaliado, instagram')
        .eq('org_id', orgId)
        .in('status', reuniaoStatusIds);
      if (error) { toast.error('Erro ao carregar reuniões'); setLoading(false); return; }
      setLeads((data || []) as CalLead[]);
      setLoading(false);
    })();
  }, [orgId, orgReady, reuniaoIdsKey]); // eslint-disable-line

  useEffect(() => {
    if (!orgReady || !orgId) return;
    const ch = (supabase as any).channel(`cal-rt-${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, (payload: any) => {
        const updated = payload.new as CalLead;
        const prot = dndProtect.current;
        console.log('[Cal RT] UPDATE recebido:', updated.id, 'reuniao_agendada_at:', updated.reuniao_agendada_at, 'status:', updated.status, 'inReu:', reuniaoStatusIds.includes(updated.status as number));
        setLeads(prev => {
          const inReu = reuniaoStatusIds.includes(updated.status as number);
          const wasHere = prev.some(l => String(l.id) === String(updated.id));
          if (inReu && wasHere) return prev.map(l => {
            if (String(l.id) !== String(updated.id)) return l;
            // Se DnD acabou de mover este lead, preserva reuniao_agendada_at otimista
            const protect = prot && prot.leadId === String(l.id) && Date.now() < prot.exp;
            const merged = { ...l, ...updated };
            if (protect) merged.reuniao_agendada_at = prot.at;
            return merged;
          });
          if (inReu && !wasHere) return [...prev, updated];
          if (!inReu && wasHere) return prev.filter(l => String(l.id) !== String(updated.id));
          return prev;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, (p: any) => {
        const novo = p.new as CalLead;
        if (reuniaoStatusIds.includes(novo.status as number)) setLeads(prev => [...prev, novo]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, orgReady, reuniaoIdsKey]); // eslint-disable-line

  // ── DnD ───────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(e.active.id as string);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    console.log('[Cal DnD] end →', { active: active.id, over: over?.id ?? 'NULL' });
    if (!over) { console.warn('[Cal DnD] over=NULL, abortando'); return; }
    const leadId = (active.id as string).replace('lead-', '');
    // IDs do Supabase chegam como number no runtime mesmo tipados como string
    const lead = leads.find(l => String(l.id) === leadId);
    if (!lead) return;
    const targetId = over.id as string;
    let finalTargetId = targetId;

    // Se caiu em cima de outro lead, resolve o slot a partir desse lead
    if (targetId.startsWith('lead-')) {
      const targetLeadId = targetId.replace('lead-', '');
      const targetLead = leads.find(l => String(l.id) === targetLeadId);
      if (targetLead && targetLead.reuniao_agendada_at) {
        const dia = targetLead.reuniao_agendada_at.slice(0, 10);
        const hora = fmtHora(targetLead.reuniao_agendada_at);
        if (viewMode === 'semana') {
          finalTargetId = `${dia}|${hora}`;
        } else if (viewMode === 'dia') {
          finalTargetId = `diaslot:${hora}`;
        } else {
          finalTargetId = dia;
        }
      } else {
        finalTargetId = 'sem-data';
      }
    }

    // Resolve o novo datetime
    let newAt: string | null;
    const currentHora = fmtHora(lead.reuniao_agendada_at) || '10:00';

    if (finalTargetId === 'sem-data') {
      newAt = null;
    } else if (finalTargetId.startsWith('outros|')) {
      // Row "Outros" do semanal: muda só o dia, mantém hora
      const dia = finalTargetId.replace('outros|', '');
      newAt = `${dia}T${currentHora}:00-03:00`;
    } else if (finalTargetId.startsWith('diaslot:')) {
      const newHora = finalTargetId.replace('diaslot:', '');
      newAt = `${isoDate(currentDate)}T${newHora}:00-03:00`;
    } else if (finalTargetId.includes('|')) {
      // semana: YYYY-MM-DD|HH:MM
      const [dia, hora] = finalTargetId.split('|');
      newAt = `${dia}T${hora}:00-03:00`;
    } else {
      // fallback: só data, mantém hora
      newAt = `${finalTargetId}T${currentHora}:00-03:00`;
    }

    const prev = lead.reuniao_agendada_at ?? null;
    // Compara em UTC para evitar falso-match entre formato local (-03:00) e UTC do Supabase
    const toUtcMin = (s: string | null) => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 16);
    };
    console.log('[Cal DnD] prev:', prev, '→ newAt:', newAt, '| utcEqual?', toUtcMin(newAt) === toUtcMin(prev));
    if (toUtcMin(newAt) === toUtcMin(prev)) { console.warn('[Cal DnD] mesmo slot (UTC), abortando'); return; }
    // Protege estado otimista contra realtime por 4s
    dndProtect.current = { leadId, at: newAt, exp: Date.now() + 4000 };
    setLeads(ls => ls.map(l => String(l.id) === leadId ? { ...l, reuniao_agendada_at: newAt } : l));
    const { error } = await (supabase as any).from('leads').update({ reuniao_agendada_at: newAt }).eq('id', leadId);
    if (error) {
      dndProtect.current = null;
      console.error('[Cal DnD] SUPABASE UPDATE FAILED:', error);
      toast.error('Erro ao mover reunião');
      setLeads(ls => ls.map(l => String(l.id) === leadId ? { ...l, reuniao_agendada_at: prev } : l));
    } else {
      console.log('[Cal DnD] ✅ update OK, newAt salvo:', newAt);
      updateLead(String(leadId), { reuniao_agendada_at: newAt } as any);
    }
  }

  // ── lead arrastado ────────────────────────────────────────────────────────

  const activeDragLead = useMemo(() => {
    if (!activeDragId) return null;
    const leadId = activeDragId.replace('lead-', '');
    return leads.find(l => String(l.id) === leadId) ?? null;
  }, [activeDragId, leads]);

  // ── derivados ─────────────────────────────────────────────────────────────

  const activeLeads = useMemo(() => {
    let f = leads;
    if (filtroQuadro !== 'todos') f = f.filter(l => l.status === filtroQuadro);
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(l => safeName(l.nome).toLowerCase().includes(q) || (l.whatsapp || '').includes(q));
    }
    return f;
  }, [leads, filtroQuadro, search]);

  const comData = useMemo(() => activeLeads.filter(l => l.reuniao_agendada_at), [activeLeads]);
  const semData = useMemo(() => activeLeads.filter(l => !l.reuniao_agendada_at), [activeLeads]);
  const byDate  = useMemo(() => groupByDate(comData), [comData]);

  function navPrev() {
    const d = new Date(currentDate);
    if (viewMode === 'mes') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'semana') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  }
  function navNext() {
    const d = new Date(currentDate);
    if (viewMode === 'mes') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'semana') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  }

  const monthGrid = useMemo(() => buildMonthGrid(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);
  const weekDays  = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const hojeStr   = isoDate(new Date());
  const DIAS      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const periodoLabel =
    viewMode === 'mes'    ? mesLabel(currentDate) :
    viewMode === 'semana' ? semanaLabel(currentDate) :
    diaLabel(currentDate);

  function statusLabel(id: number | null | undefined) {
    if (!id) return '—';
    return statusConfig.statuses.find(s => s.id === id)?.label || '—';
  }

  const pad = isMobile ? '12px 16px' : '24px 32px';

  // ── onSalvo unificado ─────────────────────────────────────────────────────

  function handleAgendandoSalvo(reuniaoAt: string) {
    if (!agendando) return;
    const { lead, fromModalDia } = agendando;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, reuniao_agendada_at: reuniaoAt } : l));
    updateLead(lead.id, { reuniao_agendada_at: reuniaoAt } as any);
    if (fromModalDia) {
      setModalDia(prev => prev
        ? { ...prev, leads: prev.leads.map(l => l.id === lead.id ? { ...l, reuniao_agendada_at: reuniaoAt } : l) }
        : null
      );
    }
    setAgendando(null);
  }

  // ── header ────────────────────────────────────────────────────────────────

  function renderHeader() {
    const tabBtn = (mode: ViewMode, label: string, Icon: React.ElementType) => (
      <button key={mode} onClick={() => setViewMode(mode)} style={{
        padding: '6px 12px', borderRadius: '8px', border: 'none',
        background: viewMode === mode ? (dark ? '#2a2a32' : '#fff') : 'transparent',
        color: viewMode === mode ? txtHi : txtMid,
        fontWeight: viewMode === mode ? 700 : 500,
        fontSize: '13px', cursor: 'pointer', fontFamily: FONT,
        display: 'flex', alignItems: 'center', gap: '5px',
        boxShadow: viewMode === mode ? (dark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none',
        transition: 'all 0.15s',
      }}>
        <Icon size={13} />{!isMobile && label}
      </button>
    );

    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 160px' }}>
            <CalendarDays size={22} color="#8b5cf6" />
            <h1 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 800, color: txtHi, margin: 0, fontFamily: FONT }}>Calendário</h1>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead…"
            style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#fff', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 12px', fontSize: '13px', color: txtHi, outline: 'none', width: isMobile ? '120px' : '160px', fontFamily: FONT }} />
          {reuniaoStatuses.length > 1 && (
            <select value={String(filtroQuadro)} onChange={e => setFiltroQuadro(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              style={{ background: dark ? '#1b1b1d' : '#fff', border: `1px solid ${border}`, borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: txtHi, outline: 'none', cursor: 'pointer', fontFamily: FONT }}>
              <option value="todos">Todos os quadros</option>
              {reuniaoStatuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={navPrev} style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: txtHi }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: '8px', padding: '0 10px', height: '32px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: txtHi, fontFamily: FONT }}>
              Hoje
            </button>
            <button onClick={navNext} style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: txtHi }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <span style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: 800, color: txtHi, fontFamily: FONT, flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {periodoLabel}
          </span>
          <div style={{ display: 'flex', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {tabBtn('mes', 'Mês', Calendar)}
            {tabBtn('semana', 'Semana', CalendarDays)}
            {tabBtn('dia', 'Dia', Clock)}
          </div>
          <button onClick={() => setSemDataOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: semDataOpen ? '#8b5cf6' : (dark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'),
            border: `1px solid ${semDataOpen ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}`,
            borderRadius: '8px', padding: '7px 12px',
            color: semDataOpen ? '#fff' : '#8b5cf6',
            fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
          }}>
            <Clock size={14} />
            Sem data{semData.length > 0 ? ` (${semData.length})` : ''}
          </button>
        </div>
      </div>
    );
  }

  // ── month view — sem DnD, avatares com overlap ────────────────────────────

  function renderMonthView() {
    return (
      <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${border}` }}>
          {DIAS.map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isMobile ? d.charAt(0) : d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', padding: '3px' }}>
          {monthGrid.map((day, i) => {
            if (!day) return <div key={`e-${i}`} style={{ minHeight: '72px' }} />;
            const dateStr = isoDate(day);
            const dayLeads = byDate[dateStr] || [];
            const isToday = dateStr === hojeStr;
            const otherMonth = day.getMonth() !== currentDate.getMonth();
            const MAX_AV = 3;
            const visibleLeads = dayLeads.slice(0, MAX_AV);
            const overflow = dayLeads.length - visibleLeads.length;
            const total = dayLeads.length;

            return (
              <div
                key={dateStr}
                onClick={() => total > 0 && setModalDia({ dateStr, leads: dayLeads })}
                style={{
                  minHeight: '80px', borderRadius: '8px', padding: '5px',
                  background: isToday ? (dark ? 'rgba(0,68,253,0.07)' : 'rgba(0,68,253,0.04)') : 'transparent',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#ececec'}`,
                  cursor: total > 0 ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => {
                  if (total > 0)
                    (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = isToday
                    ? (dark ? 'rgba(0,68,253,0.07)' : 'rgba(0,68,253,0.04)')
                    : 'transparent';
                }}
              >
                {/* Número do dia */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', borderRadius: '50%',
                  fontSize: '12px', fontWeight: isToday ? 700 : 400,
                  background: isToday ? '#0044fd' : 'transparent',
                  color: isToday ? '#fff' : (otherMonth ? txtLow : txtHi),
                }}>
                  {day.getDate()}
                </span>

                {/* Avatares empilhados + contagem */}
                {total > 0 && (
                  <div style={{ padding: '2px 2px 0' }}>
                    <div style={{ position: 'relative', height: '22px', marginBottom: '3px' }}>
                      {visibleLeads.map((lead, idx) => {
                        const color = getAvatarColor(lead.nome, dark, lead.id);
                        const tc = getAvatarTextColor(color);
                        return (
                          <div key={lead.id} style={{
                            position: 'absolute', left: `${idx * 14}px`,
                            width: '22px', height: '22px', borderRadius: '50%',
                            background: color, color: tc,
                            fontSize: '8px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `2px solid ${dark ? '#1b1b1d' : '#ffffff'}`,
                            zIndex: MAX_AV - idx,
                          }}>
                            {safeInitials(lead.nome).charAt(0)}
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div style={{
                          position: 'absolute', left: `${MAX_AV * 14}px`,
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: dark ? '#3f3f46' : '#e4e4e7',
                          color: dark ? '#a1a1aa' : '#6b7280',
                          fontSize: '8px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `2px solid ${dark ? '#1b1b1d' : '#ffffff'}`,
                          zIndex: 0,
                        }}>
                          +{overflow}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: dark ? '#6a6a74' : '#9ca3af', fontWeight: 500 }}>
                      {total} reunião{total !== 1 ? 'ões' : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── week view — grade por horário com DnD ─────────────────────────────────

  function renderWeekView() {
    const horaSet = new Set(horariosOrg);
    const bySlot: Record<string, CalLead[]>  = {};
    const outrosPorDia: Record<string, CalLead[]> = {};

    for (const lead of comData) {
      const dia  = (lead.reuniao_agendada_at as string).slice(0, 10);
      const hora = fmtHora(lead.reuniao_agendada_at);
      if (horaSet.has(hora)) {
        const key = `${dia}|${hora}`;
        if (!bySlot[key]) bySlot[key] = [];
        bySlot[key].push(lead);
      } else {
        if (!outrosPorDia[dia]) outrosPorDia[dia] = [];
        outrosPorDia[dia].push(lead);
      }
    }

    const labelW   = '52px';
    const temOutros = weekDays.some(d => (outrosPorDia[isoDate(d)] || []).length > 0);

    return (
      <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, overflow: 'auto' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: `${labelW} repeat(7, 1fr)`, borderBottom: `1px solid ${border}`, minWidth: '560px' }}>
          <div style={{ borderRight: `1px solid ${border}` }} />
          {weekDays.map(day => {
            const ds = isoDate(day);
            const isToday = ds === hojeStr;
            return (
              <div key={ds} style={{ padding: '10px 6px', textAlign: 'center', background: isToday ? (dark ? 'rgba(0,68,253,0.1)' : 'rgba(0,68,253,0.05)') : 'transparent', borderRight: `1px solid ${border}` }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: isToday ? '#0044fd' : txtLow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DIAS[day.getDay()]}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', margin: '2px auto 0', background: isToday ? '#0044fd' : 'transparent', fontSize: '15px', fontWeight: 800, color: isToday ? '#fff' : txtHi }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Linhas por horário */}
        {horariosOrg.map(hora => (
          <div key={hora} style={{ display: 'grid', gridTemplateColumns: `${labelW} repeat(7, 1fr)`, borderBottom: `1px solid ${border}`, minHeight: '54px', minWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '8px', borderRight: `1px solid ${border}` }}>
              <span style={{ fontSize: '10.5px', fontWeight: 500, color: txtLow, fontFamily: FONT }}>{hora}</span>
            </div>
            {weekDays.map(day => {
              const ds = isoDate(day);
              const isToday = ds === hojeStr;
              const cellLeads = bySlot[`${ds}|${hora}`] || [];
              const visible = cellLeads.slice(0, 2);
              const overflow = cellLeads.length - visible.length;
              const slotKey = `${ds}|${hora}`;

              return (
                <WeekDroppableCell key={ds} id={`${ds}|${hora}`} dark={dark} isToday={isToday} border={border}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {visible.map(lead => (
                      <WeekDraggableChip key={lead.id} lead={lead} dark={dark} border={border} txtHi={txtHi} onOpenDrawer={() => setSelectedLead(lead)} />
                    ))}
                    {overflow > 0 && (
                      <button onClick={() => setWeekPopover({ key: slotKey, leads: cellLeads })}
                        style={{ padding: '2px 7px', borderRadius: '5px', border: `1px solid ${border}`, background: 'none', fontSize: '10px', fontWeight: 700, color: '#8b5cf6', cursor: 'pointer', fontFamily: FONT }}>
                        +{overflow}
                      </button>
                    )}
                  </div>
                </WeekDroppableCell>
              );
            })}
          </div>
        ))}

        {/* Outros horários */}
        {temOutros && (
          <div style={{ display: 'grid', gridTemplateColumns: `${labelW} repeat(7, 1fr)`, minWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '8px', borderRight: `1px solid ${border}` }}>
              <span style={{ fontSize: '9.5px', color: txtLow, fontFamily: FONT }}>Outros</span>
            </div>
            {weekDays.map(day => {
              const ds = isoDate(day);
              const outros = outrosPorDia[ds] || [];
              const isToday = ds === hojeStr;
              return (
                <WeekDroppableCell key={ds} id={`outros|${ds}`} dark={dark} isToday={isToday} border={border}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {outros.map(lead => (
                      <WeekDraggableChip key={lead.id} lead={lead} dark={dark} border={border} txtHi={txtHi} onOpenDrawer={() => setSelectedLead(lead)} />
                    ))}
                  </div>
                </WeekDroppableCell>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── day view — blocos por horário com DnD ─────────────────────────────────

  function renderDayView() {
    const diaStr = isoDate(currentDate);
    const leadsHoje = byDate[diaStr] || [];
    const horaSet = new Set(horariosOrg);
    const semHorario = leadsHoje.filter(l => !horaSet.has(fmtHora(l.reuniao_agendada_at)));
    const byHora: Record<string, CalLead[]> = {};
    leadsHoje.filter(l => horaSet.has(fmtHora(l.reuniao_agendada_at))).forEach(l => {
      const h = fmtHora(l.reuniao_agendada_at);
      if (!byHora[h]) byHora[h] = [];
      byHora[h].push(l);
    });

    return (
      <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, overflow: 'hidden' }}>
        {semHorario.length > 0 && (
          <div style={{ borderBottom: `1px solid ${border}` }}>
            <div style={{ padding: '10px 16px 6px', fontSize: '11px', fontWeight: 700, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sem horário definido</div>
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {semHorario.map(l => (
                <DiaLeadCard key={l.id} lead={l} dark={dark} border={border} txtHi={txtHi} FONT={FONT}

                  onReagendar={() => setAgendando({ lead: l, fromModalDia: false })}
                />
              ))}
            </div>
          </div>
        )}
        {horariosOrg.map(hora => {
          const leadsHora = byHora[hora] || [];
          return (
            <div key={hora} style={{ borderBottom: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 16px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6', width: '48px', flexShrink: 0, fontFamily: FONT, paddingTop: '2px' }}>{hora}</span>
                <DiaDroppableSlot hora={hora} dark={dark} border={border}>
                  {leadsHora.length > 0 ? leadsHora.map(l => (
                    <DiaLeadCard key={l.id} lead={l} dark={dark} border={border} txtHi={txtHi} FONT={FONT}
    
                      onReagendar={() => setAgendando({ lead: l, fromModalDia: false })}
                    />
                  )) : (
                    <div style={{ height: '32px' }} />
                  )}
                </DiaDroppableSlot>
              </div>
            </div>
          );
        })}
        {leadsHoje.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <CalendarDays size={32} color={txtLow} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: txtMid, margin: '10px 0 3px' }}>Nenhuma reunião neste dia</p>
            <p style={{ fontSize: '12px', color: txtLow, margin: 0 }}>Arraste um lead aqui ou use as setas para navegar.</p>
          </div>
        )}
      </div>
    );
  }

  // ── modal de dia ──────────────────────────────────────────────────────────

  function renderModalDia() {
    if (!modalDia) return null;
    const d = new Date(modalDia.dateStr + 'T12:00:00');
    const titulo = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });

    return createPortal(
      <>
        <div onClick={() => setModalDia(null)} style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 9101, background: dark ? '#18191f' : '#ffffff',
          borderRadius: '18px', width: '440px', maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column',
          boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07)' : '0 24px 64px rgba(0,0,0,0.16)',
          fontFamily: FONT,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(139,92,246,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📅</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: txtHi, margin: 0, lineHeight: 1.3 }}>Reuniões</h3>
              <p style={{ fontSize: '12px', color: txtLow, margin: 0, textTransform: 'capitalize' }}>{titulo}</p>
            </div>
            <button onClick={() => setModalDia(null)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtLow, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modalDia.leads.map((lead, li) => {
              const ac = getAvatarColor(lead.nome || '', dark, lead.id);
              const tc = getAvatarTextColor(ac);
              const rawPhone = (lead.whatsapp || '').replace(/\D/g, '');
              const wPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
              const faixaCor = lead.faixa === 'verde' ? '#22c55e' : lead.faixa === 'amarelo' ? '#f59e0b' : lead.faixa === 'vermelho' ? '#ef4444' : null;
              const rowBg = li % 2 === 1 ? (dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)') : 'transparent';
              return (
                <div key={lead.id} style={{ borderRadius: '12px', border: `1px solid ${border}`, background: rowBg, display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px' }}>
                  <div onClick={() => setDrawerModal(lead)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: ac, color: tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>
                    {safeInitials(lead.nome || '')}
                  </div>
                  <div onClick={() => setDrawerModal(lead)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeName(lead.nome) || 'Lead'}</div>
                    {lead.cidade && <div style={{ fontSize: '11px', color: txtLow, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.cidade}</div>}
                  </div>
                  {rawPhone && (
                    <a href={`https://wa.me/${wPhone}`} target="_blank" rel="noreferrer"
                      style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: dark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', textDecoration: 'none', flexShrink: 0 }}>
                      <MessageCircle size={14} />
                    </a>
                  )}
                  <button onClick={() => setAgendando({ lead, fromModalDia: true })}
                    style={{ height: '32px', borderRadius: '8px', padding: '0 12px', background: dark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <Calendar size={12} />Reagendar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── sem data panel ────────────────────────────────────────────────────────

  function renderSemDataPanel() {
    if (!semDataOpen) return null;
    const panel = (
      <div style={{
        position: 'fixed',
        bottom: isMobile ? 0 : 'auto',
        right: isMobile ? 0 : '24px',
        top: isMobile ? 'auto' : '72px',
        left: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : '320px',
        maxHeight: isMobile ? '65vh' : 'calc(100vh - 90px)',
        background: cardBg, border: `1px solid ${border}`,
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: txtHi, margin: 0 }}>Sem data agendada</h3>
            <p style={{ fontSize: '12px', color: txtMid, margin: '2px 0 0' }}>{semData.length} lead{semData.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setSemDataOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, padding: '4px', borderRadius: '6px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {semData.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>Todos os leads têm data agendada!</p>
            </div>
          ) : semData.map(lead => {
            const color = getAvatarColor(lead.nome, dark, lead.id);
            const tc = getAvatarTextColor(color);
            return (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', marginBottom: '4px', background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: color, color: tc, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {safeInitials(lead.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeName(lead.nome)}</div>
                  <div style={{ fontSize: '11px', color: txtMid }}>{statusLabel(lead.status)}</div>
                </div>
                <button
                  onClick={() => { setAgendando({ lead, fromModalDia: false }); }}
                  style={{ background: '#8b5cf6', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, fontFamily: FONT, flexShrink: 0 }}>
                  Agendar
                </button>
              </div>
            );
          })}
        </div>
        {viewMode === 'semana' && <SemDataDropZone dark={dark} border={border} txtLow={txtLow} />}
      </div>
    );
    return createPortal(
      <>
        {isMobile && <div onClick={() => setSemDataOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }} />}
        {panel}
      </>,
      document.body
    );
  }

  // ── skeleton ──────────────────────────────────────────────────────────────

  function renderSkeleton() {
    return (
      <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, padding: '24px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: '52px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: '8px' }} />
        ))}
      </div>
    );
  }

  // ── config section ────────────────────────────────────────────────────────

  function renderConfigSection() {
    function validar(v: string) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v); }

    async function confirmarAdd() {
      let formatted = addHorVal.trim();
      if (/^\d:[0-5]\d$/.test(formatted)) {
        formatted = '0' + formatted;
      }
      if (!validar(formatted)) { setAddHorErr('Use HH:MM (ex: 09:30)'); return; }
      if (horariosOrg.includes(formatted)) { setAddHorErr('Já existe'); return; }
      setSavingHorarios(true);
      const novos = [...horariosOrg, formatted].sort();
      setHorariosOrg(novos);
      setAddHorVal(''); setAddHorErr(''); setAddHorOpen(false);
      await (supabase as any).from('organizations').update({ reuniao_horarios: novos }).eq('id', orgId);
      setSavingHorarios(false);
    }

    return (
      <div style={{ marginTop: '20px', background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: txtMid, whiteSpace: 'nowrap', fontFamily: FONT }}>Horários de reunião</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {horariosOrg.map(h => (
              <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px 4px 10px', borderRadius: '99px', background: dark ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.09)', border: `1px solid ${dark ? 'rgba(139,92,246,0.28)' : 'rgba(139,92,246,0.22)'}` }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500, color: dark ? '#c4b5fd' : '#6d28d9', fontFamily: FONT }}>{h}</span>
                <button onClick={async () => {
                  const novos = horariosOrg.filter(x => x !== h).sort();
                  setHorariosOrg(novos);
                  await (supabase as any).from('organizations').update({ reuniao_horarios: novos }).eq('id', orgId);
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#a78bfa' : '#7c3aed', padding: 0, fontSize: '13px', lineHeight: 1, display: 'flex', alignItems: 'center' }}>✕</button>
              </span>
            ))}

            {/* Botão + inline */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setAddHorOpen(o => !o); setAddHorVal(''); setAddHorErr(''); }}
                style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1.5px dashed ${dark ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.4)'}`, background: 'transparent', color: '#8b5cf6', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +
              </button>
              {addHorOpen && (
                <>
                  <div onClick={() => setAddHorOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9200 }} />
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', zIndex: 9201, background: dark ? '#1e1e24' : '#fff', border: `1px solid ${border}`, borderRadius: '12px', padding: '16px', width: '200px', boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.15)', fontFamily: FONT }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: txtHi, marginBottom: '10px' }}>Novo horário</div>
                    <input autoFocus type="time" value={addHorVal}
                      onChange={e => { setAddHorVal(e.target.value); setAddHorErr(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') confirmarAdd(); if (e.key === 'Escape') setAddHorOpen(false); }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${addHorErr ? '#ef4444' : border}`, background: dark ? 'rgba(255,255,255,0.06)' : '#f4f4f7', color: txtHi, fontSize: '18px', fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
                    {addHorErr && <p style={{ fontSize: '11px', color: '#ef4444', margin: '5px 0 0', textAlign: 'center' }}>{addHorErr}</p>}
                    <button onClick={confirmarAdd} disabled={savingHorarios}
                      style={{ marginTop: '10px', width: '100%', padding: '8px 0', borderRadius: '8px', border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: savingHorarios ? 'not-allowed' : 'pointer', fontFamily: FONT }}>
                      {savingHorarios ? '…' : 'Adicionar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── week slot overflow popover ─────────────────────────────────────────────

  function renderWeekPopover() {
    if (!weekPopover) return null;
    return createPortal(
      <>
        <div onClick={() => setWeekPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 9300 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9301, background: dark ? '#1e1e24' : '#fff', border: `1px solid ${border}`, borderRadius: '12px', padding: '14px', width: '220px', boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.15)', fontFamily: FONT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: txtHi }}>Todos os leads</span>
            <button onClick={() => setWeekPopover(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtLow, padding: '2px', display: 'flex' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {weekPopover.leads.map(lead => {
              const color = getAvatarColor(lead.nome, dark, lead.id);
              const tc = getAvatarTextColor(color);
              return (
                <div key={lead.id} onClick={() => { setSelectedLead(lead); setWeekPopover(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: color, color: tc, fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {safeInitials(lead.nome).charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeName(lead.nome)}</div>
                    <div style={{ fontSize: '10px', color: txtLow }}>{fmtHora(lead.reuniao_agendada_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── empty state ───────────────────────────────────────────────────────────

  if (orgReady && reuniaoStatuses.length === 0) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <AppLayout leadCount={0}>
          <div style={{ padding: pad, minHeight: '100vh', background: bg, fontFamily: FONT }}>
            {renderHeader()}
            <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, boxShadow: cardShadow, padding: '60px 0', textAlign: 'center' }}>
              <CalendarDays size={40} color={txtLow} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: txtMid, margin: '12px 0 4px' }}>Nenhum quadro de reunião configurado</p>
              <p style={{ fontSize: '13px', color: txtLow, margin: 0 }}>No Kanban, edite um status e ative "Quadro de reunião".</p>
            </div>
            {renderConfigSection()}
          </div>
        </AppLayout>
      </DndContext>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
    >
      <AppLayout leadCount={leads.length}>
        <div style={{ padding: pad, minHeight: '100vh', background: bg, fontFamily: FONT }}>
          {renderHeader()}
          {loading
            ? renderSkeleton()
            : viewMode === 'mes'    ? renderMonthView()
            : viewMode === 'semana' ? renderWeekView()
            : renderDayView()
          }
          {renderConfigSection()}
        </div>
      </AppLayout>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeDragLead ? <DragOverlayChip lead={activeDragLead} dark={dark} /> : null}
      </DragOverlay>

      {renderSemDataPanel()}
      {renderModalDia()}
      {renderWeekPopover()}

      {agendando && orgId && (
        <AgendamentoReuniaoModal
          leadId={agendando.lead.id}
          leadNome={agendando.lead.nome || ''}
          orgId={orgId}
          dataInicial={agendando.lead.reuniao_agendada_at?.slice(0, 10)}
          dark={dark}
          onClose={() => setAgendando(null)}
          onSalvo={handleAgendandoSalvo}
        />
      )}

      {drawerModal && createPortal(
        <LeadDrawer
          lead={drawerModal as unknown as Lead}
          isOpen
          onClose={() => setDrawerModal(null)}
          onUpdate={(updated: Lead) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
            updateLead(updated.id, updated);
            setDrawerModal(prev => prev?.id === updated.id ? { ...prev, ...updated } as CalLead : prev);
          }}
        />,
        document.body
      )}

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead as unknown as Lead}
          isOpen
          onClose={() => setSelectedLead(null)}
          onUpdate={(updated: Lead) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
            updateLead(updated.id, updated);
            setSelectedLead(prev => prev?.id === updated.id ? { ...prev, ...updated } as CalLead : prev);
          }}
        />
      )}
    </DndContext>
  );
}
