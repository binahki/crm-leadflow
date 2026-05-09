import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, calcularFaixa } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, MoreVertical, Eye, Trash2, Clock, MapPin, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getRelativeTime } from '@/utils/relativeTime';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';

const COLUMNS = [
  { status: 1, label: 'Em atendimento', border: '#3b82f6', dot: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
  { status: 2, label: 'Reunião',        border: '#8b5cf6', dot: '#8b5cf6', bg: 'rgba(139,92,246,0.06)'  },
  { status: 5, label: 'Contrato/App',  border: '#f59e0b', dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
  { status: 3, label: 'Aprovado',       border: '#10b981', dot: '#10b981', bg: 'rgba(16,185,129,0.06)' },
  { status: 4, label: 'Reprovado',      border: '#ef4444', dot: '#ef4444', bg: 'rgba(239,68,68,0.06)'   },
];

const MOTIVOS = ['Sem retorno','Fora de SP','Nome sujo','Sem reserva','Não compareceu à reunião','Desistiu','Outro'];
const AVATAR_COLORS = ['#f43f5e','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#ec4899','#8b5cf6'];

function avatarColor(name: string) { return !name ? AVATAR_COLORS[0] : AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function initials(name: string) { if (!name) return '?'; return name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase(); }

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
function DraggableCard({ lead, onCardClick, onMenuClick, onWhatsApp, onViewProfile, isMobile }: {
  lead: Lead; onCardClick: ()=>void; onMenuClick: (e:React.MouseEvent)=>void;
  onWhatsApp: (e:React.MouseEvent)=>void; onViewProfile: (e:React.MouseEvent)=>void; isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const color = avatarColor(lead.nome);
  const statusNum = lead.status === null || lead.status === undefined ? 1 : Number(lead.status);
  const dias = getDias(lead);
  const showAlerta = statusNum === 2 && dias >= 3;
  const motivo = (lead as any).motivo_reprovacao as string | undefined;
  const l = lead as any;
  const score = l.score != null ? Number(l.score) : null;
  const faixa = l.faixa || null;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onClick={isMobile ? undefined : onCardClick}
      style={{
        background: dark?'#111113':'#ffffff',
        border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.15)'}`,
        borderRadius:'14px', padding:'13px',
        boxShadow: isDragging
          ? (dark?'0 12px 32px rgba(0,0,0,0.5)':'0 12px 32px rgba(0,0,0,0.18)')
          : (dark?'0 1px 4px rgba(0,0,0,0.4)':'0 2px 8px rgba(0,0,0,0.08)'),
        cursor: isDragging?'grabbing':'grab',
        opacity: isDragging?0:1,
        touchAction: isMobile ? 'manipulation' : 'none',
        userSelect: 'none', WebkitUserSelect: 'none',
        transition:'box-shadow 0.2s, border-color 0.2s', outline:'none',
      }}
    >
      {/* Header: avatar + nome + score (desktop) + menu */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
          {/* Avatar — bolinha de faixa SÓ no mobile */}
          <div style={{ position:'relative', flexShrink:0 }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'12px', fontWeight:700 }}>{initials(lead.nome)}</div>
            {isMobile && faixa && faixa !== 'vermelho' && (
              <div style={{ position:'absolute', top:'-4px', right:'-4px', width:'12px', height:'12px', borderRadius:'50%', background: faixa==='verde'?'#10b981':'#f59e0b', border:`2px solid ${dark?'#111113':'#ffffff'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
            )}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            {/* Nome + score tag lado a lado no desktop */}
            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
              <p style={{ fontSize:'13.5px', fontWeight:600, color:dark?'#f4f4f5':'#111827', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{lead.nome||'Lead sem nome'}</p>
              {!isMobile && <ScoreTag score={score} faixa={faixa} dark={dark} />}
            </div>
            <p style={{ fontSize:'12px', color:'#9ca3af', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'1px' }}>{lead.whatsapp||'—'}</p>
          </div>
        </div>
        <button style={{ padding:'4px', color:'#d1d5db', border:'none', background:'transparent', borderRadius:'7px', cursor:'pointer', flexShrink:0, opacity:isMobile?1:0, transition:'opacity 0.15s', display:'flex', alignItems:'center', justifyContent:'center' }} className="card-menu-btn" onPointerDown={e=>e.stopPropagation()} onClick={onMenuClick}>
          <MoreVertical style={{ width:'15px', height:'15px' }}/>
        </button>
      </div>

      {/* Cidade + tempo + obs + alerta */}
      <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
        {lead.cidade && <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:dark?'#9ca3af':'#6b7280' }}><MapPin style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>{lead.cidade}</span>}
        {showAlerta ? (
          <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:'#ef4444' }}>
            <Clock style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>⚠️ {dias}d sem contato
          </span>
        ) : (
          <span style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'11.5px', color:dark?'#9ca3af':'#6b7280' }}>
            <Clock style={{ width:'11px', height:'11px', strokeWidth:1.8, flexShrink:0 }}/>{getRelativeTime(lead.created_at)}
          </span>
        )}
        {lead.observacoes && lead.observacoes.trim() && <ObsBadge text={lead.observacoes.trim()}/>}
      </div>

      {/* Motivo reprovação */}
      {statusNum === 4 && motivo && (
        <div style={{ marginTop:'7px', padding:'4px 8px', borderRadius:'7px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', display:'inline-flex', alignItems:'center', gap:'4px' }}>
          <span style={{ fontSize:'11.5px', color:'#ef4444', fontWeight:500 }}>❌ {motivo}</span>
        </div>
      )}

      {/* Botões */}
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
    <div style={{ display:'flex', flexDirection:'column', borderRadius:'16px', borderTopWidth:'3px', borderTopStyle:'solid', borderTopColor:col.border, borderRightWidth:'1px', borderRightStyle:'solid', borderRightColor:isOver?col.border:dark?'#1e1e22':'rgba(0,0,0,0.10)', borderBottomWidth:'1px', borderBottomStyle:'solid', borderBottomColor:isOver?col.border:dark?'#1e1e22':'rgba(0,0,0,0.10)', borderLeftWidth:'1px', borderLeftStyle:'solid', borderLeftColor:isOver?col.border:dark?'#1e1e22':'rgba(0,0,0,0.10)', background:dark?'#111113':'#fafafa', overflow:'hidden', boxShadow:isOver?`0 0 0 2px ${col.border}30`:dark?'0 4px 12px rgba(0,0,0,0.4)':'0 2px 8px rgba(0,0,0,0.08)', transition:'box-shadow 0.2s', width:isMobile?'calc(100vw - 48px)':'auto', minWidth:isMobile?'calc(100vw - 48px)':'auto', flexShrink:0 }}>
      <div style={{ padding:'12px 14px', borderBottom:`1px solid ${dark?'#1e1e22':'rgba(0,0,0,0.05)'}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:dark?'#18181b':'#ffffff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:col.dot, display:'inline-block' }}/>
          <span style={{ fontSize:'13px', fontWeight:600, color:dark?'#f4f4f5':'#1f2937', letterSpacing:'-0.01em' }}>{col.label}</span>
        </div>
        <span style={{ fontSize:'12px', fontWeight:500, color:col.dot, background:`${col.dot}18`, padding:'2px 8px', borderRadius:'20px' }}>{count}</span>
      </div>
      <div ref={setNodeRef} className="kanban-col-scroll" style={{ flex:1, padding:'10px', display:'flex', flexDirection:'column', gap:'8px', minHeight:'120px', maxHeight:isMobile?'calc(100vh - 260px)':'72vh', overflowY:'auto', WebkitOverflowScrolling:'touch', background:isOver?col.bg:'transparent', transition:'background 0.2s', overflowX:'hidden' }}>
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
        <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:avatarColor(lead.nome), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'12px', fontWeight:700 }}>{initials(lead.nome)}</div>
        <div>
          <p style={{ fontSize:'13.5px', fontWeight:600, color:dark?'#f4f4f5':'#111827', margin:0 }}>{lead.nome}</p>
          <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>{lead.whatsapp}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function KanbanPage() {
  const { leads, setLeads, updateLead } = useAppStore();
  const { theme } = useTheme();
  const { orgId, ready: orgReady } = useOrgId();
  const dark = theme === 'dark';
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [menuLead, setMenuLead] = useState<Lead | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [motivoCtx, setMotivoCtx] = useState<{ lead: Lead; targetStatus: number; currentStatus: number } | null>(null);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );

  useEffect(() => {
    if (!orgReady) return;
    setLeads([]);
    let q = supabase.from('leads').select('*');
    if (orgId) q = q.eq('org_id', orgId);
    q.then(({ data }) => { if (data) setLeads(data as unknown as Lead[]); });
  }, [orgId, orgReady]); // eslint-disable-line

  useEffect(() => {
    if (!orgReady || !orgId) return;
    const ch = supabase.channel(`kanban-rt-${orgId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},(p)=>{ useAppStore.getState().addLead(p.new as unknown as Lead); })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},(p)=>{ useAppStore.getState().updateLead((p.new as unknown as Lead).id, p.new as unknown as Lead); })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'leads'},(p)=>{ const c=useAppStore.getState().leads; useAppStore.getState().setLeads(c.filter(l=>l.id!==(p.old as {id:string}).id)); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, orgReady]); // eslint-disable-line

  useEffect(() => {
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuLead(null); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

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

  function getColLeads(status: number): Lead[] {
    return [...leads.filter(l => { let s = l.status === null || l.status === undefined ? 1 : Number(l.status); if (s === 0) s = 1; return s === status; })].sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at));
  }

  async function applyStatus(lead: Lead, newStatus: number, currentStatus: number, motivo?: string) {
    const patch: any = { status: newStatus, ultimo_status_change: new Date().toISOString() };
    if (motivo !== undefined) patch.motivo_reprovacao = motivo;
    updateLead(lead.id, patch);
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id);
    if (error) { updateLead(lead.id, { status: currentStatus }); toast.error('Erro ao mover lead'); }
    else { const col = COLUMNS.find(c => c.status === newStatus); toast.success(`${lead.nome} → ${col?.label}`, { duration: 2500 }); }
  }

  function handleDragStart(e: DragStartEvent) {
    const lead = leads.find(l => l.id === e.active.id);
    if (lead) setActiveLead(lead);
    setMenuLead(null);
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

  function handleMenuMove(lead: Lead, newStatus: number) {
    setMenuLead(null);
    let currentStatus = Number(lead.status ?? 1);
    if (currentStatus === 0) currentStatus = 1;
    if (newStatus === 4) { setMotivoCtx({ lead, targetStatus: newStatus, currentStatus }); }
    else if (currentStatus !== newStatus) { applyStatus(lead, newStatus, currentStatus); }
  }

  async function handleMotivoConfirm(motivo: string) {
    if (!motivoCtx) return;
    const { lead, targetStatus, currentStatus } = motivoCtx;
    setMotivoCtx(null);
    await applyStatus(lead, targetStatus, currentStatus, motivo);
  }

  async function deleteLead(lead: Lead) {
    setMenuLead(null);
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) toast.error('Erro ao excluir lead');
    else { setLeads(leads.filter(l => l.id !== lead.id)); toast.success('Lead removido'); }
  }

  const bg = dark ? '#090909' : '#f4f4f5';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding:isMobile?'16px 16px 24px':'32px 32px 40px', background:bg, minHeight:'100vh' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <h1 style={{ fontSize:isMobile?'20px':'22px', fontWeight:700, color:dark?'#f4f4f5':'#111827', margin:0, letterSpacing:'-0.03em' }}>Funil CRM</h1>
            {!isMobile && <p style={{ fontSize:'13px', color:dark?'#a1a1aa':'#9ca3af', marginTop:'3px' }}>Arraste os cards para atualizar o status · Clique para ver o perfil</p>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:dark?'#71717a':'#9ca3af' }}>
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'kpulse 2s ease-in-out infinite' }}/>Tempo real
          </div>
        </div>

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
              <span style={{ fontSize:'12px', color:dark?'#52525b':'#9ca3af', marginLeft:'6px' }}>({getColLeads(COLUMNS[activeColIndex].status).length} leads)</span>
            </div>
          </>
        )}

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={e=>setOverColId(e.over?.id?String(e.over.id):null)} onDragEnd={handleDragEnd} onDragCancel={()=>{setActiveLead(null);setOverColId(null);}}>
          {isMobile ? (
            <div ref={scrollRef} className="kanban-mobile" style={{ display:'flex', gap:'12px', overflowX:'auto', overflowY:'hidden', scrollSnapType: activeLead ? 'none' : 'x mandatory', scrollBehavior: activeLead ? 'auto' : 'smooth', WebkitOverflowScrolling:'touch', paddingBottom:'8px', msOverflowStyle:'none', scrollbarWidth:'none' }}>
              {COLUMNS.map(col => {
                const colLeads = getColLeads(col.status);
                return (
                  <div key={col.status} style={{ scrollSnapAlign:'start', flexShrink:0, width:'calc(100vw - 48px)' }}>
                    <DroppableColumn col={col} count={colLeads.length} isOver={overColId===String(col.status)} isMobile={true}>
                      {colLeads.map(lead => (
                        <DraggableCard key={lead.id} lead={lead} isMobile={true}
                          onCardClick={() => setViewingLead(lead)}
                          onMenuClick={e => { e.stopPropagation(); setMenuLead(lead); setMenuPos({ x:e.clientX, y:e.clientY }); }}
                          onWhatsApp={e => { e.stopPropagation(); window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`, '_blank'); }}
                          onViewProfile={e => { e.stopPropagation(); setViewingLead(lead); }}
                        />
                      ))}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="kanban-desktop" style={{ display:'flex', gap:'14px', alignItems:'start', overflowX:'auto', paddingBottom:'12px', minWidth:0 }}>
              {COLUMNS.map(col => {
                const colLeads = getColLeads(col.status);
                return (
                  <div key={col.status} style={{ flex:'0 0 260px', minWidth:'220px' }}>
                    <DroppableColumn col={col} count={colLeads.length} isOver={overColId===String(col.status)} isMobile={false}>
                      {colLeads.map(lead => (
                        <DraggableCard key={lead.id} lead={lead} isMobile={false}
                          onCardClick={() => setViewingLead(lead)}
                          onMenuClick={e => { e.stopPropagation(); setMenuLead(lead); setMenuPos({ x:e.clientX, y:e.clientY }); }}
                          onWhatsApp={e => { e.stopPropagation(); window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`, '_blank'); }}
                          onViewProfile={e => { e.stopPropagation(); setViewingLead(lead); }}
                        />
                      ))}
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

      {menuLead && (
        <div ref={menuRef} style={{ position:'fixed', zIndex:60, left:Math.min(menuPos.x, window.innerWidth-224), top:Math.min(menuPos.y, window.innerHeight-320), background:dark?'#111113':'#ffffff', border:`1px solid ${dark?'#1e1e22':'rgba(0,0,0,0.08)'}`, borderRadius:'13px', boxShadow:dark?'0 12px 48px rgba(0,0,0,0.6)':'0 8px 32px rgba(0,0,0,0.12)', padding:'6px', minWidth:'215px', animation:'kmenu 0.15s cubic-bezier(0.32,0.72,0,1)' }}>
          <div style={{ padding:'4px 10px 6px', fontSize:'10.5px', fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em' }}>Mover para</div>
          {COLUMNS.map(col => {
            const currentSt = Number(menuLead.status ?? 1);
            const isCurrent = currentSt === col.status;
            const canEditMotivo = isCurrent && col.status === 4;
            return (
              <button key={col.status} onClick={() => handleMenuMove(menuLead, col.status)} disabled={isCurrent && col.status !== 4}
                style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'8px', border:'none', background:'transparent', cursor:(isCurrent && col.status !== 4)?'default':'pointer', color:(isCurrent && col.status !== 4)?(dark?'#3f3f46':'#d1d5db'):(dark?'#d4d4d8':'#374151'), fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.12s' }}
                onMouseEnter={e=>{ if (!isCurrent || canEditMotivo) (e.currentTarget.style.background=dark?'rgba(255,255,255,0.04)':'#f8fafc'); }}
                onMouseLeave={e=>{ (e.currentTarget.style.background='transparent'); }}
              >
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:(isCurrent&&!canEditMotivo)?(dark?'#27272a':'#e5e7eb'):col.dot, flexShrink:0, display:'inline-block' }}/>{col.label}
                {isCurrent && !canEditMotivo && <span style={{ marginLeft:'auto', fontSize:'11px', color:dark?'#3f3f46':'#d1d5db' }}>atual</span>}
                {canEditMotivo && <span style={{ marginLeft:'auto', fontSize:'11px', color:'#ef4444' }}>editar motivo</span>}
              </button>
            );
          })}
          <div style={{ height:'1px', background:dark?'#1e1e22':'rgba(0,0,0,0.06)', margin:'4px 0' }}/>
          <button onClick={() => { setViewingLead(menuLead); setMenuLead(null); }} style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'8px', border:'none', background:'transparent', cursor:'pointer', color:dark?'#d4d4d8':'#374151', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.12s' }} onMouseEnter={e=>(e.currentTarget.style.background=dark?'rgba(255,255,255,0.04)':'#f8fafc')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            <Eye style={{ width:'14px', height:'14px', color:dark?'#71717a':'#6b7280' }}/> Ver perfil completo
          </button>
          <button onClick={() => { window.open(`https://wa.me/${menuLead.whatsapp?.replace(/\D/g,'')}`, '_blank'); setMenuLead(null); }} style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'8px', border:'none', background:'transparent', cursor:'pointer', color:dark?'#d4d4d8':'#374151', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.12s' }} onMouseEnter={e=>(e.currentTarget.style.background=dark?'rgba(255,255,255,0.04)':'#f8fafc')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            <MessageCircle style={{ width:'14px', height:'14px', color:dark?'#71717a':'#6b7280' }}/> Abrir WhatsApp
          </button>
          <div style={{ height:'1px', background:dark?'#1e1e22':'rgba(0,0,0,0.06)', margin:'4px 0' }}/>
          <button onClick={() => deleteLead(menuLead)} style={{ width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'8px', border:'none', background:'transparent', cursor:'pointer', color:'#dc2626', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.12s' }} onMouseEnter={e=>(e.currentTarget.style.background='#fff1f2')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            <Trash2 style={{ width:'14px', height:'14px' }}/> Excluir lead
          </button>
        </div>
      )}

      {motivoCtx && createPortal(
        <MotivoModal dark={dark} motivoAtual={(motivoCtx.lead as any).motivo_reprovacao} onConfirm={handleMotivoConfirm} onCancel={() => setMotivoCtx(null)}/>,
        document.body
      )}

      <LeadDrawer lead={viewingLead} isOpen={!!viewingLead} onClose={() => setViewingLead(null)}
        onUpdate={updated => { updateLead(updated.id, updated); setViewingLead(updated); }}
      />

      <style>{`
        @keyframes kpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        body.dragging * { transition: none !important; }
        body.dragging { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }
        @keyframes kmenu { from{opacity:0;transform:scale(0.94) translateY(-4px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes kmotivo { from{opacity:0;transform:translate(-50%,-48%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        div:hover > div > .card-menu-btn { opacity: 1 !important; }
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
