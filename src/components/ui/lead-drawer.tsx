import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lead, useAppStore, calcularFaixa, STATUS_CONFIG } from '@/stores/appStore';
import { useWhatsAppAccount } from '@/hooks/useWhatsAppAccount';
import { supabase } from '@/integrations/supabase/client';
import {
  X, MapPin, Phone, Clock, Briefcase,
  ChevronDown, Check, AlertTriangle, Megaphone, Save, Instagram,
  MessageCircle, Monitor,
} from 'lucide-react';
import { useTags, Tag, CORES_TAGS } from '@/hooks/useTags';
import { toast } from 'sonner';
import { getRelativeTime, formatarWhatsapp } from '@/utils/relativeTime';
import { getAvatarColor, getAvatarTextColor } from '@/utils/avatarColor';
import { useTheme } from '@/hooks/useTheme';
import { useNavigate } from 'react-router-dom';
import { useOrgId } from '@/hooks/useOrgId';

interface LeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (lead: Lead) => void;
  onTagsChange?: (leadId: string, tags: Tag[]) => void;
}

const STATUS_SEQUENCE = [1, 2, 5, 3, 6, 4];

const STATUS = STATUS_SEQUENCE.map(idx => {
  const s = STATUS_CONFIG[idx];
  return {
    id: idx,
    label: s.label,
    color: s.dot,
    bg: s.lightBg,
    text: s.lightText,
    border: s.lightBg,
    darkBg: s.darkBg,
    darkText: s.darkText
  };
});

const MOTIVOS = ['Desistiu', 'Região não atendida', 'Perfil não elegível', 'Nome sujo', 'Sem reserva', 'Não compareceu à reunião', 'Outro'];


const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

// ── Quiz respostas dinâmico ───────────────────────────────────
const CAMPOS_IGNORADOS = new Set([
  'nome', 'whatsapp', 'telefone', 'cidade', 'score', 'status', 'email',
  'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'brid', 'code', 'ip', 'platform', 'wa_sent', 'created_at', 'id',
  'tracking', 'responses', 'button', 'clicked',
]);
const STRIP_PREFIXES = ['voce_', 'qual_sua_', 'quanto_gostaria_de_'];

function deveIgnorar(chave: string, valor: unknown, isInternalQuiz: boolean = false): boolean {
  const c = chave.toLowerCase();
  if (CAMPOS_IGNORADOS.has(c)) return true;
  if (/^\d+$/.test(chave)) return true;
  // Ignora qualquer chave que comece com score, responses. ou tracking.
  if (c.startsWith('score') || c.startsWith('responses.') || c.startsWith('tracking.')) return true;
  // IDs técnicos da Inlead: exatamente 6 chars alfanuméricos
  if (/^[a-zA-Z0-9]{6}$/.test(chave)) return true;
  if (c.endsWith('_at') || c.endsWith('_id')) return true;
  if (valor === 'clicked' || valor === 'loaded') return true;
  // Valores nulos/vazios
  if (valor === null || valor === undefined || valor === '') return true;
  const str = String(valor);
  if (!isInternalQuiz) {
    // Letra maiúscula solta (A, B, C, D…) — código de opção
    if (/^[A-Z]$/.test(str)) return true;
    // Número solto de um dígito (0–9) — índice de opção
    if (/^[0-9]$/.test(str)) return true;
    // Strings de resposta encodada (ex: "1|2|*")
    if (/^[\d|*\s]+$/.test(str)) return true;
  }
  if (str.startsWith('http')) return true;
  // Valores muito longos (fbclid, userAgent, etc)
  if (str.length > 200) return true;
  return false;
}

