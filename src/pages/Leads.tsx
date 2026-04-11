import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, Plus, Download, Database, RefreshCw, Edit, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';

// Import sample data function
async function insertSampleLeads() {
  const { insertSampleData } = await import('@/utils/sampleData');
  await insertSampleData();
  toast.success('Dados de exemplo inseridos com sucesso!');
}

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('leads')
      .select('count')
      .single();
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      toast.error(`Erro na conexão: ${error.message}`);
      return false;
    }
    
    console.log('Supabase connection successful! Total leads:', data.count);
    toast.success('Conexão com Supabase está OK!');
    return true;
  } catch (err) {
    console.error('Connection test error:', err);
    toast.error('Erro ao testar conexão com Supabase');
    return false;
  }
}

export default function LeadsPage() {
  const { leads, setLeads, addLead, updateLead } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  const leadsPerPage = 20;
  const [newLead, setNewLead] = useState({ nome: '', whatsapp: '', cidade: '' });

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        console.log('Fetching leads from Supabase...');
        console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
        
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });
        
        console.log('Supabase response:', { data, error });
        
        if (error) {
          console.error('Supabase error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          toast.error(`Erro ao carregar leads: ${error.message}`);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No leads found in database');
          setLeads([]);
          toast.info('Nenhum lead encontrado no banco de dados');
          return;
        }
        
        console.log('Leads fetched successfully:', data.length, 'leads');
        setLeads(data as unknown as Lead[]);
        toast.success(`${data.length} leads carregados com sucesso!`);
      } catch (err) {
        console.error('Unexpected error in fetchLeads:', err);
        toast.error('Erro inesperado ao carregar leads');
      }
    };
    fetchLeads();
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !search ||
        l.nome?.toLowerCase().includes(search.toLowerCase()) ||
        l.whatsapp?.includes(search) ||
        l.cidade?.toLowerCase().includes(search.toLowerCase());
      const leadStatus = l.status !== undefined ? l.status : 0; // Default to 0 (novo) if status doesn't exist
      const matchStatus = statusFilter === 'all' || leadStatus === parseInt(statusFilter);
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / leadsPerPage);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * leadsPerPage;
    const endIndex = startIndex + leadsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, leadsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const handleAddLead = async () => {
    if (!newLead.nome || !newLead.whatsapp) return;
    const now = new Date();
    const lead = {
      nome: newLead.nome,
      whatsapp: newLead.whatsapp,
      cidade: newLead.cidade,
      status: 0,
      entrada: now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      wa_sent: false,
    };
    const { data, error } = await supabase.from('leads').insert(lead).select().single();
    if (error) { toast.error('Erro ao adicionar lead'); return; }
    if (data) addLead(data as unknown as Lead);
    setNewLead({ nome: '', whatsapp: '', cidade: '' });
    setIsAddOpen(false);
    toast.success('Lead adicionado!');
  };

  const handleEditLead = async () => {
    if (!editingLead) return;
    
    const { error } = await supabase
      .from('leads')
      .update({
        nome: editingLead.nome,
        whatsapp: editingLead.whatsapp,
        cidade: editingLead.cidade,
        status: editingLead.status || 0,
      })
      .eq('id', editingLead.id);
    
    if (error) {
      toast.error('Erro ao atualizar lead');
      return;
    }
    
    // Update local state
    updateLead(editingLead.id, {
      nome: editingLead.nome,
      whatsapp: editingLead.whatsapp,
      cidade: editingLead.cidade,
      status: editingLead.status || 0,
    });
    
    setIsEditOpen(false);
    setEditingLead(null);
    toast.success('Lead atualizado com sucesso!');
  };

  const exportCSV = () => {
    const headers = 'Nome,WhatsApp,Cidade,Status,Entrada\n';
    const rows = filtered.map((l) => `${l.nome},${l.whatsapp},${l.cidade},${STATUS_LABELS[l.status !== undefined ? l.status : 0]},${l.entrada || new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-4">
        
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold font-display tracking-tight">Leads ({filtered.length})</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[200px] h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Filtrar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_LABELS.map((l, i) => <SelectItem key={i} value={String(i)}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
            <Button variant="outline" size="sm" onClick={insertSampleLeads}><Database className="w-4 h-4 mr-1" /> Dados Teste</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Adicionar Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input placeholder="Nome" value={newLead.nome} onChange={(e) => setNewLead({ ...newLead, nome: e.target.value })} />
                  <Input placeholder="WhatsApp" value={newLead.whatsapp} onChange={(e) => setNewLead({ ...newLead, whatsapp: e.target.value })} />
                  <Input placeholder="Cidade" value={newLead.cidade} onChange={(e) => setNewLead({ ...newLead, cidade: e.target.value })} />
                  <Button onClick={handleAddLead} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-display">Editar Lead</DialogTitle></DialogHeader>
                {editingLead && (
                  <div className="space-y-3 mt-2">
                    <Input 
                      placeholder="Nome" 
                      value={editingLead.nome || ''} 
                      onChange={(e) => setEditingLead({ ...editingLead, nome: e.target.value })} 
                    />
                    <Input 
                      placeholder="WhatsApp" 
                      value={editingLead.whatsapp || ''} 
                      onChange={(e) => setEditingLead({ ...editingLead, whatsapp: e.target.value })} 
                    />
                    <Input 
                      placeholder="Cidade" 
                      value={editingLead.cidade || ''} 
                      onChange={(e) => setEditingLead({ ...editingLead, cidade: e.target.value })} 
                    />
                    <Select value={String(editingLead.status || 0)} onValueChange={(value) => setEditingLead({ ...editingLead, status: parseInt(value) })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_LABELS.map((label, index) => (
                          <SelectItem key={index} value={String(index)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button onClick={handleEditLead} className="flex-1">Salvar</Button>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1">Cancelar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

                      </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">WhatsApp</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Cidade</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tempo</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map((lead, index) => (
                <tr 
                  key={lead.id} 
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors cursor-pointer`}
                  onClick={() => setViewingLead(lead)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                        {lead.nome ? lead.nome.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lead.nome || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{lead.whatsapp || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">{lead.cidade || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].bg} ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].text}`}>
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[lead.status !== undefined ? lead.status : 0].dot}`} />
                      {STATUS_LABELS[lead.status !== undefined ? lead.status : 0]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{getRelativeTime(lead.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-green-50 inline-flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLead(lead);
                          setIsEditOpen(true);
                        }}
                        className="w-8 h-8 rounded-lg bg-blue-50 inline-flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr className="bg-white"><td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">Nenhum lead encontrado</td></tr>
              )}
            </tbody>
          </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {((currentPage - 1) * leadsPerPage) + 1} a {Math.min(currentPage * leadsPerPage, filtered.length)} de {filtered.length} leads
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
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
