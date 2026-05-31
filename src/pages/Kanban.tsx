import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, calcularFaixa, STATUS_CONFIG, STATUS_SEQUENCE } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageCircle, Eye, Clock, MapPin, ChevronLeft, ChevronRight, Check,
  Search, X, Tag as TagIcon, Megaphone, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime, formatarWhatsapp } from '@/utils/relativeTime';
import { safeName, safeInitials } from '@/utils/safeName';
import { getAvatarColor, getAvatarTextColor } from '@/utils/avatarColor';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useWhatsAppAccount } from '@/hooks/useWhatsAppAccount';
import { useNavigate } from 'react-router-dom';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { Tag } from '@/hooks/useTags';

// ── Constants ─────────────────────────────────────────────────────────────────
const COLUMNS = STATUS_SEQUENCE.map(status => ({
  status,
  label: STATUS_CONFIG[status].label,
  border: STATUS_CONFIG[status].dot,
  dot: STATUS_CONFIG[status].dot,
  bg: `${STATUS_CONFIG[status].dot}10`
}));

const MOTIVOS = ['Desistiu','Fora de SP','Nome sujo','Sem reserva','Não compareceu à reunião','Outro'];
const COL_PAGE = 50;

const PERIOD_OPTIONS = [
  { label: 'Todos', value: 'all' },
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: '7days' },
  { label: '30 dias', value: '30days' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' },
];

// ── Date Utilities ────────────────────────────────────────────────────────────
function initials(name: string) { return safeInitials(name); }

function parseDateMs(str?: string | null): number {
  if (!str) return 0;
  try {
    if (str.includes('T') || str.endsWith('Z')) return new Date(str).getTime();
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]), Number(m[4]||0), Number(m[5]||0)).getTime();
    return new Date(str).getTime();
  } catch { return 0; }
}

function getDias(lead: Lead): number {
  const l = lead as any;
  const ref = l.ultimo_status_change || lead.created_at;
  const ms = parseDateMs(ref);
  if (!ms) return 0;
  return Math.floor((Date.now() - ms) / 86400000);
}