function formatKey(key: string): string {
  let s = key.toLowerCase()
    .replace(/voce_|qual_|seu_|sua_|como_|onde_|quando_|para_|quem_|por_que_|em_qual_|por_|me_conte_|sobre_|pode_nos_|diga_|quais_|qual_e_|voce_ja_|ja_|quanto_|o_que_|quao_/g, '')
    .replace(/_/g, ' ')
    .trim();
  if (!s) return key;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function initials(name: string) { if (!name) return '?'; return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase(); }
function cleanCampaignName(raw?: string | null) { if (!raw) return null; return raw.replace(/\|\d+$/, '').trim(); }

function ScoreTag({ score, faixa, dark }: { score?: number | null; faixa?: string | null; dark: boolean }) {
  if (score == null || score === undefined) return null;
  const isVerde = faixa === 'verde';
  const isAmarelo = faixa === 'amarelo';
  const color = isVerde ? '#10b981' : isAmarelo ? '#f59e0b' : '#ef4444';
  const bg = isVerde ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : isAmarelo ? (dark ? 'rgba(245,158,11,0.15)' : '#fef3c7') : (dark ? 'rgba(239,68,68,0.15)' : '#fee2e2');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '6px', background: bg, border: `1px solid ${color}30` }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '12px', fontWeight: 800, color, fontFamily: FONT }}>{score} pts</span>
    </div>
  );
}

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function Section({ icon, title, children, openKey, activeKey, setActiveKey, dark, iconColor }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
  openKey: string; activeKey: string | null; setActiveKey: (k: string | null) => void; dark: boolean;
  iconColor?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const open = activeKey === openKey;
  useEffect(() => { if (contentRef.current) setHeight(open ? contentRef.current.scrollHeight : 0); }, [open, children]);
  return (
    <div style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
      <button onClick={() => setActiveKey(open ? null : openKey)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, WebkitTapHighlightColor: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: iconColor || (dark ? '#52525b' : '#9ca3af'), display: 'flex', alignItems: 'center' }}>{icon}</span>
          <span style={{ fontSize: '13.5px', fontWeight: 500, color: dark ? '#f4f4f5' : '#1f2937', fontFamily: FONT }}>{title}</span>
        </div>
        <ChevronDown style={{ width: '14px', height: '14px', color: '#d1d5db', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }} />
      </button>
      <div style={{ height: `${height}px`, overflow: 'hidden', transition: 'height 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        <div ref={contentRef} style={{ paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, dark }: { label: string; value?: string | null; dark: boolean }) {
  const display = (!value || String(value).trim() === '' || value === 'false') ? '—' : String(value);
  return (
    <div style={{ marginBottom: '4px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: dark ? '#52525b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px', fontFamily: FONT }}>{label}</p>
      <p style={{ fontSize: '14.5px', color: display === '—' ? (dark ? '#3f3f46' : '#d1d5db') : (dark ? '#a1a1aa' : '#4b5563'), fontWeight: 500, lineHeight: 1.5, fontFamily: FONT, margin: 0 }}>{display}</p>
    </div>
  );
}

// DeleteConfirm removed

function MotivoModal({ onConfirm, onCancel, dark, motivoAtual }: { onConfirm: (m: string) => void; onCancel: () => void; dark: boolean; motivoAtual?: string }) {
  const outroDefault = motivoAtual && !MOTIVOS.slice(0, -1).includes(motivoAtual) ? motivoAtual : '';
  const selectedDefault = motivoAtual ? (MOTIVOS.slice(0, -1).includes(motivoAtual) ? motivoAtual : 'Outro') : '';
  const [selected, setSelected] = useState(selectedDefault);
  const [outro, setOutro] = useState(outroDefault);
  const motivo = selected === 'Outro' ? outro.trim() : selected;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'rgba(0,0,0,0.55)' }} onClick={onCancel} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 999999, background: dark ? '#111113' : '#fff', borderRadius: '18px', padding: '24px', width: '90%', maxWidth: '360px', boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.7)' : '0 24px 60px rgba(0,0,0,0.18)', fontFamily: FONT, animation: 'ld-up 0.2s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>❌</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: dark ? '#fff' : '#111827' }}>{motivoAtual ? 'Alterar motivo' : 'Motivo da reprovação'}</h3>
            <p style={{ margin: 0, fontSize: '12px', color: dark ? '#71717a' : '#9ca3af' }}>Selecione o motivo para registrar</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {MOTIVOS.map(m => (
            <button key={m} onClick={() => setSelected(m)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${selected === m ? '#ef4444' : (dark ? '#1e1e22' : '#e5e7eb')}`, background: selected === m ? (dark ? 'rgba(239,68,68,0.12)' : '#fff1f2') : (dark ? 'rgba(255,255,255,0.02)' : '#f9fafb'), color: selected === m ? '#ef4444' : (dark ? '#d4d4d8' : '#374151'), fontSize: '13px', fontWeight: selected === m ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s', fontFamily: FONT }}>
              {m}{selected === m && <Check style={{ width: '14px', height: '14px', color: '#ef4444', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
        {selected === 'Outro' && <input autoFocus placeholder="Descreva o motivo..." value={outro} onChange={e => setOutro(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f9fafb', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as any, fontFamily: FONT }} />}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>Cancelar</button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: motivo ? '#ef4444' : (dark ? '#27272a' : '#e5e7eb'), color: motivo ? '#fff' : (dark ? '#52525b' : '#9ca3af'), fontSize: '13px', fontWeight: 600, cursor: motivo ? 'pointer' : 'default', transition: 'all 0.15s', fontFamily: FONT }}>Confirmar</button>
        </div>
      </div>
    </>
  );
}

export function LeadDrawer({ lead, isOpen, onClose, onUpdate, onTagsChange }: LeadDrawerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { updateLead, configuracoes } = useAppStore();
  const { orgId } = useOrgId();
  const { hasWA } = useWhatsAppAccount();
  const navigate = useNavigate();

  const handleWhatsApp = useCallback(() => {
    if (!lead || !lead.whatsapp) return;
    const clean = lead.whatsapp.replace(/\D/g, '');
    const phone = clean.startsWith('55') ? clean : `55${clean}`;
    
    if (hasWA) {
      navigate(`/whatsapp?phone=${phone}`);
    } else {
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  }, [lead, navigate, hasWA]);

  const [fullLead, setFullLead] = useState<any>(null);
  const [fullLeadLoading, setFullLeadLoading] = useState(false);

  useEffect(() => {
    if (!lead?.id) {
      setFullLead(null);
      setFullLeadLoading(false);
      return;
    }
    setFullLead(lead);
    setFullLeadLoading(true);

    async function fetchFullLead() {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('id', lead.id)
          .single();
        if (data) {
          setFullLead(data);
        }
      } catch (err) {
        console.error('Erro ao buscar lead completo:', err);
      } finally {
        setFullLeadLoading(false);
      }
    }
    fetchFullLead();
  }, [lead?.id]);

  const [avaliado, setAvaliado] = useState(false);
  const [obs, setObs] = useState('');
  const [status, setStatus] = useState(1);
  const [saving, setSaving] = useState(false);
  const [obsChanged, setObsChanged] = useState(false);
  const [showMotivo, setShowMotivo] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [exitingTags, setExitingTags] = useState<Tag[]>([]);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [statusDropPos, setStatusDropPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const [perguntasOrdenadas, setPerguntasOrdenadas] = useState<Array<{ ordem: number; texto: string }>>([]);

  // ── Tags ──────────────────────────────────────────────────────
  const { tags: orgTags, createTag: createOrgTag, updateTag: updateOrgTag, deleteTag: deleteOrgTag } = useTags(orgId);
  const [leadTags, setLeadTags] = useState<Tag[]>([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagManager, setShowTagManager] = useState(false);
  const [mgr_editId, setMgrEditId] = useState<string | null>(null);
  const [mgr_editNome, setMgrEditNome] = useState('');
  const [mgr_editCor, setMgrEditCor] = useState('');
  const [mgr_deleteId, setMgrDeleteId] = useState<string | null>(null);
  const [mgr_newNome, setMgrNewNome] = useState('');
  const [mgr_newCor, setMgrNewCor] = useState(CORES_TAGS[0]);
  const [mgr_creating, setMgrCreating] = useState(false);

  useEffect(() => {
    const raw = fullLead?.quiz_respostas || (lead as any)?.quiz_respostas;
    if (!raw) return;
    
    async function loadQuizOrder() {
      const respostas = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!respostas || typeof respostas !== 'object') return;
      const perguntasTextos = Object.keys(respostas as Record<string, unknown>);
      if (perguntasTextos.length === 0) return;

      const oId = orgId || fullLead?.org_id || lead?.org_id;
      if (!oId) {
        setPerguntasOrdenadas(
          perguntasTextos.map(texto => ({ ordem: 0, texto }))
        );
        return;
      }

      try {
        let quizIds: string[] = [];

        const { data: sessao } = await supabase
          .from('quiz_sessoes')
          .select('quiz_slug')
          .eq('lead_id', lead.id)
          .maybeSingle();

        if (sessao?.quiz_slug) {
          const { data: quiz } = await supabase
            .from('quizzes')
            .select('id')
            .eq('slug', sessao.quiz_slug)
            .eq('org_id', oId)
            .maybeSingle();
          if (quiz?.id) {
            quizIds = [quiz.id];
          }
        }

        if (quizIds.length === 0) {
          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('id')
            .eq('org_id', oId)
            .order('ativo', { ascending: false });
          if (quizzes && quizzes.length > 0) {
            quizIds = quizzes.map(q => q.id);
          }
        }

        if (quizIds.length === 0) {
          throw new Error('Nenhum quiz encontrado');
        }

        const { data: blocos, error: bErr } = await supabase
          .from('quiz_blocos')
          .select('id, ordem')
          .in('quiz_id', quizIds);

        if (bErr || !blocos || blocos.length === 0) {
          throw new Error('Nenhum bloco encontrado');
        }

        const blocoIds = blocos.map(b => b.id);
        const { data: perguntas, error: pErr } = await supabase
          .from('quiz_perguntas')
          .select('texto, ordem, bloco_id')
          .in('bloco_id', blocoIds);

        if (pErr || !perguntas || perguntas.length === 0) {
          throw new Error('Nenhuma pergunta encontrada');
        }

        const blocoMap = new Map(blocos.map(b => [b.id, b.ordem]));
        
        const filtradasEOrdenadas = perguntas
          .filter(p => perguntasTextos.includes(p.texto))
          .map(p => ({
            texto: p.texto,
            ordem: (blocoMap.get(p.bloco_id) || 0) * 1000 + p.ordem
          }))
          .sort((a, b) => a.ordem - b.ordem);

        const textosMapeados = new Set(filtradasEOrdenadas.map(f => f.texto));
        const naoMapeadas = perguntasTextos
          .filter(texto => !textosMapeados.has(texto))
          .map(texto => ({ ordem: 999999, texto }));

        setPerguntasOrdenadas([...filtradasEOrdenadas, ...naoMapeadas]);
      } catch (err) {
        console.error('Erro ao carregar ordenação das perguntas:', err);
        setPerguntasOrdenadas(
          perguntasTextos.map(texto => ({ ordem: 0, texto }))
        );
      }
    }
    loadQuizOrder();
  }, [lead?.id, orgId, fullLead?.quiz_respostas, lead?.quiz_respostas, fullLead?.org_id, lead?.org_id]);

  useEffect(() => {
    if (lead) setAvaliado(!!(lead as any).avaliado);
  }, [lead?.id, (lead as any)?.avaliado]);

  useEffect(() => {
    if (lead) {
      setObs(lead.observacoes || '');
      let s = lead.status === null || lead.status === undefined ? 1 : Number(lead.status);
      if (s === 0) s = 1;
      setStatus(s);
      setObsChanged(false);
      setShowMotivo(false);
      setPendingStatus(null);
      setActiveSection(null);
      setStatusOpen(false);
    }
  }, [lead?.id]);

  useEffect(() => {
    if (!lead?.id) { setLeadTags([]); return; }
    (supabase as any)
      .from('lead_tags')
      .select('tag_id, tags(id, org_id, nome, cor, created_at)')
      .eq('lead_id', lead.id)
      .then(({ data }: any) => {
        setLeadTags((data || []).map((r: any) => r.tags).filter(Boolean));
      });
  }, [lead?.id]); // eslint-disable-line

  async function applyStatus(newStatus: number, motivo?: string) {
    if (!lead) return;
    const prev = status;
    setStatus(newStatus);
    setAvaliado(true);
    const now = new Date().toISOString();
    const tsField: Record<number, string> = { 0: 'status_atendimento_at', 1: 'status_atendimento_at', 2: 'status_reuniao_at', 5: 'status_contrato_at', 3: 'status_aprovado_at', 6: 'status_sem_retorno_at' };
    const updates: any = { status: String(newStatus), avaliado: true, ultimo_status_change: now };
    if (tsField[newStatus]) updates[tsField[newStatus]] = now;
    if (motivo) updates.motivo_reprovacao = motivo;
    if (newStatus === 6) updates.motivo_reprovacao = null;
    const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
    if (error) { setStatus(prev); setAvaliado(avaliado); toast.error('Erro ao atualizar status'); }
    else { setStatusOpen(false); onUpdate({ ...lead, status: newStatus, avaliado: true, ...(motivo ? { motivo_reprovacao: motivo } : {}) }); toast.success(STATUS.find(s => s.id === newStatus)?.label || 'Atualizado'); }
  }

  function handleStatus(i: number) {
    if (!lead) return;
    if (i === 4) { setPendingStatus(4); setShowMotivo(true); return; }
    if (i === 6) { applyStatus(6); return; }
    if (status === i) return;
    applyStatus(i);
  }

  async function handleMotivoConfirm(motivo: string) {
    setShowMotivo(false);
    if (pendingStatus !== null) { await applyStatus(pendingStatus, motivo); setPendingStatus(null); }
  }

  async function handleSaveObs() {
    if (!lead || !obsChanged) return;
    setSaving(true);
    const { error } = await supabase.from('leads').update({ observacoes: obs }).eq('id', lead.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar observação');
    else { onUpdate({ ...lead, observacoes: obs }); setObsChanged(false); toast.success('Observação salva!'); }
  }

  // handleDelete removed

  async function addLeadTag(tagId: string) {
    if (!lead) return;
    const tag = orgTags.find(t => t.id === tagId);
    if (!tag || leadTags.find(t => t.id === tagId)) return;
    const next = [...leadTags, tag];
    setLeadTags(next);
    onTagsChange?.(lead.id, next);
    const { error } = await (supabase as any).from('lead_tags').upsert({ lead_id: lead.id, tag_id: tagId }, { onConflict: 'lead_id,tag_id' });
    if (error) {
      toast.error('Erro ao adicionar tag');
      setLeadTags(prev => prev.filter(t => t.id !== tagId));
      onTagsChange?.(lead.id, leadTags);
    }
  }

  async function removeLeadTag(tagId: string) {
    if (!lead) return;
    const tag = leadTags.find(t => t.id === tagId);
    // Remove imediatamente do estado (functional form para evitar stale closure)
    setLeadTags(prev => prev.filter(t => t.id !== tagId));
    const next = leadTags.filter(t => t.id !== tagId);
    onTagsChange?.(lead.id, next);
    // Animação de saída — puramente visual, separada do estado
    if (tag) {
      setExitingTags(prev => [...prev, tag]);
      setTimeout(() => setExitingTags(prev => prev.filter(t => t.id !== tagId)), 160);
    }
    const { error } = await (supabase as any).from('lead_tags').delete().eq('lead_id', lead.id).eq('tag_id', tagId);
    if (error) {
      toast.error('Erro ao remover tag');
      if (tag) { setLeadTags(prev => [...prev, tag]); onTagsChange?.(lead.id, [...next, tag]); }
    }
  }

  function handleStatusOpen() {
    if (statusBtnRef.current) {
      const r = statusBtnRef.current.getBoundingClientRect();
      setStatusDropPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
    }
    setStatusOpen(v => !v);
  }

  async function handleMgrCreate() {
    if (!mgr_newNome.trim()) return;
    setMgrCreating(true);
    await createOrgTag(mgr_newNome.trim(), mgr_newCor);
    setMgrNewNome(''); setMgrNewCor(CORES_TAGS[0]);
    setMgrCreating(false);
  }

  async function handleMgrSaveEdit() {
    if (!mgr_editId || !mgr_editNome.trim()) return;
    await updateOrgTag(mgr_editId, { nome: mgr_editNome.trim(), cor: mgr_editCor });
    setLeadTags(prev => prev.map(t => t.id === mgr_editId ? { ...t, nome: mgr_editNome.trim(), cor: mgr_editCor } : t));
    setMgrEditId(null);
  }

  async function handleMgrDelete() {
    if (!mgr_deleteId) return;
    await deleteOrgTag(mgr_deleteId);
    setLeadTags(prev => prev.filter(t => t.id !== mgr_deleteId));
    setMgrDeleteId(null);
  }

  if (!isOpen || !lead) return null;

  const avatarCor = getAvatarColor(lead.nome, dark, lead.id);
  const avatarText = getAvatarTextColor(avatarCor);
  const l = { ...fullLead, ...lead } as any;
  const hasTraffic = l.utm_source || l.utm_campaign || l.utm_medium;
  const score = l.score != null ? Number(l.score) : null;
  const faixa = calcularFaixa(lead, configuracoes!) || l.faixa || null;
  const instagramValue = String(l?.instagram || '').trim();

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'ld-fade 0.18s ease' }} />
      {showMotivo && createPortal(
        <MotivoModal onConfirm={handleMotivoConfirm} onCancel={() => { setShowMotivo(false); setPendingStatus(null); }} dark={dark} motivoAtual={lead.motivo_reprovacao} />,
        document.body
      )}

      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '92%', maxWidth: '480px', minHeight: '320px', maxHeight: '90vh', zIndex: 51, fontFamily: FONT, animation: 'ld-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)', borderRadius: '22px', background: dark ? 'rgba(20,20,22,0.97)' : 'rgba(255,255,255,0.94)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', boxShadow: dark ? '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)' : '0 24px 80px rgba(0,0,0,0.13), 0 0 0 1px rgba(255,255,255,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '22px 22px 16px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', width: '26px', height: '26px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')} onMouseLeave={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)')}>
            <X style={{ width: '12px', height: '12px', color: dark ? '#6b6b75' : '#6b7280' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginRight: '36px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: avatarCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: avatarText, boxShadow: `0 4px 14px ${avatarCor}60`, fontFamily: FONT }}>
                {initials(lead.nome)}
              </div>
              {status === 1 && !avaliado && (
                <div style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#0044fd', color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', boxShadow: '0 2px 8px rgba(0,68,253,0.4)', zIndex: 10, whiteSpace: 'nowrap' }}>
                  Novo
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: dark ? '#f0f0f0' : '#111827', letterSpacing: '-0.022em', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT }}>{lead.nome}</h2>
                <ScoreTag score={score} faixa={faixa} dark={dark} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
                {lead.cidade && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#6b6b75' : '#6b7280', fontFamily: FONT }}><MapPin style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{lead.cidade}</span>}
                {lead.whatsapp && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#6b6b75' : '#6b7280', fontFamily: FONT }}><Phone style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{formatarWhatsapp(lead.whatsapp)}</span>}
                {/* Instagram + horário sempre na mesma linha */}
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {instagramValue && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#6b6b75' : '#6b7280', fontFamily: FONT }}><Instagram style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{instagramValue}</span>}
                  {lead.created_at && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: dark ? '#6b6b75' : '#b0b7c3', fontFamily: FONT }}><Clock style={{ width: '11px', height: '11px', strokeWidth: 1.8 }} />{getRelativeTime(lead.created_at)}</span>}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Linha 1: Avaliado (esquerda) + Status (direita) */}
        <div style={{ padding: '10px 22px', flexShrink: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '8px' }}>

          {/* Checkbox avaliado */}
          <div
            onClick={async (e) => {
              e.stopPropagation();
              if (!lead) return;
              const novoValor = !avaliado;
              const { error } = await supabase.from('leads').update({ avaliado: novoValor }).eq('id', lead.id);
              if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
              setAvaliado(novoValor);
              onUpdate({ ...lead, avaliado: novoValor });
            }}
            style={{ flex: isMobile ? 'none' : 1, padding: '9px 12px', borderRadius: '8px', background: avaliado ? (dark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'), border: `1px solid ${avaliado ? 'rgba(16,185,129,0.3)' : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`, display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <div style={{ width: '15px', height: '15px', borderRadius: '4px', border: `2px solid ${avaliado ? '#10b981' : (dark ? '#6b6b75' : '#d4d4d8')}`, background: avaliado ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
              {avaliado && <Check size={9} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: avaliado ? '#10b981' : (dark ? '#6b6b75' : '#9ca3af'), fontFamily: FONT, whiteSpace: 'nowrap' }}>
              {avaliado ? 'Perfil avaliado' : 'Marcar como avaliado'}
            </span>
          </div>

          {/* Status select */}
          {(() => {
            const s = STATUS.find(s => s.id === status);
            return (
              <button
                ref={statusBtnRef}
                onClick={handleStatusOpen}
                style={{ flexShrink: 0, width: isMobile ? '100%' : '178px', display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${s ? (dark ? 'rgba(255,255,255,0.1)' : s.border) : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`, background: s ? (dark ? s.darkBg : s.bg) : 'transparent', cursor: 'pointer', fontFamily: FONT, transition: 'opacity 0.15s', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {s && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600, color: s ? (dark ? s.darkText : s.text) : (dark ? '#71717a' : '#6b7280') }}>{s?.label}</span>
                <ChevronDown style={{ width: '13px', height: '13px', color: s ? (dark ? s.darkText : s.text) : (dark ? '#52525b' : '#9ca3af'), transform: statusOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)', flexShrink: 0, opacity: 0.7 }} />
              </button>
            );
          })()}
        </div>

        {status === 4 && lead.motivo_reprovacao && (
          <div style={{ margin: '0 22px 8px', padding: '6px 10px', borderRadius: '7px', background: dark ? 'rgba(239,68,68,0.08)' : '#fff1f2', border: `1px solid ${dark ? 'rgba(239,68,68,0.2)' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 500, fontFamily: FONT }}>Motivo:</span>
            <span style={{ fontSize: '11.5px', color: dark ? '#f87171' : '#dc2626', fontFamily: FONT }}>{lead.motivo_reprovacao}</span>
          </div>
        )}

        <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Linha 2: Tags */}
        <div style={{ padding: '9px 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            {/* + tag primeiro */}
            <button
              onClick={() => { setShowTagDropdown(true); setTagSearch(''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 10px', minHeight: '28px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: dark ? '#52525b' : '#9ca3af', background: 'transparent', border: `1px dashed ${dark ? '#3f3f46' : '#d1d5db'}`, cursor: 'pointer', fontFamily: FONT, transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = dark ? '#71717a' : '#9ca3af'; e.currentTarget.style.color = dark ? '#a1a1aa' : '#6b7280'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = dark ? '#3f3f46' : '#d1d5db'; e.currentTarget.style.color = dark ? '#52525b' : '#9ca3af'; }}
            >+ tag</button>
            {/* Pills ativas */}
            {leadTags.map(tag => (
              <span key={tag.id} className="ld-tag-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px 4px 10px', minHeight: '28px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: tag.cor, background: tag.cor + '1e', border: `1px solid ${tag.cor}38`, whiteSpace: 'nowrap', animation: 'tagEnter 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                {tag.nome}
                <button onClick={() => removeLeadTag(tag.id)} className="ld-tag-x" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 1px', color: tag.cor, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  <X style={{ width: '9px', height: '9px' }} />
                </button>
              </span>
            ))}
            {/* Pills saindo — apenas animação, pointerEvents off */}
            {exitingTags.map(tag => (
              <span key={`exit-${tag.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 8px 4px 10px', minHeight: '28px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: tag.cor, background: tag.cor + '1e', border: `1px solid ${tag.cor}38`, whiteSpace: 'nowrap', animation: 'tagExit 0.16s ease-in forwards', pointerEvents: 'none' }}>
                {tag.nome}
              </span>
            ))}
            {/* Gerenciar à direita */}
            <button
              onClick={() => setShowTagManager(true)}
              style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 500, color: dark ? '#a1a1aa' : '#4b5563', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '4px 0', transition: 'all 0.15s', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.color = dark ? '#d4d4d8' : '#111827'; e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.color = dark ? '#a1a1aa' : '#4b5563'; e.currentTarget.style.textDecoration = 'none'; }}
            >Gerenciar</button>
          </div>
        </div>

        <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.055)', flexShrink: 0 }} />

        {/* Conteúdo rolável */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '4px 22px 8px' }}>

            {/* Respostas do Quiz — lê de quiz_respostas (jsonb), totalmente dinâmico */}
            {(() => {
              let respostas: Record<string, unknown> | null = null;
              try {
                const raw = l.quiz_respostas;
                if (raw) respostas = typeof raw === 'string' ? JSON.parse(raw) : raw;
              } catch { respostas = null; }
              // Fallback para leads legados sem quiz_respostas (vieram pelo Make)
              if (!respostas) {
                respostas = {
                  oque_mais_te_atrai: l.o_que_mais_te_atrai,
                  quanto_gostaria_de_ganhar_por_mes: l.quanto_ganha,
                  qual_sua_idade: l.idade,
                  tem_filhos: l.tem_filhos,
                  idade_do_filho_mais_novo: l.idade_filho,
                  voce_tem_alguma_rede_de_apoio: l.rede_apoio,
                  voce_mora_com_marido: l.mora_com,
                  situacao_atual: l.situacao_atual,
                  area_de_atuacao: l.area_atuacao,
                  voce_ja_vende: l.ja_vende,
                  por_quais_meios_vc_pretende_vender: l.meios_venda,
                  quantas_horas_por_semana_vai_se_dedicar: l.horas_semana,
                  quando_gostaria_de_comecar: l.quando_comecar,
                  ja_tentou_vender_semijoia: l.tentou_semijoia,
                  instagram_ativo: l.instagram_ativo,
                  para_comecar_no_consignado: l.consignado,
                  seu_nome_esta_negativado: l.negativado,
                  voce_aceita_as_regras_do_consignado: l.aceita_regras,
                };
              }
              const isInternalQuiz = respostas && Object.keys(respostas).some(k => k.includes(' ') || k.length > 12);
              const orderedKeys = (isInternalQuiz && perguntasOrdenadas.length > 0)
                ? perguntasOrdenadas.map(p => p.texto).filter(texto => texto in respostas!)
                : Object.keys(respostas).sort();
              const entries = orderedKeys
                .map(k => [k, respostas![k]] as [string, unknown])
                .filter(([k, v]) => !deveIgnorar(k, v, !!isInternalQuiz));
              return (
                <Section openKey="quiz_respostas" activeKey={activeSection} setActiveKey={setActiveSection} dark={dark} iconColor="#0044fd"
                  icon={<MessageCircle style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Respostas do Quiz">
                  {fullLeadLoading && !l.quiz_respostas
                    ? <div style={{ height: '32px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', animation: 'ld-skeleton 1.5s ease-in-out infinite' }}/>
                    : entries.length === 0
                      ? <p style={{ fontSize: '13px', color: dark ? '#52525b' : '#9ca3af', margin: 0, fontFamily: FONT }}>Nenhuma resposta do quiz disponível.</p>
                      : entries.map(([key, val]) => (
                          <Field key={key} label={formatKey(key)} value={formatValue(val)} dark={dark} />
                        ))
                  }
                </Section>
              );
            })()}

            {/* Reunião de Onboarding */}
            {(() => {
              let respostas: Record<string, unknown> | null = null;
              try {
                const raw = l.quiz_reuniao_respostas;
                if (raw) respostas = typeof raw === 'string' ? JSON.parse(raw) : raw;
              } catch { respostas = null; }
              if (!respostas) return null;
              // Formato esperado: { key: { pergunta: "Label", resposta: "Valor" } }
              const entries = Object.entries(respostas)
                .filter(([, v]) => {
                  if (!v || typeof v !== 'object') return false;
                  const obj = v as any;
                  return obj.resposta !== null && obj.resposta !== undefined && String(obj.resposta).trim() !== '';
                })
                .map(([k, v]) => {
                  const obj = v as any;
                  return { key: k, pergunta: String(obj.pergunta || k), resposta: String(obj.resposta) };
                });
              if (entries.length === 0) return null;
              return (
                <Section openKey="reuniao" activeKey={activeSection} setActiveKey={setActiveSection} dark={dark} iconColor="#7e3beb"
                  icon={<Monitor style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title="Reunião de Onboarding">
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Participou</span>
                  </div>
                  {entries.map(({ key, pergunta, resposta }) => (
                    <Field key={key} label={pergunta} value={resposta} dark={dark} />
                  ))}
                </Section>
              );
            })()}

            {/* Origem do Lead / Tráfego */}
            {(hasTraffic || (l.utm_source && !l.utm_campaign)) && (
              <Section openKey="traffic" activeKey={activeSection} setActiveKey={setActiveSection} dark={dark}
                iconColor="#fd4c04" icon={<Megaphone style={{ width: '14px', height: '14px', strokeWidth: 1.8 }} />} title={!l.utm_campaign && l.utm_source ? "Origem do Lead" : "Origem do Tráfego"}>
                {(!l.utm_campaign && l.utm_source) ? (
                  <Field label="Origem" value={l.utm_source === 'FB' ? 'Tráfego Pago' : l.utm_source === 'instagram_organico' ? 'Instagram Orgânico' : l.utm_source} dark={dark} />
                ) : (
                  <>
                    <Field label="Fonte" value={l.utm_source === 'FB' ? 'Facebook Ads' : l.utm_source === 'instagram_organico' ? 'Instagram' : l.utm_source} dark={dark} />
                    <Field label="Campanha" value={cleanCampaignName(l.utm_campaign)} dark={dark} />
                    <Field label="Conjunto" value={cleanCampaignName(l.utm_medium)} dark={dark} />
                    <Field label="Anúncio" value={l.utm_content} dark={dark} />
                  </>
                )}
                {l.ip && <Field label="IP" value={l.ip} dark={dark} />}
              </Section>
            )}
          </div>

          {/* Observações */}
          <div style={{ padding: '0 22px 20px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 500, color: dark ? '#6b6b75' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', fontFamily: FONT }}>Observações</p>
            <textarea value={obs} onChange={e => { setObs(e.target.value); setObsChanged(true); }} placeholder="Anotações sobre este lead..." rows={3}
              style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px', lineHeight: 1.55, fontFamily: FONT, color: dark ? '#f0f0f0' : '#374151', background: dark ? '#0f0f10' : 'rgba(0,0,0,0.025)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '10px', resize: 'none', outline: 'none', transition: 'border-color 0.18s', boxSizing: 'border-box' as any }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0,68,253,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,68,253,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 22px 20px', display: 'flex', gap: '8px', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0 }}>
          <button onClick={handleWhatsApp} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#25D366', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'opacity 0.15s', fontFamily: FONT }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            <WaIcon /> {hasWA ? 'Abrir conversa' : 'Chamar no WhatsApp'}
          </button>
          <button onClick={handleSaveObs} disabled={saving || !obsChanged} style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: '10px', background: obsChanged ? (dark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)'), border: `1px solid ${obsChanged ? (dark ? 'rgba(16,185,129,0.3)' : '#bbf7d0') : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`, color: obsChanged ? (dark ? '#34d399' : '#15803d') : (dark ? '#6b6b75' : '#9ca3af'), fontSize: '13px', fontWeight: 500, cursor: obsChanged ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.18s', fontFamily: FONT }}>
            <Save style={{ width: '13px', height: '13px', strokeWidth: 1.8 }} />{saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ld-fade { from{opacity:0}to{opacity:1} }
        @keyframes ld-up { from{opacity:0;transform:translate(-50%,-46%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes ld-skeleton { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes dropdownIn { from{opacity:0;transform:translateY(-6px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes tagEnter { from{opacity:0;transform:scale(0.78)} to{opacity:1;transform:scale(1)} }
        @keyframes tagExit { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.78)} }
        .ld-tag-pill { transition: filter 0.15s ease, transform 0.15s ease; }
        .ld-tag-pill:hover { filter: brightness(1.1); transform: scale(1.03); }
        .ld-tag-x { opacity: 0.5; transition: opacity 0.1s ease; }
        .ld-tag-pill:hover .ld-tag-x { opacity: 0.9; }
      `}</style>

      {/* Status dropdown portal */}
      {statusOpen && createPortal(
        <>
          <div onClick={() => setStatusOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9996 }} />
          <div style={{ position: 'fixed', top: statusDropPos.top, left: statusDropPos.left, width: statusDropPos.width, zIndex: 9997, background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, borderRadius: '11px', padding: '4px', boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.12)', animation: 'dropdownIn 0.18s cubic-bezier(0.16,1,0.3,1)', fontFamily: FONT }}>
            {STATUS.map(s => {
              const active = status === s.id;
              return (
                <button key={s.id} onClick={() => handleStatus(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '8px', border: 'none', background: active ? (dark ? s.darkBg : s.bg) : 'transparent', color: active ? (dark ? s.darkText : s.text) : (dark ? '#a1a1aa' : '#374151'), fontSize: '13px', fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'background 0.1s' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {active && <Check style={{ width: '12px', height: '12px', strokeWidth: 2.5, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}

      {/* Tag dropdown portal — modal centralizado */}
      {showTagDropdown && createPortal(
        <>
          <div onClick={() => setShowTagDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999, background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, borderRadius: '16px', padding: '16px', width: 'calc(100vw - 48px)', maxWidth: '360px', maxHeight: '60vh', display: 'flex', flexDirection: 'column', boxShadow: dark ? '0 24px 60px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.15)', fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: dark ? '#f4f4f5' : '#111827' }}>Adicionar tag</span>
              <button onClick={() => setShowTagDropdown(false)} style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: dark ? '#71717a' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
            <input
              autoFocus
              placeholder="Buscar tag..."
              value={tagSearch}
              onChange={e => setTagSearch(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '9px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#1a1a1e' : '#f8fafc', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', fontFamily: FONT, marginBottom: '8px', flexShrink: 0 }}
            />
            <div style={{ overflow: 'auto', flex: 1 }}>
              {orgTags.filter(t => !tagSearch || t.nome.toLowerCase().includes(tagSearch.toLowerCase())).map(tag => {
                const applied = !!leadTags.find(lt => lt.id === tag.id);
                return (
                  <button key={tag.id} onClick={() => applied ? removeLeadTag(tag.id) : addLeadTag(tag.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '9px', border: 'none', background: applied ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'background 0.1s' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: tag.cor, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: dark ? '#f4f4f5' : '#111827', flex: 1 }}>{tag.nome}</span>
                    {applied && <Check style={{ width: '13px', height: '13px', color: '#10b981', flexShrink: 0 }} />}
                  </button>
                );
              })}
              {orgTags.filter(t => !tagSearch || t.nome.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '13px', color: dark ? '#52525b' : '#9ca3af', padding: '16px 0', margin: 0 }}>
                  {orgTags.length === 0 ? 'Nenhuma tag. Use "Gerenciar" para criar.' : 'Nenhuma tag encontrada'}
                </p>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Tag manager modal */}
      {showTagManager && createPortal(
        <>
          <div onClick={() => { setShowTagManager(false); setMgrEditId(null); setMgrDeleteId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999, background: dark ? '#111113' : '#fff', borderRadius: '18px', border: `1px solid ${dark ? '#27272a' : 'rgba(0,0,0,0.08)'}`, width: '90%', maxWidth: '420px', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', fontFamily: FONT }}>
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: dark ? '#f4f4f5' : '#111827' }}>Gerenciar Tags</h3>
              <button onClick={() => { setShowTagManager(false); setMgrEditId(null); setMgrDeleteId(null); }} style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: dark ? '#71717a' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '13px', height: '13px' }} />
              </button>
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: '12px' }}>
              {/* Nova tag */}
              <div style={{ padding: '12px', borderRadius: '10px', background: dark ? '#18181b' : '#f8fafc', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: dark ? '#52525b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova tag</p>
                <input
                  placeholder="Nome da tag..."
                  value={mgr_newNome}
                  onChange={e => setMgrNewNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && mgr_newNome.trim()) handleMgrCreate(); }}
                  style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#111113' : '#fff', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', fontFamily: FONT }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {CORES_TAGS.map(c => (
                    <button key={c} onClick={() => setMgrNewCor(c)}
                      style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: mgr_newCor === c ? `3px solid ${dark ? '#fff' : '#111'}` : '3px solid transparent', cursor: 'pointer', padding: 0 }}
                    />
                  ))}
                </div>
                <button onClick={handleMgrCreate} disabled={!mgr_newNome.trim() || mgr_creating}
                  style={{ padding: '8px', borderRadius: '8px', border: 'none', background: mgr_newNome.trim() ? '#0044fd' : (dark ? '#27272a' : '#e5e7eb'), color: mgr_newNome.trim() ? '#fff' : (dark ? '#52525b' : '#9ca3af'), fontSize: '13px', fontWeight: 600, cursor: mgr_newNome.trim() ? 'pointer' : 'default', fontFamily: FONT }}>
                  {mgr_creating ? 'Criando...' : 'Criar tag'}
                </button>
              </div>
              {/* Tags existentes */}
              {orgTags.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '13px', color: dark ? '#52525b' : '#9ca3af', padding: '20px 0', margin: 0 }}>Nenhuma tag criada ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {orgTags.map(tag => {
                    const isEditing = mgr_editId === tag.id;
                    const isDeleting = mgr_deleteId === tag.id;
                    return (
                      <div key={tag.id} style={{ padding: '10px 12px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#18181b' : '#fafafa', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {isEditing ? (
                          <>
                            <input value={mgr_editNome} onChange={e => setMgrEditNome(e.target.value)}
                              style={{ padding: '7px 10px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#111113' : '#fff', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', fontFamily: FONT }} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {CORES_TAGS.map(c => (
                                <button key={c} onClick={() => setMgrEditCor(c)}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: mgr_editCor === c ? `3px solid ${dark ? '#fff' : '#111'}` : '3px solid transparent', cursor: 'pointer', padding: 0 }}
                                />
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={handleMgrSaveEdit} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: 'none', background: '#10b981', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Salvar</button>
                              <button onClick={() => setMgrEditId(null)} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>Cancelar</button>
                            </div>
                          </>
                        ) : isDeleting ? (
                          <>
                            <p style={{ margin: 0, fontSize: '12.5px', color: dark ? '#f4f4f5' : '#111827' }}>Excluir <strong>{tag.nome}</strong> de todos os leads? Esta ação não pode ser desfeita.</p>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={handleMgrDelete} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Excluir</button>
                              <button onClick={() => setMgrDeleteId(null)} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: dark ? '#a1a1aa' : '#6b7280', fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: tag.cor, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: dark ? '#f4f4f5' : '#111827' }}>{tag.nome}</span>
                            <button onClick={() => { setMgrEditId(tag.id); setMgrEditNome(tag.nome); setMgrEditCor(tag.cor); setMgrDeleteId(null); }}
                              style={{ fontSize: '12px', color: dark ? '#71717a' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '5px', fontFamily: FONT }}>Editar</button>
                            <button onClick={() => { setMgrDeleteId(tag.id); setMgrEditId(null); }}
                              style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '5px', fontFamily: FONT }}>Excluir</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
