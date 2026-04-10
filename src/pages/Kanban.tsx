import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, GripVertical, ChevronRight, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function SortableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-all group" onClick={onClick}>
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{lead.nome}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
          {lead.cidade && <p className="text-[10px] text-muted-foreground mt-0.5">{lead.cidade}</p>}
          <p className="text-[10px] text-muted-foreground mt-1.5">{lead.entrada}</p>
          {lead.observacoes && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <StickyNote className="w-3 h-3" /> Obs. adicionada
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <button
          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank'); }}
        >
          <MessageCircle className="w-3 h-3 inline mr-1" /> WhatsApp
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({ status, leads, onCardClick }: { status: number; leads: Lead[]; onCardClick: (l: Lead) => void }) {
  return (
    <div className="bg-secondary/30 border border-border rounded-xl overflow-hidden flex flex-col min-w-[260px]">
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].dot}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABELS[status]}</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{leads.length}</span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2.5 flex flex-col gap-2 flex-1 min-h-[200px] overflow-y-auto">
          {leads.map((lead) => (
            <SortableCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))}
          {leads.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic py-10">
              Arraste leads para cá
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function KanbanPage() {
  const { leads, setLeads, updateLead } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [obs, setObs] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (data) setLeads(data as unknown as Lead[]);
    };
    fetchLeads();
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const getByStatus = useCallback((s: number) => leads.filter((l) => l.status === s), [leads]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeLead = leads.find((l) => l.id === active.id);
    const overLead = leads.find((l) => l.id === over.id);
    if (activeLead && overLead && activeLead.status !== overLead.status) {
      updateLead(active.id as string, { status: overLead.status });
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeLead = leads.find((l) => l.id === active.id);
    if (activeLead) {
      await supabase.from('leads').update({ status: activeLead.status }).eq('id', active.id);
    }
  };

  const advanceStage = async (lead: Lead) => {
    if (lead.status >= 3) return;
    const newStatus = lead.status + 1;
    updateLead(lead.id, { status: newStatus });
    await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);
    setSelectedLead({ ...lead, status: newStatus });
    toast.success(`Lead avançou para: ${STATUS_LABELS[newStatus]}`);
  };

  const saveObs = async () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, { observacoes: obs });
    await supabase.from('leads').update({ observacoes: obs }).eq('id', selectedLead.id);
    setSelectedLead({ ...selectedLead, observacoes: obs });
    toast.success('Observação salva!');
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-display tracking-tight">Funil CRM</h1>
          <p className="text-xs text-muted-foreground">Arraste os cards entre colunas</p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((s) => (
              <KanbanColumn key={s} status={s} leads={getByStatus(s)} onCardClick={(l) => { setSelectedLead(l); setObs(l.observacoes || ''); }} />
            ))}
          </div>
          <DragOverlay>
            {activeLead && (
              <div className="bg-card border-2 border-primary rounded-xl p-3 shadow-xl">
                <p className="text-sm font-medium">{activeLead.nome}</p>
                <p className="text-xs text-muted-foreground">{activeLead.whatsapp}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{selectedLead?.nome}</DialogTitle></DialogHeader>
          {selectedLead && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">WhatsApp</span><p>{selectedLead.whatsapp}</p></div>
                <div><span className="text-muted-foreground text-xs">Cidade</span><p>{selectedLead.cidade}</p></div>
                <div><span className="text-muted-foreground text-xs">Status</span><p>{STATUS_LABELS[selectedLead.status]}</p></div>
                <div><span className="text-muted-foreground text-xs">Entrada</span><p>{selectedLead.entrada}</p></div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Observações</label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Adicionar observação..." rows={3} />
                <Button onClick={saveObs} size="sm" className="mt-2">Salvar observação</Button>
              </div>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${selectedLead.whatsapp?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full"><MessageCircle className="w-4 h-4 mr-2" /> WhatsApp</Button>
                </a>
                {selectedLead.status < 3 && (
                  <Button onClick={() => advanceStage(selectedLead)} className="flex-1">
                    <ChevronRight className="w-4 h-4 mr-2" /> Avançar etapa
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
