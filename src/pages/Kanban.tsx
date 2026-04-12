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
import { MessageCircle, MoreVertical, Eye, Trash2, Clock, MapPin, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';
import { LeadDrawer } from '@/components/ui/lead-drawer';

const COLUMNS = [
  { status: 0, label: 'Aguardando',     border: '#f59e0b', dot: '#f59e0b', bg: '#fffbeb' },
  { status: 1, label: 'Em atendimento', border: '#3b82f6', dot: '#3b82f6', bg: '#eff6ff' },
  { status: 2, label: 'Reunião',        border: '#8b5cf6', dot: '#8b5cf6', bg: '#f5f3ff' },
  { status: 3, label: 'Aprovado',       border: '#10b981', dot: '#10b981', bg: '#ecfdf5' },
];

const AVATAR_COLORS = [
  'bg-rose-400','bg-yellow-400','bg-emerald-400','bg-orange-400',
  'bg-cyan-400','bg-violet-400','bg-blue-400','bg-pink-400',
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

// ── Draggable Card ────────────────────────────────────────────

function DraggableCard({ lead, onCardClick, onMenuClick, onWhatsApp, onViewProfile }: {
  lead: Lead;
  onCardClick: () => void;
  onMenuClick: (e: React.MouseEvent) => void;
  onWhatsApp: (e: React.MouseEvent) => void;
  onViewProfile: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onCardClick}
      className="group select-none rounded-xl transition-all"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-full ${avatarColor(lead.nome)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {initials(lead.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{lead.nome || 'Lead sem nome'}</p>
            <p className="text-xs text-gray-400 truncate">{lead.whatsapp || '—'}</p>
          </div>
        </div>
        <button
          className="p-1 text-gray-300 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          onPointerDown={e => e.stopPropagation()}
          onClick={onMenuClick}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
        {lead.cidade && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="w-3 h-3" />{lead.cidade}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />{getRelativeTime(lead.created_at)}
        </span>
        {lead.observacoes && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <Eye className="w-3 h-3" />Obs
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          style={{ background: '#f0fdf4', color: '#16a34a' }}
          onPointerDown={e => e.stopPropagation()}
          onClick={onWhatsApp}
        >
          <MessageCircle className="w-3 h-3" />WhatsApp
        </button>
        <button
          className="flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          onPointerDown={e => e.stopPropagation()}
          onClick={onViewProfile}
        >
          <Eye className="w-3 h-3" />Perfil
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

  return (
    <div
      className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTop: `3px solid ${col.border}` }}
    >
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.dot }} />
          <span className="text-sm font-semibold text-gray-800">{col.label}</span>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 p-3 flex flex-col gap-3 min-h-[200px] max-h-[70vh] overflow-y-auto transition-colors duration-150"
        style={{ backgroundColor: isOver ? col.bg : 'transparent' }}
      >
        {children}
        {count === 0 && (
          <div
            className="flex-1 flex items-center justify-center text-xs py-8 text-center px-2 rounded-lg border-2 border-dashed transition-colors"
            style={isOver
              ? { color: col.dot, borderColor: col.dot }
              : { color: '#d1d5db', borderColor: '#e5e7eb' }
            }
          >
            {isOver ? 'Solte aqui' : 'Sem leads'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overlay Card (shown while dragging) ──────────────────────

function OverlayCard({ lead }: { lead: Lead }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '12px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
      cursor: 'grabbing',
      width: '260px',
      transform: 'rotate(2deg)',
    }}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-full ${avatarColor(lead.nome)} flex items-center justify-center text-white text-xs font-bold`}>
          {initials(lead.nome)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.nome}</p>
          <p className="text-xs text-gray-400">{lead.whatsapp}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function KanbanPage() {
  const { leads, setLeads, updateLead } = useAppStore();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [menuLead, setMenuLead] = useState<Lead | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    supabase.from('leads').select('*').then(({ data }) => {
      if (data) setLeads(data as unknown as Lead[]);
    });
  }, []);

  useEffect(() => {
    const ch = supabase.channel('kanban-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        // Só adiciona leads novos, não refaz fetch completo
        const newLead = payload.new as unknown as Lead;
        useAppStore.getState().addLead(newLead);
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
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveLead(null);
    setOverColId(null);

    console.log('DRAG END — active:', active.id, 'over:', over?.id);

    if (!over) {
      console.log('DRAG END — sem destino, cancelando');
      return;
    }

    const leadId = active.id as string;
    const targetStatus = parseInt(over.id as string);

    console.log('DRAG END — leadId:', leadId, 'targetStatus:', targetStatus);

    if (isNaN(targetStatus)) {
      console.log('DRAG END — targetStatus inválido');
      return;
    }

    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      console.log('DRAG END — lead não encontrado');
      return;
    }

    const currentStatus = lead.status === null || lead.status === undefined ? 0 : Number(lead.status);
    console.log('DRAG END — currentStatus:', currentStatus, 'targetStatus:', targetStatus);

    // Atualiza otimisticamente
    updateLead(leadId, { status: targetStatus });

    const { data, error } = await supabase
      .from('leads')
      .update({ status: String(targetStatus) })
      .eq('id', leadId)
      .select();

    console.log('SUPABASE UPDATE — data:', data, 'error:', error);

    if (error) {
      updateLead(leadId, { status: currentStatus });
      toast.error('Erro ao mover lead: ' + error.message);
    } else {
      const col = COLUMNS.find(c => c.status === targetStatus);
      toast.success(`${lead.nome} → ${col?.label}`);
    }
  }

  async function moveToStatus(lead: Lead, newStatus: number) {
    setMenuLead(null);
    const currentStatus = lead.status ?? 0;
    if (currentStatus === newStatus) return;
    updateLead(lead.id, { status: newStatus });
    if (detailLead?.id === lead.id) setDetailLead({ ...detailLead, status: newStatus });
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    if (error) {
      updateLead(lead.id, { status: currentStatus });
      toast.error('Erro ao mover lead');
    } else {
      toast.success(`${lead.nome} → ${COLUMNS.find(c => c.status === newStatus)?.label}`);
    }
  }

  async function deleteLead(lead: Lead) {
    setMenuLead(null);
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) toast.error('Erro ao excluir lead');
    else {
      setLeads(leads.filter(l => l.id !== lead.id));
      toast.success('Lead excluído');
    }
  }

  async function saveObs() {
    if (!detailLead) return;
    setSaving(true);
    await supabase.from('leads').update({ observacoes: obs }).eq('id', detailLead.id);
    updateLead(detailLead.id, { observacoes: obs });
    setDetailLead({ ...detailLead, observacoes: obs });
    setSaving(false);
    toast.success('Observação salva!');
  }

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Funil CRM</h1>
            <p className="text-sm text-gray-400 mt-0.5">Arraste os cards entre colunas para atualizar o status</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Tempo real ativo
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={e => setOverColId(e.over?.id ? String(e.over.id) : null)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveLead(null); setOverColId(null); }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
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
                      onCardClick={() => { setDetailLead(lead); setObs(lead.observacoes || ''); }}
                      onMenuClick={e => { setMenuLead(lead); setMenuPos({ x: e.clientX, y: e.clientY }); }}
                      onWhatsApp={e => { e.stopPropagation(); window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank'); }}
                      onViewProfile={e => { e.stopPropagation(); setViewingLead(lead); }}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeLead ? <OverlayCard lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {menuLead && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[210px]"
          style={{ left: Math.min(menuPos.x, window.innerWidth - 220), top: Math.min(menuPos.y, window.innerHeight - 320) }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mover para</div>
          {COLUMNS.map(col => (
            <button key={col.status} onClick={() => moveToStatus(menuLead, col.status)}
              disabled={(menuLead.status ?? 0) === col.status}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${(menuLead.status ?? 0) === col.status ? 'text-gray-300 cursor-default' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
              {col.label}
              {(menuLead.status ?? 0) === col.status && <span className="ml-auto text-xs text-gray-300">atual</span>}
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => { setViewingLead(menuLead); setMenuLead(null); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
            <Eye className="w-4 h-4" /> Ver perfil completo
          </button>
          <button onClick={() => { window.open(`https://wa.me/${menuLead.whatsapp?.replace(/\D/g, '')}`, '_blank'); setMenuLead(null); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
            <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={() => deleteLead(menuLead)}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" /> Excluir lead
          </button>
        </div>
      )}

      <Dialog open={!!detailLead} onOpenChange={open => !open && setDetailLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${avatarColor(detailLead?.nome || '')} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {initials(detailLead?.nome || '')}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{detailLead?.nome}</p>
                <p className="text-xs text-gray-400 font-normal">{COLUMNS.find(c => c.status === (detailLead?.status ?? 0))?.label}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-4 mt-1">
              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                  <div><p className="text-xs text-gray-400">WhatsApp</p><p className="font-medium text-xs">{detailLead.whatsapp || '—'}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <div><p className="text-xs text-gray-400">Cidade</p><p className="font-medium text-xs">{detailLead.cidade || '—'}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <div><p className="text-xs text-gray-400">Entrada</p><p className="font-medium text-xs">{getRelativeTime(detailLead.created_at)}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <div><p className="text-xs text-gray-400">Status</p><p className="font-medium text-xs">{COLUMNS.find(c => c.status === (detailLead.status ?? 0))?.label}</p></div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">Mover para</p>
                <div className="flex gap-2 flex-wrap">
                  {COLUMNS.map(col => (
                    <button key={col.status} onClick={() => moveToStatus(detailLead, col.status)}
                      disabled={(detailLead.status ?? 0) === col.status}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-default"
                      style={(detailLead.status ?? 0) === col.status
                        ? { background: col.bg, color: col.dot, borderColor: col.dot }
                        : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >{col.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1.5">Observações</label>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Adicionar observação..." rows={3} className="text-sm" />
                <Button onClick={saveObs} size="sm" className="mt-2" disabled={saving}>{saving ? 'Salvando...' : 'Salvar observação'}</Button>
              </div>
              <div className="flex gap-2 pt-1">
                <a href={`https://wa.me/${detailLead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button>
                </a>
                <Button onClick={() => { setDetailLead(null); setViewingLead(detailLead); }} variant="outline" className="flex-1">
                  <Eye className="w-4 h-4 mr-2" />Ver perfil
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeadDrawer
        lead={viewingLead}
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onUpdate={updated => { updateLead(updated.id, updated); setViewingLead(updated); }}
      />
    </AppLayout>
  );
}
