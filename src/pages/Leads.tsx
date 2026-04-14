// Cole este conteúdo em src/pages/Leads.tsx
// Adiciona suporte mobile: tabela vira cards empilhados em telas < 768px

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Search, MessageCircle, Plus, Download, RefreshCw,
  Edit, Loader2, ChevronDown, Check, X, Trash2, Filter,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

const STATUS_BADGE = [
  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  { bg: 'bg-blue-100',    text: 'text-blue-700',     dot: 'bg-blue-500'    },
  { bg: 'bg-purple-100',  text: 'text-purple-700',   dot: 'bg-purple-500'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700',  dot: 'bg-emerald-500' },
];

const PERIOD_OPTIONS = [
  { label: 'Todos',         value: 'all'       },
  { label: 'Hoje',          value: 'today'     },
  { label: 'Ontem',         value: 'yesterday' },
  { label: '7 dias',        value: '7days'     },
  { label: '30 dias',       value: '30days'    },
  { label: 'Este mês',      value: 'month'     },
  { label: 'Personalizado', value: 'custom'    },
];

const STATUS_OPTIONS = [
  { label: 'Todos os status', value: 'all' },
  ...STATUS_LABELS.map((l, i) => ({ label: l, value: String(i) })),
];

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseLeadDate(str?: string | null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) return new Date(str);
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (match) {
    const [, d, m, y, h = '0', min = '0'] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }
  return new Date(str);
}

function formatEntrada(str?: string | null): string {
  if (!str) return '—';
  const d = parseLeadDate(str);
  if (d.getTime() === 0) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function isoToBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizeCity(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let city = raw.trim();
  const ufMatch = city.match(/[\s\/\-,]+([A-Za-z]{2})\s*$/);
  let uf = '';
  if (ufMatch) {
    const candidate = ufMatch[1].toUpperCase();
    const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    if (UFS.includes(candidate)) { uf = candidate; city = city.slice(0, city.length - ufMatch[0].length).trim(); }
  }
  const lower = new Set(['de','do','da','dos','das','e','em','com','no','na','nos','nas']);
  city = city.toLowerCase().replace(/[_\-\/]+/g,' ').replace(/\s+/g,' ').trim().split(' ').map((w,i)=>{if(!w)return'';if(i>0&&lower.has(w))return w;return w.charAt(0).toUpperCase()+w.slice(1);}).join(' ');
  return uf ? `${city} - ${uf}` : city;
}

function filterByPeriod(leads: Lead[], period: string, customFrom?: string, customTo?: string): Lead[] {
  if (period === 'all') return leads;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (period) {
    case 'today':    return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= todayStart && d <= todayEnd; });
    case 'yesterday':{const ys=new Date(todayStart);ys.setDate(ys.getDate()-1);const ye=new Date(todayEnd);ye.setDate(ye.getDate()-1);return leads.filter(l=>{const d=parseLeadDate(l.created_at);return d>=ys&&d<=ye;});}
    case '7days':    {const a=new Date(todayStart);a.setDate(a.getDate()-6);return leads.filter(l=>{const d=parseLeadDate(l.created_at);return d>=a&&d<=todayEnd;});}
    case '30days':   {const a=new Date(todayStart);a.setDate(a.getDate()-29);return leads.filter(l=>{const d=parseLeadDate(l.created_at);return d>=a&&d<=todayEnd;});}
    case 'month':    {const f=new Date(now.getFullYear(),now.getMonth(),1,0,0,0,0);return leads.filter(l=>{const d=parseLeadDate(l.created_at);return d>=f&&d<=todayEnd;});}
    case 'custom':   {if(!customFrom||!customTo)return leads;const[fy,fm,fd]=customFrom.split('-').map(Number);const[ty,tm,td]=customTo.split('-').map(Number);if(!fy||!ty)return leads;const f=new Date(fy,fm-1,fd,0,0,0,0);const t=new Date(ty,tm-1,td,23,59,59,999);return leads.filter(l=>{const d=parseLeadDate(l.created_at);return d>=f&&d<=t;});}
    default: return leads;
  }
}

