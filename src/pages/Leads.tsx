import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Search, MessageCircle, Plus, Download, RefreshCw,
  Edit, Loader2, ChevronDown, Check, X, Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

// ── Helpers ───────────────────────────────────────────────────

const STATUS_BADGE = [
  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
];

const PERIOD_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: '7days' },
  { label: '30 dias', value: '30days' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' },
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

// Formata data + hora de entrada
function formatEntrada(str?: string | null): string {
  if (!str) return '—';
  const d = parseLeadDate(str);
  if (d.getTime() === 0) return '—';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

// Converte YYYY-MM-DD → dd/mm/yyyy
function isoToBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Máscara WhatsApp: (XX) XXXXX-XXXX
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Normaliza cidade: capitaliza corretamente e detecta UF
function normalizeCity(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let city = raw.trim();

  // Detecta UF no final: /SP, -SP, , SP, SP (2 letras maiúsculas/minúsculas)
  // Aceita: "ValINHs/sp", "campinas-SP", "vinhedo sp", "jundiai,sp"
  const ufMatch = city.match(/[\s\/\-,]+([A-Za-z]{2})\s*$/);
  let uf = '';
  if (ufMatch && ufMatch[1]) {
    const candidate = ufMatch[1].toUpperCase();
    // Lista de UFs válidas para confirmar que é UF e não parte do nome
    const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
    if (UFS.includes(candidate)) {
      uf = candidate;
      city = city.slice(0, city.length - ufMatch[0].length).trim();
    }
  }

  // Artigos/preposições que ficam em minúsculo (exceto no início)
  const lower = new Set(['de','do','da','dos','das','e','em','com','no','na','nos','nas']);

  // Capitaliza cada palavra
  city = city
    .toLowerCase()
    .replace(/[_\-\/]+/g, ' ')   // troca separadores por espaço
    .replace(/\s+/g, ' ')          // colapsa espaços
    .trim()
    .split(' ')
    .map((word, i) => {
      if (!word) return '';
      if (i > 0 && lower.has(word)) return word;  // artigos no meio ficam minúsculos
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  if (uf) return `${city} - ${uf}`;
  return city;
}

function filterByPeriod(leads: Lead[], period: string, customFrom?: string, customTo?: string): Lead[] {
  if (period === 'all') return leads;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (period) {
    case 'today':
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= todayStart && d <= todayEnd; });
    case 'yesterday': {
      const ys = new Date(todayStart); ys.setDate(ys.getDate() - 1);
      const ye = new Date(todayEnd); ye.setDate(ye.getDate() - 1);
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= ys && d <= ye; });
    }
    case '7days': {
      const a = new Date(todayStart); a.setDate(a.getDate() - 6);
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= a && d <= todayEnd; });
    }
    case '30days': {
      const a = new Date(todayStart); a.setDate(a.getDate() - 29);
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= a && d <= todayEnd; });
    }
    case 'month': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= f && d <= todayEnd; });
    }
    case 'custom': {
      if (!customFrom || !customTo) return leads;
      // Usa Date local explícito para evitar problema de timezone com strings ISO
      const [fy, fm, fd] = customFrom.split('-').map(Number);
      const [ty, tm, td] = customTo.split('-').map(Number);
      if (!fy || !ty) return leads;
      const f = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
      const t = new Date(ty, tm - 1, td, 23, 59, 59, 999);
      return leads.filter(l => { const d = parseLeadDate(l.created_at); return d >= f && d <= t; });
    }
    default: return leads;
  }
}

