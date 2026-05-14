import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAppStore, Lead, STATUS_LABELS, STATUS_CONFIG, calcularFaixa } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { useNavigate } from 'react-router-dom';
import { useWhatsAppAccount } from '@/hooks/useWhatsAppAccount';
import { Search, MessageCircle, Plus, Download, RefreshCw, Edit, Loader2, ChevronDown, Check, X, Trash2, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { formatarWhatsapp } from '@/utils/relativeTime';
import { safeName } from '@/utils/safeName';

const STATUS_STYLE = STATUS_CONFIG;

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
  { label: 'Em atendimento', value: '1', dot: STATUS_CONFIG[1]?.dot },
  { label: 'Reunião',        value: '2', dot: STATUS_CONFIG[2]?.dot },
  { label: 'Contrato/App',   value: '5', dot: STATUS_CONFIG[5]?.dot },
  { label: 'Aprovado',       value: '3', dot: STATUS_CONFIG[3]?.dot },
  { label: 'Reprovado',      value: '4', dot: STATUS_CONFIG[4]?.dot },
];

function getInitials(name: string) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Datas no fuso de Brasília ─────────────────────────────────
function parseLeadDate(str?: string | null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) {
    const cleaned = str.replace(/(\.\d{3})\d+/, '$1');
    return new Date(cleaned);
  }
  if (/^\d{4}-\d{2}-\d{2} /.test(str)) {
    const cleaned = str.replace(' ', 'T').replace('+00:00', 'Z').replace('+00', 'Z').replace(/(\.\d{3})\d+/, '$1');
    return new Date(cleaned);
  }
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0'] = m;
    return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${mi.padStart(2,'0')}:00-03:00`);
  }
  return new Date(str.replace(/(\.\d{3})\d+/, '$1'));
}

function leadDateBR(str?: string | null): string {
  try {
    const d = parseLeadDate(str);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
}

function todayBR(): string {
  try {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function subDays(dateStr: string, n: number): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().split('T')[0];
  } catch { return dateStr; }
}

function filterByPeriod(leads: Lead[], period: string, customFrom?: string, customTo?: string): Lead[] {
  if (period === 'all') return leads;
  const today = todayBR();
  const ok = (l: Lead, from: string, to: string) => {
    const d = leadDateBR(l.created_at);
    return !!d && d >= from && d <= to;
  };
  switch (period) {
    case 'today':     return leads.filter(l => ok(l, today, today));
    case 'yesterday': { const y = subDays(today, 1); return leads.filter(l => ok(l, y, y)); }
    case '7days':     { const f = subDays(today, 6);  return leads.filter(l => ok(l, f, today)); }
    case '30days':    { const f = subDays(today, 29); return leads.filter(l => ok(l, f, today)); }
    case 'month':     { const f = today.slice(0, 7) + '-01'; return leads.filter(l => ok(l, f, today)); }
    case 'custom':    { if (!customFrom || !customTo) return leads; return leads.filter(l => ok(l, customFrom, customTo)); }
    default: return leads;
  }
}

function formatEntrada(str?: string | null): string {
  try {
    if (!str) return '—';
    const d = parseLeadDate(str);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch { return '—'; }
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g,'').slice(0,11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

function normalizeCity(raw: string): string {
  if (!raw?.trim()) return '';
  let city = raw.trim();
  const ufMatch = city.match(/[\s\/\-,]+([A-Za-z]{2})\s*$/);
  let uf = '';
  if (ufMatch) { const c=ufMatch[1].toUpperCase(); const UFS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']; if(UFS.includes(c)){uf=c;city=city.slice(0,city.length-ufMatch[0].length).trim();} }
  const lower=new Set(['de','do','da','dos','das','e','em','com','no','na','nos','nas']);
  city=city.toLowerCase().replace(/[_\-\/]+/g,' ').replace(/\s+/g,' ').trim().split(' ').map((w,i)=>{ if(!w)return''; if(i>0&&lower.has(w))return w; return w.charAt(0).toUpperCase()+w.slice(1); }).join(' ');
  return uf?`${city} - ${uf}`:city;
}

function toStatusNum(s: any): number {
  if(s===null||s===undefined||s==='')return 1; const n=Number(s); if(isNaN(n)||n===0)return 1; return n;
}

function ScoreTag({ score, faixa, dark }: { score?: number | null; faixa?: string | null; dark: boolean }) {
  if (score == null) return <span style={{color:dark?'#3f3f46':'#d1d5db',fontSize:'12px'}}>—</span>;
  const isVerde = faixa === 'verde';
  const isAmarelo = faixa === 'amarelo';
  const color = isVerde ? '#10b981' : isAmarelo ? '#f59e0b' : '#6b7280';
  const bg = isVerde ? (dark?'rgba(16,185,129,0.12)':'#dcfce7') : isAmarelo ? (dark?'rgba(245,158,11,0.12)':'#fef9c3') : (dark?'rgba(107,114,128,0.12)':'#f3f4f6');
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 7px',borderRadius:'6px',background:bg,fontSize:'12px',fontWeight:700,color,whiteSpace:'nowrap'}}>
      <span style={{width:'5px',height:'5px',borderRadius:'50%',background:color,display:'inline-block',flexShrink:0}}/>
      {score} pts
    </span>
  );
}

function FaixaDot({ lead, dark }: { lead: Lead; dark: boolean }) {
  const { configuracoes } = useAppStore();
  const faixa = calcularFaixa(lead, configuracoes!) ?? (lead as any).faixa;
  if (!faixa || faixa === 'vermelho') return null;
  return <div style={{ width:'10px', height:'10px', borderRadius:'50%', flexShrink:0, background:faixa==='verde'?'#10b981':'#f59e0b', border:`2px solid ${dark?'#111113':'#ffffff'}` }}/>;
}

function FilterDropdown({ value, options, onChange, dark }: { value:string; options:{label:string;value:string;dot?:string}[]; onChange:(v:string)=>void; dark:boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(o => o.value === value);
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      let left = r.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setPos({ top: r.bottom + 6, left, width: Math.max(r.width, menuWidth) });
    }
    setOpen(v => !v);
  }
  return (
    <div style={{ position:'relative' }}>
      <button ref={btnRef} onClick={handleOpen} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 10px', borderRadius:'9px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#111113':'#ffffff', color:dark?'#d4d4d8':'#374151', fontSize:'12.5px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
        {selected?.dot && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:selected.dot, flexShrink:0 }}/>}
        {selected?.label}<ChevronDown style={{ width:'13px', height:'13px', transform:open?'rotate(180deg)':'', transition:'transform 0.18s' }}/>
      </button>
      {open && (<>
        <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
        <div style={{ position:'fixed', top:pos.top, left:pos.left, width:pos.width, background:dark?'#111113':'#ffffff', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, borderRadius:'10px', padding:'4px', zIndex:9999, boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 24px rgba(0,0,0,0.1)' }}>
          {options.map(o => (<button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'7px', padding:'7px 10px', borderRadius:'7px', border:'none', background:value===o.value?(dark?'rgba(255,255,255,0.07)':'#eff6ff'):'transparent', color:value===o.value?(dark?'#fff':'#2563eb'):(dark?'#a1a1aa':'#374151'), fontSize:'13px', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
            {value===o.value?<Check style={{ width:'12px', height:'12px', flexShrink:0 }}/>:<span style={{ width:'12px', flexShrink:0 }}/>}
            {o.dot && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:o.dot, flexShrink:0 }}/>}
            {o.label}
          </button>))}
        </div>
      </>)}
    </div>
  );
}

function CustomDateModal({ dark, customFrom, customTo, setCustomFrom, setCustomTo, onApply, onClear, onClose }: {
  dark:boolean; customFrom:string; customTo:string; setCustomFrom:(v:string)=>void; setCustomTo:(v:string)=>void; onApply:()=>void; onClear:()=>void; onClose:()=>void;
}) {
  const border=dark?'#1e1e22':'#e5e7eb'; const txtHi=dark?'#f4f4f5':'#111827'; const txtMid=dark?'#71717a':'#374151';
  const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1px solid ${border}`, background:dark?'#1a1a1e':'#f9fafb', color:dark?'#f4f4f5':'#111827', fontSize:'14px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as any };
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:9999, background:dark?'#111113':'#fff', border:`1px solid ${border}`, borderRadius:'16px', padding:'20px', width:'90%', maxWidth:'320px', boxShadow:dark?'0 24px 60px rgba(0,0,0,0.6)':'0 12px 40px rgba(0,0,0,0.15)', fontFamily:'inherit' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
          <span style={{ fontSize:'14px', fontWeight:600, color:txtHi }}>Período personalizado</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:txtMid, display:'flex', padding:'4px' }}><X style={{ width:'16px', height:'16px' }}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div><label style={{ fontSize:'12px', color:txtMid, display:'block', marginBottom:'5px', fontWeight:500 }}>Data inicial</label><input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle}/></div>
          <div><label style={{ fontSize:'12px', color:txtMid, display:'block', marginBottom:'5px', fontWeight:500 }}>Data final</label><input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={onApply} style={{ flex:1, padding:'10px', borderRadius:'9px', background:'#2563eb', border:'none', color:'#fff', fontSize:'13px', fontWeight:500, cursor:'pointer' }}>Aplicar</button>
            <button onClick={onClear} style={{ flex:1, padding:'10px', borderRadius:'9px', border:`1px solid ${border}`, background:'transparent', color:txtMid, fontSize:'13px', cursor:'pointer' }}>Limpar</button>
          </div>
        </div>
      </div>
    </>
  );
}

