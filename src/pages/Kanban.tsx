import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, MoreVertical, Eye, Trash2, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { useTheme } from '@/hooks/useTheme';

const COLUMNS = [
  { status: 0, label: 'Aguardando',     border: '#f59e0b', dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
  { status: 1, label: 'Em atendimento', border: '#3b82f6', dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
  { status: 2, label: 'Reunião',        border: '#8b5cf6', dot: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
  { status: 3, label: 'Aprovado',       border: '#10b981', dot: '#10b981', bg: 'rgba(16,185,129,0.06)' },
];

const AVATAR_COLORS = [
  '#f43f5e','#f97316','#eab308','#22c55e',
  '#06b6d4','#6366f1','#ec4899','#8b5cf6',
];

function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function parseDate(str?: string): Date {
  if (!str) return new Date(0);
  if (str.includes('T') || str.endsWith('Z')) return new Date(str);
  if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    const [datePart, timePart] = str.split(' ');
    const [day, month, year] = datePart.split('/');
    const [h = '0', m = '0'] = (timePart || '').split(':');
    return new Date(Number(year), Number(month)-1, Number(day), Number(h), Number(m));
  }
  return new Date(str);
}

// ── Obs Badge ─────────────────────────────────────────────────

function ObsBadge({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onPointerDown={e => e.stopPropagation()}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', gap: '3px',
        fontSize: '11.5px', color: '#f59e0b', cursor: 'default',
        background: 'rgba(245,158,11,0.1)', padding: '2px 6px',
        borderRadius: '20px', fontWeight: 500,
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Obs
      </span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1f2937', color: '#f9fafb',
          fontSize: '12px', lineHeight: 1.5,
          padding: '8px 12px', borderRadius: '9px',
          maxWidth: '220px', minWidth: '100px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #1f2937',
          }} />
        </div>
      )}
    </div>
  );
}

// ── Draggable Card ────────────────────────────────────────────