function toStatusNum(s: any): number {
  if (s === null || s === undefined || s === '') return 0;
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// ── FilterDropdown ────────────────────────────────────────────

function FilterDropdown({ value, options, onChange, dark }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '9px',
        border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
        background: dark ? '#111113' : '#ffffff', color: dark ? '#d4d4d8' : '#374151',
        fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        {selected?.label}
        <ChevronDown style={{ width: '14px', height: '14px', color: dark ? '#71717a' : '#9ca3af', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            background: dark ? '#111113' : '#ffffff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
            borderRadius: '10px', padding: '4px', minWidth: '160px', zIndex: 50,
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)',
          }}>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 10px', borderRadius: '7px', border: 'none',
                background: value === o.value ? (dark ? 'rgba(255,255,255,0.07)' : '#eff6ff') : 'transparent',
                color: value === o.value ? (dark ? '#fff' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'),
                fontSize: '13px', fontWeight: value === o.value ? 500 : 400,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                {value === o.value ? <Check style={{ width: '13px', height: '13px', flexShrink: 0 }} /> : <span style={{ width: '13px', flexShrink: 0 }} />}
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Checkbox ──────────────────────────────────────────────────

function Checkbox({ checked, indeterminate = false, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
      onClick={e => e.stopPropagation()}
      style={{ width: '15px', height: '15px', borderRadius: '4px', cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0 }}
    />
  );
}

// ── ObsTooltip ────────────────────────────────────────────────

function ObsTooltip({ text, dark }: { text: string; dark: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={dark ? '#9ca3af' : '#6b7280'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      {show && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#f9fafb', fontSize: '12px', lineHeight: 1.5, padding: '8px 12px', borderRadius: '9px', maxWidth: '220px', minWidth: '100px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
          {text}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1f2937' }} />
        </div>
      )}
    </div>
  );
}

// ── DeleteConfirmDialog ───────────────────────────────────────

function DeleteConfirmDialog({ count, onConfirm, onCancel, loading, dark }: {
  count: number; onConfirm: () => void; onCancel: () => void; loading: boolean; dark: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 style={{ width: '18px', height: '18px', color: '#dc2626' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dark ? '#fff' : '#111827' }}>
            Excluir {count > 1 ? `${count} leads` : 'lead'}?
          </h3>
        </div>
        <p style={{ fontSize: '13.5px', color: dark ? '#9ca3af' : '#6b7280', margin: '0 0 20px', lineHeight: 1.55 }}>Esta ação não pode ser desfeita.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Excluindo…' : 'Sim, excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PhoneInput ────────────────────────────────────────────────

function PhoneInput({ value, onChange, style: st }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return (
    <input
      type="tel"
      value={value}
      placeholder="(XX) XXXXX-XXXX"
      onChange={e => onChange(maskPhone(e.target.value))}
      style={st}
    />
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function LeadsPage() {
  const { updateLead } = useAppStore();
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';

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

  // ── Fetch ──────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) toast.error(`Erro ao carregar leads: ${error.message}`);
    else if (data) setAllLeads(data as unknown as Lead[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Realtime ───────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('leads-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, p => {
        const novo = p.new as Lead;
        setAllLeads(prev => {
          // Se já existe lead com mesmo whatsapp, substitui pelo mais recente
          const existing = prev.findIndex(l => l.whatsapp && l.whatsapp.replace(/\D/g, '') === (novo.whatsapp || '').replace(/\D/g, '') && l.nome?.toLowerCase() === novo.nome?.toLowerCase());
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = novo;
            return updated;
          }
          return [novo, ...prev];
        });
        toast.success(`Novo lead: ${novo.nome || 'Sem nome'}`, {
          description: novo.cidade ? `Cidade: ${novo.cidade}` : 'Origem: Direct',
          duration: 5000,
          position: 'bottom-left',
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, p => {
        setAllLeads(prev => prev.map(l => l.id === (p.new as Lead).id ? p.new as Lead : l));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, p => {
        setAllLeads(prev => prev.filter(l => l.id !== (p.old as { id: string }).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Filters ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...allLeads].sort((a, b) => parseLeadDate(b.created_at).getTime() - parseLeadDate(a.created_at).getTime());
    r = filterByPeriod(r, periodFilter, customFrom, customTo);
    if (statusFilter !== 'all') r = r.filter(l => toStatusNum(l.status) === parseInt(statusFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(l => l.nome?.toLowerCase().includes(q) || l.whatsapp?.includes(search) || l.cidade?.toLowerCase().includes(q));
    }
    return r;
  }, [allLeads, periodFilter, statusFilter, search, customFrom, customTo]);

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [periodFilter, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / leadsPerPage);
  const paginatedLeads = useMemo(() => filtered.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage), [filtered, currentPage]);

  // ── Selection ──────────────────────────────────────────────
  const allPageSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id));
  const somePageSelected = paginatedLeads.some(l => selectedIds.has(l.id)) && !allPageSelected;

  function toggleAll(checked: boolean) {
    setSelectedIds(prev => { const n = new Set(prev); paginatedLeads.forEach(l => checked ? n.add(l.id) : n.delete(l.id)); return n; });
  }
  function toggleOne(id: string, checked: boolean) {
    setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  }

  // ── CRUD ───────────────────────────────────────────────────
  const handleAddLead = async () => {
    if (!newLead.nome.trim() || !newLead.whatsapp.trim()) {
      toast.error('Nome e WhatsApp são obrigatórios');
      return;
    }
    const cidadeNorm = normalizeCity(newLead.cidade);
    const userId = user?.id;
    const now = new Date().toISOString();

    // Verifica duplicata por whatsapp
    const phoneClean = newLead.whatsapp.replace(/\D/g, '');
    const existing = allLeads.find(l => l.whatsapp?.replace(/\D/g, '') === phoneClean);
    if (existing) {
      const { error } = await supabase.from('leads')
        .update({ nome: newLead.nome.trim(), cidade: cidadeNorm, status: existing.status ?? 0 })
        .eq('id', existing.id);
      if (error) { toast.error(`Erro ao atualizar lead duplicado: ${error.message}`); return; }
      setAllLeads(prev => prev.map(l => l.id === existing.id ? { ...l, nome: newLead.nome.trim(), cidade: cidadeNorm } : l));
      setNewLead({ nome: '', whatsapp: '', cidade: '' });
      setIsAddOpen(false);
      toast.success('Lead duplicado atualizado!');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      nome: newLead.nome.trim(),
      whatsapp: newLead.whatsapp,
      cidade: cidadeNorm,
      status: 0,
      created_at: now,
    };
    if (userId) insertPayload.user_id = userId;

    const { data, error } = await supabase
      .from('leads')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select('*')
      .single();

    if (error) {
      console.error('[AddLead] erro Supabase:', error);
      if (error.code === '23505') {
        toast.error('Lead já existe com esse WhatsApp');
      } else if (error.code === '42501' || error.message?.includes('policy')) {
        toast.error('Sem permissão para criar leads. Faça login novamente.');
      } else {
        toast.error(`Erro ao adicionar lead: ${error.message}`);
      }
      return;
    }
    if (data) setAllLeads(prev => [data as unknown as Lead, ...prev]);
    setNewLead({ nome: '', whatsapp: '', cidade: '' });
    setIsAddOpen(false);
    toast.success('Lead adicionado!');
  };

  const handleEditLead = async () => {
    if (!editingLead) return;
    const cidadeNorm = normalizeCity(editingLead.cidade || '');
    const updates = {
      nome: editingLead.nome,
      whatsapp: editingLead.whatsapp,
      cidade: cidadeNorm,
      status: editingLead.status ?? 0,
    };
    const { error } = await supabase.from('leads').update(updates).eq('id', editingLead.id);
    if (error) { toast.error(`Erro ao atualizar lead: ${error.message}`); return; }
    setAllLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...updates } : l));
    updateLead(editingLead.id, updates);
    setIsEditOpen(false); setEditingLead(null);
    toast.success('Lead atualizado!');
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('leads').delete().in('id', ids);
    setDeleting(false);
    if (error) { toast.error('Erro ao excluir leads'); return; }
    setAllLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set()); setShowDeleteConf(false);
    toast.success(`${ids.length} lead${ids.length > 1 ? 's' : ''} excluído${ids.length > 1 ? 's' : ''}!`);
  };

  const exportCSV = () => {
    const toExport = selectedIds.size > 0 ? allLeads.filter(l => selectedIds.has(l.id)) : filtered;
    if (!toExport.length) { toast.error('Nenhum lead para exportar'); return; }
    const allKeys = Array.from(new Set(toExport.flatMap(l => Object.keys(l as object))));
    const header = allKeys.join(',');
    const rows = toExport.map(l => allKeys.map(k => {
      const v = (l as any)[k]; if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  // ── Styles ─────────────────────────────────────────────────
  const card = dark ? 'bg-[#111113] border-[#1e1e22]' : 'bg-white border-gray-100';
  const bold = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';
  const divider = dark ? 'border-[#1e1e22]' : 'border-gray-100';
  const hov = dark ? 'hover:bg-[#1a1a1e]' : 'hover:bg-blue-50/50';
  const theadBg = dark ? 'bg-[#18181b]' : 'bg-gray-50';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '9px',
    border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
    background: dark ? '#1a1a1e' : '#f9fafb',
    color: dark ? '#f4f4f5' : '#111827',
    fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
  };

  const btnGhost: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px',
    border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
    background: dark ? '#111113' : '#ffffff', color: dark ? '#a1a1aa' : '#374151',
    fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
  };

  const pageBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '32px', height: '32px', padding: '0 8px', borderRadius: '8px',
    border: `1px solid ${active ? '#2563eb' : dark ? '#1e1e22' : '#e5e7eb'}`,
    background: active ? '#2563eb' : (dark ? '#111113' : '#fff'),
    color: disabled ? (dark ? '#3f3f46' : '#d1d5db') : active ? '#fff' : (dark ? '#a1a1aa' : '#374151'),
    fontSize: '13px', fontWeight: active ? 600 : 400, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.1s',
  });

  return (
    <AppLayout leadCount={allLeads.length}>
      <div style={{ padding: '32px', background: dark ? '#090909' : '#f4f4f5', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className={`text-2xl font-bold ${bold}`}>
              Leads <span className={`font-normal text-lg ${muted}`}>({filtered.length})</span>
            </h1>
            <p className={`text-sm mt-0.5 ${muted}`}>Gerencie todos os seus leads</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: dark ? '#71717a' : '#9ca3af' }} />
              <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#ffffff', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', outline: 'none', width: '180px', fontFamily: 'inherit' }}
              />
            </div>

            <FilterDropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} dark={dark} />

            {/* Period + custom popover */}
            <div style={{ position: 'relative' }}>
              <FilterDropdown
                value={periodFilter}
                options={PERIOD_OPTIONS}
                onChange={v => {
                  if (v === 'custom') {
                    setShowCustom(true);
                  } else {
                    setPeriodFilter(v);
                    setShowCustom(false);
                    setCustomFrom('');
                    setCustomTo('');
                  }
                }}
                dark={dark}
              />
              {showCustom && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: dark ? '#111113' : '#ffffff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', zIndex: 50, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)', minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: dark ? '#a1a1aa' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Período personalizado</span>
                    <button onClick={() => { setShowCustom(false); if (!customFrom || !customTo) { setPeriodFilter('all'); setCustomFrom(''); setCustomTo(''); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#71717a' : '#9ca3af', display: 'flex' }}><X style={{ width: '14px', height: '14px' }} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: dark ? '#71717a' : '#9ca3af', display: 'block', marginBottom: '4px' }}>Data inicial</label>
                      <div style={{ position: 'relative' }}>
                        <input type="date" value={customFrom}
                          onChange={e => {
                            const val = e.target.value;
                            setCustomFrom(val);
                            // Aplica automaticamente se ambas as datas já estão preenchidas
                            if (val && customTo) { setPeriodFilter('custom'); setShowCustom(false); }
                          }}
                          style={{ ...inputStyle, color: 'transparent', cursor: 'pointer' }}
                        />
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: customFrom ? (dark ? '#f4f4f5' : '#111827') : (dark ? '#52525b' : '#9ca3af'), pointerEvents: 'none' }}>
                          {customFrom ? isoToBR(customFrom) : 'dd/mm/aaaa'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: dark ? '#71717a' : '#9ca3af', display: 'block', marginBottom: '4px' }}>Data final</label>
                      <div style={{ position: 'relative' }}>
                        <input type="date" value={customTo}
                          onChange={e => {
                            const val = e.target.value;
                            setCustomTo(val);
                            // Aplica automaticamente assim que a data final for selecionada
                            if (customFrom && val) { setPeriodFilter('custom'); setShowCustom(false); }
                          }}
                          style={{ ...inputStyle, color: 'transparent', cursor: 'pointer' }}
                        />
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: customTo ? (dark ? '#f4f4f5' : '#111827') : (dark ? '#52525b' : '#9ca3af'), pointerEvents: 'none' }}>
                          {customTo ? isoToBR(customTo) : 'dd/mm/aaaa'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={() => { if (customFrom && customTo) { setPeriodFilter('custom'); setShowCustom(false); } }}
                        disabled={!customFrom || !customTo}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', background: customFrom && customTo ? '#2563eb' : (dark ? '#27272a' : '#e5e7eb'), border: 'none', color: customFrom && customTo ? '#fff' : (dark ? '#52525b' : '#9ca3af'), fontSize: '13px', fontWeight: 500, cursor: customFrom && customTo ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >Aplicar</button>
                      <button onClick={() => { setCustomFrom(''); setCustomTo(''); setPeriodFilter('all'); setShowCustom(false); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={fetchLeads} style={btnGhost}><RefreshCw style={{ width: '14px', height: '14px' }} /> Atualizar</button>
            <button onClick={exportCSV} style={btnGhost}><Download style={{ width: '14px', height: '14px' }} />{selectedIds.size > 0 ? `CSV (${selectedIds.size})` : 'CSV'}</button>

            <button onClick={() => selectedIds.size > 0 ? setShowDeleteConf(true) : undefined}
              style={{ ...btnGhost, border: `1px solid ${selectedIds.size > 0 ? '#fecaca' : dark ? '#1e1e22' : '#e5e7eb'}`, background: selectedIds.size > 0 ? (dark ? '#1a0a0a' : '#fff1f2') : (dark ? '#111113' : '#fff'), color: selectedIds.size > 0 ? '#dc2626' : (dark ? '#3f3f46' : '#d1d5db'), cursor: selectedIds.size > 0 ? 'pointer' : 'default' }}
              title={selectedIds.size === 0 ? 'Selecione leads para excluir' : `Excluir ${selectedIds.size} selecionado(s)`}
            >
              <Trash2 style={{ width: '14px', height: '14px' }} />
              {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>

            {/* Add dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus style={{ width: '14px', height: '14px' }} /> Adicionar
                </button>
              </DialogTrigger>
              <DialogContent style={{ background: dark ? '#111113' : '#ffffff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '16px', color: dark ? '#f4f4f5' : '#111827' }}>
                <DialogHeader><DialogTitle style={{ color: dark ? '#fff' : '#111827' }}>Adicionar Lead</DialogTitle></DialogHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <input placeholder="Nome completo" value={newLead.nome} onChange={e => setNewLead(n => ({ ...n, nome: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')} onBlur={e => (e.target.style.borderColor = dark ? '#1e1e22' : '#e5e7eb')} />
                  <PhoneInput value={newLead.whatsapp} onChange={v => setNewLead(n => ({ ...n, whatsapp: v }))} style={inputStyle} />
                  <input placeholder="Cidade (ex: Valinhos/SP)" value={newLead.cidade} onChange={e => setNewLead(n => ({ ...n, cidade: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')} onBlur={e => (e.target.style.borderColor = dark ? '#1e1e22' : '#e5e7eb')} />
                  <button onClick={handleAddLead} style={{ padding: '10px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer', marginTop: '4px' }}>Salvar</button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={isEditOpen} onOpenChange={open => { setIsEditOpen(open); if (!open) setEditingLead(null); }}>
              <DialogContent style={{ background: dark ? '#111113' : '#ffffff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '16px', color: dark ? '#f4f4f5' : '#111827' }}>
                <DialogHeader><DialogTitle style={{ color: dark ? '#fff' : '#111827' }}>Editar Lead</DialogTitle></DialogHeader>
                {editingLead && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    <input placeholder="Nome" value={editingLead.nome || ''} onChange={e => setEditingLead(l => l && ({ ...l, nome: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')} onBlur={e => (e.target.style.borderColor = dark ? '#1e1e22' : '#e5e7eb')} />
                    <PhoneInput value={editingLead.whatsapp || ''} onChange={v => setEditingLead(l => l && ({ ...l, whatsapp: v }))} style={inputStyle} />
                    <input placeholder="Cidade (ex: Valinhos/SP)" value={editingLead.cidade || ''} onChange={e => setEditingLead(l => l && ({ ...l, cidade: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')} onBlur={e => (e.target.style.borderColor = dark ? '#1e1e22' : '#e5e7eb')} />
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: dark ? '#71717a' : '#9ca3af', display: 'block', marginBottom: '6px' }}>Status</label>
                      <FilterDropdown value={String(editingLead.status ?? 0)} options={STATUS_LABELS.map((l, i) => ({ label: l, value: String(i) }))} onChange={v => setEditingLead(l => l && ({ ...l, status: parseInt(v) }))} dark={dark} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button onClick={handleEditLead} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13.5px', fontWeight: 500, cursor: 'pointer' }}>Salvar</button>
                      <button onClick={() => setIsEditOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '13.5px', cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${divider} ${theadBg}`}>
                <th className="pl-5 pr-2 py-3 w-8">
                  <Checkbox checked={allPageSelected} indeterminate={somePageSelected} onChange={toggleAll} />
                </th>
                {['Nome', 'WhatsApp', 'Cidade', 'Status', 'Entrada', 'Ações'].map(h => (
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
                const cidadeDisplay = lead.cidade ? normalizeCity(lead.cidade) : '—';

                return (
                  <tr key={lead.id}
                    className={`${sel ? (dark ? 'bg-blue-950/30' : 'bg-blue-50/60') : idx % 2 === 0 ? '' : dark ? 'bg-[#0f0f11]' : 'bg-gray-50/50'} ${hov} transition-colors cursor-pointer border-b ${divider} last:border-0`}
                    onClick={() => setViewingLead(lead)}
                  >
                    <td className="pl-5 pr-2 py-4 w-8" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={sel} onChange={v => toggleOne(lead.id, v)} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#4b5563] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {getInitials(lead.nome)}
                        </div>
                        <p className={`font-medium truncate max-w-[140px] ${bold}`}>{lead.nome || '—'}</p>
                        {obs && obs.trim() && <ObsTooltip text={obs.trim()} dark={dark} />}
                      </div>
                    </td>
                    <td className={`px-4 py-4 ${muted}`}>{lead.whatsapp || '—'}</td>
                    <td className={`px-4 py-4 ${muted}`}>{cidadeDisplay}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {STATUS_LABELS[s]}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-sm whitespace-nowrap ${muted}`}>{formatEntrada(lead.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <a href={`https://wa.me/${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-green-50 inline-flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button onClick={() => { setEditingLead(lead); setIsEditOpen(true); }}
                          className="w-8 h-8 rounded-lg bg-blue-50 inline-flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!isLoading && totalPages > 1 && (
            <div className={`px-6 py-4 border-t ${divider} flex items-center justify-between`}>
              <p className={`text-sm ${muted}`}>
                Mostrando {(currentPage - 1) * leadsPerPage + 1}–{Math.min(currentPage * leadsPerPage, filtered.length)} de {filtered.length}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ ...pageBtn(false, currentPage === 1), padding: '0 12px' }}>Anterior</button>
                {(() => {
                  const pages: number[] = [];
                  if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                  else if (currentPage <= 3) { pages.push(1, 2, 3, 4, 5); }
                  else if (currentPage >= totalPages - 2) { for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i); }
                  else { for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i); }
                  return pages.map(n => <button key={n} onClick={() => setCurrentPage(n)} style={pageBtn(currentPage === n)}>{n}</button>);
                })()}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ ...pageBtn(false, currentPage === totalPages), padding: '0 12px' }}>Próximo</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConf && (
        <DeleteConfirmDialog count={selectedIds.size} onConfirm={handleDeleteSelected} onCancel={() => setShowDeleteConf(false)} loading={deleting} dark={dark} />
      )}

      <LeadDrawer
        lead={viewingLead} isOpen={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onUpdate={updated => {
          updateLead(updated.id, updated);
          setAllLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
          setViewingLead(updated);
        }}
      />
    </AppLayout>
  );
}
