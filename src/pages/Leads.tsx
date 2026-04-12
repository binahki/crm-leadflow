import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, Plus, Download, RefreshCw, Edit, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { toast } from 'sonner';
import { formatDate } from '@/utils/relativeTime';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE = [
  { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  { bg: 'bg-purple-100', text: 'text-purple-700',  dot: 'bg-purple-500' },
  { bg: 'bg-green-100',  text: 'text-green-700',   dot: 'bg-green-500'  },
];

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Use the canonical formatDate from utils (DD/MM às HH:mm)
const formatEntryTime = formatDate;

/** Retorna os limites ISO para o filtro de período */
function getPeriodRange(period: string): { gte?: string; lt?: string } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { gte: today.toISOString() };

    case 'yesterday': {
      const start = new Date(today); start.setDate(start.getDate() - 1);
      return { gte: start.toISOString(), lt: today.toISOString() };
    }
    case '7days': {
      const start = new Date(today); start.setDate(start.getDate() - 7);
      return { gte: start.toISOString() };
    }
    case '30days': {
      const start = new Date(today); start.setDate(start.getDate() - 30);
      return { gte: start.toISOString() };
    }
    case 'month':
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };

    default:
      return {};
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { setLeads: syncStore, updateLead } = useAppStore();

  // Table-specific state (independent of the global store)
  const [tableLeads, setTableLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  // Pagination
  const leadsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [isAddOpen,   setIsAddOpen]   = useState(false);
  const [isEditOpen,  setIsEditOpen]  = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ nome: '', whatsapp: '', cidade: '' });

  // ── Fetch with Supabase filters ─────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);

    // Build query — filters first, order last (safer with PostgREST)
    let query = supabase.from('leads').select('*');

    // Period filter via .gte / .lt
    const { gte, lt } = getPeriodRange(periodFilter);
    if (gte) query = query.gte('created_at', gte);
    if (lt)  query = query.lt('created_at', lt);

    // Status filter: status 0 can be stored as NULL in some rows
    if (statusFilter !== 'all') {
      const s = parseInt(statusFilter);
      if (s === 0) {
        query = query.or('status.eq.0,status.is.null');
      } else {
        query = query.eq('status', s);
      }
    }

    // Always newest first
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      toast.error(`Erro ao carregar leads: ${error.message}`);
    } else {
      // Sort client-side as safety net to guarantee descending order
      const leads = ((data ?? []) as unknown as Lead[]).sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
      setTableLeads(leads);
      syncStore(leads); // keep sidebar badge in sync
    }

    setIsLoading(false);
  }, [periodFilter, statusFilter]);

  // Re-fetch whenever a filter changes
  useEffect(() => {
    setCurrentPage(1);
    fetchLeads();
  }, [fetchLeads]);

  // ── Client-side search (no extra round-trip needed) ─────────────────────────

  const filtered = useMemo(() => {
    let result = tableLeads;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = tableLeads.filter(l =>
        l.nome?.toLowerCase().includes(q) ||
        l.whatsapp?.includes(search) ||
        l.cidade?.toLowerCase().includes(q)
      );
    }
    // Maintain descending order after any client-side filtering
    return [...result].sort(
      (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
  }, [tableLeads, search]);

  // Reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  // Pagination
  const totalPages     = Math.ceil(filtered.length / leadsPerPage);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * leadsPerPage;
    return filtered.slice(start, start + leadsPerPage);
  }, [filtered, currentPage]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleAddLead = async () => {
    if (!newLead.nome || !newLead.whatsapp) return;
    const { data, error } = await supabase
      .from('leads')
      .upsert(
        { nome: newLead.nome, whatsapp: newLead.whatsapp, cidade: newLead.cidade, status: 0, wa_sent: false },
        { onConflict: 'nome,whatsapp', ignoreDuplicates: true }
      )
      .select()
      .single();
    if (error) { toast.error('Erro ao adicionar lead'); return; }
    if (data) {
      const lead = data as unknown as Lead;
      setTableLeads(prev => [lead, ...prev]);
      syncStore([lead, ...tableLeads]);
    }
    setNewLead({ nome: '', whatsapp: '', cidade: '' });
    setIsAddOpen(false);
    toast.success('Lead adicionado!');
  };

  /** Salva nome, whatsapp, cidade e status no Supabase e atualiza a tabela imediatamente */
  const handleEditLead = async () => {
    if (!editingLead) return;

    const updates = {
      nome:      editingLead.nome,
      whatsapp:  editingLead.whatsapp,
      cidade:    editingLead.cidade,
      status:    editingLead.status ?? 0,
    };

    const { error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', editingLead.id);

    if (error) { toast.error('Erro ao atualizar lead'); return; }

    // Atualiza tabela local sem reload
    setTableLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...updates } : l));
    updateLead(editingLead.id, updates);

    // Se o filtro de status estiver ativo e o novo status for diferente, remove da lista visível
    if (statusFilter !== 'all' && String(updates.status) !== statusFilter) {
      setTableLeads(prev => prev.filter(l => l.id !== editingLead.id));
    }

    setIsEditOpen(false);
    setEditingLead(null);
    toast.success('Lead atualizado!');
  };

  const exportCSV = () => {
    const headers = 'Nome,WhatsApp,Cidade,Status,Entrada\n';
    const rows = filtered.map(l =>
      `${l.nome},${l.whatsapp},${l.cidade},${STATUS_LABELS[l.status ?? 0]},${formatEntryTime(l.created_at)}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout leadCount={tableLeads.length}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Leads{' '}
              <span className="text-gray-400 font-normal text-lg">({filtered.length})</span>
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie todos os seus leads</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-[180px] h-9 bg-white border-gray-200"
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[155px] h-9 bg-white border-gray-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUS_LABELS.map((l, i) => (
                  <SelectItem key={i} value={String(i)}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period filter */}
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[135px] h-9 bg-white border-gray-200">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="7days">7 dias</SelectItem>
                <SelectItem value="30days">30 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={fetchLeads} className="bg-white border-gray-200 h-9">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="bg-white border-gray-200 h-9">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>

            {/* Add dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input placeholder="Nome" value={newLead.nome} onChange={e => setNewLead(n => ({ ...n, nome: e.target.value }))} />
                  <Input placeholder="WhatsApp" value={newLead.whatsapp} onChange={e => setNewLead(n => ({ ...n, whatsapp: e.target.value }))} />
                  <Input placeholder="Cidade" value={newLead.cidade} onChange={e => setNewLead(n => ({ ...n, cidade: e.target.value }))} />
                  <Button onClick={handleAddLead} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={isEditOpen} onOpenChange={open => { setIsEditOpen(open); if (!open) setEditingLead(null); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>Editar Lead</DialogTitle></DialogHeader>
                {editingLead && (
                  <div className="space-y-3 mt-2">
                    <Input placeholder="Nome" value={editingLead.nome || ''} onChange={e => setEditingLead(l => l && ({ ...l, nome: e.target.value }))} />
                    <Input placeholder="WhatsApp" value={editingLead.whatsapp || ''} onChange={e => setEditingLead(l => l && ({ ...l, whatsapp: e.target.value }))} />
                    <Input placeholder="Cidade" value={editingLead.cidade || ''} onChange={e => setEditingLead(l => l && ({ ...l, cidade: e.target.value }))} />
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">Status</label>
                      <Select
                        value={String(editingLead.status ?? 0)}
                        onValueChange={v => setEditingLead(l => l && ({ ...l, status: parseInt(v) }))}
                      >
                        <SelectTrigger className="bg-white border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_LABELS.map((label, i) => (
                            <SelectItem key={i} value={String(i)}>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${STATUS_BADGE[i].dot}`} />
                                {label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleEditLead} className="flex-1">Salvar</Button>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1">Cancelar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Nome', 'WhatsApp', 'Cidade', 'Status', 'Entrada', 'Ações'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                    Nenhum lead encontrado
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead, index) => {
                  const s = lead.status ?? 0;
                  const badge = STATUS_BADGE[s] ?? STATUS_BADGE[0];
                  return (
                    <tr
                      key={lead.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors cursor-pointer`}
                      onClick={() => setViewingLead(lead)}
                    >
                      {/* Nome + avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#4b5563] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {getInitials(lead.nome)}
                          </div>
                          <p className="font-medium text-gray-900 truncate max-w-[160px]">{lead.nome || '—'}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-gray-500">{lead.whatsapp || '—'}</td>
                      <td className="px-6 py-4 text-gray-500">{lead.cidade || '—'}</td>

                      {/* Status badge */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {STATUS_LABELS[s]}
                        </span>
                      </td>

                      {/* Data/hora de entrada — do created_at */}
                      <td className="px-6 py-4 text-gray-500 text-sm whitespace-nowrap">
                        {formatEntryTime(lead.created_at)}
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <a
                            href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg bg-green-50 inline-flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => { setEditingLead(lead); setIsEditOpen(true); }}
                            className="w-8 h-8 rounded-lg bg-blue-50 inline-flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {(currentPage - 1) * leadsPerPage + 1}–{Math.min(currentPage * leadsPerPage, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Anterior
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let n: number;
                  if (totalPages <= 5)           n = i + 1;
                  else if (currentPage <= 3)     n = i + 1;
                  else if (currentPage >= totalPages - 2) n = totalPages - 4 + i;
                  else                           n = currentPage - 2 + i;
                  return (
                    <Button key={n} variant={currentPage === n ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(n)} className="w-8 h-8 p-0">
                      {n}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lead drawer */}
      <LeadDrawer
        lead={viewingLead}
        isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onUpdate={updated => {
          updateLead(updated.id, updated);
          setTableLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
          setViewingLead(updated);
        }}
      />
    </AppLayout>
  );
}