function toStatusNum(s: any): number {
  if (s === null || s === undefined || s === '') return 0;
  const n = Number(s); return isNaN(n) ? 0 : n;
}

function FilterDropdown({ value, options, onChange, dark }: { value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; dark: boolean; }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#ffffff', color: dark ? '#d4d4d8' : '#374151', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {selected?.label}<ChevronDown style={{ width: '13px', height: '13px', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
      </button>
      {open && (<>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: dark ? '#111113' : '#ffffff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '10px', padding: '4px', minWidth: '150px', zIndex: 50, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)' }}>
          {options.map(o => (<button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '7px', border: 'none', background: value === o.value ? (dark ? 'rgba(255,255,255,0.07)' : '#eff6ff') : 'transparent', color: value === o.value ? (dark ? '#fff' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'), fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            {value === o.value ? <Check style={{ width: '12px', height: '12px', flexShrink: 0 }} /> : <span style={{ width: '12px', flexShrink: 0 }} />}{o.label}
          </button>))}
        </div>
      </>)}
    </div>
  );
}

function PhoneInput({ value, onChange, style: st }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return <input type="tel" value={value} placeholder="(XX) XXXXX-XXXX" onChange={e => onChange(maskPhone(e.target.value))} style={st} />;
}

function DeleteConfirmDialog({ count, onConfirm, onCancel, loading, dark }: { count: number; onConfirm: () => void; onCancel: () => void; loading: boolean; dark: boolean; }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '360px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 style={{ width: '18px', height: '18px', color: '#dc2626' }} /></div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dark ? '#fff' : '#111827' }}>Excluir {count > 1 ? `${count} leads` : 'lead'}?</h3>
        </div>
        <p style={{ fontSize: '13px', color: dark ? '#9ca3af' : '#6b7280', margin: '0 0 20px' }}>Esta ação não pode ser desfeita.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Excluindo…' : 'Sim, excluir'}</button>
        </div>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { updateLead } = useAppStore();
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';
  const [isMobile, setIsMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 20;
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ nome: '', whatsapp: '', cidade: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConf, setShowDeleteConf] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) toast.error(`Erro: ${error.message}`);
    else if (data) setAllLeads(data as unknown as Lead[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    const ch = supabase.channel('leads-rt2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, p => {
        const novo = p.new as Lead;
        setAllLeads(prev => [novo, ...prev]);
        toast.success(`Novo lead: ${novo.nome || 'Sem nome'}`, { duration: 3000, position: 'bottom-left' });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, p => { setAllLeads(prev => prev.map(l => l.id === (p.new as Lead).id ? p.new as Lead : l)); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, p => { setAllLeads(prev => prev.filter(l => l.id !== (p.old as { id: string }).id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let r = [...allLeads].sort((a, b) => parseLeadDate(b.created_at).getTime() - parseLeadDate(a.created_at).getTime());
    r = filterByPeriod(r, periodFilter, customFrom, customTo);
    if (statusFilter !== 'all') r = r.filter(l => toStatusNum(l.status) === parseInt(statusFilter));
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(l => l.nome?.toLowerCase().includes(q) || l.whatsapp?.includes(search) || l.cidade?.toLowerCase().includes(q)); }
    return r;
  }, [allLeads, periodFilter, statusFilter, search, customFrom, customTo]);

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [periodFilter, statusFilter, search]);
  const totalPages = Math.ceil(filtered.length / leadsPerPage);
  const paginatedLeads = useMemo(() => filtered.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage), [filtered, currentPage]);

  const handleAddLead = async () => {
    if (!newLead.nome.trim() || !newLead.whatsapp.trim()) { toast.error('Nome e WhatsApp são obrigatórios'); return; }
    const cidadeNorm = normalizeCity(newLead.cidade);
    const phoneClean = newLead.whatsapp.replace(/\D/g, '');
    const existing = allLeads.find(l => l.whatsapp?.replace(/\D/g,'') === phoneClean);
    if (existing) {
      const { error } = await supabase.from('leads').update({ nome: newLead.nome.trim(), cidade: cidadeNorm }).eq('id', existing.id);
      if (error) { toast.error(`Erro: ${error.message}`); return; }
      setAllLeads(prev => prev.map(l => l.id === existing.id ? { ...l, nome: newLead.nome.trim(), cidade: cidadeNorm } : l));
      setNewLead({ nome: '', whatsapp: '', cidade: '' }); setIsAddOpen(false);
      toast.success('Lead duplicado atualizado!'); return;
    }
    const { data, error } = await supabase.from('leads').insert({ nome: newLead.nome.trim(), whatsapp: newLead.whatsapp, cidade: cidadeNorm, status: 0, created_at: new Date().toISOString() }).select('*').single();
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    if (data) setAllLeads(prev => [data as unknown as Lead, ...prev]);
    setNewLead({ nome: '', whatsapp: '', cidade: '' }); setIsAddOpen(false);
    toast.success('Lead adicionado!');
  };

  const handleEditLead = async () => {
    if (!editingLead) return;
    const cidadeNorm = normalizeCity(editingLead.cidade || '');
    const updates = { nome: editingLead.nome, whatsapp: editingLead.whatsapp, cidade: cidadeNorm, status: editingLead.status ?? 0 };
    const { error } = await supabase.from('leads').update(updates).eq('id', editingLead.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    setAllLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...updates } : l));
    updateLead(editingLead.id, updates); setIsEditOpen(false); setEditingLead(null);
    toast.success('Lead atualizado!');
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('leads').delete().in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Erro ao excluir'); return; }
    setAllLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set()); setShowDeleteConf(false);
    toast.success(`${ids.length} lead(s) excluído(s)!`);
  };

  const exportCSV = () => {
    const toExport = selectedIds.size > 0 ? allLeads.filter(l => selectedIds.has(l.id)) : filtered;
    if (!toExport.length) { toast.error('Nenhum lead para exportar'); return; }
    const allKeys = Array.from(new Set(toExport.flatMap(l => Object.keys(l as object))));
    const rows = toExport.map(l => allKeys.map(k => { const v=(l as any)[k]; if(v===null||v===undefined)return''; const s=String(v).replace(/"/g,'""'); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s}"`:s; }).join(',')).join('\n');
    const blob = new Blob([allKeys.join(',') + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const divider = dark ? 'border-[#1e1e22]' : 'border-gray-100';
  const bold = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';
  const theadBg = dark ? 'bg-[#18181b]' : 'bg-gray-50';
  const hov = dark ? 'hover:bg-[#1a1a1e]' : 'hover:bg-blue-50/50';
  const card = dark ? 'bg-[#111113] border-[#1e1e22]' : 'bg-white border-gray-100';

  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#f4f4f5' : '#111827', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' };
  const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#ffffff', color: dark ? '#a1a1aa' : '#374151', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <AppLayout leadCount={allLeads.length}>
      <div style={{ padding: isMobile ? '12px' : '28px', background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
          <div>
            <h1 className={`text-xl font-bold ${bold}`}>Leads <span className={`font-normal text-base ${muted}`}>({filtered.length})</span></h1>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isMobile ? (
              <>
                <button onClick={() => setShowFilters(v => !v)} style={{ ...btnGhost, gap: '4px' }}>
                  <Filter style={{ width: '14px', height: '14px' }} /> Filtros
                </button>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                      <Plus style={{ width: '14px', height: '14px' }} /> Add
                    </button>
                  </DialogTrigger>
                  <DialogContent style={{ background: dark ? '#111113' : '#fff', border: `1px solid ${border}`, borderRadius: '16px' }}>
                    <DialogHeader><DialogTitle style={{ color: dark ? '#fff' : '#111827' }}>Adicionar Lead</DialogTitle></DialogHeader>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                      <input placeholder="Nome completo" value={newLead.nome} onChange={e => setNewLead(n => ({ ...n, nome: e.target.value }))} style={inputStyle} />
                      <PhoneInput value={newLead.whatsapp} onChange={v => setNewLead(n => ({ ...n, whatsapp: v }))} style={inputStyle} />
                      <input placeholder="Cidade (ex: Valinhos/SP)" value={newLead.cidade} onChange={e => setNewLead(n => ({ ...n, cidade: e.target.value }))} style={inputStyle} />
                      <button onClick={handleAddLead} style={{ padding: '10px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Salvar</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: dark ? '#71717a' : '#9ca3af' }} />
                  <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#fff', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', outline: 'none', width: '180px', fontFamily: 'inherit' }} />
                </div>
                <FilterDropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} dark={dark} />
                <div style={{ position: 'relative' }}>
                  <FilterDropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={v => { if (v === 'custom') setShowCustom(true); else { setPeriodFilter(v); setShowCustom(false); setCustomFrom(''); setCustomTo(''); } }} dark={dark} />
                  {showCustom && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: dark ? '#111113' : '#fff', border: `1px solid ${border}`, borderRadius: '12px', padding: '16px', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: dark ? '#a1a1aa' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período personalizado</span>
                        <button onClick={() => setShowCustom(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, display: 'flex' }}><X style={{ width: '14px', height: '14px' }} /></button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[{ label: 'Data inicial', val: customFrom, set: setCustomFrom }, { label: 'Data final', val: customTo, set: setCustomTo }].map(({ label, val, set }) => (
                          <div key={label}>
                            <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px' }}>{label}</label>
                            <div style={{ position: 'relative' }}>
                              <input type="date" value={val} onChange={e => { set(e.target.value); if (label === 'Data final' && customFrom && e.target.value) { setPeriodFilter('custom'); setShowCustom(false); } }} style={{ ...inputStyle, color: 'transparent', cursor: 'pointer' }} />
                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: val ? txtHi : txtMid, pointerEvents: 'none' }}>{val ? isoToBR(val) : 'dd/mm/aaaa'}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button onClick={() => { if (customFrom && customTo) { setPeriodFilter('custom'); setShowCustom(false); } }} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Aplicar</button>
                          <button onClick={() => { setCustomFrom(''); setCustomTo(''); setPeriodFilter('all'); setShowCustom(false); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer' }}>Limpar</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={fetchLeads} style={btnGhost}><RefreshCw style={{ width: '13px', height: '13px' }} /></button>
                <button onClick={exportCSV} style={btnGhost}><Download style={{ width: '13px', height: '13px' }} /></button>
                <button onClick={() => selectedIds.size > 0 ? setShowDeleteConf(true) : undefined} style={{ ...btnGhost, border: `1px solid ${selectedIds.size > 0 ? '#fecaca' : dark ? '#1e1e22' : '#e5e7eb'}`, background: selectedIds.size > 0 ? '#fff1f2' : (dark ? '#111113' : '#fff'), color: selectedIds.size > 0 ? '#dc2626' : (dark ? '#3f3f46' : '#d1d5db'), cursor: selectedIds.size > 0 ? 'pointer' : 'default' }}>
                  <Trash2 style={{ width: '13px', height: '13px' }} />{selectedIds.size > 0 && `(${selectedIds.size})`}
                </button>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}><Plus style={{ width: '14px', height: '14px' }} /> Adicionar</button>
                  </DialogTrigger>
                  <DialogContent style={{ background: dark ? '#111113' : '#fff', border: `1px solid ${border}`, borderRadius: '16px' }}>
                    <DialogHeader><DialogTitle style={{ color: dark ? '#fff' : '#111827' }}>Adicionar Lead</DialogTitle></DialogHeader>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                      <input placeholder="Nome completo" value={newLead.nome} onChange={e => setNewLead(n => ({ ...n, nome: e.target.value }))} style={inputStyle} />
                      <PhoneInput value={newLead.whatsapp} onChange={v => setNewLead(n => ({ ...n, whatsapp: v }))} style={inputStyle} />
                      <input placeholder="Cidade (ex: Valinhos/SP)" value={newLead.cidade} onChange={e => setNewLead(n => ({ ...n, cidade: e.target.value }))} style={inputStyle} />
                      <button onClick={handleAddLead} style={{ padding: '10px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Salvar</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* Mobile search + filters */}
        {isMobile && (
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: dark ? '#71717a' : '#9ca3af' }} />
              <input placeholder="Buscar leads..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '10px', paddingBottom: '10px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: txtHi, fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {showFilters && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '10px', background: cardBg, borderRadius: '10px', border: `1px solid ${border}` }}>
                <FilterDropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} dark={dark} />
                <FilterDropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={v => { if (v === 'custom') setShowCustom(true); else { setPeriodFilter(v); setShowCustom(false); } }} dark={dark} />
                <button onClick={fetchLeads} style={btnGhost}><RefreshCw style={{ width: '13px', height: '13px' }} /></button>
                <button onClick={exportCSV} style={btnGhost}><Download style={{ width: '13px', height: '13px' }} /></button>
                {selectedIds.size > 0 && (
                  <button onClick={() => setShowDeleteConf(true)} style={{ ...btnGhost, border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626' }}>
                    <Trash2 style={{ width: '13px', height: '13px' }} /> ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile: cards */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} style={{ height: '88px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)
            ) : paginatedLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: txtMid, fontSize: '13px' }}>Nenhum lead encontrado</div>
            ) : paginatedLeads.map(lead => {
              const s = toStatusNum(lead.status);
              const badge = STATUS_BADGE[s] ?? STATUS_BADGE[0];
              const sel = selectedIds.has(lead.id);
              return (
                <div key={lead.id}
                  onClick={() => setViewingLead(lead)}
                  style={{
                    background: cardBg, borderRadius: '12px', padding: '12px 14px',
                    border: `1px solid ${sel ? '#2563eb' : border}`,
                    boxShadow: sel ? '0 0 0 2px rgba(37,99,235,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={sel} onChange={e => { e.stopPropagation(); const n = new Set(selectedIds); e.target.checked ? n.add(lead.id) : n.delete(lead.id); setSelectedIds(n); }} onClick={e => e.stopPropagation()} style={{ width: '15px', height: '15px', accentColor: '#2563eb', flexShrink: 0 }} />
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{getInitials(lead.nome)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.nome || '—'}</p>
                      <p style={{ fontSize: '12px', color: txtMid, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.cidade ? normalizeCity(lead.cidade) : ''}{lead.cidade && lead.whatsapp ? ' · ' : ''}{lead.whatsapp || ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />{STATUS_LABELS[s]}
                      </span>
                      <span style={{ fontSize: '11px', color: txtMid }}>{formatEntrada(lead.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                    <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', background: dark ? 'rgba(16,185,129,0.12)' : '#f0fdf4', color: dark ? '#34d399' : '#16a34a', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textDecoration: 'none' }}>
                      <MessageCircle style={{ width: '13px', height: '13px' }} /> WhatsApp
                    </a>
                    <button onClick={() => { setEditingLead(lead); setIsEditOpen(true); }}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', background: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Edit style={{ width: '13px', height: '13px' }} /> Editar
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination mobile */}
            {!isLoading && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px 0' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}>Anterior</button>
                <span style={{ padding: '8px 12px', fontSize: '13px', color: txtMid }}>{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}>Próximo</button>
              </div>
            )}
          </div>
        ) : (
          /* Desktop: tabela original */
          <div className={`rounded-2xl border overflow-hidden ${card}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${divider} ${theadBg}`}>
                  <th className="pl-5 pr-2 py-3 w-8">
                    <input type="checkbox" checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id))} onChange={e => { const n = new Set(selectedIds); paginatedLeads.forEach(l => e.target.checked ? n.add(l.id) : n.delete(l.id)); setSelectedIds(n); }} style={{ width: '15px', height: '15px', accentColor: '#2563eb' }} />
                  </th>
                  {['Nome','WhatsApp','Cidade','Status','Entrada','Ações'].map(h => (
                    <th key={h} className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider ${muted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 className={`w-6 h-6 animate-spin mx-auto ${muted}`} /></td></tr>
                ) : paginatedLeads.length === 0 ? (
                  <tr><td colSpan={7} className={`px-6 py-12 text-center text-sm ${muted}`}>Nenhum lead encontrado</td></tr>
                ) : paginatedLeads.map((lead, idx) => {
                  const s = toStatusNum(lead.status);
                  const badge = STATUS_BADGE[s] ?? STATUS_BADGE[0];
                  const sel = selectedIds.has(lead.id);
                  const obs = (lead as any).observacoes as string | null | undefined;
                  return (
                    <tr key={lead.id}
                      className={`${sel ? (dark ? 'bg-blue-950/30' : 'bg-blue-50/60') : idx % 2 === 0 ? '' : dark ? 'bg-[#0f0f11]' : 'bg-gray-50/50'} ${hov} transition-colors cursor-pointer border-b ${divider} last:border-0`}
                      onClick={() => setViewingLead(lead)}
                    >
                      <td className="pl-5 pr-2 py-4 w-8" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(lead.id) : n.delete(lead.id); setSelectedIds(n); }} onClick={e => e.stopPropagation()} style={{ width: '15px', height: '15px', accentColor: '#2563eb' }} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#4b5563] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{getInitials(lead.nome)}</div>
                          <p className={`font-medium truncate max-w-[140px] ${bold}`}>{lead.nome || '—'}</p>
                          {obs && obs.trim() && (
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={dark?'#9ca3af':'#6b7280'} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-4 ${muted}`}>{lead.whatsapp || '—'}</td>
                      <td className={`px-4 py-4 ${muted}`}>{lead.cidade ? normalizeCity(lead.cidade) : '—'}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />{STATUS_LABELS[s]}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-sm whitespace-nowrap ${muted}`}>{formatEntrada(lead.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-green-50 inline-flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"><MessageCircle className="w-4 h-4"/></a>
                          <button onClick={() => { setEditingLead(lead); setIsEditOpen(true); }} className="w-8 h-8 rounded-lg bg-blue-50 inline-flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors"><Edit className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!isLoading && totalPages > 1 && (
              <div className={`px-6 py-4 border-t ${divider} flex items-center justify-between`}>
                <p className={`text-sm ${muted}`}>Mostrando {(currentPage-1)*leadsPerPage+1}–{Math.min(currentPage*leadsPerPage,filtered.length)} de {filtered.length}</p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: currentPage===1?'default':'pointer', opacity: currentPage===1?0.4:1 }}>Anterior</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: currentPage===totalPages?'default':'pointer', opacity: currentPage===totalPages?0.4:1 }}>Próximo</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConf && <DeleteConfirmDialog count={selectedIds.size} onConfirm={handleDeleteSelected} onCancel={() => setShowDeleteConf(false)} loading={deleting} dark={dark} />}

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={open => { setIsEditOpen(open); if (!open) setEditingLead(null); }}>
        <DialogContent style={{ background: dark ? '#111113' : '#fff', border: `1px solid ${border}`, borderRadius: '16px' }}>
          <DialogHeader><DialogTitle style={{ color: dark ? '#fff' : '#111827' }}>Editar Lead</DialogTitle></DialogHeader>
          {editingLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <input placeholder="Nome" value={editingLead.nome||''} onChange={e => setEditingLead(l => l&&({...l,nome:e.target.value}))} style={inputStyle} />
              <PhoneInput value={editingLead.whatsapp||''} onChange={v => setEditingLead(l => l&&({...l,whatsapp:v}))} style={inputStyle} />
              <input placeholder="Cidade" value={editingLead.cidade||''} onChange={e => setEditingLead(l => l&&({...l,cidade:e.target.value}))} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={handleEditLead} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Salvar</button>
                <button onClick={() => setIsEditOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LeadDrawer lead={viewingLead} isOpen={!!viewingLead} onClose={() => setViewingLead(null)} onUpdate={updated => { updateLead(updated.id, updated); setAllLeads(prev => prev.map(l => l.id === updated.id ? updated : l)); setViewingLead(updated); }} />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </AppLayout>
  );
}