function PhoneInput({ value, onChange, style: st }: { value:string; onChange:(v:string)=>void; style?:React.CSSProperties }) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let masked = '';
    if (digits.length === 0) masked = '';
    else if (digits.length <= 2) masked = `(${digits}`;
    else if (digits.length <= 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    else masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    onChange(masked);
  }
  return <input type="tel" value={value} placeholder="(XX) XXXXX-XXXX" onChange={handleChange} style={st}/>;
}

function FormStatusSelect({ value, onChange, dark }: { value:number; onChange:(v:number)=>void; dark:boolean }) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 1, label: 'Em atendimento', dot: STATUS_CONFIG[1].dot },
    { value: 2, label: 'Reunião',        dot: STATUS_CONFIG[2].dot },
    { value: 5, label: 'Contrato/App',   dot: STATUS_CONFIG[5].dot },
    { value: 3, label: 'Aprovado',       dot: STATUS_CONFIG[3].dot },
    { value: 4, label: 'Reprovado',      dot: STATUS_CONFIG[4].dot },
  ];
  const selected = options.find(o => o.value === value) || options[0];
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const bg = dark ? '#1a1a1e' : '#f9fafb';
  const txt = dark ? '#f4f4f5' : '#111827';
  
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1px solid ${border}`, background:bg, color:txt, fontSize:'13.5px', outline:'none', fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', textAlign:'left' }}>
        <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:selected.dot, flexShrink:0 }}/>
        <span style={{ flex: 1 }}>{selected.label}</span>
        <ChevronDown style={{ width:'14px', height:'14px', color:txt }}/>
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
        <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:'4px', background:dark?'#111113':'#ffffff', border:`1px solid ${border}`, borderRadius:'10px', padding:'4px', zIndex:50, boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 24px rgba(0,0,0,0.1)' }}>
          {options.map(o => (
            <button type="button" key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', border:'none', background:value===o.value?(dark?'rgba(255,255,255,0.07)':'#eff6ff'):'transparent', color:value===o.value?(dark?'#fff':'#2563eb'):(dark?'#a1a1aa':'#374151'), fontSize:'13px', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:o.dot, flexShrink:0 }}/>
              {o.label}
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}

function DeleteConfirmDialog({ count, onConfirm, onCancel, loading, dark }: { count:number; onConfirm:()=>void; onCancel:()=>void; loading:boolean; dark:boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background:dark?'#111113':'#fff', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, borderRadius:'16px', padding:'24px', width:'90%', maxWidth:'360px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#fff1f2', display:'flex', alignItems:'center', justifyContent:'center' }}><Trash2 style={{ width:'18px', height:'18px', color:'#dc2626' }}/></div>
          <h3 style={{ margin:0, fontSize:'15px', fontWeight:600, color:dark?'#fff':'#111827' }}>Excluir {count>1?`${count} leads`:'lead'}?</h3>
        </div>
        <p style={{ fontSize:'13px', color:dark?'#9ca3af':'#6b7280', margin:'0 0 20px' }}>Esta ação não pode ser desfeita.</p>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={onCancel} style={{ flex:1, padding:'9px', borderRadius:'9px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#1a1a1e':'#f9fafb', color:dark?'#d4d4d8':'#374151', fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex:1, padding:'9px', borderRadius:'9px', border:'none', background:'#dc2626', color:'#fff', fontSize:'13px', cursor:'pointer', opacity:loading?0.7:1 }}>{loading?'Excluindo…':'Sim, excluir'}</button>
        </div>
      </div>
    </div>
  );
}

function ObsTooltip({ text, dark }: { text: string; dark: boolean }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    }
    setShow(true);
  }

  return (
    <>
      <div
        ref={ref}
        style={{ position:'relative', display:'inline-flex', flexShrink:0 }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onClick={e => { e.stopPropagation(); if (ref.current) { const r=ref.current.getBoundingClientRect(); setPos({top:r.top-8,left:r.left+r.width/2}); } setShow(v=>!v); }}
      >
        <div style={{ width:'16px', height:'16px', borderRadius:'50%', background:dark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={dark?'#9ca3af':'#6b7280'} strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
      </div>
      {show && (
        <div style={{ position:'fixed', top:pos.top, left:pos.left, transform:'translate(-50%,-100%)', zIndex:99999, background:'#1f2937', color:'#f9fafb', fontSize:'12px', lineHeight:1.5, padding:'8px 12px', borderRadius:'9px', maxWidth:'240px', minWidth:'120px', whiteSpace:'pre-wrap', wordBreak:'break-word', boxShadow:'0 4px 16px rgba(0,0,0,0.3)', pointerEvents:'none' }}>
          {text}
          <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'5px solid #1f2937' }}/>
        </div>
      )}
    </>
  );
}

function LeadsPage() {
  const navigate = useNavigate();
  const { updateLead, configuracoes } = useAppStore();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { orgId, ready: orgReady } = useOrgId();
  const dark = theme === 'dark';

  const { hasWA } = useWhatsAppAccount();

  const handleWhatsApp = useCallback((lead: Lead) => {
    if (!lead.whatsapp) return;
    const clean = lead.whatsapp.replace(/\D/g, '');
    const phone = clean.startsWith('55') ? clean : `55${clean}`;
    
    if (hasWA) {
      navigate(`/whatsapp?phone=${phone}`);
    } else {
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  }, [navigate, hasWA]);

  const [isMobile, setIsMobile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const longPressTriggered = useRef(false);

  useEffect(() => { const check=()=>setIsMobile(window.innerWidth<768); check(); window.addEventListener('resize',check); return()=>window.removeEventListener('resize',check); }, []);

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const bgCancelRef = useRef(false);
  const INITIAL_SIZE = 200;
  const PAGE_SIZE = 100;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 20;
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead|null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead|null>(null);
  const [newLead, setNewLead] = useState({
    nome: '', whatsapp: '', cidade: '',
    origem: '', origemCustom: '', status: 1, observacoes: ''
  });
  const ORIGENS = ['Indicação', 'Outro'];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConf, setShowDeleteConf] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allSystemSelected, setAllSystemSelected] = useState(false);
  const [campanhaFiltro, setCampanhaFiltro] = useState('');
  const [sortByScore, setSortByScore] = useState<'asc'|'desc'|null>(null);
  const [sortByDate, setSortByDate] = useState<'asc'|'desc'>('desc');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const periodo = params.get('periodo');
    const campanha = params.get('campanha');
    const de = params.get('de');
    const ate = params.get('ate');
    const status = params.get('status');
    if (periodo) setPeriodFilter(periodo);
    if (de) setCustomFrom(de);
    if (ate) setCustomTo(ate);
    if (campanha) {
      try {
        setCampanhaFiltro(decodeURIComponent(campanha).split('|')[0].trim());
      } catch {
        setCampanhaFiltro(campanha.split('|')[0].trim());
      }
    }
    if (status) setStatusFilter(status);
  }, []);

  const loadRestInBackground = useCallback(async (total: number, loaded: number) => {
    bgCancelRef.current = false;
    let from = loaded;
    while (from < total) {
      if (bgCancelRef.current) break;
      const to = Math.min(from + PAGE_SIZE - 1, total - 1);
      const { data } = await supabase
        .from('leads')
        .select(`
          id, nome, whatsapp, cidade, status, created_at,
          utm_source, utm_campaign, score, faixa,
          observacoes, motivo_reprovacao, ultimo_status_change,
          org_id, wa_sent
        `)
        .order('created_at', { ascending: false })
        .eq('org_id', orgId)
        .range(from, to);
      if (bgCancelRef.current) break;
      if (data?.length) setAllLeads(prev => [...prev, ...(data as unknown as Lead[])]);
      from += PAGE_SIZE;
      await new Promise(r => setTimeout(r, 200));
    }
  }, [orgId]);

  const fetchLeads = useCallback(async () => {
    if (!orgReady || !orgId) return;
    bgCancelRef.current = true; // cancela qualquer background load anterior
    setIsLoading(true);
    setAllLeads([]);

    // Count total (query leve — só id)
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    setTotalCount(count || 0);

    // Busca os primeiros 200 imediatamente
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id, nome, whatsapp, cidade, status, created_at,
        utm_source, utm_campaign, score, faixa,
        observacoes, motivo_reprovacao, ultimo_status_change,
        org_id, wa_sent
      `)
      .order('created_at', { ascending: false })
      .eq('org_id', orgId)
      .range(0, INITIAL_SIZE - 1);

    if (error) { toast.error('Erro ao carregar leads'); setIsLoading(false); return; }
    setAllLeads((data || []) as unknown as Lead[]);
    setIsLoading(false);

    // Carrega o restante em background sem travar a UI
    if (count && count > INITIAL_SIZE) {
      loadRestInBackground(count, INITIAL_SIZE);
    }
  }, [orgId, orgReady, loadRestInBackground]);

  useEffect(() => {
    if (!orgReady || !orgId) return;
    fetchLeads();
  }, [orgId, orgReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abre o drawer com dados parciais imediatamente, depois enriquece com quiz_respostas
  const handleViewLead = useCallback(async (lead: Lead) => {
    setViewingLead(lead);
    const { data } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    if (data) setViewingLead(data as unknown as Lead);
  }, []);

  useEffect(() => {
    if (!orgReady || !orgId) return;
    const ch = supabase.channel(`leads-rt2-${orgId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{ const novo=p.new as Lead; setAllLeads(prev=>[novo,...prev]); setTotalCount(c=>c+1); toast.success(`Novo lead: ${novo.nome||'Sem nome'}`,{duration:3000,position:'bottom-left'}); })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{ setAllLeads(prev=>prev.map(l=>l.id===(p.new as Lead).id?p.new as Lead:l)); })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'leads'},p=>{ setAllLeads(prev=>prev.filter(l=>l.id!==(p.old as{id:string}).id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, orgReady]);

  const filtered = useMemo(() => {
    let r=[...allLeads];
    r=filterByPeriod(r,periodFilter,customFrom,customTo);
    if(statusFilter!=='all') r=r.filter(l=>toStatusNum(l.status)===parseInt(statusFilter));
    if(campanhaFiltro.trim()){
      r=r.filter(l=>{
        try {
          const la=l as any;
          const utm=String(la.utm_campaign||'').toLowerCase().split('|')[0].trim();
          const camp=campanhaFiltro.toLowerCase().split('|')[0].trim().slice(0,20);
          return utm.includes(camp);
        } catch { return false; }
      });
    }
    if(search.trim()&&!campanhaFiltro.trim()){
      const q=search.toLowerCase();
      r=r.filter(l=>{ const la=l as any; return l.nome?.toLowerCase().includes(q)||l.whatsapp?.includes(search)||l.cidade?.toLowerCase().includes(q)||safeName((la.utm_campaign||'')).toLowerCase().includes(q); });
    }
    if (sortByScore) {
      r=[...r].sort((a,b)=>{ const sa=(a as any).score??-1; const sb=(b as any).score??-1; return sortByScore==='desc'?sb-sa:sa-sb; });
    } else {
      r=[...r].sort((a,b)=>{
        const da=parseLeadDate(a.created_at).getTime();
        const db=parseLeadDate(b.created_at).getTime();
        return sortByDate==='desc'?db-da:da-db;
      });
    }
    return r;
  }, [allLeads, periodFilter, statusFilter, search, campanhaFiltro, customFrom, customTo, sortByScore, sortByDate]);

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); setAllSystemSelected(false); }, [periodFilter, statusFilter, search, campanhaFiltro]);

  const totalPages = Math.ceil(filtered.length/leadsPerPage);
  const paginatedLeads = useMemo(() => filtered.slice((currentPage-1)*leadsPerPage, currentPage*leadsPerPage), [filtered, currentPage]);

  const pageIds = paginatedLeads.map(l => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));

  function handleCheckboxHeader() {
    const n = new Set(selectedIds);
    if (allPageSelected) { pageIds.forEach(id => n.delete(id)); setAllSystemSelected(false); }
    else { pageIds.forEach(id => n.add(id)); }
    setSelectedIds(n);
  }

  function handleSelectAllSystem() { setSelectedIds(new Set(allLeads.map(l => l.id))); setAllSystemSelected(true); }
  function handleClearSelection() { setSelectedIds(new Set()); setAllSystemSelected(false); }

  const handleAddLead = async () => {
    if (!newLead.nome.trim()) { toast.error('Nome obrigatório'); return; }
    if (!newLead.whatsapp.trim()) { toast.error('WhatsApp obrigatório'); return; }
    if (!newLead.cidade.trim()) { toast.error('Cidade obrigatória'); return; }
    if (!newLead.origem || (newLead.origem === 'Outro' && !newLead.origemCustom.trim())) { toast.error('Origem obrigatória'); return; }
    if (!newLead.observacoes.trim()) { toast.error('Observações obrigatórias'); return; }

    const cidadeNorm = normalizeCity(newLead.cidade);
    const phoneClean = newLead.whatsapp.replace(/\D/g, '');

    // Busca o score mínimo verde da org via quizzes
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('corte_verde')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const scoreMinVerde = quizData?.corte_verde || 35;

    const { data, error } = await supabase.from('leads').insert({
      nome: newLead.nome.trim(),
      whatsapp: phoneClean,
      cidade: cidadeNorm,
      status: newLead.status,
      score: scoreMinVerde,
      faixa: 'verde',
      observacoes: newLead.observacoes || null,
      utm_source: newLead.origem === 'Outro'
        ? (newLead.origemCustom || 'Outro')
        : (newLead.origem || null),
      utm_campaign: null,
      utm_medium: null,
      utm_content: null,
      utm_term: null,
      utm_id: null,
      org_id: orgId,
      created_at: new Date().toISOString(),
    }).select('*').single();

    if (error) { toast.error(`Erro: ${error.message}`); return; }
    if (data) setAllLeads(prev => [data as unknown as Lead, ...prev]);

    setNewLead({
      nome: '', whatsapp: '', cidade: '',
      origem: '', origemCustom: '', status: 1, observacoes: ''
    });
    setIsAddOpen(false);
    toast.success('Lead adicionado!');
  };

  const handleEditLead = async () => {
    if(!editingLead)return; const cidadeNorm=normalizeCity(editingLead.cidade||''); const updates={nome:editingLead.nome,whatsapp:editingLead.whatsapp,cidade:cidadeNorm,status:editingLead.status??0};
    const{error}=await supabase.from('leads').update(updates).eq('id',editingLead.id); if(error){toast.error(`Erro: ${error.message}`);return;}
    setAllLeads(prev=>prev.map(l=>l.id===editingLead.id?{...l,...updates}:l)); updateLead(editingLead.id,updates); setIsEditOpen(false); setEditingLead(null); toast.success('Lead atualizado!');
  };

  const handleDeleteSelected = async () => {
    setDeleting(true); const ids=Array.from(selectedIds); const{error}=await supabase.from('leads').delete().in('id',ids); setDeleting(false);
    if(error){toast.error('Erro ao excluir');return;} setAllLeads(prev=>prev.filter(l=>!selectedIds.has(l.id))); setSelectedIds(new Set()); setAllSystemSelected(false); setShowDeleteConf(false); toast.success(`${ids.length} lead(s) excluído(s)!`);
  };

  const exportCSV = () => {
    const toExport=selectedIds.size>0?allLeads.filter(l=>selectedIds.has(l.id)):filtered; if(!toExport.length){toast.error('Nenhum lead para exportar');return;}
    const allKeys=Array.from(new Set(toExport.flatMap(l=>Object.keys(l as object))));
    const rows=toExport.map(l=>allKeys.map(k=>{const v=(l as any)[k];if(v===null||v===undefined)return'';const s=String(v).replace(/"/g,'""');return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s}"`:s;}).join(',')).join('\n');
    const blob=new Blob([allKeys.join(',')+'\n'+rows],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`leads_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  function handlePeriodChange(v: string) {
    if (v === 'custom') { setShowCustom(true); }
    else { setPeriodFilter(v); setShowCustom(false); setCustomFrom(''); setCustomTo(''); }
  }

  const bg=dark?'#090909':'#f4f4f5'; const cardBg=dark?'#111113':'#ffffff'; const border=dark?'#1e1e22':'#e5e7eb';
  const txtHi=dark?'#f4f4f5':'#111827'; const txtMid=dark?'#71717a':'#6b7280';
  const divider=dark?'border-[#1e1e22]':'border-gray-100'; const bold=dark?'text-white':'text-gray-900';
  const muted=dark?'text-gray-500':'text-gray-600'; const theadBg=dark?'bg-[#18181b]':'bg-gray-50';
  const hov=dark?'hover:bg-[#1a1a1e]':'hover:bg-blue-50/50'; const card=dark?'bg-[#111113] border-[#1e1e22]':'bg-white border-gray-100';
  const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1px solid ${border}`, background:dark?'#1a1a1e':'#f9fafb', color:dark?'#f4f4f5':'#111827', fontSize:'13.5px', outline:'none', fontFamily:'inherit' };
  const btnGhost: React.CSSProperties = { display:'flex', alignItems:'center', gap:'5px', padding:'7px 10px', borderRadius:'9px', border:`1px solid ${border}`, background:dark?'#111113':'#ffffff', color:dark?'#a1a1aa':'#374151', fontSize:'12.5px', cursor:'pointer', fontFamily:'inherit' };

  return (
    <AppLayout leadCount={totalCount}>
      <div style={{ padding:isMobile?'12px':'28px', background:bg, minHeight:'100vh' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', gap:'8px' }}>
          <h1 className={`text-xl font-bold ${bold}`}>Leads <span className={`font-normal text-base ${muted}`}>({totalCount})</span></h1>
          <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
            {isMobile ? (
              <>
                {selectedIds.size>0&&<button onClick={()=>setShowDeleteConf(true)} style={{...btnGhost,border:'1px solid #fecaca',background:'#fff1f2',color:'#dc2626',padding:'7px'}}><Trash2 style={{width:'16px',height:'16px'}}/></button>}
                <button onClick={()=>setShowFilters(v=>!v)} style={{...btnGhost,gap:'4px'}}><Filter style={{width:'14px',height:'14px'}}/> Filtros</button>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild><button style={{display:'flex',alignItems:'center',gap:'4px',padding:'7px 12px',borderRadius:'9px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:500,cursor:'pointer'}}><Plus style={{width:'14px',height:'14px'}}/> Add</button></DialogTrigger>
                  <DialogContent style={{background:dark?'#111113':'#fff',border:`1px solid ${border}`,borderRadius:'16px'}}>
                    <DialogHeader><DialogTitle style={{color:dark?'#fff':'#111827'}}>Adicionar Lead</DialogTitle></DialogHeader>
                    <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'8px'}}>
                      <input placeholder="Nome completo *" required value={newLead.nome} onChange={e=>setNewLead(n=>({...n,nome:e.target.value}))} style={inputStyle}/>
                      <PhoneInput value={newLead.whatsapp} onChange={v=>setNewLead(n=>({...n,whatsapp:v}))} style={inputStyle}/>
                      <input placeholder="Cidade *" required value={newLead.cidade} onChange={e=>setNewLead(n=>({...n,cidade:e.target.value}))} style={inputStyle}/>
                      
                      {/* ORIGEM */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Origem</label>
                        <select value={newLead.origem} onChange={e => setNewLead(n => ({ ...n, origem: e.target.value }))} style={inputStyle}>
                          <option value="">Selecionar origem...</option>
                          {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {newLead.origem === 'Outro' && (
                          <input placeholder="Especifique a origem..." value={newLead.origemCustom} onChange={e => setNewLead(n => ({ ...n, origemCustom: e.target.value }))} style={{ ...inputStyle, marginTop: '8px' }} />
                        )}
                      </div>

                      {/* STATUS INICIAL */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Status inicial</label>
                        <FormStatusSelect value={newLead.status} onChange={v => setNewLead(n => ({ ...n, status: v }))} dark={dark} />
                      </div>

                      {/* OBSERVAÇÕES */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Observações</label>
                        <textarea 
                          placeholder="Notas sobre o lead..." 
                          value={newLead.observacoes} 
                          onChange={e => setNewLead(n => ({ ...n, observacoes: e.target.value }))} 
                          style={{ ...inputStyle, height: '80px', resize: 'none' }}
                        />
                      </div>

                      <button onClick={handleAddLead} style={{padding:'10px',borderRadius:'9px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13.5px',fontWeight:600,cursor:'pointer',marginTop:'8px'}}>Adicionar Lead</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <>
                <div style={{position:'relative'}}>
                  <Search style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',width:'14px',height:'14px',color:dark?'#71717a':'#9ca3af'}}/>
                  <input placeholder="Buscar..." value={search} onChange={e=>{ setSearch(e.target.value); if(campanhaFiltro)setCampanhaFiltro(''); }} style={{paddingLeft:'32px',paddingRight:'12px',paddingTop:'7px',paddingBottom:'7px',borderRadius:'9px',border:`1px solid ${border}`,background:dark?'#111113':'#fff',color:dark?'#d4d4d8':'#374151',fontSize:'13px',outline:'none',width:'180px',fontFamily:'inherit'}}/>
                </div>
                <FilterDropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} dark={dark}/>
                <FilterDropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={handlePeriodChange} dark={dark}/>
                <button onClick={fetchLeads} style={btnGhost}><RefreshCw style={{width:'13px',height:'13px'}}/></button>
                <button onClick={exportCSV} style={btnGhost}><Download style={{width:'13px',height:'13px'}}/></button>
                <button onClick={()=>selectedIds.size>0?setShowDeleteConf(true):undefined} style={{...btnGhost,border:`1px solid ${selectedIds.size>0?'#fecaca':border}`,background:selectedIds.size>0?'#fff1f2':(dark?'#111113':'#fff'),color:selectedIds.size>0?'#dc2626':(dark?'#3f3f46':'#d1d5db'),cursor:selectedIds.size>0?'pointer':'default'}}>
                  <Trash2 style={{width:'13px',height:'13px'}}/>{selectedIds.size>0&&` (${selectedIds.size})`}
                </button>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild><button style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 12px',borderRadius:'9px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:500,cursor:'pointer'}}><Plus style={{width:'14px',height:'14px'}}/> Adicionar</button></DialogTrigger>
                  <DialogContent style={{background:dark?'#111113':'#fff',border:`1px solid ${border}`,borderRadius:'16px'}}>
                    <DialogHeader><DialogTitle style={{color:dark?'#fff':'#111827'}}>Adicionar Lead</DialogTitle></DialogHeader>
                    <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'8px'}}>
                      <input placeholder="Nome completo *" required value={newLead.nome} onChange={e=>setNewLead(n=>({...n,nome:e.target.value}))} style={inputStyle}/>
                      <PhoneInput value={newLead.whatsapp} onChange={v=>setNewLead(n=>({...n,whatsapp:v}))} style={inputStyle}/>
                      <input placeholder="Cidade *" required value={newLead.cidade} onChange={e=>setNewLead(n=>({...n,cidade:e.target.value}))} style={inputStyle}/>
                      
                      {/* ORIGEM */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Origem</label>
                        <select value={newLead.origem} onChange={e => setNewLead(n => ({ ...n, origem: e.target.value }))} style={inputStyle}>
                          <option value="">Selecionar origem...</option>
                          {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {newLead.origem === 'Outro' && (
                          <input placeholder="Especifique a origem..." value={newLead.origemCustom} onChange={e => setNewLead(n => ({ ...n, origemCustom: e.target.value }))} style={{ ...inputStyle, marginTop: '8px' }} />
                        )}
                      </div>

                      {/* STATUS INICIAL */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Status inicial</label>
                        <FormStatusSelect value={newLead.status} onChange={v => setNewLead(n => ({ ...n, status: v }))} dark={dark} />
                      </div>

                      {/* OBSERVAÇÕES */}
                      <div>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Observações</label>
                        <textarea 
                          placeholder="Notas sobre o lead..." 
                          value={newLead.observacoes} 
                          onChange={e => setNewLead(n => ({ ...n, observacoes: e.target.value }))} 
                          style={{ ...inputStyle, height: '80px', resize: 'none' }}
                        />
                      </div>

                      <button onClick={handleAddLead} style={{padding:'10px',borderRadius:'9px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13.5px',fontWeight:600,cursor:'pointer',marginTop:'8px'}}>Adicionar Lead</button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {isMobile && (
          <div style={{marginBottom:'12px',display:'flex',flexDirection:'column',gap:'8px'}}>
            <div style={{position:'relative'}}>
              <Search style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',width:'14px',height:'14px',color:dark?'#71717a':'#9ca3af'}}/>
              <input placeholder="Buscar leads..." value={search} onChange={e=>{ setSearch(e.target.value); if(campanhaFiltro)setCampanhaFiltro(''); }} style={{width:'100%',paddingLeft:'32px',paddingRight:'12px',paddingTop:'10px',paddingBottom:'10px',borderRadius:'10px',border:`1px solid ${border}`,background:cardBg,color:txtHi,fontSize:'14px',outline:'none',fontFamily:'inherit'}}/>
            </div>
            {showFilters && (
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap',padding:'10px',background:cardBg,borderRadius:'10px',border:`1px solid ${border}`}}>
                <FilterDropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} dark={dark}/>
                <FilterDropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={handlePeriodChange} dark={dark}/>
                <button onClick={fetchLeads} style={btnGhost}><RefreshCw style={{width:'13px',height:'13px'}}/></button>
                <button onClick={exportCSV} style={btnGhost}><Download style={{width:'13px',height:'13px'}}/></button>
              </div>
            )}
          </div>
        )}

        {/* Chip campanha ativa */}
        {campanhaFiltro && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', background:dark?'rgba(16,185,129,0.1)':'#f0fdf4', border:`1px solid ${dark?'rgba(16,185,129,0.25)':'#bbf7d0'}`, borderRadius:'9px', marginBottom:'10px', fontSize:'12.5px' }}>
            <span style={{ color:dark?'#34d399':'#15803d', fontWeight:500 }}>🎯 Campanha:</span>
            <span style={{ color:dark?'#f4f4f5':'#111827', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{campanhaFiltro}</span>
            <button onClick={()=>{ setCampanhaFiltro(''); setPeriodFilter('all'); }} style={{ background:'none', border:'none', cursor:'pointer', color:dark?'#6b7280':'#9ca3af', fontSize:'14px', padding:'0 2px', lineHeight:1 }}>✕</button>
          </div>
        )}

        {showCustom && (
          <CustomDateModal dark={dark} customFrom={customFrom} customTo={customTo} setCustomFrom={setCustomFrom} setCustomTo={setCustomTo}
            onApply={() => { if(customFrom&&customTo){setPeriodFilter('custom');setShowCustom(false);} }}
            onClear={() => { setCustomFrom('');setCustomTo('');setPeriodFilter('all');setShowCustom(false); }}
            onClose={() => setShowCustom(false)}
          />
        )}

        {!isMobile && selectedIds.size > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 14px', background:dark?'rgba(37,99,235,0.1)':'#eff6ff', border:`1px solid ${dark?'rgba(37,99,235,0.25)':'#bfdbfe'}`, borderRadius:'10px', marginBottom:'10px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px', fontWeight:500, color:dark?'#93c5fd':'#1d4ed8' }}>
              {allSystemSelected ? `Todos os ${allLeads.length} leads selecionados` : `${selectedIds.size} lead${selectedIds.size>1?'s':''} selecionado${selectedIds.size>1?'s':''} nesta página`}
            </span>
            {!allSystemSelected && (<>
              <span style={{color:dark?'rgba(147,197,253,0.3)':'#bfdbfe',fontSize:'13px'}}>·</span>
              <button onClick={handleSelectAllSystem} style={{ background:'none', border:'none', cursor:'pointer', color:dark?'#60a5fa':'#2563eb', fontWeight:600, fontSize:'13px', padding:0, textDecoration:'underline' }}>
                Selecionar todos os {allLeads.length} leads do sistema
              </button>
            </>)}
            <button onClick={handleClearSelection} style={{ background:'none', border:'none', cursor:'pointer', color:dark?'#6b7280':'#9ca3af', fontSize:'12px', padding:0, marginLeft:'auto' }}>Limpar seleção</button>
          </div>
        )}

        {/* Mobile cards */}
        {isMobile ? (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',overscrollBehavior:'contain'}}>
            {isLoading?[...Array(5)].map((_,i)=><div key={i} style={{height:'88px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',animation:'pulse 1.5s ease-in-out infinite'}}/>)
            :paginatedLeads.length===0?<div style={{textAlign:'center',padding:'40px 0',color:txtMid,fontSize:'13px'}}>Nenhum lead encontrado</div>
            :paginatedLeads.map(lead=>{
              const s=toStatusNum(lead.status); const sel=selectedIds.has(lead.id);
              return(
                <div key={lead.id}
                  onTouchStart={()=>{longPressTriggered.current=false;pressTimer.current=setTimeout(()=>{longPressTriggered.current=true;setSelectedIds(prev=>{const n=new Set(prev);if(n.has(lead.id))n.delete(lead.id);else n.add(lead.id);return n;});if(window.navigator?.vibrate)window.navigator.vibrate(50);},450);}}
                  onTouchEnd={()=>pressTimer.current&&clearTimeout(pressTimer.current)}
                  onTouchMove={()=>pressTimer.current&&clearTimeout(pressTimer.current)}
                  onContextMenu={e=>e.preventDefault()}
                  onClick={()=>{if(longPressTriggered.current){longPressTriggered.current=false;return;}if(selectedIds.size>0){const n=new Set(selectedIds);if(n.has(lead.id))n.delete(lead.id);else n.add(lead.id);setSelectedIds(n);}else{handleViewLead(lead);}}}
                  style={{background:cardBg,borderRadius:'12px',padding:'12px 14px',border:`1px solid ${sel?'#2563eb':border}`,boxShadow:sel?'0 0 0 2px rgba(37,99,235,0.2)':'0 1px 4px rgba(0,0,0,0.04)',cursor:'pointer',transition:'all 0.12s',userSelect:'none',WebkitUserSelect:'none',touchAction:'pan-y'}}
                >
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    {selectedIds.size>0&&<input type="checkbox" checked={sel} readOnly style={{width:'15px',height:'15px',accentColor:'#2563eb',flexShrink:0,pointerEvents:'none'}}/>}
                    <div style={{position:'relative',flexShrink:0}}>
                      <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'#4b5563',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'12px',fontWeight:700}}>{getInitials(lead.nome)}</div>
                      <div style={{position:'absolute',top:'-4px',right:'-4px'}}><FaixaDot lead={lead} dark={dark}/></div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{safeName(lead.nome)||'Lead'}</p>
                      <p style={{fontSize:'12px',color:txtMid,margin:'2px 0 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{safeName(lead.cidade)?normalizeCity(safeName(lead.cidade)):''}{safeName(lead.cidade)&&lead.whatsapp?' · ':''}{lead.whatsapp?formatarWhatsapp(lead.whatsapp):''}</p>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'6px',flexShrink:0}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,background:dark?STATUS_STYLE[s]?.darkBg:STATUS_STYLE[s]?.lightBg,color:dark?STATUS_STYLE[s]?.darkText:STATUS_STYLE[s]?.lightText}}>
                        <span style={{width:'5px',height:'5px',borderRadius:'50%',background:STATUS_STYLE[s]?.dot,flexShrink:0,display:'inline-block'}}/>{STATUS_LABELS[s]}
                      </span>
                      <span style={{fontSize:'11px',color:txtMid}}>{formatEntrada(lead.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!isLoading&&totalPages>1&&(
              <div style={{display:'flex',justifyContent:'center',gap:'8px',padding:'8px 0'}}>
                <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} style={{padding:'8px 16px',borderRadius:'8px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:currentPage===1?'default':'pointer',opacity:currentPage===1?0.4:1}}>Anterior</button>
                <span style={{padding:'8px 12px',fontSize:'13px',color:txtMid}}>{currentPage}/{totalPages}</span>
                <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} style={{padding:'8px 16px',borderRadius:'8px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:currentPage===totalPages?'default':'pointer',opacity:currentPage===totalPages?0.4:1}}>Próximo</button>
              </div>
            )}
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${card}`}>
            <table className="w-full text-sm" style={{tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'40px'}}/>
                <col style={{width:'23%'}}/>
                <col style={{width:'88px'}}/>
                <col style={{width:'14%'}}/>
                <col style={{width:'18%'}}/>
                <col style={{width:'120px'}}/>
                <col style={{width:'120px'}}/>
                <col style={{width:'72px'}}/>
              </colgroup>
              <thead>
                <tr className={`border-b ${divider} ${theadBg}`}>
                  <th className="pl-4 pr-2 py-3">
                    <input type="checkbox" checked={allPageSelected} onChange={handleCheckboxHeader} style={{width:'15px',height:'15px',accentColor:'#3b82f6',opacity:0.6,cursor:'pointer'}}/>
                  </th>
                  <th className={`text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider ${muted}`}>Nome</th>
                  <th className={`text-left px-3 py-3`} style={{whiteSpace:'nowrap'}}>
                    <button onClick={()=>setSortByScore(s=>s==='desc'?'asc':'desc')} style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',color:sortByScore?(dark?'#60a5fa':'#2563eb'):(dark?'#71717a':'#6b7280'),background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                      Score {sortByScore==='asc'?'↑':'↓'}
                    </button>
                  </th>
                  {(['WhatsApp','Cidade','Status'] as string[]).map(h=>(
                    <th key={h} className={`text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider ${muted}`}>{h}</th>
                  ))}
                  <th className={`text-left px-3 py-3`} style={{whiteSpace:'nowrap'}}>
                    <button onClick={()=>setSortByDate(s=>s==='desc'?'asc':'desc')} style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',color:dark?'#71717a':'#6b7280',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>
                      Entrada {sortByDate==='desc'?'↓':'↑'}
                    </button>
                  </th>
                  <th className={`text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider ${muted}`}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading?([...Array(10)].map((_,i)=>(
                  <tr key={i} className={`border-b ${divider}`}>
                    <td className="pl-4 pr-2 py-3"><div style={{width:'15px',height:'15px',borderRadius:'3px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite'}}/></td>
                    <td className="px-3 py-3"><div style={{display:'flex',alignItems:'center',gap:'7px'}}><div style={{width:'28px',height:'28px',borderRadius:'50%',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite',flexShrink:0}}/><div style={{height:'13px',borderRadius:'4px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite',width:`${90+Math.floor((i*37)%70)}px`}}/></div></td>
                    {[60,90,110,90,80].map((w,j)=>(<td key={j} className="px-3 py-3"><div style={{height:'13px',borderRadius:'4px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite',width:`${w}px`}}/></td>))}
                    <td className="px-3 py-3"><div style={{height:'13px',borderRadius:'4px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite',width:'80px'}}/></td>
                    <td className="px-3 py-3"><div style={{display:'flex',gap:'5px'}}><div style={{width:'28px',height:'28px',borderRadius:'7px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite'}}/><div style={{width:'28px',height:'28px',borderRadius:'7px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',animation:'pulse 1.5s ease-in-out infinite'}}/></div></td>
                  </tr>
                )))
                :paginatedLeads.length===0?(<tr><td colSpan={8} className={`px-6 py-12 text-center text-sm ${muted}`}>Nenhum lead encontrado</td></tr>)
                :paginatedLeads.map((lead,idx)=>{
                  const s=toStatusNum(lead.status); const sel=selectedIds.has(lead.id); const obs=(lead as any).observacoes as string|null|undefined; const la=lead as any;
                  return(
                    <tr key={lead.id} className={`${sel?(dark?'bg-blue-950/30':'bg-blue-50/60'):idx%2===0?'':(dark?'bg-[#0f0f11]':'bg-gray-50/50')} ${hov} transition-colors cursor-pointer border-b ${divider} last:border-0`} onClick={()=>handleViewLead(lead)}>
                      <td className="pl-4 pr-2 py-3" onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={e=>{const n=new Set(selectedIds);e.target.checked?n.add(lead.id):n.delete(lead.id);setSelectedIds(n);if(!e.target.checked)setAllSystemSelected(false);}} onClick={e=>e.stopPropagation()} style={{width:'15px',height:'15px',accentColor:'#3b82f6',opacity:0.5,cursor:'pointer'}}/>
                      </td>
                      <td className="px-3 py-3" style={{overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'7px',minWidth:0}}>
                          <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'#4b5563',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'10px',fontWeight:700,flexShrink:0}}>{getInitials(lead.nome)}</div>
                          <span style={{fontSize:'13px',fontWeight:500,color:dark?'#f4f4f5':'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{safeName(lead.nome)||'Lead'}</span>
                          {obs&&obs.trim()&&<ObsTooltip text={obs} dark={dark}/>}
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{whiteSpace:'nowrap'}}>
                        <ScoreTag score={la.score!=null?Number(la.score):null} faixa={calcularFaixa(lead, configuracoes!) ?? la.faixa} dark={dark}/>
                      </td>
                      <td className="px-3 py-3" style={{color:dark?'#71717a':'#374151',fontSize:'12.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.whatsapp?formatarWhatsapp(lead.whatsapp):'—'}</td>
                      <td className="px-3 py-3" style={{color:dark?'#71717a':'#374151',fontSize:'12.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{safeName(lead.cidade)?normalizeCity(safeName(lead.cidade)):'—'}</td>
                      <td className="px-3 py-3">
                        <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 8px',borderRadius:'99px',fontSize:'11.5px',fontWeight:600,whiteSpace:'nowrap',background:dark?STATUS_STYLE[s]?.darkBg:STATUS_STYLE[s]?.lightBg,color:dark?STATUS_STYLE[s]?.darkText:STATUS_STYLE[s]?.lightText}}>
                          <span style={{width:'5px',height:'5px',borderRadius:'50%',background:STATUS_STYLE[s]?.dot,flexShrink:0,display:'inline-block'}}/>{STATUS_LABELS[s]}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{color:dark?'#71717a':'#374151',fontSize:'12px',whiteSpace:'nowrap'}}>{formatEntrada(lead.created_at)}</td>
                      <td className="px-3 py-3">
                        <div style={{display:'flex',alignItems:'center',gap:'5px'}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>{ handleWhatsApp(lead); }} className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${dark?'bg-green-500/15 text-green-500 hover:bg-green-500/25':'bg-green-50 text-green-600 hover:bg-green-100'}`} style={{border:'none',cursor:lead.whatsapp?'pointer':'default',opacity:lead.whatsapp?1:0.4}}><MessageCircle className="w-3.5 h-3.5"/></button>
                          <button onClick={()=>{setEditingLead(lead);setIsEditOpen(true);}} className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${dark?'bg-blue-500/15 text-blue-500 hover:bg-blue-500/25':'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}><Edit className="w-3.5 h-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!isLoading&&totalPages>1&&(
              <div className={`px-6 py-4 border-t ${divider} flex items-center justify-between`}>
                <p className={`text-sm ${muted}`}>Mostrando {(currentPage-1)*leadsPerPage+1}–{Math.min(currentPage*leadsPerPage,filtered.length)} de {filtered.length}</p>
                <div style={{display:'flex',gap:'4px'}}>
                  <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} style={{padding:'6px 12px',borderRadius:'8px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:currentPage===1?'default':'pointer',opacity:currentPage===1?0.4:1}}>Anterior</button>
                  <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} style={{padding:'6px 12px',borderRadius:'8px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:currentPage===totalPages?'default':'pointer',opacity:currentPage===totalPages?0.4:1}}>Próximo</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConf&&<DeleteConfirmDialog count={selectedIds.size} onConfirm={handleDeleteSelected} onCancel={()=>setShowDeleteConf(false)} loading={deleting} dark={dark}/>}

      <Dialog open={isEditOpen} onOpenChange={open=>{setIsEditOpen(open);if(!open)setEditingLead(null);}}>
        <DialogContent style={{background:dark?'#111113':'#fff',border:`1px solid ${border}`,borderRadius:'16px'}}>
          <DialogHeader><DialogTitle style={{color:dark?'#fff':'#111827'}}>Editar Lead</DialogTitle></DialogHeader>
          {editingLead&&(<div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'8px'}}>
            <input placeholder="Nome" value={editingLead.nome||''} onChange={e=>setEditingLead(l=>l&&({...l,nome:e.target.value}))} style={inputStyle}/>
            <PhoneInput value={editingLead.whatsapp||''} onChange={v=>setEditingLead(l=>l&&({...l,whatsapp:v}))} style={inputStyle}/>
            <input placeholder="Cidade" value={editingLead.cidade||''} onChange={e=>setEditingLead(l=>l&&({...l,cidade:e.target.value}))} style={inputStyle}/>
            <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
              <button onClick={handleEditLead} style={{flex:1,padding:'10px',borderRadius:'9px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:500,cursor:'pointer'}}>Salvar</button>
              <button onClick={()=>setIsEditOpen(false)} style={{flex:1,padding:'10px',borderRadius:'9px',border:`1px solid ${border}`,background:'transparent',color:txtMid,fontSize:'13px',cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>)}
        </DialogContent>
      </Dialog>

      <LeadDrawer lead={viewingLead} isOpen={!!viewingLead} onClose={()=>setViewingLead(null)} onUpdate={updated=>{updateLead(updated.id,updated);setAllLeads(prev=>prev.map(l=>l.id===updated.id?updated:l));setViewingLead(updated);}}/>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </AppLayout>
  );
}

export default function LeadsPageExport() {
  return (
    <ErrorBoundary>
      <LeadsPage />
    </ErrorBoundary>
  );
}
