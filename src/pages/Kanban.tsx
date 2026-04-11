import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, MoreVertical, Plus, Eye, Trash2, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';
import { LeadDrawer } from '@/components/ui/lead-drawer';

export default function KanbanPage() {
  const { leads, setLeads, updateLead, addLead } = useAppStore();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [obs, setObs] = useState('');
  const [contextMenuLead, setContextMenuLead] = useState<Lead | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [addLeadDialog, setAddLeadDialog] = useState<{ open: boolean; status: number }>({ open: false, status: 0 });
  const [newLead, setNewLead] = useState({ nome: '', whatsapp: '', cidade: '' });
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<number | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (data) setLeads(data as unknown as Lead[]);
    };
    fetchLeads();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setContextMenuLead(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getByStatus = useCallback((s: number) => {
  if (s === 0) {
    return leads.filter((l) => l.status === null || l.status === undefined || l.status === 0);
  }
  return leads.filter((l) => l.status === s);
}, [leads]);

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLeadId(lead.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (status: number) => {
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: number) => {
    e.preventDefault();
    setDragOverStatus(null);
    
    if (!draggedLeadId) return;
    
    const draggedLead = leads.find((l) => l.id === draggedLeadId);
    if (!draggedLead) return;
    
    if (draggedLead.status !== targetStatus) {
      // Update local state first for immediate visual feedback
      updateLead(draggedLead.id, { status: targetStatus });
      
      // Update Supabase
      const { error } = await supabase
        .from('leads')
        .update({ status: targetStatus })
        .eq('id', draggedLead.id);
      
      if (error) {
        console.error('Error updating lead status:', error);
        toast.error('Erro ao atualizar status do lead');
        // Revert local state on error
        updateLead(draggedLead.id, { status: draggedLead.status });
      } else {
        toast.success(`${draggedLead.nome} movido para ${STATUS_LABELS[targetStatus]}`);
      }
    }
    
    setDraggedLeadId(null);
  };

  const handleContextMenu = (lead: Lead, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuLead(lead);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const moveLeadToStatus = async (lead: Lead, newStatus: number) => {
    if (lead.status === newStatus) return;
    
    // Update local state first
    updateLead(lead.id, { status: newStatus });
    
    // Update Supabase
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', lead.id);
    
    if (error) {
      console.error('Error updating lead status:', error);
      toast.error('Erro ao atualizar status do lead');
      // Revert local state on error
      updateLead(lead.id, { status: lead.status });
    } else {
      toast.success(`Lead movido para: ${STATUS_LABELS[newStatus]}`);
    }
    
    setContextMenuLead(null);
  };

  const deleteLead = async (lead: Lead) => {
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) {
      toast.error('Erro ao excluir lead');
    } else {
      setLeads(leads.filter(l => l.id !== lead.id));
      toast.success('Lead excluído com sucesso');
    }
    setContextMenuLead(null);
  };

  const openWhatsApp = (lead: Lead) => {
    window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`, '_blank');
    setContextMenuLead(null);
  };

  const openProfile = (lead: Lead) => {
    setViewingLead(lead);
    setContextMenuLead(null);
  };

  const handleAddLead = async () => {
    if (!newLead.nome || !newLead.whatsapp) {
      toast.error('Preencha nome e WhatsApp');
      return;
    }

    const now = new Date();
    const lead = {
      nome: newLead.nome,
      whatsapp: newLead.whatsapp,
      cidade: newLead.cidade,
      status: addLeadDialog.status,
      entrada: now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      wa_sent: false,
    };

    const { data, error } = await supabase.from('leads').insert(lead).select().single();
    if (error) {
      toast.error('Erro ao adicionar lead');
      return;
    }
    
    if (data) {
      addLead(data as unknown as Lead);
      setNewLead({ nome: '', whatsapp: '', cidade: '' });
      setAddLeadDialog({ open: false, status: 0 });
      toast.success('Lead adicionado com sucesso!');
    }
  };

  
  const saveObs = async () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, { observacoes: obs });
    await supabase.from('leads').update({ observacoes: obs }).eq('id', selectedLead.id);
    setSelectedLead({ ...selectedLead, observacoes: obs });
    toast.success('Observação salva!');
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900">Funil CRM</h1>
          <p className="text-sm text-gray-600 mt-1">Arraste os cards entre colunas para atualizar o status</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((status) => (
            <div key={status} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-w-[280px]">
              <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].dot}`} />
                  <span className="text-sm font-semibold text-gray-900">{STATUS_LABELS[status]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{getByStatus(status).length}</span>
                  <button
                    onClick={() => setAddLeadDialog({ open: true, status })}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Adicionar lead"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div 
                className={`p-3 flex flex-col gap-3 flex-1 min-h-[200px] overflow-y-auto transition-colors ${
                  dragOverStatus === status ? 'bg-blue-50' : 'bg-white'
                }`}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
              >
                {getByStatus(status).map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead)}
                    onClick={() => { setSelectedLead(lead); setObs(lead.observacoes || ''); }}
                    className="bg-white border border-gray-200 rounded-lg p-3 cursor-move hover:shadow-md transition-all mb-3 relative"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{lead.nome || 'Lead sem nome'}</p>
                        <p className="text-xs text-gray-600 truncate">{lead.whatsapp || 'Sem WhatsApp'}</p>
                        {lead.cidade && <p className="text-xs text-gray-500 mt-0.5">{lead.cidade}</p>}
                        <p className="text-xs text-gray-400 mt-1.5">{getRelativeTime(lead.created_at)}</p>
                        {lead.observacoes && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                            <Eye className="w-3 h-3" /> Obs. adicionada
                          </div>
                        )}
                      </div>
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(lead, e); }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <button
                        className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(lead); }}
                      >
                        <MessageCircle className="w-3 h-3 inline mr-1" /> WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
                {getByStatus(status).length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-sm py-8 text-gray-400">
                    {dragOverStatus === status ? "Solte o lead aqui" : "Arraste leads para cá ou clique em + para adicionar"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Context Menu */}
        {contextMenuLead && (
          <div 
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[200px]"
            style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mover para</div>
            {[0, 1, 2, 3].map(status => (
              <button
                key={status}
                onClick={() => moveLeadToStatus(contextMenuLead, status)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].dot}`} />
                {STATUS_LABELS[status]}
              </button>
            ))}
            <div className="border-t border-gray-200 my-2"></div>
            <button
              onClick={() => openProfile(contextMenuLead)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> Ver perfil completo
            </button>
            <button
              onClick={() => openWhatsApp(contextMenuLead)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
            </button>
            <div className="border-t border-gray-200 my-2"></div>
            <button
              onClick={() => deleteLead(contextMenuLead)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Excluir lead
            </button>
          </div>
        )}

        {/* Add Lead Dialog */}
        <Dialog open={addLeadDialog.open} onOpenChange={(open) => setAddLeadDialog({ ...addLeadDialog, open })}>
          <DialogContent className="bg-white rounded-xl border border-gray-200 shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Adicionar Lead - {STATUS_LABELS[addLeadDialog.status]}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Nome"
                value={newLead.nome}
                onChange={(e) => setNewLead({ ...newLead, nome: e.target.value })}
              />
              <Input
                placeholder="WhatsApp"
                value={newLead.whatsapp}
                onChange={(e) => setNewLead({ ...newLead, whatsapp: e.target.value })}
              />
              <Input
                placeholder="Cidade"
                value={newLead.cidade}
                onChange={(e) => setNewLead({ ...newLead, cidade: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddLead} className="flex-1">
                  Adicionar Lead
                </Button>
                <Button variant="outline" onClick={() => setAddLeadDialog({ open: false, status: 0 })} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lead Detail Modal */}
        <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="bg-white rounded-xl border border-gray-200 shadow-lg">
            <DialogHeader><DialogTitle className="text-lg font-semibold text-gray-900">{selectedLead?.nome}</DialogTitle></DialogHeader>
            {selectedLead && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500 text-xs">WhatsApp</span><p>{selectedLead.whatsapp}</p></div>
                  <div><span className="text-gray-500 text-xs">Cidade</span><p>{selectedLead.cidade}</p></div>
                  <div><span className="text-gray-500 text-xs">Status</span><p>{STATUS_LABELS[selectedLead.status]}</p></div>
                  <div><span className="text-gray-500 text-xs">Entrada</span><p>{selectedLead.entrada}</p></div>
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
                  <Button onClick={() => moveLeadToStatus(selectedLead, selectedLead.status + 1)} className="flex-1">
                    <ChevronRight className="w-4 h-4 mr-2" /> Avançar etapa
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>

      {/* Lead Drawer */}
      <LeadDrawer
        lead={viewingLead}
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onUpdate={(updatedLead) => {
          updateLead(updatedLead.id, updatedLead);
          setViewingLead(updatedLead);
        }}
      />
    </AppLayout>
  );
}