function DraggableCard({ lead, onCardClick, onMenuClick, onWhatsApp, onViewProfile }: {
  lead: Lead;
  onCardClick: () => void;
  onMenuClick: (e: React.MouseEvent) => void;
  onWhatsApp: (e: React.MouseEvent) => void;
  onViewProfile: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const color = avatarColor(lead.nome);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onCardClick}
      style={{
        background: dark ? '#111113' : '#ffffff',
        border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.07)'}`,
        borderRadius: '14px',
        padding: '13px',
        boxShadow: isDragging
          ? (dark ? '0 12px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' : '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)')
          : (dark ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.05)'),
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
        userSelect: 'none',
        transition: 'box-shadow 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s',
        willChange: 'box-shadow, opacity',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0,
            letterSpacing: '-0.01em',
          }}>
            {initials(lead.nome)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, color: dark ? '#f4f4f5' : '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              {lead.nome || 'Lead sem nome'}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
              {lead.whatsapp || '—'}
            </p>
          </div>
        </div>
        <button
          style={{
            padding: '4px', color: '#d1d5db', border: 'none', background: 'transparent',
            borderRadius: '7px', cursor: 'pointer', flexShrink: 0,
            opacity: 0, transition: 'opacity 0.15s, color 0.15s, background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          className="card-menu-btn"
          onPointerDown={e => e.stopPropagation()}
          onClick={onMenuClick}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#374151'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#d1d5db'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <MoreVertical style={{ width: '15px', height: '15px' }} />
        </button>
      </div>

      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {lead.cidade && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#9ca3af' }}>
            <MapPin style={{ width: '11px', height: '11px', strokeWidth: 1.8, flexShrink: 0 }} />
            {lead.cidade}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#9ca3af' }}>
          <Clock style={{ width: '11px', height: '11px', strokeWidth: 1.8, flexShrink: 0 }} />
          {getRelativeTime(lead.created_at)}
        </span>
        {lead.observacoes && lead.observacoes.trim() && (
          <ObsBadge text={lead.observacoes.trim()} />
        )}
      </div>

      <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
        <button
          style={{
            flex: 1, padding: '6px 0', borderRadius: '8px', border: 'none',
            background: dark ? 'rgba(16,163,74,0.15)' : '#f0fdf4', color: dark ? '#4ade80' : '#16a34a',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            transition: 'background 0.15s',
          }}
          onPointerDown={e => e.stopPropagation()}
          onClick={onWhatsApp}
          onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(16,163,74,0.25)' : '#dcfce7')}
          onMouseLeave={e => (e.currentTarget.style.background = dark ? 'rgba(16,163,74,0.15)' : '#f0fdf4')}
        >
          <MessageCircle style={{ width: '12px', height: '12px' }} /> WhatsApp
        </button>
        <button
          style={{
            flex: 1, padding: '6px 0', borderRadius: '8px', border: 'none',
            background: dark ? 'rgba(255,255,255,0.05)' : '#f8fafc', color: dark ? '#cbd5e1' : '#475569',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            transition: 'background 0.15s',
          }}
          onPointerDown={e => e.stopPropagation()}
          onClick={onViewProfile}
          onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : '#f1f5f9')}
          onMouseLeave={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : '#f8fafc')}
        >
          <Eye style={{ width: '12px', height: '12px' }} /> Perfil
        </button>
      </div>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────

function DroppableColumn({ col, children, count, isOver }: {
  col: typeof COLUMNS[0];
  children: React.ReactNode;
  count: number;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: String(col.status) });
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        borderRadius: '16px',
        border: `1px solid ${isOver ? col.border : dark ? '#1e1e22' : 'rgba(0,0,0,0.07)'}`,
        background: dark ? '#111113' : '#fafafa',
        overflow: 'hidden',
        boxShadow: isOver
          ? `0 0 0 2px ${col.border}30, 0 4px 16px rgba(0,0,0,0.06)`
          : dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'border-color 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1)',
        borderTop: `3px solid ${col.border}`,
      }}
    >
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: dark ? '#18181b' : '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.dot, display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: dark ? '#f4f4f5' : '#1f2937', letterSpacing: '-0.01em' }}>{col.label}</span>
        </div>
        <span style={{
          fontSize: '12px', fontWeight: 500, color: col.dot,
          background: `${col.dot}18`, padding: '2px 8px', borderRadius: '20px',
        }}>{count}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px',
          minHeight: '120px', maxHeight: '72vh', overflowY: 'auto',
          background: isOver ? col.bg : 'transparent',
          transition: 'background 0.2s cubic-bezier(0.4,0,0.2,1)',
          overflowX: 'hidden',
        }}
      >
        {children}
        {count === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', padding: '28px 0', textAlign: 'center',
            borderRadius: '10px', border: `2px dashed ${isOver ? col.dot : 'rgba(0,0,0,0.1)'}`,
            color: isOver ? col.dot : '#d1d5db',
            transition: 'color 0.2s, border-color 0.2s',
          }}>
            {isOver ? 'Solte aqui' : 'Sem leads'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overlay Card (shown while dragging) ──────────────────────

function OverlayCard({ lead }: { lead: Lead }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const color = avatarColor(lead.nome);
  return (
    <div style={{
      background: dark ? '#18181b' : '#ffffff',
      border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '14px',
      padding: '13px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.2), 0 4px 14px rgba(0,0,0,0.1)',
      cursor: 'grabbing',
      width: '260px',
      transform: 'rotate(1.5deg) scale(1.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: '12px', fontWeight: 700,
        }}>
          {initials(lead.nome)}
        </div>
        <div>
          <p style={{ fontSize: '13.5px', fontWeight: 600, color: dark ? '#f4f4f5' : '#111827', margin: 0 }}>{lead.nome}</p>
          <p style={{ fontSize: '12px', color: dark ? '#71717a' : '#9ca3af', margin: 0 }}>{lead.whatsapp}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function KanbanPage() {
  const { leads, setLeads, updateLead } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [menuLead, setMenuLead] = useState<Lead | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sensor com delay mínimo para não atrapalhar o click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    supabase.from('leads').select('*').then(({ data }) => {
      if (data) setLeads(data as unknown as Lead[]);
    });
  }, []);

  useEffect(() => {
    const ch = supabase.channel('kanban-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const newLead = payload.new as unknown as Lead;
        useAppStore.getState().addLead(newLead);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const updated = payload.new as unknown as Lead;
        useAppStore.getState().updateLead(updated.id, updated);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
        const deleted = payload.old as { id: string };
        const current = useAppStore.getState().leads;
        useAppStore.getState().setLeads(current.filter(l => l.id !== deleted.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuLead(null);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function getColLeads(status: number): Lead[] {
    const col = leads.filter(l => {
      const s = l.status === null || l.status === undefined ? 0 : Number(l.status);
      return s === status;
    });
    return [...col].sort((a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime());
  }

  function handleDragStart(e: DragStartEvent) {
    const lead = leads.find(l => l.id === e.active.id);
    if (lead) setActiveLead(lead);
    setMenuLead(null); // fecha menu ao arrastar
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveLead(null);
    setOverColId(null);

    if (!over) return;

    const leadId = active.id as string;
    const targetStatus = parseInt(over.id as string);
    if (isNaN(targetStatus)) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const currentStatus = lead.status === null || lead.status === undefined ? 0 : Number(lead.status);
    if (currentStatus === targetStatus) return;

    // Atualização otimista — imediato, sem esperar o Supabase
    updateLead(leadId, { status: targetStatus });

    const { error } = await supabase
      .from('leads')
      .update({ status: targetStatus })
      .eq('id', leadId);

    if (error) {
      updateLead(leadId, { status: currentStatus });
      toast.error('Erro ao mover lead', {
        description: error.message
      });
    } else {
      const col = COLUMNS.find(c => c.status === targetStatus);
      toast.success('Status Atualizado', {
        description: `${lead.nome} movido para ${col?.label}`,
        duration: 3000,
      });
    }
  }

  async function moveToStatus(lead: Lead, newStatus: number) {
    setMenuLead(null);
    const currentStatus = Number(lead.status ?? 0);
    if (currentStatus === newStatus) return;
    updateLead(lead.id, { status: newStatus });
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) {
      updateLead(lead.id, { status: currentStatus });
      toast.error('Erro ao mover lead');
    } else {
      const col = COLUMNS.find(c => c.status === newStatus);
      toast.success('Status Atualizado', {
        description: `${lead.nome} movido para ${col?.label}`,
        duration: 3000,
      });
    }
  }

  async function deleteLead(lead: Lead) {
    setMenuLead(null);
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) toast.error('Erro ao excluir lead');
    else {
      setLeads(leads.filter(l => l.id !== lead.id));
      toast.success('Lead removido', {
        description: `${lead.nome} foi excluído do sistema.`,
      });
    }
  }

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px 32px 40px', background: dark ? '#090909' : '#f4f4f5', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: dark ? '#f4f4f5' : '#111827', margin: 0, letterSpacing: '-0.03em' }}>Funil CRM</h1>
            <p style={{ fontSize: '13px', color: dark ? '#a1a1aa' : '#9ca3af', marginTop: '3px' }}>
              Arraste os cards para atualizar o status · Clique para ver o perfil
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: dark ? '#71717a' : '#9ca3af' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'kpulse 2s ease-in-out infinite' }} />
            Tempo real
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={e => setOverColId(e.over?.id ? String(e.over.id) : null)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveLead(null); setOverColId(null); }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', alignItems: 'start' }}>
            {COLUMNS.map(col => {
              const colLeads = getColLeads(col.status);
              return (
                <DroppableColumn
                  key={col.status}
                  col={col}
                  count={colLeads.length}
                  isOver={overColId === String(col.status)}
                >
                  {colLeads.map(lead => (
                    <DraggableCard
                      key={lead.id}
                      lead={lead}
                      // Clicar no card → abre LeadDrawer diretamente
                      onCardClick={() => setViewingLead(lead)}
                      onMenuClick={e => {
                        e.stopPropagation();
                        setMenuLead(lead);
                        setMenuPos({ x: e.clientX, y: e.clientY });
                      }}
                      onWhatsApp={e => {
                        e.stopPropagation();
                        window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank');
                      }}
                      onViewProfile={e => {
                        e.stopPropagation();
                        setViewingLead(lead);
                      }}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeLead ? <OverlayCard lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Context menu */}
      {menuLead && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed', zIndex: 60,
            left: Math.min(menuPos.x, window.innerWidth - 224),
            top: Math.min(menuPos.y, window.innerHeight - 300),
            background: dark ? '#111113' : '#ffffff',
            border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: '13px',
            boxShadow: dark ? '0 12px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            padding: '6px',
            minWidth: '210px',
            animation: 'kmenu 0.15s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <div style={{ padding: '4px 10px 6px', fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Mover para
          </div>
          {COLUMNS.map(col => {
            const isCurrent = Number(menuLead.status ?? 0) === col.status;
            return (
              <button key={col.status}
                onClick={() => moveToStatus(menuLead, col.status)}
                disabled={isCurrent}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px',
                  border: 'none', background: 'transparent', cursor: isCurrent ? 'default' : 'pointer',
                  color: isCurrent ? (dark ? '#3f3f46' : '#d1d5db') : (dark ? '#d4d4d8' : '#374151'), fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isCurrent) (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'); }}
                onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isCurrent ? (dark ? '#27272a' : '#e5e7eb') : col.dot, flexShrink: 0, display: 'inline-block' }} />
                {col.label}
                {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '11px', color: dark ? '#3f3f46' : '#d1d5db' }}>atual</span>}
              </button>
            );
          })}

          <div style={{ height: '1px', background: dark ? '#1e1e22' : 'rgba(0,0,0,0.06)', margin: '4px 0' }} />

          <button onClick={() => { setViewingLead(menuLead); setMenuLead(null); }}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Eye style={{ width: '14px', height: '14px', color: dark ? '#71717a' : '#6b7280' }} /> Ver perfil completo
          </button>

          <button onClick={() => { window.open(`https://wa.me/${menuLead.whatsapp?.replace(/\D/g, '')}`, '_blank'); setMenuLead(null); }}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <MessageCircle style={{ width: '14px', height: '14px', color: dark ? '#71717a' : '#6b7280' }} /> Abrir WhatsApp
          </button>

          <div style={{ height: '1px', background: dark ? '#1e1e22' : 'rgba(0,0,0,0.06)', margin: '4px 0' }} />

          <button onClick={() => deleteLead(menuLead)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fff1f2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 style={{ width: '14px', height: '14px' }} /> Excluir lead
          </button>
        </div>
      )}

      {/* Lead Drawer — abre tanto ao clicar no card quanto no botão Perfil */}
      <LeadDrawer
        lead={viewingLead}
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onUpdate={updated => {
          updateLead(updated.id, updated);
          setViewingLead(updated);
        }}
      />

      <style>{`
        @keyframes kpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes kmenu {
          from { opacity: 0; transform: scale(0.94) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        /* Revela o botão de menu ao hover no card */
        div:hover > div > .card-menu-btn {
          opacity: 1 !important;
        }
      `}</style>
    </AppLayout>
  );
}
