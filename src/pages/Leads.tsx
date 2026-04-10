import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Search, MessageCircle, Plus, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function LeadsPage() {
  const { leads, setLeads, addLead, updateLead } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLead, setNewLead] = useState({ nome: '', whatsapp: '', cidade: '' });

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (data) setLeads(data as unknown as Lead[]);
    };
    fetchLeads();
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !search ||
        l.nome.toLowerCase().includes(search.toLowerCase()) ||
        l.whatsapp?.includes(search) ||
        l.cidade?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || l.status === parseInt(statusFilter);
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

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

  const exportCSV = () => {
    const headers = 'Nome,WhatsApp,Cidade,Status,Entrada\n';
    const rows = filtered.map((l) => `${l.nome},${l.whatsapp},${l.cidade},${STATUS_LABELS[l.status]},${l.entrada}`).join('\n');
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
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">WhatsApp</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cidade</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Entrada</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{lead.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.whatsapp}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.cidade}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status].bg} ${STATUS_COLORS[lead.status].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[lead.status].dot}`} />
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{lead.entrada}</td>
                  <td className="px-4 py-3">
                    <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-success/10 inline-flex items-center justify-center text-success hover:bg-success/20 transition">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Nenhum lead encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