function parseLeadDate(str?: string | null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) return new Date(str.replace(/(\.\d{3})\d+/, '$1'));
  if (/^\d{4}-\d{2}-\d{2} /.test(str)) return new Date(str.replace(' ', 'T').replace('+00:00', 'Z').replace(/(\.\d{3})\d+/, '$1'));
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) {
    const [, d, mo, y, h = '0', mi = '0'] = m;
    return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${mi.padStart(2,'0')}:00-03:00`);
  }
  return new Date(str.replace(/(\.\d{3})\d+/, '$1'));
}

function todayBR(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function subDays(dateStr: string, n: number): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().split('T')[0];
  } catch { return dateStr; }
}

function leadDateBR(str?: string | null): string {
  try {
    const d = parseLeadDate(str);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch { return ''; }
}

function filterByPeriod(items: Lead[], period: string, customFrom?: string, customTo?: string, getRef?: (l: Lead) => string | null | undefined): Lead[] {
  if (period === 'all') return items;
  const today = todayBR();
  const ok = (l: Lead, from: string, to: string) => { const d = leadDateBR(getRef ? getRef(l) : l.created_at); return !!d && d >= from && d <= to; };
  switch (period) {
    case 'today':     return items.filter(l => ok(l, today, today));
    case 'yesterday': { const y = subDays(today, 1); return items.filter(l => ok(l, y, y)); }
    case '7days':     return items.filter(l => ok(l, subDays(today, 6), today));
    case '30days':    return items.filter(l => ok(l, subDays(today, 29), today));
    case 'month':     return items.filter(l => ok(l, today.slice(0, 7) + '-01', today));
    case 'custom':    if (!customFrom || !customTo) return items; return items.filter(l => ok(l, customFrom, customTo));
    default: return items;
  }
}

function extractCampaignName(utmCampaign: string | null | undefined): string {
  if (!utmCampaign) return '';
  return String(utmCampaign).split('|')[0].trim();
}

// ── Filter Dropdown ───────────────────────────────────────────────────────────
function FilterDropdown({ value, options, onChange, dark }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];
  const border = dark ? '#27272a' : '#e5e7eb';
  const txtHi  = dark ? '#f4f4f5' : '#111827';
  const bg     = dark ? '#111113' : '#fff';
  const rowBg  = dark ? '#1a1a1e' : '#f9fafb';
  return (
    <div style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 10px', borderRadius:'9px', border:`1px solid ${border}`, background:bg, color:txtHi, fontSize:'12.5px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
      >
        {selected?.label}
        <ChevronDown style={{ width:'11px', height:'11px', color:dark?'#71717a':'#9ca3af', flexShrink:0, transform:open?'rotate(180deg)':'', transition:'transform 0.15s' }}/>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }}/>
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:41, background:bg, border:`1px solid ${border}`, borderRadius:'10px', minWidth:'140px', overflow:'hidden', boxShadow:dark?'0 8px 24px rgba(0,0,0,0.4)':'0 8px 24px rgba(0,0,0,0.12)', fontFamily:'inherit' }}>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ width:'100%', display:'block', textAlign:'left', padding:'8px 12px', border:'none', background:o.value===value?rowBg:bg, color:o.value===value?'#0044fd':txtHi, fontSize:'12.5px', cursor:'pointer', fontFamily:'inherit' }}
              >{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Campaign Filter Dropdown ──────────────────────────────────────────────────
function CampFilterDropdown({ dark, campaigns, pendingSelected, onToggle, onApply, onClear, onClose, align = 'left' }: {
  dark: boolean;
  campaigns: { name: string; count: number; isActive: boolean }[];
  pendingSelected: Set<string>;
  onToggle: (name: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const border  = dark ? '#27272a' : '#e5e7eb';
  const txtHi   = dark ? '#f4f4f5' : '#111827';
  const txtMid  = dark ? '#a0a0a8' : '#6b7280';
  const bg      = dark ? '#111113' : '#fff';
  const rowBg   = dark ? '#1a1a1e' : '#f9fafb';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const activeCamps   = campaigns.filter(c => c.isActive);
  const inactiveCamps = campaigns.filter(c => !c.isActive);
  const hasInactive   = inactiveCamps.length > 0;
  const q = search.trim().toLowerCase();
  const visibleActive   = activeCamps.filter(c => !q || c.name.toLowerCase().includes(q));
  const visibleInactive = inactiveCamps.filter(c => !q || c.name.toLowerCase().includes(q));
  const selectedLeadCount = campaigns.filter(c => pendingSelected.has(c.name)).reduce((s, c) => s + c.count, 0);
  const hasSelection = pendingSelected.size > 0;

  function CampRow({ camp }: { camp: { name: string; count: number; isActive: boolean } }) {
    const isSel = pendingSelected.has(camp.name);
    return (
      <button onClick={() => onToggle(camp.name)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'7px', border:'none', background:isSel?(dark?'rgba(0,68,253,0.1)':'#eff6ff'):'transparent', cursor:'pointer', textAlign:'left', fontFamily:'inherit', marginBottom:'1px' }}>
        <div style={{ width:'14px', height:'14px', borderRadius:'3px', border:`2px solid ${isSel?'#0044fd':(dark?'#3f3f46':'#d1d5db')}`, background:isSel?'#0044fd':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.1s' }}>
          {isSel && <Check style={{ width:'9px', height:'9px', color:'#fff' }}/>}
        </div>
        <span style={{ flex:1, fontSize:'12.5px', fontWeight:500, color:isSel?(dark?'#7ab0ff':'#0044fd'):txtHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'5px' }}>
          {hasInactive && camp.isActive && <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#10b981', flexShrink:0, display:'inline-block' }}/>}
          {camp.name || 'Sem campanha'}
        </span>
        <span style={{ fontSize:'11px', color:txtMid, background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)', padding:'1px 6px', borderRadius:'99px', flexShrink:0 }}>{camp.count}</span>
      </button>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:40 }} />
      <div onClick={e => e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 6px)', ...(align === 'right' ? { right:0 } : { left:0 }), zIndex:41, background:bg, border:`1px solid ${border}`, borderRadius:'12px', width:'264px', maxHeight:'370px', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:dark?'0 8px 24px rgba(0,0,0,0.4)':'0 8px 24px rgba(0,0,0,0.12)', fontFamily:'inherit' }}>
        <div style={{ padding:'8px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
          <div style={{ position:'relative' }}>
            <Search style={{ position:'absolute', left:'8px', top:'50%', transform:'translateY(-50%)', width:'12px', height:'12px', color:txtMid }}/>
            <input autoFocus placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:'100%', paddingLeft:'28px', paddingRight:'8px', paddingTop:'6px', paddingBottom:'6px', borderRadius:'7px', border:`1px solid ${border}`, background:rowBg, color:txtHi, fontSize:'12.5px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as any }}/>
          </div>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'6px' }}>
          {campaigns.length === 0 && <div style={{ textAlign:'center', padding:'20px 0', color:txtMid, fontSize:'12px' }}>Nenhuma campanha</div>}
          {visibleActive.map(camp => <CampRow key={camp.name} camp={camp} />)}
          {hasInactive && (
            <>
              <button onClick={() => setShowInactive(v => !v)} style={{ width:'100%', display:'flex', alignItems:'center', gap:'4px', padding:'5px 8px', borderRadius:'6px', border:'none', background:'transparent', cursor:'pointer', color:txtMid, fontSize:'11.5px', fontFamily:'inherit', textAlign:'left', marginTop:'2px' }}>
                <ChevronDown style={{ width:'11px', height:'11px', transform:showInactive?'rotate(180deg)':'rotate(0deg)', transition:'transform 0.15s' }}/>
                {showInactive ? 'Ocultar desativadas' : `Desativadas (${inactiveCamps.length})`}
              </button>
              {showInactive && visibleInactive.map(camp => <CampRow key={camp.name} camp={camp} />)}
            </>
          )}
        </div>
        <div style={{ padding:'7px 8px', borderTop:`1px solid ${border}`, display:'flex', gap:'6px', flexShrink:0 }}>
          <button onClick={onClear} style={{ padding:'5px 10px', borderRadius:'7px', border:`1px solid ${border}`, background:'transparent', color:txtMid, fontSize:'12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Limpar</button>
          <button onClick={onApply} style={{ flex:1, padding:'5px 10px', borderRadius:'7px', border:'none', background:'#0044fd', color:'#fff', fontSize:'12px', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            {hasSelection ? `Aplicar (${selectedLeadCount})` : 'Aplicar'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Score Tag ─────────────────────────────────────────────────
function ScoreTag({ score, faixa, dark }: { score?: number | null; faixa?: string | null; dark: boolean }) {
  if (score == null) return null;
  const isVerde = faixa === 'verde';
  const isAmarelo = faixa === 'amarelo';
  const color = isVerde ? '#10b981' : isAmarelo ? '#f59e0b' : '#6b7280';
  const bg = isVerde
    ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5')
    : isAmarelo ? (dark ? 'rgba(245,158,11,0.15)' : '#fef3c7')
    : (dark ? 'rgba(107,114,128,0.15)' : '#f3f4f6');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '99px', background: bg, border: `1px solid ${color}30`, flexShrink: 0 }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color }}>{score} pts</span>
    </div>
  );
}

// ── Modal Motivo ──────────────────────────────────────────────
function MotivoModal({ onConfirm, onCancel, dark, motivoAtual }: {
  onConfirm: (m: string) => void; onCancel: () => void; dark: boolean; motivoAtual?: string;
}) {
  const outroDefault = motivoAtual && !MOTIVOS.slice(0,-1).includes(motivoAtual) ? motivoAtual : '';
  const selectedDefault = motivoAtual ? (MOTIVOS.slice(0,-1).includes(motivoAtual) ? motivoAtual : 'Outro') : '';
  const [selected, setSelected] = useState(selectedDefault);
  const [outro, setOutro] = useState(outroDefault);
  const motivo = selected === 'Outro' ? outro.trim() : selected;
  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:999998, background:'rgba(0,0,0,0.55)' }} onClick={onCancel}/>
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:999999, background:dark?'#111113':'#fff', borderRadius:'18px', padding:'24px', width:'90%', maxWidth:'360px', boxShadow:dark?'0 24px 60px rgba(0,0,0,0.7)':'0 24px 60px rgba(0,0,0,0.18)', animation:'kmotivo 0.2s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(239,68,68,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'18px' }}>❌</div>
          <div>
            <h3 style={{ margin:0, fontSize:'15px', fontWeight:600, color:dark?'#fff':'#111827' }}>{motivoAtual ? 'Alterar motivo' : 'Motivo da reprovação'}</h3>
            <p style={{ margin:0, fontSize:'12px', color:dark?'#71717a':'#9ca3af' }}>Selecione o motivo para registrar</p>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px' }}>
          {MOTIVOS.map(m => (
            <button key={m} onClick={() => setSelected(m)} style={{ width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:'10px', border:`1px solid ${selected===m?'#ef4444':(dark?'#1e1e22':'#e5e7eb')}`, background:selected===m?(dark?'rgba(239,68,68,0.12)':'#fff1f2'):(dark?'rgba(255,255,255,0.02)':'#f9fafb'), color:selected===m?'#ef4444':(dark?'#d4d4d8':'#374151'), fontSize:'13px', fontWeight:selected===m?600:400, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s' }}>
              {m}{selected===m && <Check style={{ width:'14px', height:'14px', color:'#ef4444', flexShrink:0 }}/>}
            </button>
          ))}
        </div>
        {selected==='Outro' && <input autoFocus placeholder="Descreva o motivo..." value={outro} onChange={e=>setOutro(e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#1a1a1e':'#f9fafb', color:dark?'#f4f4f5':'#111827', fontSize:'13px', outline:'none', marginBottom:'12px', boxSizing:'border-box' as any }}/>}
        <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
          <button onClick={onCancel} style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:'transparent', color:dark?'#a1a1aa':'#6b7280', fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo} style={{ flex:1, padding:'10px', borderRadius:'10px', border:'none', background:motivo?'#ef4444':(dark?'#27272a':'#e5e7eb'), color:motivo?'#fff':(dark?'#52525b':'#9ca3af'), fontSize:'13px', fontWeight:600, cursor:motivo?'pointer':'default', transition:'all 0.15s' }}>Confirmar</button>
        </div>
      </div>
    </>
  );
}

// ── Obs Badge ─────────────────────────────────────────────────
function ObsBadge({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onPointerDown={e=>e.stopPropagation()} style={{ position:'relative', display:'inline-flex', alignItems:'center', flexShrink:0, zIndex: show ? 200 : 1 }}>
      <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:'#f59e0b', cursor:'default', background:'rgba(245,158,11,0.1)', padding:'2px 6px', borderRadius:'20px', fontWeight:500 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Obs
      </span>
      {show && (
        <div style={{ position:'fixed', transform:'translateX(-50%)', background:'#1f2937', color:'#f9fafb', fontSize:'12px', lineHeight:1.5, padding:'8px 12px', borderRadius:'9px', maxWidth:'220px', minWidth:'100px', whiteSpace:'pre-wrap', wordBreak:'break-word', zIndex:9999, boxShadow:'0 4px 16px rgba(0,0,0,0.35)', pointerEvents:'none', marginTop:'-60px' }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ── Draggable Card ────────────────────────────────────────────
function DraggableCard({ lead, onCardClick, onWhatsApp, onViewProfile, isMobile, leadTags }: {
  lead: Lead; onCardClick: ()=>void;
  onWhatsApp: (e:React.MouseEvent)=>void; onViewProfile: (e:React.MouseEvent)=>void; isMobile: boolean;
  leadTags?: Tag[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const { configuracoes } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const color = getAvatarColor(lead.nome, dark, lead.id);
  const statusNum = lead.status === null || lead.status === undefined ? 1 : Number(lead.status);
  const dias = getDias(lead);
  const showAlerta = statusNum === 2 && dias >= 3;
  const motivo = (lead as any).motivo_reprovacao as string | undefined;
  const l = lead as any;
  const score = l.score != null ? Number(l.score) : null;
  const faixa = calcularFaixa(lead, configuracoes!) ?? l.faixa;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onClick={isMobile ? undefined : onCardClick}
      style={{
        background: dark?'#222225':'#ffffff',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius:'14px', padding:'13px',
        boxShadow: isDragging
          ? (dark?'0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)':'0 12px 32px rgba(0,0,0,0.18)')
          : (dark?'0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)':'0 1px 3px rgba(0,0,0,0.07)'),
        cursor: isDragging?'grabbing':'grab',
        opacity: isDragging?0:1,
        touchAction: isMobile ? 'manipulation' : 'none',
        userSelect: 'none', WebkitUserSelect: 'none',
        transition:'box-shadow 0.2s, border-color 0.2s', outline:'none',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:getAvatarTextColor(color), fontSize:'12px', fontWeight:700 }}>{initials(lead.nome)}</div>
          {statusNum === 1 && !(lead as any).avaliado
            ? <div style={{ position:'absolute', top:'-1px', right:'-1px', width:'10px', height:'10px', borderRadius:'50%', background:'#3b82f6', border:`2px solid ${dark?'#111113':'#ffffff'}`, boxShadow:'0 0 0 1px #3b82f6', zIndex:2 }}/>
            : isMobile && faixa && faixa !== 'vermelho'
              ? <div style={{ position:'absolute', top:'-4px', right:'-4px', width:'12px', height:'12px', borderRadius:'50%', background: faixa==='verde'?'#10b981':'#f59e0b', border:`2px solid ${dark?'#111113':'#ffffff'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
              : null
          }
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'6px' }}>
            <p style={{ fontSize:'13.5px', fontWeight:600, color:dark?'#f0f0f0':'#111827', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{safeName(lead.nome)||'Lead sem nome'}</p>
            {score != null && (
              <span style={{ fontSize:'11px', fontWeight:700, color:faixa==='verde'?'#10b981':faixa==='amarelo'?'#f59e0b':'#ef4444', background:faixa==='verde'?'rgba(16,185,129,0.12)':faixa==='amarelo'?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)', padding:'2px 7px', borderRadius:'99px', flexShrink:0 }}>{score}pts</span>
            )}
          </div>
          <p style={{ fontSize:'12px', color:'#9ca3af', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'1px' }}>{lead.whatsapp?formatarWhatsapp(lead.whatsapp):'—'}</p>
        </div>
      </div>
      <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'6px', overflow:'hidden' }}>
        {lead.cidade && (
          <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:dark?'#9ca3af':'#6b7280', flex:1, minWidth:0, overflow:'hidden' }}>
            <MapPin style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.cidade}</span>
          </span>
        )}
        {showAlerta ? (
          <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:'#ef4444', flexShrink:0, whiteSpace:'nowrap' }}>
            <Clock style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>⚠️ {dias}d
          </span>
        ) : (
          <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:dark?'#9ca3af':'#6b7280', flexShrink:0, whiteSpace:'nowrap' }}>
            <Clock style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>{getRelativeTime(lead.created_at)}
          </span>
        )}
        {lead.observacoes && lead.observacoes.trim() && <ObsBadge text={lead.observacoes.trim()}/>}
      </div>
      {statusNum === 4 && motivo && (
        <div style={{ marginTop:'7px' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'99px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.2)', fontSize:'11px', color:'#ef4444', fontWeight:500, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✕ {motivo}</span>
        </div>
      )}
      {leadTags && leadTags.length > 0 && (
        <div style={{ marginTop:'7px', display:'flex', flexWrap:'wrap', gap:'4px' }}>
          {leadTags.slice(0, 2).map(tag => (
            <span key={tag.id} style={{ display:'inline-flex', alignItems:'center', padding:'1px 6px', borderRadius:'99px', fontSize:'10px', fontWeight:600, color:tag.cor, background:tag.cor+'20', border:`1px solid ${tag.cor}40`, whiteSpace:'nowrap' }}>{tag.nome}</span>
          ))}
          {leadTags.length > 2 && (
            <span title={leadTags.slice(2).map(t => t.nome).join(', ')} style={{ display:'inline-flex', alignItems:'center', padding:'1px 6px', borderRadius:'99px', fontSize:'10px', fontWeight:600, color:'#6b7280', background:'rgba(107,114,128,0.1)', border:'1px solid rgba(107,114,128,0.2)', cursor:'default' }}>+{leadTags.length - 2}</span>
          )}
        </div>
      )}
      <div style={{ marginTop:'10px', display:'flex', gap:'6px' }}>
        <button style={{ flex:1, padding:'6px 0', borderRadius:'8px', border:'none', background:dark?'rgba(16,163,74,0.15)':'#f0fdf4', color:dark?'#4ade80':'#16a34a', fontSize:'12px', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', transition:'background 0.15s' }} onPointerDown={e=>e.stopPropagation()} onClick={onWhatsApp} onMouseEnter={e=>(e.currentTarget.style.background=dark?'rgba(16,163,74,0.25)':'#dcfce7')} onMouseLeave={e=>(e.currentTarget.style.background=dark?'rgba(16,163,74,0.15)':'#f0fdf4')}>
          <MessageCircle style={{ width:'12px', height:'12px' }}/> WhatsApp
        </button>
        <button style={{ flex:1, padding:'6px 0', borderRadius:'8px', border:'none', background:dark?'rgba(255,255,255,0.05)':'#f8fafc', color:dark?'#cbd5e1':'#475569', fontSize:'12px', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', transition:'background 0.15s' }} onPointerDown={e=>e.stopPropagation()} onClick={onViewProfile} onMouseEnter={e=>(e.currentTarget.style.background=dark?'rgba(255,255,255,0.1)':'#f1f5f9')} onMouseLeave={e=>(e.currentTarget.style.background=dark?'rgba(255,255,255,0.05)':'#f8fafc')}>
          <Eye style={{ width:'12px', height:'12px' }}/> Perfil
        </button>
      </div>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────
function DroppableColumn({ col, children, count, isOver, isMobile }: {
  col: typeof COLUMNS[0]; children: React.ReactNode; count: number; isOver: boolean; isMobile: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: String(col.status) });
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <div style={{ display:'flex', flexDirection:'column', borderRadius:'16px', borderTopWidth:'3px', borderTopStyle:'solid', borderTopColor:col.border, borderRightWidth:'1px', borderRightStyle:'solid', borderRightColor:isOver?col.border:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.10)', borderBottomWidth:'1px', borderBottomStyle:'solid', borderBottomColor:isOver?col.border:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.10)', borderLeftWidth:'1px', borderLeftStyle:'solid', borderLeftColor:isOver?col.border:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.10)', background:dark?'#1b1b1d':'#fafafa', overflow:'hidden', boxShadow:isOver?`0 0 0 2px ${col.border}30`:dark?'0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)':'0 2px 8px rgba(0,0,0,0.06)', transition:'box-shadow 0.2s', width:isMobile?'calc(100vw - 48px)':'auto', minWidth:isMobile?'calc(100vw - 48px)':'auto', flexShrink:0, contain:'layout style', willChange:'transform' }}>
      <div style={{ padding:'12px 14px', borderBottom:`1px solid ${dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:dark?'#141416':'#ffffff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:col.dot, display:'inline-block' }}/>
          <span style={{ fontSize:'13px', fontWeight:600, color:dark?'#f4f4f5':'#1f2937', letterSpacing:'-0.01em' }}>{col.label}</span>
        </div>
        <span style={{ fontSize:'12px', fontWeight:500, color:col.dot, background:`${col.dot}18`, padding:'2px 8px', borderRadius:'20px' }}>{count}</span>
      </div>
      <div ref={setNodeRef} className="kanban-col-scroll" style={{ flex:1, padding:'10px', display:'flex', flexDirection:'column', gap:'8px', minHeight:'120px', maxHeight:isMobile?'calc(100vh - 260px)':'72vh', overflowY:'auto', WebkitOverflowScrolling:'touch', background:isOver?col.bg:'transparent', transition:'background 0.2s', overflowX:'hidden', contain:'layout style', willChange:'transform' }}>
        {children}
        {count===0 && <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', padding:'28px 0', textAlign:'center', borderRadius:'10px', border:`2px dashed ${isOver?col.dot:'rgba(0,0,0,0.1)'}`, color:isOver?col.dot:'#d1d5db', transition:'color 0.2s,border-color 0.2s' }}>{isOver?'Solte aqui':'Sem leads'}</div>}
      </div>
    </div>
  );
}

function OverlayCard({ lead }: { lead: Lead }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <div style={{ background:dark?'#18181b':'#ffffff', borderRadius:'14px', padding:'13px', boxShadow:'0 20px 50px rgba(0,0,0,0.2)', cursor:'grabbing', width:'260px', transform:'rotate(1.5deg) scale(1.02)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        {(()=>{ const ac=getAvatarColor(lead.nome, dark, lead.id); return <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:ac, display:'flex', alignItems:'center', justifyContent:'center', color:getAvatarTextColor(ac), fontSize:'12px', fontWeight:700 }}>{initials(lead.nome)}</div>; })()}
        <div>
          <p style={{ fontSize:'13.5px', fontWeight:600, color:dark?'#f4f4f5':'#111827', margin:0 }}>{lead.nome}</p>
          <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>{lead.whatsapp?formatarWhatsapp(lead.whatsapp):''}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function KanbanPage() {
  const { leads, setLeads, updateLead, campaigns: storeCampaigns, setCampaigns: setStoreCampaigns } = useAppStore();
  const { theme } = useTheme();
  const { orgId, ready: orgReady } = useOrgId();
  const navigate = useNavigate();
  const dark = theme === 'dark';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const { hasWA } = useWhatsAppAccount();
  const { metaToken, metaAccount } = useMetaConfig();

  // ── Filter state ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [orgTags, setOrgTags] = useState<Tag[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [pendingCampaigns, setPendingCampaigns] = useState<Set<string>>(new Set());
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [colLimits, setColLimits] = useState<Map<number, number>>(new Map());

  // ── Other state ───────────────────────────────────────────────
  const [leadTagsMap, setLeadTagsMap] = useState<Map<string, Tag[]>>(new Map());
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [motivoCtx, setMotivoCtx] = useState<{ lead: Lead; targetStatus: number; currentStatus: number } | null>(null);
  const orgTagsRef = useRef<Tag[]>([]);

  const handleWhatsApp = useCallback((lead: Lead) => {
    if (!lead.whatsapp) return;
    const clean = lead.whatsapp.replace(/\D/g, '');
    const phone = clean.startsWith('55') ? clean : `55${clean}`;
    if (hasWA) navigate(`/whatsapp?phone=${phone}`);
    else window.open(`https://wa.me/${phone}`, '_blank');
  }, [navigate, hasWA]);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );

  // ── Fetch all leads ──────────────────────────────────────────
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (!orgReady || !orgId) return;
    // Nunca resetar para [] — mantém dados anteriores durante refetch para evitar flash
    (async () => {
      let allData: Lead[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('leads')
          .select('id, nome, whatsapp, cidade, score, faixa, status, created_at, org_id, observacoes, motivo_reprovacao, ultimo_status_change, avaliado, utm_campaign, instagram')
          .eq('org_id', orgId)
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        allData = [...allData, ...data as unknown as Lead[]];
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setLeads(allData);
      isInitialLoadRef.current = false;
    })();
  }, [orgId, orgReady]); // eslint-disable-line

  // ── Fetch org tags ──────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: tagsData } = await (supabase as any).from('tags').select('id, nome, cor').eq('org_id', orgId);
      if (!tagsData?.length) { setLeadTagsMap(new Map()); orgTagsRef.current = []; setOrgTags([]); return; }
      orgTagsRef.current = tagsData as Tag[];
      setOrgTags(tagsData as Tag[]);
      const tagIds = (tagsData as any[]).map((t: any) => t.id);
      const { data: lt } = await (supabase as any).from('lead_tags').select('lead_id, tag_id').in('tag_id', tagIds);
      const tagById = new Map((tagsData as any[]).map((t: any) => [t.id, t]));
      const result = new Map<string, Tag[]>();
      for (const row of (lt || [])) {
        const tag = tagById.get(row.tag_id);
        if (!tag) continue;
        if (!result.has(row.lead_id)) result.set(row.lead_id, []);
        result.get(row.lead_id)!.push(tag as Tag);
      }
      setLeadTagsMap(result);
    })();
  }, [orgId]); // eslint-disable-line

  // ── Realtime: lead_tags changes ──────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const ch = (supabase as any).channel(`lead-tags-kanban-${orgId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_tags' }, (p: any) => {
        const { lead_id, tag_id } = p.new;
        const tag = orgTagsRef.current.find((t: Tag) => t.id === tag_id);
        if (!tag) return;
        setLeadTagsMap(prev => {
          const next = new Map(prev);
          const existing = next.get(lead_id) || [];
          if (existing.find((t: Tag) => t.id === tag_id)) return prev;
          next.set(lead_id, [...existing, tag]);
          return next;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lead_tags' }, (p: any) => {
        const { lead_id, tag_id } = p.old;
        setLeadTagsMap(prev => {
          const next = new Map(prev);
          const existing = next.get(lead_id);
          if (!existing) return prev;
          const updated = existing.filter((t: Tag) => t.id !== tag_id);
          if (updated.length === 0) next.delete(lead_id);
          else next.set(lead_id, updated);
          return next;
        });
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [orgId]); // eslint-disable-line

  // ── Realtime: leads (com debounce 300ms) ────────────────────
  const lastRtUpdate = useRef(0);
  useEffect(() => {
    if (!orgReady || !orgId) return;
    const ch = supabase.channel(`kanban-rt-${orgId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},(p)=>{ useAppStore.getState().addLead(p.new as unknown as Lead); })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},(p)=>{
        const now = Date.now();
        if (now - lastRtUpdate.current < 300) return;
        lastRtUpdate.current = now;
        useAppStore.getState().updateLead((p.new as unknown as Lead).id, p.new as unknown as Lead);
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'leads'},(p)=>{ const c=useAppStore.getState().leads; useAppStore.getState().setLeads(c.filter(l=>l.id!==(p.old as {id:string}).id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, orgReady]); // eslint-disable-line

  // ── Meta Ads campaign statuses ───────────────────────────────
  useEffect(() => {
    if (!metaToken || !metaAccount) return;
    const normId = metaAccount.startsWith('act_') ? metaAccount : `act_${metaAccount}`;
    const url = `https://graph.facebook.com/v18.0/${normId}/campaigns?fields=id,name,status&limit=100&access_token=${metaToken}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data?.data) {
          setStoreCampaigns(data.data.map((c: any) => ({
            id: c.id, name: c.name, status: c.status,
            objective: '', budget: 0, budget_type: 'daily',
            spend: 0, impressions: 0, clicks: 0, ctr: 0, cpm: 0, roas: 0, leads_api: 0, reach: 0,
          })));
        }
      })
      .catch(() => {});
  }, [metaToken, metaAccount]); // eslint-disable-line

  // ── Reset col limits on filter change ────────────────────────
  useEffect(() => {
    setColLimits(new Map());
  }, [search, periodFilter, customFrom, customTo, selectedTagIds, selectedCampaigns]);

  // ── Lock scroll when any filter open ────────────────────────
  useEffect(() => {
    document.body.style.overflow = (showTagFilter || showCampaignModal) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showTagFilter, showCampaignModal]);

  // ── Filtered leads ───────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    let list = leads;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(l => (l.nome || '').toLowerCase().includes(q) || (l.whatsapp || '').includes(q));
    list = filterByPeriod(list, periodFilter, customFrom, customTo, l => (l as any).ultimo_status_change || l.created_at);
    if (selectedTagIds.size > 0) {
      list = list.filter(l => {
        const tags = leadTagsMap.get(l.id) || [];
        return Array.from(selectedTagIds).some(tid => tags.some(t => t.id === tid));
      });
    }
    if (selectedCampaigns.size > 0) {
      list = list.filter(l => selectedCampaigns.has(extractCampaignName((l as any).utm_campaign)));
    }
    return list;
  }, [leads, search, periodFilter, customFrom, customTo, selectedTagIds, selectedCampaigns, leadTagsMap]);

  // ── Campaign options ─────────────────────────────────────────
  const campaignOptions = useMemo(() => {
    const countMap = new Map<string, number>();
    filteredLeads.forEach(l => {
      const name = extractCampaignName((l as any).utm_campaign);
      if (name) countMap.set(name, (countMap.get(name) || 0) + 1);
    });
    const entries = Array.from(countMap.entries());
    if (storeCampaigns.length === 0) {
      return entries.map(([name, count]) => ({ name, count, isActive: true })).sort((a, b) => b.count - a.count);
    }
    const metaByName = new Map(storeCampaigns.map(c => [c.name, c]));
    return entries
      .map(([name, count]) => {
        const meta = metaByName.get(name);
        return { name, count, isActive: meta ? meta.status === 'ACTIVE' : false };
      })
      .sort((a, b) => { if (a.isActive !== b.isActive) return a.isActive ? -1 : 1; return b.count - a.count; });
  }, [filteredLeads, storeCampaigns]);

  const hasActiveFilters = search.trim() || periodFilter !== 'all' || selectedTagIds.size > 0 || selectedCampaigns.size > 0;

  // ── Column leads memoizado (7 filter+sort por render → 1 vez) ──
  const colLeadsMap = useMemo(() => {
    const map = new Map<number, Lead[]>();
    for (const col of COLUMNS) {
      const leads = filteredLeads
        .filter(l => {
          let s = l.status === null || l.status === undefined ? 1 : Number(l.status);
          if (s === 0) s = 1;
          return s === col.status;
        })
        .sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at));
      map.set(col.status, leads);
    }
    return map;
  }, [filteredLeads]);

  // ── Column helpers ───────────────────────────────────────────
  function getColLeads(status: number): Lead[] {
    return colLeadsMap.get(status) || [];
  }

  function scrollToCol(index: number) {
    if (!scrollRef.current) return;
    const col = scrollRef.current.children[index] as HTMLElement;
    if (col) col.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'start' });
    setActiveColIndex(index);
  }

  useEffect(() => {
    if (!isMobile || !scrollRef.current) return;
    const el = scrollRef.current;
    const fn = () => setActiveColIndex(Math.min(Math.round(el.scrollLeft / el.clientWidth), COLUMNS.length-1));
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [isMobile]);

  // ── Status change ────────────────────────────────────────────
  async function applyStatus(lead: Lead, newStatus: number, currentStatus: number, motivo?: string) {
    const now = new Date().toISOString();
    const tsField: Record<number, string> = { 0: 'status_atendimento_at', 1: 'status_atendimento_at', 2: 'status_reuniao_at', 5: 'status_contrato_at', 3: 'status_aprovado_at', 6: 'status_sem_retorno_at' };
    const patch: any = { status: newStatus, ultimo_status_change: now };
    if (tsField[newStatus]) patch[tsField[newStatus]] = now;
    if (motivo !== undefined) patch.motivo_reprovacao = motivo;
    updateLead(lead.id, patch);
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id);
    if (error) { updateLead(lead.id, { status: currentStatus }); toast.error('Erro ao mover lead'); }
    else { const col = COLUMNS.find(c => c.status === newStatus); toast.success(`${lead.nome} → ${col?.label}`, { duration: 2500 }); }
  }

  function handleDragStart(e: DragStartEvent) {
    const lead = leads.find(l => l.id === e.active.id);
    if (lead) setActiveLead(lead);
    document.body.classList.add('dragging');
    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';
  }

  function handleDragEnd(e: DragEndEvent) {
    document.body.classList.remove('dragging');
    document.body.style.userSelect = '';
    (document.body.style as any).webkitUserSelect = '';
    const { active, over } = e;
    setActiveLead(null); setOverColId(null);
    if (!over) return;
    const leadId = active.id as string;
    const targetStatus = parseInt(over.id as string);
    if (isNaN(targetStatus)) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    let currentStatus = lead.status === null || lead.status === undefined ? 1 : Number(lead.status);
    if (currentStatus === 0) currentStatus = 1;
    if (currentStatus === targetStatus) return;
    if (targetStatus === 4) { setMotivoCtx({ lead, targetStatus, currentStatus }); }
    else { applyStatus(lead, targetStatus, currentStatus); }
  }

  async function handleMotivoConfirm(motivo: string) {
    if (!motivoCtx) return;
    const { lead, targetStatus, currentStatus } = motivoCtx;
    setMotivoCtx(null);
    await applyStatus(lead, targetStatus, currentStatus, motivo);
  }

  function clearFilters() {
    setSearch(''); setPeriodFilter('all'); setCustomFrom(''); setCustomTo('');
    setShowCustom(false); setSelectedTagIds(new Set()); setSelectedCampaigns(new Set());
  }

  const bg = dark ? '#0f0f10' : '#f4f4f5';
  const inputStyle: React.CSSProperties = { padding:'7px 10px', borderRadius:'9px', border:`1px solid ${dark ? 'rgba(255,255,255,0.1)' : border}`, background:dark?'#0f0f10':'#fff', color:dark?'#f0f0f0':'#111827', fontSize:'12.5px', outline:'none', fontFamily:'inherit' };
  const btnGhost: React.CSSProperties = { display:'flex', alignItems:'center', gap:'5px', padding:'7px 10px', borderRadius:'9px', border:`1px solid ${dark ? 'rgba(255,255,255,0.1)' : border}`, background:dark?'#1b1b1d':'#fff', color:dark?'#a0a0a8':'#374151', fontSize:'12.5px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' };

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding:isMobile?'16px 16px 24px':'32px 32px 40px', background:bg, minHeight:'100vh' }}>

        {/* Header + inline filter bar */}
        <div style={{ marginBottom:'16px' }}>
          {/* Row 1: title + realtime */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <h1 style={{ fontSize:isMobile?'22px':'26px', fontWeight:800, fontFamily:'Inter, sans-serif', color:dark?'#f0f0f0':'#111827', margin:0, letterSpacing:'-0.035em' }}>Funil CRM</h1>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:dark?'#8a8a96':'#9ca3af' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'kpulse 2s ease-in-out infinite' }}/>Tempo real
            </div>
          </div>

          {/* Row 2: filters inline (no box) */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {/* Search - expands to fill available space */}
            <div style={{ position:'relative', flex:'1 1 160px', minWidth:'140px' }}>
              <Search style={{ position:'absolute', left:'8px', top:'50%', transform:'translateY(-50%)', width:'13px', height:'13px', color:dark?'#71717a':'#9ca3af', pointerEvents:'none' }}/>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar lead..."
                style={{ ...inputStyle, width:'100%', paddingLeft:'28px', boxSizing:'border-box' }}
              />
            </div>

            {/* Period */}
            <FilterDropdown value={periodFilter} options={PERIOD_OPTIONS} onChange={v => { setPeriodFilter(v); if (v === 'custom') setShowCustom(true); else { setShowCustom(false); setCustomFrom(''); setCustomTo(''); }}} dark={dark}/>

            {/* Custom date range */}
            {showCustom && (
              <>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle}/>
                <span style={{ color:dark?'#52525b':'#9ca3af', fontSize:'12px' }}>até</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle}/>
              </>
            )}

            {/* Campaign filter */}
            <div style={{ position:'relative' }}>
              <button
                onClick={() => { setPendingCampaigns(new Set(selectedCampaigns)); setShowCampaignModal(v => !v); }}
                style={{ ...btnGhost, border:`1px solid ${selectedCampaigns.size > 0 ? '#0044fd' : border}`, background:selectedCampaigns.size > 0 ? (dark?'rgba(0,68,253,0.12)':'#eff6ff') : (dark?'#111113':'#fff'), color:selectedCampaigns.size > 0 ? (dark?'#7ab0ff':'#0044fd') : (dark?'#d4d4d8':'#374151') }}
              >
                <Megaphone style={{ width:'12px', height:'12px' }}/>
                Campanhas {selectedCampaigns.size > 0 && <span style={{ background:'#0044fd', color:'#fff', borderRadius:'99px', padding:'0px 5px', fontSize:'11px', fontWeight:700 }}>{selectedCampaigns.size}</span>}
              </button>
              {showCampaignModal && (
                <CampFilterDropdown
                  dark={dark}
                  campaigns={campaignOptions}
                  pendingSelected={pendingCampaigns}
                  onToggle={name => { const n = new Set(pendingCampaigns); if (n.has(name)) n.delete(name); else n.add(name); setPendingCampaigns(n); }}
                  onApply={() => { setSelectedCampaigns(new Set(pendingCampaigns)); setShowCampaignModal(false); }}
                  onClear={() => { setPendingCampaigns(new Set()); }}
                  onClose={() => setShowCampaignModal(false)}
                  align="right"
                />
              )}
            </div>

            {/* Tag filter */}
            {orgTags.length > 0 && (
              <div style={{ position:'relative' }}>
                <button
                  onClick={() => setShowTagFilter(v => !v)}
                  style={{ ...btnGhost, border:`1px solid ${selectedTagIds.size > 0 ? '#8b5cf6' : border}`, background:selectedTagIds.size > 0 ? (dark?'rgba(139,92,246,0.12)':'#f5f3ff') : (dark?'#111113':'#fff'), color:selectedTagIds.size > 0 ? (dark?'#c4b5fd':'#7c3aed') : (dark?'#d4d4d8':'#374151') }}
                >
                  <TagIcon style={{ width:'12px', height:'12px' }}/>
                  Tags {selectedTagIds.size > 0 && <span style={{ background:'#8b5cf6', color:'#fff', borderRadius:'99px', padding:'0px 5px', fontSize:'11px', fontWeight:700 }}>{selectedTagIds.size}</span>}
                </button>
                {showTagFilter && (
                  <>
                    <div onClick={() => setShowTagFilter(false)} style={{ position:'fixed', inset:0, zIndex:40 }} />
                    <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:41, background:dark?'#111113':'#fff', border:`1px solid ${border}`, borderRadius:'12px', padding:'8px', minWidth:'180px', boxShadow:dark?'0 8px 24px rgba(0,0,0,0.4)':'0 8px 24px rgba(0,0,0,0.12)' }}>
                      {orgTags.map(tag => {
                        const sel = selectedTagIds.has(tag.id);
                        return (
                          <button key={tag.id} onClick={() => { const n = new Set(selectedTagIds); if (sel) n.delete(tag.id); else n.add(tag.id); setSelectedTagIds(n); }}
                            style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', borderRadius:'7px', border:'none', background:sel?(dark?`${tag.cor}18`:`${tag.cor}12`):'transparent', cursor:'pointer', fontFamily:'inherit', marginBottom:'2px' }}
                          >
                            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:tag.cor, flexShrink:0 }}/>
                            <span style={{ flex:1, fontSize:'12.5px', color:sel?tag.cor:(dark?'#f4f4f5':'#111827'), fontWeight:sel?600:400, textAlign:'left' }}>{tag.nome}</span>
                            {sel && <Check style={{ width:'11px', height:'11px', color:tag.cor, flexShrink:0 }}/>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Clear all */}
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ ...btnGhost, color:dark?'#f87171':'#ef4444', borderColor:'rgba(239,68,68,0.3)', background:dark?'rgba(239,68,68,0.08)':'rgba(239,68,68,0.05)' }}>
                <X style={{ width:'12px', height:'12px' }}/> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav dots */}
        {isMobile && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
              <button onClick={() => scrollToCol(Math.max(0, activeColIndex-1))} disabled={activeColIndex===0} style={{ width:'32px', height:'32px', borderRadius:'8px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#111113':'#fff', color:dark?'#a1a1aa':'#374151', cursor:activeColIndex===0?'default':'pointer', opacity:activeColIndex===0?0.3:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ChevronLeft style={{ width:'16px', height:'16px' }}/>
              </button>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                {COLUMNS.map((col,i) => <button key={i} onClick={() => scrollToCol(i)} style={{ width:i===activeColIndex?'24px':'7px', height:'7px', borderRadius:'99px', border:'none', background:i===activeColIndex?col.dot:(dark?'#27272a':'#d1d5db'), cursor:'pointer', padding:0, transition:'all 0.2s ease' }}/>)}
              </div>
              <button onClick={() => scrollToCol(Math.min(COLUMNS.length-1, activeColIndex+1))} disabled={activeColIndex===COLUMNS.length-1} style={{ width:'32px', height:'32px', borderRadius:'8px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#111113':'#fff', color:dark?'#a1a1aa':'#374151', cursor:activeColIndex===COLUMNS.length-1?'default':'pointer', opacity:activeColIndex===COLUMNS.length-1?0.3:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ChevronRight style={{ width:'16px', height:'16px' }}/>
              </button>
            </div>
            <div style={{ textAlign:'center', marginBottom:'10px' }}>
              <span style={{ fontSize:'13px', fontWeight:600, color:COLUMNS[activeColIndex].dot }}>{COLUMNS[activeColIndex].label}</span>
              <span style={{ fontSize:'12px', color:dark?'#8a8a96':'#9ca3af', marginLeft:'6px' }}>({getColLeads(COLUMNS[activeColIndex].status).length} leads)</span>
            </div>
          </>
        )}

        {/* Kanban board */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={e=>setOverColId(e.over?.id?String(e.over.id):null)} onDragEnd={handleDragEnd} onDragCancel={()=>{setActiveLead(null);setOverColId(null);}}>
          {isMobile ? (
            <div ref={scrollRef} className="kanban-mobile" style={{ display:'flex', gap:'12px', overflowX:'auto', overflowY:'hidden', scrollSnapType: activeLead ? 'none' : 'x mandatory', scrollBehavior: activeLead ? 'auto' : 'smooth', WebkitOverflowScrolling:'touch', paddingBottom:'8px', msOverflowStyle:'none', scrollbarWidth:'none' }}>
              {COLUMNS.map(col => {
                const colLeads = getColLeads(col.status);
                const limit = colLimits.get(col.status) || COL_PAGE;
                const visibleLeads = colLeads.slice(0, limit);
                const remaining = colLeads.length - limit;
                return (
                  <div key={col.status} style={{ scrollSnapAlign:'start', flexShrink:0, width:'calc(100vw - 48px)' }}>
                    <DroppableColumn col={col} count={colLeads.length} isOver={overColId===String(col.status)} isMobile={true}>
                      {visibleLeads.map(lead => (
                        <DraggableCard key={lead.id} lead={lead} isMobile={true}
                          onCardClick={() => setViewingLead(lead)}
                          onWhatsApp={e => { e.stopPropagation(); handleWhatsApp(lead); }}
                          onViewProfile={e => { e.stopPropagation(); setViewingLead(lead); }}
                          leadTags={leadTagsMap.get(lead.id)}
                        />
                      ))}
                      {remaining > 0 && (
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => setColLimits(prev => { const n = new Map(prev); n.set(col.status, limit + COL_PAGE); return n; })}
                          style={{ width:'100%', padding:'8px', borderRadius:'9px', border:`1px dashed ${dark?'#3f3f46':'#d1d5db'}`, background:'transparent', color:dark?'#71717a':'#9ca3af', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}
                        >
                          Ver mais {remaining} leads
                        </button>
                      )}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="kanban-desktop" style={{ display:'flex', gap:'14px', alignItems:'start', overflowX:'auto', paddingBottom:'12px', minWidth:0 }}>
              {COLUMNS.map(col => {
                const colLeads = getColLeads(col.status);
                const limit = colLimits.get(col.status) || COL_PAGE;
                const visibleLeads = colLeads.slice(0, limit);
                const remaining = colLeads.length - limit;
                return (
                  <div key={col.status} style={{ flex:'0 0 260px', minWidth:'220px' }}>
                    <DroppableColumn col={col} count={colLeads.length} isOver={overColId===String(col.status)} isMobile={false}>
                      {visibleLeads.map(lead => (
                        <DraggableCard key={lead.id} lead={lead} isMobile={false}
                          onCardClick={() => setViewingLead(lead)}
                          onWhatsApp={e => { e.stopPropagation(); handleWhatsApp(lead); }}
                          onViewProfile={e => { e.stopPropagation(); setViewingLead(lead); }}
                          leadTags={leadTagsMap.get(lead.id)}
                        />
                      ))}
                      {remaining > 0 && (
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => setColLimits(prev => { const n = new Map(prev); n.set(col.status, limit + COL_PAGE); return n; })}
                          style={{ width:'100%', padding:'8px', borderRadius:'9px', border:`1px dashed ${dark?'#3f3f46':'#d1d5db'}`, background:'transparent', color:dark?'#71717a':'#9ca3af', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}
                        >
                          Ver mais {remaining} leads
                        </button>
                      )}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          )}
          <DragOverlay dropAnimation={{ duration:180, easing:'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeLead ? <OverlayCard lead={activeLead}/> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {motivoCtx && createPortal(
        <MotivoModal dark={dark} motivoAtual={(motivoCtx.lead as any).motivo_reprovacao} onConfirm={handleMotivoConfirm} onCancel={() => setMotivoCtx(null)}/>,
        document.body
      )}

      <LeadDrawer lead={viewingLead} isOpen={!!viewingLead} onClose={() => setViewingLead(null)}
        onUpdate={updated => { updateLead(updated.id, updated); setViewingLead(updated); }}
        onTagsChange={(leadId, tags) => setLeadTagsMap(prev => { const next = new Map(prev); if (tags.length === 0) next.delete(leadId); else next.set(leadId, tags); return next; })}
      />

      <style>{`
        @keyframes kpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        body.dragging * { transition: none !important; }
        body.dragging { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }
        @keyframes kmotivo { from{opacity:0;transform:translate(-50%,-48%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        .kanban-col-scroll::-webkit-scrollbar { display: none; }
        .kanban-mobile::-webkit-scrollbar { display: none; }
        .kanban-desktop { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
        .kanban-desktop::-webkit-scrollbar { height: 6px; }
        .kanban-desktop::-webkit-scrollbar-track { background: transparent; }
        .kanban-desktop::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </AppLayout>
  );
}
