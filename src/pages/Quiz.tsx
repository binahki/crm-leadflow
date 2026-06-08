import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { UpgradeModal } from '@/components/ui/UpgradeModal';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { seedQuizBecker } from '@/utils/seedQuizBecker';
import {
  QuizRenderer,
  type QuizConfig, type Bloco, type Opcao, type ColetaCampo,
  hexRgba, defaultEmojiForBloco, DEFAULT_COLETA_CONFIG,
} from '@/components/quiz/QuizRenderer';
import type { Phase } from '@/components/quiz/QuizRenderer';
import { QuizLeads } from '@/components/quiz/QuizLeads';
import {
  Plus, Trash2, Copy, ExternalLink, RotateCcw, ClipboardList, ChevronLeft,
  Loader2, Settings, Eye, Check, X, Upload, GripVertical, ChevronDown, ChevronUp, TrendingUp, ArrowDownRight, ArrowUpRight, Filter,
  Search, Download, Calendar, ChevronRight, Users, Palette,
  MessageCircle, Instagram, MapPin, Sparkles, BrainCircuit,
  Clock, Share2, MoreHorizontal, TrendingDown,
  LayoutDashboard,
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const DEFAULT_DEPOIMENTOS = [
  { nome: 'Ana Paula Silva',   handle: '@ana.silva',      texto: 'Não acreditei quando vi os resultados. Em poucos meses já estava faturando muito mais do que esperava!' },
  { nome: 'Carla Mendes',      handle: '@carla.mendes',   texto: 'Comecei do zero, sem experiência nenhuma. Hoje tenho minha própria renda e trabalho no meu horário.' },
  { nome: 'Fernanda Costa',    handle: '@fernanda.costa', texto: 'A melhor decisão que tomei foi dar esse primeiro passo. Mudou completamente minha vida financeira.' },
];

const BASE_URL = 'https://app.floowcrm.online';

const tokens = {
  radius: { sm: 8, md: 12, lg: 16 },
  shadow: { card: '0 1px 4px rgba(0,0,0,0.06)', modal: '0 8px 32px rgba(0,0,0,0.12)' },
  transition: 'all 150ms ease-out',
};

// Builder-specific Pergunta (no opcoes array — stored separately)
interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto: string | null; tipo_resposta: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
}

interface FlatPergunta extends Pergunta { blocoTitulo: string; globalIndex: number; }

function hexToRgba(hex: string, a: number) { return hexRgba(hex, a); }

function sanitizeQuizForUpdate(q: QuizConfig) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _a, org_id: _b, created_at: _c, updated_at: _d, published_at: _e, publicado: _f, ativo: _g, ...rest } = q as any;
  return rest;
}

function formatWANumber(v: string): string {
  const nums = v.replace(/\D/g, '');
  const d = nums.startsWith('55') ? nums.slice(2) : nums;
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
}

// ── Image compression ─────────────────────────────────────────────────────────
async function compressImage(file: File, maxWidth = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.75));
      };
      img.src = e.target?.result as string;
      img.onerror = reject;
    };
    reader.readAsDataURL(file);
    reader.onerror = reject;
  });
}

// ── Sortable pergunta card (dnd-kit) ─────────────────────────────────────────
interface SortableCardProps {
  perg: FlatPergunta;
  isActive: boolean; isHovered: boolean; isDimmed: boolean;
  primary: string; textMain: string; textMut: string; isDark: boolean;
  onSelect: () => void; onHover: (id: string | null) => void;
  onDuplicate: () => void; onDelete: () => void;
}
function SortablePerguntaCard({ perg, isActive, isHovered, isDimmed, primary, textMain, textMut, isDark, onSelect, onHover, onDuplicate, onDelete }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: perg.id });
  const dndStyle: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 999 : undefined };
  return (
    <div ref={setNodeRef} style={dndStyle} {...attributes}>
      <div onClick={onSelect} onMouseEnter={() => onHover(perg.id)} onMouseLeave={() => onHover(null)}
        style={{
          padding: '7px 8px 7px 4px', borderRadius: '10px', marginBottom: '2px', cursor: 'pointer',
          border: `1.5px solid ${isActive ? '#2563eb' : 'transparent'}`,
          background: isActive ? hexToRgba('#2563eb', 0.06) : isHovered ? (isDark ? '#1a1a1e' : '#f9fafb') : 'transparent',
          opacity: isDragging ? 0.5 : isDimmed ? 0.4 : 1,
          transition: 'background 0.1s, border-color 0.1s, opacity 150ms ease',
          boxShadow: isActive ? `0 0 0 3px ${hexToRgba('#2563eb', 0.12)}` : 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div {...listeners} style={{ color: textMut, cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, touchAction: 'none', display: 'flex' }}>
            <GripVertical style={{ width: '12px', height: '12px' }} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: isActive ? '#2563eb' : textMut, flexShrink: 0 }}>{perg.globalIndex}.</span>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: isActive ? 700 : 500, color: isActive ? '#2563eb' : textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {perg.texto ? perg.texto.slice(0, 26) : 'Sem texto'}
          </span>
          {(isHovered || isActive) && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button onClick={onDuplicate} title="Duplicar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '2px', borderRadius: '4px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? '#2a2a2e' : '#f3f4f6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <Copy style={{ width: '11px', height: '11px' }} />
              </button>
              <button onClick={onDelete} title="Excluir"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '2px', borderRadius: '4px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = textMut; }}>
                <Trash2 style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableOpcaoCard({ op, isDark, border, textMut, primary, iStyle, lbl, isEditing, onToggleEdit, onUpdate, onDelete, allPages }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: op.id });
  const dndStyle = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 999 : undefined };
  return (
    <div ref={setNodeRef} style={dndStyle} {...attributes}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div {...listeners} style={{ color: textMut, cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, touchAction: 'none', display: 'flex' }}>
            {isEditing ? (
              <button onClick={onDelete} title="Excluir"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                <Trash2 style={{ width: '13px', height: '13px' }} />
              </button>
            ) : (
              <GripVertical style={{ width: '13px', height: '13px' }} />
            )}
          </div>
          <input value={op.texto}
            onChange={e => onUpdate('texto', e.target.value)}
            placeholder="Texto da opção"
            style={{ ...iStyle, flex: 1, padding: '6px 8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            <input type="number" value={op.pontos}
              onChange={e => onUpdate('pontos', Number(e.target.value))}
              style={{ ...iStyle, width: '48px', textAlign: 'center', padding: '6px 4px' }} />
          </div>
          <button onClick={onToggleEdit}
            style={{ background: isEditing ? hexToRgba('#2563eb', 0.1) : 'none', border: 'none', cursor: 'pointer', color: isEditing ? '#2563eb' : textMut, display: 'flex', padding: '5px', borderRadius: '4px' }}>
            <Settings style={{ width: '13px', height: '13px' }} />
          </button>
        </div>

        {isEditing && (
          <div style={{ margin: '2px 0 8px 18px', padding: '10px', borderRadius: '8px', background: isDark ? '#1a1a1e' : '#f9fafb', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ ...lbl, fontSize: '10px' }}>Redirecionar para:</label>
            <select
              value={op.reprova_imediato ? 'reprovado' : (op as any).target_pergunta_id || 'next'}
              onChange={e => {
                const val = e.target.value;
                if (val === 'reprovado') onUpdate('reprova_imediato', true);
                else if (val === 'next') { onUpdate('reprova_imediato', false); onUpdate('target_pergunta_id', null); }
                else { onUpdate('reprova_imediato', false); onUpdate('target_pergunta_id', val); }
              }}
              style={{ ...iStyle, fontSize: '12px', padding: '5px' }}
            >
              <option value="next">Próxima etapa (padrão)</option>
              <option value="reprovado">Página de Reprovação ❌</option>
              <optgroup label="Pular para etapa:">
                {allPages.map((p: any) => (
                  <option key={p.id} value={p.id}>Etapa {p.globalIndex}: {p.texto.slice(0, 30)}...</option>
                ))}
              </optgroup>
              <optgroup label="Páginas finais:">
                <option value="approval">Página de Aprovação ✅</option>
                <option value="collect">Formulário de Coleta 📝</option>
              </optgroup>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable coleta sidebar sub-item ──────────────────────────────────────────
const DEFAULT_COLETA_CAMPOS = new Set(['nome', 'whatsapp', 'cidade', 'instagram']);

function SortableColetaSidebarItem({ cfg, index, isActive, isDark, textMain, textMut, border, primary, onClick, onDelete }: {
  cfg: ColetaCampo; index: number; isActive: boolean;
  isDark: boolean; textMain: string; textMut: string; border: string; primary: string;
  onClick: () => void; onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `sidebar-coleta-${cfg.campo}` });
  const [hovered, setHovered] = useState(false);
  const dndStyle: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isDefault = DEFAULT_COLETA_CAMPOS.has(cfg.campo);
  const bg = isActive ? `${primary}12` : hovered ? (isDark ? '#1a1a1e' : '#f9fafb') : 'transparent';
  return (
    <div ref={setNodeRef} style={{ ...dndStyle, display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px', borderRadius: '8px', marginBottom: '2px', cursor: 'pointer', border: `1.5px solid ${isActive ? primary : 'transparent'}`, background: bg, transition: 'all 0.15s' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div {...attributes} {...listeners} style={{ color: textMut, cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, touchAction: 'none', display: 'flex' }} onClick={e => e.stopPropagation()}>
        <GripVertical style={{ width: '9px', height: '9px' }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: 700, color: isActive ? primary : textMut, flexShrink: 0, minWidth: '14px', textAlign: 'right' as const }}>{index + 1}.</span>
      <span style={{ flex: 1, fontSize: '11px', fontWeight: isActive ? 700 : 400, color: isActive ? primary : textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{cfg.label}</span>
      {hovered && !isDefault && onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Remover campo"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
          <Trash2 style={{ width: '10px', height: '10px' }} />
        </button>
      )}
    </div>
  );
}

// ── Sortable coleta field card ────────────────────────────────────────────────
const DEFAULT_CAMPOS = new Set(['nome', 'whatsapp', 'cidade', 'instagram']);
const TIPO_LABELS: Record<string, string> = { texto: 'Aa  Texto', telefone: '📞  Telefone', email: '✉️  E-mail', numero: '#  Número', cpf: '🪪  CPF' };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuizBuilderPage() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { features, loading: planLoading } = usePlanFeatures();
  const [showQuizUpgrade, setShowQuizUpgrade] = useState(false);

  // Data
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizConfig[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'design' | 'leads'>('editor');
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[]>>({});
  const [opcoes, setOpcoes] = useState<Record<string, Opcao[]>>({});

  // Builder UI
  const [selectedPageId, setSelectedPageId] = useState<string>('cover');
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newBenefit, setNewBenefit] = useState('');
  const [showConditional, setShowConditional] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [editingBlocoId, setEditingBlocoId] = useState<string | null>(null);
  const [editingOpcaoId, setEditingOpcaoId] = useState<string | null>(null);
  const [expandedColetaCampo, setExpandedColetaCampo] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'Geral' | 'Pixel/Scripts'>('Geral');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nomeTemplate, setNomeTemplate] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [redoHistory, setRedoHistory] = useState<any[]>([]);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Preview state (interactive phone preview)
  const [previewPhase, setPreviewPhase] = useState<Phase>('capa');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewColetaIdx, setPreviewColetaIdx] = useState(0);
  const [previewSelectedOpcao, setPreviewSelectedOpcao] = useState<string | null>(null);
  const previewAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect panel state
  const [showAddColeta, setShowAddColeta] = useState(false);
  const [newCampoLabel, setNewCampoLabel] = useState('');
  const [newCampoTipo, setNewCampoTipo] = useState<ColetaCampo['tipo']>('texto');
  const [newCampoPlaceholder, setNewCampoPlaceholder] = useState('');
  const [newCampoObrigatorio, setNewCampoObrigatorio] = useState(false);
  const [selectedColetaElement, setSelectedColetaElement] = useState<'texto' | 'campo' | 'botao' | 'aviso' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnpublishedEdits, setHasUnpublishedEdits] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedRecentlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const pageListRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const bg = isDark ? '#0d0d0f' : '#f4f2ef';
  const cardBg = isDark ? '#111113' : '#ffffff';
  const border = isDark ? '#1e1e22' : '#e8e6e3';
  const textMut = isDark ? 'rgba(255,255,255,0.4)' : '#9d9189';
  const textMain = isDark ? '#f4f4f5' : '#1a1918';
  const inputBg = isDark ? '#1a1a1e' : '#f7f6f4';

  // Computed flat list
  const flatPerguntas = useMemo<FlatPergunta[]>(() => [...blocos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap(b => (perguntas[b.id] || []).sort((a, b) => a.ordem - b.ordem).map(p => ({ ...p, blocoTitulo: b.titulo })))
    .map((p, i) => ({ ...p, globalIndex: i + 1 }))
  , [blocos, perguntas]);

  const quizLink = quiz ? `${BASE_URL}/quiz/${quiz.slug}` : '';

  type PageType = 'cover' | 'question' | 'approval' | 'collect' | 'rejection';
  selectedPageId === 'analise' ? 'analise' :
    selectedPageId === 'rejection' ? 'rejection' : 'question';

  const selectedPageType: PageType | 'analise' =
    selectedPageId === 'cover' ? 'cover' :
      selectedPageId === 'approval' ? 'approval' :
        selectedPageId === 'analise' ? 'analise' :
          selectedPageId === 'collect' ? 'collect' :
            selectedPageId === 'rejection' ? 'rejection' : 'question';

  const selectedPergunta = selectedPageType === 'question'
    ? flatPerguntas.find(p => p.id === selectedPageId) ?? null
    : null;

  const selectedPergOpcoes = selectedPergunta ? (opcoes[selectedPergunta.id] || []) : [];

  // Sync preview with selected page
  useEffect(() => {
    if (selectedPageId === 'cover') {
      setPreviewPhase('capa');
    } else if (selectedPageId === 'approval') {
      setPreviewPhase('aprovado_form');
    } else if (selectedPageId === 'collect') {
      setPreviewPhase('coleta');
      setPreviewColetaIdx(0);
      const firstCampo = quiz?.coleta_config?.length
        ? [...quiz.coleta_config].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))[0]?.campo
        : DEFAULT_COLETA_CONFIG[0]?.campo ?? 'nome';
      setExpandedColetaCampo(firstCampo ?? null);
    } else if (selectedPageId === 'analise') {
      setPreviewPhase('analise');
    } else if (selectedPageId === 'rejection') {
      setPreviewPhase('reprovado');
    } else {
      const idx = flatPerguntas.findIndex(p => p.id === selectedPageId);
      setPreviewPhase('quiz');
      setPreviewIdx(Math.max(0, idx));
    }
    setPreviewSelectedOpcao(null);
  }, [selectedPageId, flatPerguntas]);

  useEffect(() => {
    setShowConditional(!!selectedPergunta?.condicao_pergunta_id);
  }, [selectedPergunta?.id]);

  useEffect(() => {
    setSelectedColetaElement(null);
  }, [expandedColetaCampo]);

  useEffect(() => {
    if (!ready || !orgId) return;
    loadData();
  }, [ready, orgId]);

  // ── Data loading ────────────────────────────────────────────────────────────
  async function loadData() {
    if (!orgId) return;
    setLoading(true);

    // Fetch all quizzes for this org
    const { data: quizzesData, error: qErr } = await db.from('quizzes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (qErr) {
      toast.error('Erro ao carregar quizes');
      setLoading(false);
      return;
    }

    setQuizzes(quizzesData || []);

    // If we were editing a specific quiz, reload its data
    if (quiz) {
      await loadQuizData(quiz.id);
    } else {
      setLoading(false);
    }
  }

  async function loadQuizData(quizId: string) {
    setLoading(true);
    const { data: quizData } = await db.from('quizzes').select('*').eq('id', quizId).eq('org_id', orgId).single();
    if (!quizData) { setLoading(false); return; }
    setQuiz(quizData);

    const { data: bData } = await db.from('quiz_blocos').select('*').eq('quiz_id', quizId).order('ordem');
    setBlocos(bData || []);

    if (bData?.length) {
      const blocoIds = bData.map((b: Bloco) => b.id);
      const { data: pData } = await db.from('quiz_perguntas').select('*').in('bloco_id', blocoIds).order('ordem');

      const pergMap: Record<string, Pergunta[]> = {};
      for (const b of bData) pergMap[b.id] = [];
      for (const p of (pData || [])) { if (pergMap[p.bloco_id]) pergMap[p.bloco_id].push(p); }
      setPerguntas(pergMap);

      if (pData?.length) {
        const pergIds = pData.map((p: Pergunta) => p.id);
        const { data: oData } = await db.from('quiz_opcoes').select('*').in('pergunta_id', pergIds).order('ordem');

        const opMap: Record<string, Opcao[]> = {};
        for (const p of pData) opMap[p.id] = [];
        for (const o of (oData || [])) { if (opMap[o.pergunta_id]) opMap[o.pergunta_id].push(o); }
        setOpcoes(opMap);
      }
    }
    setLoading(false);
  }

  // ── Create quiz ─────────────────────────────────────────────────────────────
  async function handleCreateQuiz(withSeed = false) {
    if (!orgId) return;

    // Limit quizzes per plan
    if (!planLoading && quizzes.length >= features.limiteQuizzes) {
      if (features.limiteQuizzes === 1) {
        setShowQuizUpgrade(true);
      } else {
        toast.error(`Limite de ${features.limiteQuizzes} quizzes atingido no seu plano.`, { duration: 4000, icon: '⚠️' });
      }
      return;
    }

    setCreating(true);
    try {
      const { data: org, error: orgErr } = await db.from('organizations').select('nome').eq('id', orgId).maybeSingle();
      if (orgErr) console.warn('Org fetch error:', orgErr);

      const baseSlug = (org?.nome || 'meu-quiz').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Slug more robust
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const slug = quizzes.length > 0 ? `${baseSlug}-${quizzes.length + 1}-${randomSuffix}` : `${baseSlug}-${randomSuffix}`;

      let createdQuizId: string | null = null;

      if (withSeed) {
        // 1. Busca dados da Becker
        const beckerOrgId = '81b1ba7b-5c03-45c5-a74a-6ea8eb3432ae';

        const { data: beckerQuiz } = await db.from('quizzes')
          .select('*').eq('org_id', beckerOrgId)
          .order('created_at', { ascending: false }).limit(1).single();
        if (!beckerQuiz) throw new Error('Template não encontrado');

        const { data: bBlocos } = await db.from('quiz_blocos')
          .select('*').eq('quiz_id', beckerQuiz.id).order('ordem');
        if (!bBlocos?.length) throw new Error('Template sem blocos');

        const { data: bPergs } = await db.from('quiz_perguntas')
          .select('*').in('bloco_id', bBlocos.map((b: any) => b.id)).order('ordem');

        const { data: bOps } = bPergs?.length
          ? await db.from('quiz_opcoes')
            .select('*').in('pergunta_id', bPergs.map((p: any) => p.id)).order('ordem')
          : { data: [] };

        // 3. Cria o quiz novo
        const excludeFields = [
          'id', 'org_id', 'slug', 'created_at',
          'pixel_id', 'pixel_meta_id', 'gtm_id',
          'redirect_whatsapp', 'whatsapp_redirecionar_direto',
          'whatsapp_mensagem_personalizada',
          'capa_imagem_url', 'logo_url',
          'publicado', 'ativo',
          'webhook_url', 'webhook_token',
          'script_head', 'script_body', 'script_footer',
        ];

        const insertData: any = { org_id: orgId, slug, publicado: false, ativo: true };
        Object.keys(beckerQuiz).forEach(key => {
          if (!excludeFields.includes(key) && beckerQuiz[key] !== undefined) {
            insertData[key] = beckerQuiz[key];
          }
        });

        // Título vem do modal
        insertData.titulo = nomeTemplate.trim() || 'Meu Quiz';

        const { data: newQuiz, error: quizErr } = await db.from('quizzes')
          .insert(insertData).select().single();
        if (quizErr || !newQuiz) throw new Error('Erro ao criar quiz: ' + (quizErr?.message || 'Desconhecido'));

        createdQuizId = newQuiz.id;

        // 4. Cria blocos UM POR UM e mapeia IDs
        const blocoIdMap: Record<string, string> = {};
        for (const b of bBlocos) {
          const { data: newB, error: bErr } = await db.from('quiz_blocos')
            .insert({ quiz_id: newQuiz.id, titulo: b.titulo, ordem: b.ordem, emoji: b.emoji })
            .select().single();
          if (bErr || !newB) {
            console.error('Erro ao criar bloco:', bErr);
            continue;
          }
          blocoIdMap[b.id] = newB.id;
        }

        console.log('Blocos criados:', Object.keys(blocoIdMap).length, 'de', bBlocos.length);

        // 5. Cria perguntas UM POR UM e mapeia IDs
        const pergIdMap: Record<string, string> = {};
        const opIdMap: Record<string, string> = {};

        for (const p of (bPergs || [])) {
          const novoBlocoId = blocoIdMap[p.bloco_id];
          if (!novoBlocoId) {
            console.error('Bloco não encontrado para pergunta:', p.id, p.bloco_id);
            continue;
          }

          const { data: newP, error: pErr } = await db.from('quiz_perguntas')
            .insert({
              quiz_id: newQuiz.id,
              bloco_id: novoBlocoId,
              texto: p.texto,
              subtexto: p.subtexto,
              ordem: p.ordem,
              tipo_resposta: p.tipo_resposta,
              condicao_pergunta_id: null, // resolve depois
              condicao_opcao_id: null,
            })
            .select().single();

          if (pErr || !newP) {
            console.error('Erro ao criar pergunta:', pErr);
            continue;
          }
          pergIdMap[p.id] = newP.id;
        }

        console.log('Perguntas criadas:', Object.keys(pergIdMap).length, 'de', (bPergs || []).length);

        // 6. Cria opções UM POR UM
        for (const o of (bOps || [])) {
          const novaPergId = pergIdMap[o.pergunta_id];
          if (!novaPergId) continue;

          const { data: newO, error: oErr } = await db.from('quiz_opcoes')
            .insert({
              pergunta_id: novaPergId,
              texto: o.texto,
              pontos: o.pontos,
              reprova_imediato: o.reprova_imediato,
              ordem: o.ordem,
              emoji: o.emoji,
              cor_fundo: o.cor_fundo,
              cor_texto: o.cor_texto,
              target_pergunta_id: null, // resolve depois
            })
            .select().single();

          if (oErr || !newO) {
            console.error('Erro ao criar opção:', oErr);
            continue;
          }
          opIdMap[o.id] = newO.id;
        }

        console.log('Opções criadas:', Object.keys(opIdMap).length, 'de', (bOps || []).length);

        // 7. Resolve condicionais das perguntas
        for (const p of (bPergs || [])) {
          if (!p.condicao_pergunta_id && !p.condicao_opcao_id) continue;
          const newPId = pergIdMap[p.id];
          if (!newPId) continue;

          const updt: any = {};
          if (p.condicao_pergunta_id && pergIdMap[p.condicao_pergunta_id]) {
            updt.condicao_pergunta_id = pergIdMap[p.condicao_pergunta_id];
          }
          if (p.condicao_opcao_id && opIdMap[p.condicao_opcao_id]) {
            updt.condicao_opcao_id = opIdMap[p.condicao_opcao_id];
          }
          if (Object.keys(updt).length > 0) {
            await db.from('quiz_perguntas').update(updt).eq('id', newPId);
          }
        }

        // 8. Resolve target_pergunta_id das opções
        for (const o of (bOps || [])) {
          if (!o.target_pergunta_id) continue;
          const newOId = opIdMap[o.id];
          if (!newOId) continue;

          const novoTarget = pergIdMap[o.target_pergunta_id] || null;
          if (novoTarget) {
            await db.from('quiz_opcoes').update({ target_pergunta_id: novoTarget }).eq('id', newOId);
          }
        }

        toast.success(`Quiz criado com ${Object.keys(pergIdMap).length} etapas!`);
      } else {
        // DEFAULT BLANK CREATION
        const { data: newQuiz, error } = await db.from('quizzes').insert({
          org_id: orgId,
          titulo: org?.nome ? `Quiz ${org.nome}` : 'Meu Quiz',
          slug, cor_primaria: '#2563eb', redirect_whatsapp: '',
          corte_verde: 35, corte_amarelo: 25,
          mensagem_aprovado: 'Parabéns! Seu perfil foi pré-aprovado.',
          mensagem_reprovado: 'Obrigada pela participação!',
          ativo: true, publicado: false,
          capa_titulo: null, capa_subtitulo: null, capa_imagem_url: null, capa_beneficios: [],
          capa_botao_texto: 'Clique para iniciar →',
          coleta_campos: ['nome', 'whatsapp', 'cidade', 'instagram'],
          coleta_config: DEFAULT_COLETA_CONFIG,
        }).select().single();

        if (error || !newQuiz) throw new Error(error?.message || 'Erro ao criar quiz em branco');

        createdQuizId = newQuiz.id;
        toast.success('Quiz criado com sucesso!');
      }

      await loadData();
      if (createdQuizId) await loadQuizData(createdQuizId);
    } catch (err: any) {
      console.error('Error creating quiz:', err);
      toast.error(`Erro ao criar quiz: ${err?.message || 'Erro desconhecido'}`);
    }
    setCreating(false);
  }

  async function handleDeleteQuiz(id: string) {
    if (!orgId) return;
    setLoading(true);
    try {
      const { error } = await db.from('quizzes').delete().eq('id', id).eq('org_id', orgId);
      if (error) throw error;
      toast.success('Quiz excluído permanentemente');
      setShowDeleteQuizModal(null);
      await loadData();
      setQuiz(null);
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err?.message || 'Tente novamente'}`);
    }
    setLoading(false);
  }

  // ── Auto-save debounce ──────────────────────────────────────────────────────
  function debounce(key: string, fn: () => Promise<void>, delay = 800) {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      setSaving(true); setSavedRecently(false);
      try {
        console.log('[debounce] executando:', key);
        await fn();
        console.log('[debounce] sucesso:', key);
        setSaving(false); setSavedRecently(true);
        if (savedRecentlyTimer.current) clearTimeout(savedRecentlyTimer.current);
        savedRecentlyTimer.current = setTimeout(() => setSavedRecently(false), 2000);
      } catch (err) {
        console.error('[debounce] ERRO:', key, err);
        setSaving(false);
        toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
      }
    }, delay);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function pushHistory(currentQuiz = quiz, currentBlocos = blocos, currentPerguntas = perguntas, currentOpcoes = opcoes) {
    if (!currentQuiz) return;
    const snapshot = JSON.parse(JSON.stringify({ quiz: currentQuiz, blocos: currentBlocos, perguntas: currentPerguntas, opcoes: currentOpcoes }));
    setHistory(prev => [snapshot, ...prev.slice(0, 19)]);
    setRedoHistory([]);
  }

  function markDirty() {
    setHasUnsavedChanges(true);
    setHasUnpublishedEdits(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateQuizField(field: string, value: any) {
    if (!quiz) return;
    pushHistory();
    markDirty();
    setQuiz(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function handleUndo() {
    const last = history[0];
    if (!last) return;
    setRedoHistory(prev => [{ quiz: { ...quiz }, blocos: [...blocos], perguntas: { ...perguntas }, opcoes: { ...opcoes } }, ...prev]);
    setQuiz(last.quiz);
    setBlocos(last.blocos);
    setPerguntas(last.perguntas);
    setOpcoes(last.opcoes);
    setHistory(prev => prev.slice(1));
    toast.success('Desfeito');
  }

  function handleRedo() {
    const next = redoHistory[0];
    if (!next) return;
    setHistory(prev => [{ quiz: { ...quiz }, blocos: [...blocos], perguntas: { ...perguntas }, opcoes: { ...opcoes } }, ...prev]);
    setQuiz(next.quiz);
    setBlocos(next.blocos);
    setPerguntas(next.perguntas);
    setOpcoes(next.opcoes);
    setRedoHistory(prev => prev.slice(1));
    toast.success('Refeito');
  }

  function updateColetaConfig(updated: ColetaCampo[]) {
    updateQuizField('coleta_config', updated);
  }

  async function toggleAtivo() {
    if (!quiz) return;
    const newVal = !quiz.ativo;
    setQuiz({ ...quiz, ativo: newVal });
    await db.from('quizzes').update({ ativo: newVal }).eq('id', quiz.id);
    toast.success(newVal ? 'Quiz ativado' : 'Quiz desativado');
  }

  // ── Manual save ─────────────────────────────────────────────────────────────
  async function handleManualSave(): Promise<boolean> {
    if (!quiz) return false;
    setIsSaving(true);
    try {
      const blocoSaves = blocos.map(b =>
        (db as any).from('quiz_blocos').update({ titulo: b.titulo, emoji: b.emoji, ordem: b.ordem }).eq('id', b.id)
      );

      const allPerguntas = Object.values(perguntas).flat();
      const pergSaves = allPerguntas.map(p =>
        (db as any).from('quiz_perguntas').update({
          texto: p.texto, subtexto: p.subtexto, tipo_resposta: p.tipo_resposta,
          condicao_pergunta_id: p.condicao_pergunta_id, condicao_opcao_id: p.condicao_opcao_id, ordem: p.ordem,
        }).eq('id', p.id)
      );

      const allOpcoes = Object.values(opcoes).flat();
      const opcaoSaves = allOpcoes.map(o =>
        (db as any).from('quiz_opcoes').update({
          texto: o.texto, pontos: o.pontos, reprova_imediato: o.reprova_imediato, emoji: o.emoji, ordem: o.ordem, target_pergunta_id: o.target_pergunta_id,
        }).eq('id', o.id)
      );

      const results = await Promise.all([
        db.from('quizzes').update(sanitizeQuizForUpdate(quiz)).eq('id', quiz.id),
        ...blocoSaves, ...pergSaves, ...opcaoSaves,
      ]);

      const firstError = results.find((r: any) => r.error);
      if (firstError?.error) throw new Error((firstError.error as any).message);

      setHasUnsavedChanges(false);
      toast.success('✓ Salvo com sucesso');
      return true;
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!quiz) return;
    const { error } = await db.from('quizzes').update({ publicado: true, ativo: true }).eq('id', quiz.id);
    if (error) { toast.error(error.message); return; }
    setQuiz(q => q ? { ...q, publicado: true, ativo: true } : q);
    setHasUnpublishedEdits(false);
    setShowPublishModal(false);
    toast.success('Quiz publicado! 🎉');
  }

  async function handleUnpublish() {
    if (!quiz) return;
    const { error } = await db.from('quizzes').update({ publicado: false, ativo: false }).eq('id', quiz.id);
    if (error) { toast.error(error.message); return; }
    setQuiz(q => q ? { ...q, publicado: false, ativo: false } : q);
    setShowUnpublishModal(false);
    toast.success('Quiz despublicado');
  }

  // ── File uploads (with base64 fallback) ────────────────────────────────────
  async function handleFileUpload(file: File, field: 'logo_url' | 'capa_imagem_url') {
    if (!quiz) return;
    if (file.size > 3_000_000) { toast.error('Arquivo deve ter menos de 3MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `quiz-assets/${quiz.id}-${field}.${ext}`;
      const { error: upErr } = await (supabase as any).storage
        .from('quiz-assets').upload(path, file, { upsert: true });

      let url: string;
      if (!upErr) {
        const { data: urlData } = (supabase as any).storage
          .from('quiz-assets').getPublicUrl(path);
        url = urlData.publicUrl;
      } else {
        url = await compressImage(file, field === 'logo_url' ? 300 : 800);
      }

      await db.from('quizzes').update({ [field]: url }).eq('id', quiz.id);
      setQuiz(q => q ? { ...q, [field]: url } : q);
      toast.success(upErr ? 'Imagem salva localmente' : 'Imagem atualizada!');
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Tente novamente'}`);
    }
    setUploading(false);
  }

  // ── Questions ───────────────────────────────────────────────────────────────
  async function addPergunta() {
    if (!quiz) return;
    let targetBlocoId: string;
    if (blocos.length === 0) {
      const { data: nb, error: nbErr } = await db.from('quiz_blocos').insert({ quiz_id: quiz.id, titulo: 'Perguntas', ordem: 1 }).select().single();
      if (nbErr || !nb) { toast.error(`Erro ao criar bloco${nbErr ? ': ' + nbErr.message : ''}`); return; }
      setBlocos([nb]);
      setPerguntas({ [nb.id]: [] });
      targetBlocoId = nb.id;
    } else {
      targetBlocoId = [...blocos].sort((a, b) => a.ordem - b.ordem).at(-1)!.id;
    }
    const blocoPergs = perguntas[targetBlocoId] || [];
    const maxOrdem = blocoPergs.reduce((mx, p) => Math.max(mx, p.ordem), 0);
    console.log('[addPergunta] quiz.id:', quiz.id, 'bloco:', targetBlocoId);
    pushHistory();
    const { data: np, error: npErr } = await db.from('quiz_perguntas').insert({
      quiz_id: quiz.id,
      bloco_id: targetBlocoId, texto: '', ordem: maxOrdem + 1,
      subtexto: null, tipo_resposta: 'unica',
      condicao_pergunta_id: null, condicao_opcao_id: null,
    }).select().single();
    if (npErr || !np) {
      console.error('[addPergunta] ERRO:', npErr);
      toast.error(`Erro ao criar etapa: ${npErr?.message || 'Erro desconhecido'}`);
      return;
    }
    markDirty();
    setPerguntas(p => ({ ...p, [targetBlocoId]: [...(p[targetBlocoId] || []), np] }));
    setOpcoes(o => ({ ...o, [np.id]: [] }));
    setSelectedPageId(np.id);
    setTimeout(() => pageListRef.current?.scrollTo({ top: pageListRef.current.scrollHeight, behavior: 'smooth' }), 80);
  }

  async function duplicatePergunta(id: string) {
    const perg = flatPerguntas.find(p => p.id === id);
    if (!perg) return;
    const blocoPergs = perguntas[perg.bloco_id] || [];
    const maxOrdem = blocoPergs.reduce((mx, p) => Math.max(mx, p.ordem), 0);
    console.log('[duplicatePergunta] quiz.id:', quiz!.id, 'bloco:', perg.bloco_id);
    const { data: np, error: npErr } = await db.from('quiz_perguntas').insert({
      quiz_id: quiz!.id,
      bloco_id: perg.bloco_id, texto: perg.texto, ordem: maxOrdem + 1,
      subtexto: perg.subtexto, tipo_resposta: perg.tipo_resposta,
      condicao_pergunta_id: null, condicao_opcao_id: null,
    }).select().single();
    if (npErr || !np) {
      console.error('[duplicatePergunta] ERRO:', npErr);
      toast.error(`Erro ao duplicar: ${npErr?.message || 'Erro desconhecido'}`);
      return;
    }
    const ops = opcoes[perg.id] || [];
    if (ops.length > 0) {
      const { data: newOps, error: opsErr } = await db.from('quiz_opcoes').insert(
        ops.map(o => ({ pergunta_id: np.id, texto: o.texto, pontos: o.pontos, reprova_imediato: o.reprova_imediato, ordem: o.ordem, emoji: o.emoji }))
      ).select();
      if (opsErr) toast.error(`Aviso: opções não duplicadas: ${opsErr.message}`);
      setOpcoes(prev => ({ ...prev, [np.id]: newOps || [] }));
    } else {
      setOpcoes(prev => ({ ...prev, [np.id]: [] }));
    }
    setPerguntas(prev => ({ ...prev, [perg.bloco_id]: [...(prev[perg.bloco_id] || []), np] }));
    setSelectedPageId(np.id);
    toast.success('Etapa duplicada');
  }

  // DnD reorder via @dnd-kit (suporta mover entre blocos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Pergunta drag
    const idA = active.id as string;
    const idB = over.id as string;
    const pergA = flatPerguntas.find(p => p.id === idA);
    const pergB = flatPerguntas.find(p => p.id === idB);

    if (pergA && pergB) {
      pushHistory();
      if (pergA.bloco_id === pergB.bloco_id) {
        // Mesmo bloco — reordena normalmente
        const blocoPergs = [...(perguntas[pergA.bloco_id] || [])].sort((a, b) => a.ordem - b.ordem);
        const oldIndex = blocoPergs.findIndex(p => p.id === idA);
        const newIndex = blocoPergs.findIndex(p => p.id === idB);
        const reordered = arrayMove(blocoPergs, oldIndex, newIndex).map((p, i) => ({ ...p, ordem: i + 1 }));
        setPerguntas(prev => ({ ...prev, [pergA.bloco_id]: reordered }));
        await Promise.all(reordered.map(p =>
          db.from('quiz_perguntas').update({ ordem: p.ordem }).eq('id', p.id)
        ));
      } else {
        // Blocos diferentes — move a pergunta para o bloco de destino
        const novoBlocoId = pergB.bloco_id;
        const blocoDestino = [...(perguntas[novoBlocoId] || [])].sort((a, b) => a.ordem - b.ordem);
        const idxDestino = blocoDestino.findIndex(p => p.id === idB);
        const novaOrdem = idxDestino + 1;

        const { error } = await db.from('quiz_perguntas')
          .update({ bloco_id: novoBlocoId, ordem: novaOrdem })
          .eq('id', idA);
        if (error) { toast.error('Erro ao mover etapa'); return; }

        setPerguntas(prev => {
          const next = { ...prev };
          next[pergA.bloco_id] = next[pergA.bloco_id].filter(p => p.id !== idA).map((p, i) => ({ ...p, ordem: i + 1 }));
          const dest = [...(next[novoBlocoId] || [])].sort((a, b) => a.ordem - b.ordem);
          dest.splice(idxDestino, 0, { ...pergA, bloco_id: novoBlocoId, ordem: novaOrdem });
          next[novoBlocoId] = dest.map((p, i) => ({ ...p, ordem: i + 1 }));
          return next;
        });
        toast.success('Etapa movida');
      }
      return;
    }

    // Opcao drag
    const opA = Object.values(opcoes).flat().find(o => o.id === active.id);
    const opB = Object.values(opcoes).flat().find(o => o.id === over.id);
    if (opA && opB && opA.pergunta_id === opB.pergunta_id) {
      pushHistory();
      const pid = opA.pergunta_id;
      const ops = [...(opcoes[pid] || [])].sort((a, b) => a.ordem - b.ordem);
      const oldIdx = ops.findIndex(o => o.id === active.id);
      const newIdx = ops.findIndex(o => o.id === over.id);
      const reordered = arrayMove(ops, oldIdx, newIdx).map((o, i) => ({ ...o, ordem: i + 1 }));
      setOpcoes(prev => ({ ...prev, [pid]: reordered }));
      await Promise.all(reordered.map(o =>
        db.from('quiz_opcoes').update({ ordem: o.ordem }).eq('id', o.id)
      ));
    }
  }

  function updatePergunta(id: string, field: string, value: string | null) {
    pushHistory();
    markDirty();
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next))
        next[bid] = next[bid].map(p => p.id === id ? { ...p, [field]: value } : p);
      return next;
    });
  }

  async function deletePergunta(id: string) {
    const { error } = await db.from('quiz_perguntas').delete().eq('id', id);
    if (error) { toast.error(`Erro ao deletar: ${error.message}`); return; }
    markDirty();
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].filter(p => p.id !== id);
      return next;
    });
    setOpcoes(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedPageId === id) setSelectedPageId('cover');
  }

  async function addOpcao(pergId: string) {
    pushHistory();
    const ordem = (opcoes[pergId]?.length || 0) + 1;
    const { data: no, error } = await db.from('quiz_opcoes').insert({
      pergunta_id: pergId, texto: '', pontos: 0, reprova_imediato: false, ordem, emoji: null,
    }).select().single();
    if (error) { toast.error(`Erro ao adicionar opção: ${error.message}`); return; }
    markDirty();
    if (no) setOpcoes(p => ({ ...p, [pergId]: [...(p[pergId] || []), no] }));
  }

  function updateOpcao(id: string, field: string, value: string | number | boolean | null) {
    pushHistory();
    markDirty();
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next))
        next[pid] = next[pid].map(o => o.id === id ? { ...o, [field]: value } : o);
      return next;
    });
  }

  async function deleteOpcao(id: string) {
    const { error } = await db.from('quiz_opcoes').delete().eq('id', id);
    if (error) { toast.error(`Erro ao deletar opção: ${error.message}`); return; }
    markDirty();
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter(o => o.id !== id);
      return next;
    });
  }

  async function addBloco() {
    if (!quiz) return;
    const { data: nb, error } = await db.from('quiz_blocos').insert({
      quiz_id: quiz.id,
      titulo: 'Novo bloco',
      ordem: blocos.length + 1,
      emoji: null,
    }).select().single();
    if (error) { toast.error(`Erro ao criar bloco: ${error.message}`); return; }
    setBlocos(prev => [...prev, nb]);
    setPerguntas(prev => ({ ...prev, [nb.id]: [] }));
    setEditingBlocoId(nb.id);
  }

  async function deleteBloco(id: string) {
    const blocoPergs = perguntas[id] || [];
    if (blocoPergs.length > 0) { toast.error('Remova todas as etapas antes de excluir o bloco'); return; }
    const { error } = await db.from('quiz_blocos').delete().eq('id', id);
    if (error) { toast.error(`Erro ao excluir bloco: ${error.message}`); return; }
    setBlocos(prev => prev.filter(b => b.id !== id));
    setPerguntas(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function updateBlocoField(id: string, field: string, value: string) {
    markDirty();
    setBlocos(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }

  function addBenefit() {
    if (!newBenefit.trim() || !quiz) return;
    updateQuizField('capa_beneficios', [...(quiz.capa_beneficios || []), newBenefit.trim()]);
    setNewBenefit('');
  }

  function removeBenefit(idx: number) {
    if (!quiz) return;
    updateQuizField('capa_beneficios', (quiz.capa_beneficios || []).filter((_, i) => i !== idx));
  }

  function moveCapaElement(key: string, dir: 1 | -1) {
    if (!quiz) return;
    const ordem = [...((quiz.capa_ordem as string[]) || ['titulo', 'subtitulo', 'imagem', 'beneficios', 'botao'])];
    const idx = ordem.indexOf(key);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= ordem.length) return;
    [ordem[idx], ordem[newIdx]] = [ordem[newIdx], ordem[idx]];
    updateQuizField('capa_ordem', ordem);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(quizLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Preview handlers ────────────────────────────────────────────────────────
  const previewPerguntaWithOpcoes = previewPhase === 'quiz' ? (() => {
    const fp = flatPerguntas[previewIdx];
    if (!fp) return null;
    return { ...fp, opcoes: opcoes[fp.id] || [] };
  })() : null;

  const previewCurrentBloco = previewPerguntaWithOpcoes
    ? blocos.find(b => b.id === previewPerguntaWithOpcoes.bloco_id) ?? null
    : null;

  function handlePreviewOpcaoClick(perg: { tipo_resposta?: string | null; id: string; opcoes: Opcao[] }, opcao: Opcao) {
    if (previewSelectedOpcao) return;
    setPreviewSelectedOpcao(opcao.id);
    const isMultipla = perg.tipo_resposta === 'multipla';
    if (!isMultipla) {
      if (previewAdvanceTimer.current) clearTimeout(previewAdvanceTimer.current);
      previewAdvanceTimer.current = setTimeout(() => advancePreview(), 350);
    }
  }

  function advancePreview() {
    setPreviewSelectedOpcao(null);
    const nextIdx = previewIdx + 1;
    if (nextIdx < flatPerguntas.length) {
      setPreviewIdx(nextIdx);
    } else {
      setPreviewPhase('analise');
      // No preview, vamos simular a transição após o tempo configurado
      setTimeout(() => {
        setPreviewPhase('aprovado_form');
      }, (quiz.analise_duracao || 3) * 1000);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const iStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    borderRadius: tokens.radius.sm, border: `1px solid ${border}`,
    background: inputBg, color: textMain, fontSize: '13px',
    fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: textMut,
    marginBottom: '4px', letterSpacing: '0.03em',
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!ready || loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 0.7s linear infinite', color: '#2563eb' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </AppLayout>
    );
  }

  // ── Quiz Selection / List View ─────────────────────────────────────────────
  if (!quiz) {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 56px)', background: isDark ? '#0d0d0f' : '#f8fafc', padding: '40px 24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: textMain, marginBottom: '8px', letterSpacing: '-0.02em' }}>Meus Quizes</h1>
              <p style={{ fontSize: '14px', color: textMut }}>Gerencie seus quizes ou crie um novo a partir de um modelo.</p>
            </div>

            {/* Creation Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '48px' }}>
              <FeatureGate feature="modeloConversao" planoNecessario="Starter">
                <button onClick={() => { setNomeTemplate(''); setShowNameModal(true); }} disabled={creating} style={{
                  padding: '32px 24px', borderRadius: '20px', border: `1.5px solid ${isDark ? '#1e1e22' : '#e5e7eb'}`,
                  background: isDark ? '#111113' : '#fff', color: textMain, cursor: creating ? 'default' : 'pointer',
                  fontFamily: 'inherit', textAlign: 'left', boxShadow: tokens.shadow.card, transition: tokens.transition,
                  display: 'flex', flexDirection: 'column', width: '100%',
                }}
                  onMouseEnter={e => { if (!creating) { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2563eb'; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 12px 24px rgba(37,99,235,0.12)'; } }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = isDark ? '#1e1e22' : '#e5e7eb'; el.style.transform = 'translateY(0)'; el.style.boxShadow = tokens.shadow.card; }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: hexRgba('#2563eb', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>🎯</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Usar modelo de Alta Conversão</div>
                  <div style={{ fontSize: '13px', color: textMut, lineHeight: 1.5 }}>Modelo otimizado para revenda de semijoias com perguntas validadas e alta conversão.</div>
                  {creating && <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontSize: '12px', fontWeight: 600 }}><Loader2 size={14} className="animate-spin" /> Criando...</div>}
                </button>
              </FeatureGate>

              <button onClick={() => handleCreateQuiz(false)} disabled={creating} style={{
                padding: '32px 24px', borderRadius: '20px', border: `1.5px solid ${isDark ? '#1e1e22' : '#e5e7eb'}`,
                background: isDark ? '#111113' : '#fff', color: textMain, cursor: creating ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left', boxShadow: tokens.shadow.card, transition: tokens.transition,
                display: 'flex', flexDirection: 'column'
              }}
                onMouseEnter={e => { if (!creating) { const el = e.currentTarget as HTMLElement; el.style.borderColor = textMain; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = `0 12px 24px ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}`; } }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = isDark ? '#1e1e22' : '#e5e7eb'; el.style.transform = 'translateY(0)'; el.style.boxShadow = tokens.shadow.card; }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>📝</div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Começar em branco</div>
                <div style={{ fontSize: '13px', color: textMut, lineHeight: 1.5 }}>Crie um quiz totalmente personalizado do zero para qualquer tipo de produto ou serviço.</div>
              </button>
            </div>

            {/* List Section */}
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: textMain, marginBottom: '20px' }}>Seus Quizes Criados</h2>

              {quizzes.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '20px', border: `1px dashed ${border}` }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
                  <p style={{ color: textMut, fontSize: '14px' }}>Você ainda não criou nenhum quiz. Escolha uma das opções acima para começar!</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  {quizzes.map(q => (
                    <div key={q.id} onClick={() => loadQuizData(q.id)} style={{
                      padding: '20px 24px', borderRadius: '16px', border: `1px solid ${border}`,
                      background: isDark ? '#111113' : '#fff', cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: '16px'
                    }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2563eb'; el.style.background = isDark ? '#161619' : '#f8faff'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = border; el.style.background = isDark ? '#111113' : '#fff'; }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: q.publicado ? '#10b981' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <ClipboardList size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: textMain }}>{q.titulo}</div>
                        <div style={{ fontSize: '12px', color: textMut }}>/{q.slug} • {q.publicado ? 'Publicado' : 'Rascunho'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={e => { 
                            e.stopPropagation(); 
                            const link = `${BASE_URL}/quiz/${q.slug}`;
                            navigator.clipboard.writeText(link);
                            toast.success('Link copiado!');
                          }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: textMut }} title="Copiar link">
                          <Copy size={16} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); window.open(`${BASE_URL}/quiz/${q.slug}`, '_blank'); }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: textMut }} title="Visualizar">
                          <ExternalLink size={16} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setShowDeleteQuizModal(q.id); }} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: '#ef4444' }} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={18} color={textMut} style={{ marginLeft: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showNameModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
              }} onClick={() => setShowNameModal(false)}>
                <div style={{
                  background: cardBg, borderRadius: '20px', padding: '32px',
                  maxWidth: '400px', width: '100%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                  animation: 'appleIn 0.3s ease'
                }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>🎯</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: textMain, margin: '0 0 8px' }}>
                    Nome do seu quiz
                  </h3>
                  <p style={{ fontSize: '13px', color: textMut, margin: '0 0 20px', lineHeight: 1.5 }}>
                    Escolha um nome para identificar seu quiz. Você pode alterar depois.
                  </p>
                  <input
                    autoFocus
                    placeholder="Ex: Quiz Revendedoras MinhaLoja"
                    value={nomeTemplate}
                    onChange={e => setNomeTemplate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nomeTemplate.trim()) {
                        setShowNameModal(false);
                        handleCreateQuiz(true);
                      }
                    }}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px',
                      border: '1px solid #e5e7eb', background: isDark ? '#1a1a1e' : '#f9fafb',
                      color: textMain, fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '16px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setShowNameModal(false)}
                      style={{
                        flex: 1, padding: '11px', borderRadius: '10px',
                        border: '1px solid #e5e7eb', background: 'transparent',
                        color: textMut, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={!nomeTemplate.trim() || creating}
                      onClick={() => {
                        if (!nomeTemplate.trim()) return;
                        setShowNameModal(false);
                        handleCreateQuiz(true);
                      }}
                      style={{
                        flex: 1, padding: '11px', borderRadius: '10px',
                        border: 'none',
                        background: nomeTemplate.trim() ? '#2563eb' : '#e5e7eb',
                        color: nomeTemplate.trim() ? '#fff' : '#9ca3af',
                        fontSize: '13px', fontWeight: 600,
                        cursor: nomeTemplate.trim() ? 'pointer' : 'default',
                        fontFamily: 'inherit',
                      }}
                    >
                      {creating ? 'Criando...' : 'Criar Quiz'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showDeleteQuizModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setShowDeleteQuizModal(null)}>
                <div style={{ background: cardBg, borderRadius: '24px', padding: '32px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'appleIn 0.3s ease' }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '20px' }}>🗑️</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, color: textMain, marginBottom: '12px' }}>Excluir quiz?</h3>
                  <p style={{ fontSize: '14px', color: textMut, lineHeight: 1.6, marginBottom: '24px' }}>Esta ação é irreversível. Todas as perguntas, blocos e respostas associadas a este quiz serão excluídos permanentemente.</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowDeleteQuizModal(null)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1.5px solid ${border}`, background: 'none', color: textMain, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    <button onClick={() => handleDeleteQuiz(showDeleteQuizModal)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sim, excluir</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      {showQuizUpgrade && (
        <UpgradeModal
          feature="limiteQuizzes"
          planoNecessario="Pro"
          onClose={() => setShowQuizUpgrade(false)}
        />
      )}
      </AppLayout>
    );
  }

  const primary = quiz.cor_primaria || '#2563eb';
  const isPublicado = !!quiz.publicado;

  // ── Fixed page card style ──────────────────────────────────────────────────
  const fixedCardActive = (id: string) => selectedPageId === id;

  // ── Coleta config for collect panel ────────────────────────────────────────
  // Merge stored config with DEFAULT — fills missing fields so inputs never appear blank
  const currentColetaConfig: ColetaCampo[] = (() => {
    if (!quiz.coleta_config?.length) return [...DEFAULT_COLETA_CONFIG];
    const stored = [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem);
    const storedCampos = new Set(stored.map(c => c.campo));
    const missing = DEFAULT_COLETA_CONFIG.filter(d => !storedCampos.has(d.campo));
    const merged = stored.map(cfg => {
      const def = DEFAULT_COLETA_CONFIG.find(d => d.campo === cfg.campo);
      return {
        ...def,
        ...cfg,
        label:       cfg.label       || def?.label       || cfg.campo,
        placeholder: cfg.placeholder || def?.placeholder || '',
        botao_texto: cfg.botao_texto || def?.botao_texto || 'Continuar →',
      };
    });
    return [...merged, ...missing];
  })();

  // ── Design panel ───────────────────────────────────────────────────────────
  function renderDesignPanel() {
    if (!quiz) return null;
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={lbl}>Cor primária</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={quiz.cor_primaria || '#2563eb'}
              onChange={e => updateQuizField('cor_primaria', e.target.value)}
              style={{ width: '36px', height: '34px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
            <input value={quiz.cor_primaria || '#2563eb'}
              onChange={e => updateQuizField('cor_primaria', e.target.value)}
              style={{ ...iStyle, flex: 1 }} />
          </div>
        </div>
        <div>
          <label style={lbl}>Cor do botão <span style={{ fontWeight: 400 }}>(padrão: cor primária)</span></label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={quiz.cor_botao || quiz.cor_primaria || '#2563eb'}
              onChange={e => updateQuizField('cor_botao', e.target.value)}
              style={{ width: '36px', height: '34px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
            <input value={quiz.cor_botao || ''}
              onChange={e => updateQuizField('cor_botao', e.target.value || null)}
              placeholder={quiz.cor_primaria || '#2563eb'}
              style={{ ...iStyle, flex: 1 }} />
            {quiz.cor_botao && (
              <button onClick={() => updateQuizField('cor_botao', null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
                <X style={{ width: '12px', height: '12px' }} />
              </button>
            )}
          </div>
          <p style={{ fontSize: '10px', color: textMut, margin: '3px 0 0' }}>Afeta botões Iniciar, Continuar e Enviar</p>
        </div>
        <div>
          <label style={lbl}>Cor de fundo</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={quiz.cor_fundo || '#ffffff'}
              onChange={e => updateQuizField('cor_fundo', e.target.value)}
              style={{ width: '36px', height: '34px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
            <input value={quiz.cor_fundo || '#ffffff'}
              onChange={e => updateQuizField('cor_fundo', e.target.value)}
              style={{ ...iStyle, flex: 1 }} />
          </div>
          <p style={{ fontSize: '10px', color: textMut, margin: '3px 0 0' }}>Cor de fundo da página do quiz</p>
        </div>
        <div>
          <label style={lbl}>Cor dos títulos</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={quiz.cor_titulo || '#111111'}
              onChange={e => updateQuizField('cor_titulo', e.target.value)}
              style={{ width: '36px', height: '34px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
            <input value={quiz.cor_titulo || '#111111'}
              onChange={e => updateQuizField('cor_titulo', e.target.value)}
              style={{ ...iStyle, flex: 1 }} />
          </div>
          <p style={{ fontSize: '10px', color: textMut, margin: '3px 0 0' }}>Afeta títulos, perguntas e texto principal</p>
        </div>
        <div>
          <label style={lbl}>Cor do subtítulo / texto secundário</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="color" value={quiz.cor_subtitulo || '#6b7280'}
              onChange={e => updateQuizField('cor_subtitulo', e.target.value)}
              style={{ width: '36px', height: '34px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
            <input value={quiz.cor_subtitulo || '#6b7280'}
              onChange={e => updateQuizField('cor_subtitulo', e.target.value)}
              style={{ ...iStyle, flex: 1 }} />
          </div>
          <p style={{ fontSize: '10px', color: textMut, margin: '3px 0 0' }}>Afeta subtítulos e textos de apoio</p>
        </div>
        <div>
          <label style={lbl}>Logo</label>
          {quiz.logo_url ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg }}>
                <img src={quiz.logo_url} alt="Logo" style={{ height: `${quiz.logo_altura || 32}px`, maxWidth: '80px', objectFit: 'contain', borderRadius: 4 }} />
                <span style={{ flex: 1, fontSize: '12px', color: textMut }}>Logo ativa</span>
                <button onClick={async () => { await db.from('quizzes').update({ logo_url: null }).eq('id', quiz.id); setQuiz(q => q ? { ...q, logo_url: null } : q); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
              <div style={{ marginTop: '10px' }}>
                <label style={lbl}>Tamanho da logo: {quiz.logo_altura || 32}px</label>
                <input
                  type="range" min={20} max={80} step={4}
                  value={quiz.logo_altura || 32}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setQuiz(q => q ? { ...q, logo_altura: val } : q);
                  }}
                  style={{ width: '100%', marginTop: '4px', accentColor: '#2563eb' }}
                />
              </div>
            </div>
          ) : (
            <>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'logo_url'); }} />
              <button onClick={() => logoInputRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '10px 12px', borderRadius: tokens.radius.sm, border: `1.5px dashed ${border}`, background: 'transparent', color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {uploading ? <><Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Enviando...</> : <><Upload style={{ width: '13px', height: '13px' }} /> Upload da logo</>}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Right panel ────────────────────────────────────────────────────────────
  function renderRightPanel() {
    if (!quiz) return null;

    // COVER
    if (selectedPageType === 'cover') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Título da capa</label>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={() => moveCapaElement('titulo', -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronUp style={{ width: '12px', height: '12px' }} /></button>
                      <button onClick={() => moveCapaElement('titulo', 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronDown style={{ width: '12px', height: '12px' }} /></button>
                    </div>
                  </div>
                  <textarea value={quiz.capa_titulo || ''} rows={2}
                    onChange={e => updateQuizField('capa_titulo', e.target.value)}
                    placeholder={quiz.titulo} style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Subtítulo</label>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={() => moveCapaElement('subtitulo', -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronUp style={{ width: '12px', height: '12px' }} /></button>
                      <button onClick={() => moveCapaElement('subtitulo', 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronDown style={{ width: '12px', height: '12px' }} /></button>
                    </div>
                  </div>
                  <textarea value={quiz.capa_subtitulo || ''} rows={2}
                    onChange={e => updateQuizField('capa_subtitulo', e.target.value)}
                    placeholder="Texto de apoio..." style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Imagem de capa</label>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={() => moveCapaElement('imagem', -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronUp style={{ width: '12px', height: '12px' }} /></button>
                      <button onClick={() => moveCapaElement('imagem', 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronDown style={{ width: '12px', height: '12px' }} /></button>
                    </div>
                  </div>
                  {quiz.capa_imagem_url ? (
                    <div>
                      <div style={{ position: 'relative' }}>
                        <img src={quiz.capa_imagem_url} alt="" style={{ width: '100%', height: `${Math.round((quiz.capa_imagem_height || 200) * 90 / 200)}px`, objectFit: 'cover', borderRadius: tokens.radius.sm, display: 'block' }} />
                        <button onClick={() => updateQuizField('capa_imagem_url', null)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X style={{ width: '12px', height: '12px' }} />
                        </button>
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <label style={lbl}>Altura da imagem <span style={{ fontWeight: 400 }}>{quiz.capa_imagem_height || 200}px</span></label>
                        <input type="range" min={80} max={400} step={10}
                          value={quiz.capa_imagem_height || 200}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setQuiz(q => q ? { ...q, capa_imagem_height: val } : q);
                          }}
                          style={{ width: '100%', marginTop: '4px', accentColor: '#2563eb' }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <input ref={capaInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'capa_imagem_url'); }} />
                      <button onClick={() => capaInputRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '10px 12px', borderRadius: tokens.radius.sm, border: `1.5px dashed ${border}`, background: 'transparent', color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {uploading ? <><Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Enviando...</> : <><Upload style={{ width: '13px', height: '13px' }} /> Upload da imagem</>}
                      </button>
                    </>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Benefícios</label>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={() => moveCapaElement('beneficios', -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronUp style={{ width: '12px', height: '12px' }} /></button>
                      <button onClick={() => moveCapaElement('beneficios', 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronDown style={{ width: '12px', height: '12px' }} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '6px' }}>
                    {(quiz.capa_beneficios || []).map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ flex: 1, fontSize: '12px', color: textMain, padding: '5px 8px', background: inputBg, borderRadius: tokens.radius.sm, border: `1px solid ${border}` }}>{b}</span>
                        <button onClick={() => removeBenefit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '3px', flexShrink: 0 }}>
                          <X style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input value={newBenefit} onChange={e => setNewBenefit(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                      placeholder="Novo benefício..." style={{ ...iStyle, flex: 1 }} />
                    <button onClick={addBenefit} style={{ padding: '7px 10px', borderRadius: tokens.radius.sm, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <Plus style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ ...lbl, marginBottom: 0 }}>Texto do botão</label>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button onClick={() => moveCapaElement('botao', -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronUp style={{ width: '12px', height: '12px' }} /></button>
                      <button onClick={() => moveCapaElement('botao', 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, padding: '2px' }}><ChevronDown style={{ width: '12px', height: '12px' }} /></button>
                    </div>
                  </div>
                  <input value={quiz.capa_botao_texto || ''} style={iStyle}
                    onChange={e => updateQuizField('capa_botao_texto', e.target.value)}
                    placeholder="Clique para iniciar →" />
                </div>
              </div>
          </div>
        </div>
      );
    }

    // QUESTION
    if (selectedPageType === 'question' && selectedPergunta) {
      const conditionalOpcoes = selectedPergunta.condicao_pergunta_id
        ? (opcoes[selectedPergunta.condicao_pergunta_id] || []) : [];

      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Tipo de resposta</label>
            <select value={selectedPergunta.tipo_resposta || 'unica'}
              onChange={e => updatePergunta(selectedPergunta.id, 'tipo_resposta', e.target.value)}
              style={{ ...iStyle }}>
              <option value="unica">Seleção única (avança automático)</option>
              <option value="multipla">Múltipla escolha (botão continuar)</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Texto da etapa</label>
            <textarea value={selectedPergunta.texto}
              onChange={e => updatePergunta(selectedPergunta.id, 'texto', e.target.value)}
              placeholder="Digite a pergunta..."
              rows={3} style={{ ...iStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={lbl}>Sub-texto <span style={{ fontWeight: 400, color: textMut }}>(opcional)</span></label>
            <input value={selectedPergunta.subtexto || ''}
              onChange={e => updatePergunta(selectedPergunta.id, 'subtexto', e.target.value || null)}
              placeholder="Contexto adicional..." style={iStyle} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, paddingRight: '48px' }}>Score</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selectedPergOpcoes.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  {selectedPergOpcoes.map(op => (
                    <SortableOpcaoCard
                      key={op.id} op={op} isDark={isDark} border={border} textMut={textMut} primary={primary} iStyle={iStyle} lbl={lbl}
                      isEditing={editingOpcaoId === op.id}
                      onToggleEdit={() => setEditingOpcaoId(editingOpcaoId === op.id ? null : op.id)}
                      onUpdate={(f, v) => updateOpcao(op.id, f, v)}
                      onDelete={() => deleteOpcao(op.id)}
                      allPages={flatPerguntas}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <button onClick={() => addOpcao(selectedPergunta.id)} style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
              borderRadius: tokens.radius.sm, border: `1px dashed ${border}`,
              background: 'transparent', color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Adicionar opção
            </button>
          </div>
        </div>
      );
    }

    // ANALISE
    if (selectedPageType === 'analise') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Título da análise</label>
            <input value={quiz.analise_titulo || ''}
              onChange={e => updateQuizField('analise_titulo', e.target.value)}
              placeholder="Ex: Estamos analisando seu perfil..." style={iStyle} />
          </div>
          <div>
            <label style={lbl}>Subtítulo</label>
            <textarea value={quiz.analise_subtitulo || ''}
              onChange={e => updateQuizField('analise_subtitulo', e.target.value)}
              placeholder="Explique o que está acontecendo..."
              style={{ ...iStyle, height: '60px', resize: 'none' }} />
          </div>
          <div>
            <label style={lbl}>Tempo de análise (segundos)</label>
            <input type="number" min={1} max={30} value={quiz.analise_duracao || 4}
              onChange={e => updateQuizField('analise_duracao', Number(e.target.value))}
              style={iStyle} />
          </div>
          <div>
            <label style={lbl}>Depoimentos</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(quiz.analise_depoimentos?.length ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS).map((d, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${border}`, background: inputBg }}>
                  <input value={d.nome} onChange={e => {
                    const current = quiz.analise_depoimentos?.length ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS;
                    const newDep = [...current];
                    newDep[i] = { ...newDep[i], nome: e.target.value };
                    updateQuizField('analise_depoimentos', newDep);
                  }} placeholder="Nome" style={{ ...iStyle, marginBottom: '5px' }} />

                  <input value={d.handle} onChange={e => {
                    const current = quiz.analise_depoimentos?.length ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS;
                    const newDep = [...current];
                    newDep[i] = { ...newDep[i], handle: e.target.value };
                    updateQuizField('analise_depoimentos', newDep);
                  }} placeholder="@handle" style={{ ...iStyle, marginBottom: '5px', fontSize: '11px' }} />

                  <textarea value={d.texto} onChange={e => {
                    const current = quiz.analise_depoimentos?.length ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS;
                    const newDep = [...current];
                    newDep[i] = { ...newDep[i], texto: e.target.value };
                    updateQuizField('analise_depoimentos', newDep);
                  }} placeholder="Texto do depoimento" style={{ ...iStyle, height: '60px', resize: 'none' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // APPROVAL — FEATURE 2: Pixel Meta
    if (selectedPageType === 'approval') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Título da aprovação</label>
            <input value={quiz.mensagem_aprovado || ''}
              onChange={e => updateQuizField('mensagem_aprovado', e.target.value)}
              placeholder="Ex: Parabéns! Você foi aprovada." style={iStyle} />
          </div>
          <div>
            <label style={lbl}>Subtítulo</label>
            <textarea value={quiz.mensagem_aprovado_subtitulo || ''}
              onChange={e => updateQuizField('mensagem_aprovado_subtitulo', e.target.value)}
              placeholder="Explique os próximos passos..."
              style={{ ...iStyle, height: '60px', resize: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Corte verde (pts)</label>
              <input type="number" value={quiz.corte_verde}
                onChange={e => updateQuizField('corte_verde', Number(e.target.value))}
                style={iStyle} />
            </div>
            <div>
              <label style={lbl}>Corte amarelo (pts)</label>
              <input type="number" value={quiz.corte_amarelo}
                onChange={e => updateQuizField('corte_amarelo', Number(e.target.value))}
                style={iStyle} />
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: tokens.radius.md, background: hexToRgba('#2563eb', 0.06), border: `1px solid ${hexToRgba('#2563eb', 0.15)}` }}>
            <p style={{ fontSize: '11px', color: '#2563eb', margin: 0, lineHeight: 1.5 }}>
              ✅ Verde: ≥ {quiz.corte_verde} pts · 🟡 Amarelo: ≥ {quiz.corte_amarelo} pts · ❌ Reprovado: abaixo de {quiz.corte_amarelo} pts
            </p>
          </div>

          <div style={{ padding: '12px', borderRadius: '12px', background: inputBg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: textMain }}>Disparar evento de Lead</span>
                <span style={{ fontSize: '11px', color: textMut }}>Somente na aprovação</span>
              </div>
              <div onClick={() => updateQuizField('pixel_fire_lead_event', !(quiz as any).pixel_fire_lead_event)} style={{ width: '32px', height: '18px', borderRadius: 99, background: (quiz as any).pixel_fire_lead_event !== false ? '#2563eb' : '#d1d5db', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '2px', left: (quiz as any).pixel_fire_lead_event !== false ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <button onClick={() => { setShowSettings(true); setSettingsTab('Pixel/Scripts'); }} style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
              Configure seu pixel aqui
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowAdvanced(!showAdvanced)}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: textMain, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avançado (Scripts)</span>
              {showAdvanced ? <ChevronUp style={{ width: '16px' }} /> : <ChevronDown style={{ width: '16px' }} />}
            </div>
            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <label style={lbl}>Script da página</label>
                <textarea
                  value={(quiz as any).pixel_custom_event_name || ''}
                  onChange={e => updateQuizField('pixel_custom_event_name', e.target.value)}
                  placeholder="Digite seu script..."
                  style={{ ...iStyle, height: '100px', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }} />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedPageType === 'collect') {
      const slugify = (str: string) => str.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

      const addColetaCampo = () => {
        if (!newCampoLabel.trim()) { toast.error('Informe o nome do campo'); return; }
        const campoId = slugify(newCampoLabel);
        if (currentColetaConfig.some(c => c.campo === campoId)) { toast.error('Já existe um campo com esse nome'); return; }
        const newCfg: ColetaCampo = {
          campo: campoId, label: newCampoLabel.trim(),
          placeholder: newCampoPlaceholder.trim() || newCampoLabel.trim(),
          obrigatorio: newCampoObrigatorio, tipo: newCampoTipo || 'texto',
          ordem: currentColetaConfig.length + 1,
        };
        const updated = [...currentColetaConfig, newCfg];
        updateColetaConfig(updated);
        setNewCampoLabel(''); setNewCampoPlaceholder(''); setNewCampoTipo('texto');
        setNewCampoObrigatorio(false); setShowAddColeta(false);
        setExpandedColetaCampo(campoId);
        setPreviewColetaIdx(updated.length - 1);
        toast.success('Campo adicionado');
      };

      // Add campo form
      if (showAddColeta) {
        return (
          <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>Novo campo</span>
              <button onClick={() => { setShowAddColeta(false); setNewCampoLabel(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '2px' }}>
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
            <div>
              <label style={lbl}>Nome do campo</label>
              <input value={newCampoLabel} onChange={e => setNewCampoLabel(e.target.value)} placeholder="Ex: Data de nascimento" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} autoFocus />
              {newCampoLabel && <span style={{ fontSize: '10px', color: textMut, fontFamily: 'monospace' }}>{`ID: {{${slugify(newCampoLabel)}}}`}</span>}
            </div>
            <div>
              <label style={lbl}>Tipo</label>
              <select value={newCampoTipo || 'texto'} onChange={e => setNewCampoTipo(e.target.value as ColetaCampo['tipo'])} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const, height: '34px', padding: '0 8px' }}>
                {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Placeholder</label>
              <input value={newCampoPlaceholder} onChange={e => setNewCampoPlaceholder(e.target.value)} placeholder="Texto de exemplo" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: textMain }}>Obrigatório</span>
              <div onClick={() => setNewCampoObrigatorio(v => !v)} style={{ width: '34px', height: '20px', borderRadius: '99px', background: newCampoObrigatorio ? '#2563eb' : (isDark ? '#3f3f46' : '#d1d5db'), position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '3px', left: newCampoObrigatorio ? '17px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => { setShowAddColeta(false); setNewCampoLabel(''); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${border}`, background: 'transparent', color: textMut, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={addColetaCampo} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Adicionar</button>
            </div>
          </div>
        );
      }

      // Single-campo settings panel
      const selectedCfg = expandedColetaCampo
        ? currentColetaConfig.find(c => c.campo === expandedColetaCampo)
        : currentColetaConfig[0];

      if (!selectedCfg) {
        return (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: textMut, fontSize: '13px' }}>
            Selecione um campo na sidebar para editar
          </div>
        );
      }

      const isDefaultCampo = DEFAULT_CAMPOS.has(selectedCfg.campo);
      const isWA = selectedCfg.campo === 'whatsapp';

      const updateCampo = (updated: Partial<ColetaCampo>) => {
        updateColetaConfig(currentColetaConfig.map(c =>
          c.campo === selectedCfg.campo ? { ...c, ...updated } : c
        ));
      };

      // ── Element card selector (null state) ────────────────────────────────
      if (selectedColetaElement === null) {
        const elementCards: { type: 'texto' | 'campo' | 'botao' | 'aviso'; icon: string; label: string; desc: string }[] = [
          { type: 'texto', icon: '✏️', label: 'Textos', desc: 'Título e subtítulo da etapa' },
          { type: 'campo', icon: '⌨️', label: 'Campo', desc: 'Placeholder, tipo e obrigatoriedade' },
          { type: 'botao', icon: '🔘', label: 'Botão', desc: 'Texto e ação do botão' },
          ...(isWA ? [{ type: 'aviso' as const, icon: '💬', label: 'Aviso WA', desc: 'Mensagem exibida abaixo do botão' }] : []),
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {elementCards.map(({ type, icon, label, desc }) => (
                <div key={type} onClick={() => setSelectedColetaElement(type)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${border}`, background: cardBg, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = primary; el.style.background = hexToRgba(primary, 0.04); }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = border; el.style.background = cardBg; }}>
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: textMain }}>{label}</div>
                    <div style={{ fontSize: '11px', color: textMut, marginTop: '1px' }}>{desc}</div>
                  </div>
                  <ChevronRight style={{ width: '14px', height: '14px', color: textMut, flexShrink: 0 }} />
                </div>
              ))}
            </div>
            {!isDefaultCampo && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${border}` }}>
                <button onClick={() => {
                  const next = currentColetaConfig.filter(c => c.campo !== selectedCfg.campo).map((c, j) => ({ ...c, ordem: j + 1 }));
                  updateColetaConfig(next);
                  const idx = currentColetaConfig.findIndex(c => c.campo === selectedCfg.campo);
                  const fallback = next[Math.max(0, idx - 1)];
                  if (fallback) { setExpandedColetaCampo(fallback.campo); setPreviewColetaIdx(Math.max(0, idx - 1)); }
                  else { setExpandedColetaCampo(next[0]?.campo ?? null); setPreviewColetaIdx(0); }
                }} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit' }}>
                  <Trash2 style={{ width: '14px', height: '14px' }} /> Remover campo
                </button>
              </div>
            )}
          </div>
        );
      }

      // ── Focused element panel ─────────────────────────────────────────────
      const elementLabelMap: Record<string, string> = { texto: 'Textos', campo: 'Campo', botao: 'Botão', aviso: 'Aviso WA' };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => setSelectedColetaElement(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f3f4f6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <ChevronLeft style={{ width: '12px', height: '12px' }} /> Voltar
            </button>
            <span style={{ fontSize: '11px', color: textMut }}>/</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: textMain }}>{elementLabelMap[selectedColetaElement]}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedColetaElement === 'texto' && (
              <>
                <div>
                  <label style={lbl}>Título do campo</label>
                  <input value={selectedCfg.label} onChange={e => updateCampo({ label: e.target.value })} placeholder="Ex: Qual o seu Instagram?" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={lbl}>Subtítulo <span style={{ fontWeight: 400, color: textMut }}>(opcional)</span></label>
                  <input value={selectedCfg.subtitulo || ''} onChange={e => updateCampo({ subtitulo: e.target.value || undefined })} placeholder="Dica exibida abaixo da pergunta" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
                </div>
              </>
            )}

            {selectedColetaElement === 'campo' && (
              <>
                <div>
                  <label style={lbl}>Placeholder</label>
                  <input value={selectedCfg.placeholder} onChange={e => updateCampo({ placeholder: e.target.value })} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={lbl}>Tipo do campo</label>
                  <select value={selectedCfg.tipo || 'texto'} onChange={e => updateCampo({ tipo: e.target.value as ColetaCampo['tipo'] })} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const, height: '34px', padding: '0 8px' }}>
                    {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>ID automático</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ padding: '5px 9px', borderRadius: '8px', background: isDark ? '#18181b' : '#f1f5f9', border: `1px solid ${border}`, fontFamily: 'monospace', fontSize: '12px', color: '#2563eb' }}>
                      {`{{${selectedCfg.campo}}}`}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(`{{${selectedCfg.campo}}}`); toast.success('Copiado!'); }} title="Copiar ID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '4px', borderRadius: '4px' }}>
                      <Copy style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: textMain }}>Obrigatório</span>
                  <div onClick={() => { if (!isWA) updateCampo({ obrigatorio: !selectedCfg.obrigatorio }); }}
                    style={{ width: '34px', height: '20px', borderRadius: '99px', background: selectedCfg.obrigatorio ? '#2563eb' : (isDark ? '#3f3f46' : '#d1d5db'), position: 'relative', cursor: isWA ? 'not-allowed' : 'pointer', transition: 'background 0.2s', flexShrink: 0, opacity: isWA ? 0.5 : 1 }}>
                    <div style={{ position: 'absolute', top: '3px', left: selectedCfg.obrigatorio ? '17px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                  </div>
                </div>
              </>
            )}

            {selectedColetaElement === 'botao' && (
              <>
                <div>
                  <label style={lbl}>Texto do botão</label>
                  <input value={selectedCfg.botao_texto || ''} onChange={e => updateCampo({ botao_texto: e.target.value || null })} placeholder="Continuar →" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={lbl}>Ação do botão</label>
                  <select
                    value={selectedCfg.botao_acao === 'whatsapp' ? 'redirecionar' : (selectedCfg.botao_acao || 'proxima_etapa')}
                    onChange={e => updateCampo({ botao_acao: e.target.value as ColetaCampo['botao_acao'], botao_target: null })}
                    style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const, height: '34px', padding: '0 8px' }}>
                    <option value="proxima_etapa">Próxima etapa</option>
                    <option value="redirecionar">Redirecionar</option>
                    <option value="pagina_sucesso">Página de sucesso</option>
                  </select>
                </div>
                {(selectedCfg.botao_acao === 'proxima_etapa' || !selectedCfg.botao_acao || selectedCfg.botao_acao === 'whatsapp') && (
                  <div>
                    <label style={lbl}>Ir para qual etapa?</label>
                    <select value={selectedCfg.botao_target || 'proxima'} onChange={e => updateCampo({ botao_target: e.target.value === 'proxima' ? null : e.target.value })} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const, height: '34px', padding: '0 8px' }}>
                      <option value="proxima">Próxima (padrão)</option>
                      {currentColetaConfig.filter(c => c.campo !== selectedCfg.campo).map(c => (
                        <option key={c.campo} value={c.campo}>{c.label}</option>
                      ))}
                      <option value="aprovacao">Página de Aprovação ✅</option>
                      <option value="reprovacao">Página de Reprovação ❌</option>
                    </select>
                  </div>
                )}
                {selectedCfg.botao_acao === 'redirecionar' && (
                  <div>
                    <label style={lbl}>URL de destino</label>
                    <input value={selectedCfg.botao_target || ''} onChange={e => updateCampo({ botao_target: e.target.value || null })} placeholder="https://..." style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const }} />
                  </div>
                )}
              </>
            )}

            {selectedColetaElement === 'aviso' && isWA && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: textMain, fontWeight: 500 }}>Mostrar aviso</span>
                  <div onClick={() => updateCampo({ show_whatsapp_warning: selectedCfg.show_whatsapp_warning === false ? undefined : false })}
                    style={{ width: '34px', height: '20px', borderRadius: '99px', background: selectedCfg.show_whatsapp_warning !== false ? '#2563eb' : (isDark ? '#3f3f46' : '#d1d5db'), position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '3px', left: selectedCfg.show_whatsapp_warning !== false ? '17px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                  </div>
                </div>
                {selectedCfg.show_whatsapp_warning !== false && (
                  <div>
                    <label style={lbl}>Texto do aviso</label>
                    <textarea
                      value={selectedCfg.whatsapp_warning_text || ''}
                      onChange={e => updateCampo({ whatsapp_warning_text: e.target.value || null })}
                      placeholder="📲 Ao clicar, você será direcionada para o WhatsApp. Envie a mensagem para garantir sua vaga — a mensagem já vem preenchida ✓"
                      rows={4}
                      style={{ ...iStyle, width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    // REJECTION
    if (selectedPageType === 'rejection') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Título da reprovação</label>
            <input value={quiz.mensagem_reprovado || ''}
              onChange={e => updateQuizField('mensagem_reprovado', e.target.value)}
              placeholder="Ex: Não foi desta vez..." style={iStyle} />
          </div>
          <div>
            <label style={lbl}>Subtítulo</label>
            <textarea value={(quiz as any).mensagem_reprovado_subtitulo || ''}
              onChange={e => updateQuizField('mensagem_reprovado_subtitulo', e.target.value)}
              placeholder="No momento seu perfil não atende..."
              style={{ ...iStyle, height: '60px', resize: 'none' }} />
          </div>

          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Dicas de melhoria</p>
            <textarea
              value={Array.isArray(quiz.reprovado_conteudo) ? quiz.reprovado_conteudo.join('\n') : ''}
              onChange={e => updateQuizField('reprovado_conteudo', e.target.value.split('\n'))}
              placeholder="Ex: Regularize seu CPF"
              style={{ ...iStyle, height: '100px', resize: 'none', fontSize: '12px' }} />
          </div>

          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Botão de Ação (opcional)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={lbl}>Texto do botão</label>
                <input value={(quiz as any).reprovado_botao_texto || ''}
                  onChange={e => updateQuizField('reprovado_botao_texto', e.target.value)}
                  placeholder="Ex: Nos acompanhe no Instagram" style={iStyle} />
              </div>
              <div>
                <label style={lbl}>Link de destino</label>
                <input value={(quiz as any).reprovado_botao_url || ''}
                  onChange={e => updateQuizField('reprovado_botao_url', e.target.value)}
                  placeholder="https://..." style={iStyle} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Phone preview dimensions ────────────────────────────────────────────────
  // Content renders at native width — no transform scale needed
  const PHONE_INNER_H = 645; // 720px frame - 12px*2 border - 51px DI (14+37)
  const previewBg = isDark
    ? 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%), #0a0a0f'
    : 'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.06) 0%, transparent 70%), #f0f0f2';

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        {/* Tabs and Navigation */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: cardBg, padding: '0 16px', alignItems: 'center', height: '52px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '32px' }}>
            <button onClick={() => setQuiz(null)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: textMut, display: 'flex' }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: textMain }}>{quiz.titulo}</span>
              <span style={{ fontSize: '10px', color: textMut }}>/{quiz.slug}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', height: '100%', alignItems: 'center' }}>
            {(['editor', 'design', 'leads'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  height: '100%', padding: '0 16px', border: 'none', background: 'transparent',
                  color: activeTab === tab ? '#2563eb' : textMut,
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer', position: 'relative',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'color 0.2s'
                }}
              >
                {tab === 'editor' ? <Plus size={14} /> : tab === 'design' ? <Palette size={14} /> : <Users size={14} />}
                {tab === 'editor' ? 'Editor' : tab === 'design' ? 'Design' : 'Leads'}
                {activeTab === tab && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#2563eb' }} />
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeTab === 'editor' && (
              <div
                onClick={toggleAtivo}
                title={quiz.ativo ? 'Quiz ativo (clique para desativar)' : 'Quiz inativo (clique para ativar)'}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 10px', borderRadius: tokens.radius.sm, border: `1px solid ${quiz.ativo ? '#16a34a' : border}`, background: quiz.ativo ? 'rgba(22,163,74,0.08)' : 'transparent' }}
              >
                <div style={{ width: '28px', height: '16px', borderRadius: '99px', background: quiz.ativo ? '#16a34a' : (isDark ? '#3f3f46' : '#d1d5db'), position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '2px', left: quiz.ativo ? '14px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: quiz.ativo ? '#16a34a' : textMut }}>{quiz.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            )}

            {/* Salvar */}
            <button onClick={handleManualSave} disabled={isSaving || !hasUnsavedChanges} style={{
              padding: '6px 12px', borderRadius: tokens.radius.sm,
              border: `1px solid ${hasUnsavedChanges ? '#2563eb' : border}`,
              background: hasUnsavedChanges ? '#2563eb' : 'transparent',
              color: hasUnsavedChanges ? '#fff' : textMut,
              fontSize: '12px', fontWeight: 600,
              cursor: hasUnsavedChanges ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: '6px',
              opacity: isSaving ? 0.7 : 1,
            }}>
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {isSaving ? 'Salvando...' : hasUnsavedChanges ? 'Salvar' : 'Salvo'}
            </button>

            {/* Publicar */}
            {(() => {
              const isLive = isPublicado && !hasUnsavedChanges && !hasUnpublishedEdits;
              return (
                <button
                  onClick={() => { if (!hasUnsavedChanges) setShowPublishModal(true); }}
                  disabled={hasUnsavedChanges}
                  title={hasUnsavedChanges ? 'Salve as alterações antes de publicar' : undefined}
                  style={{
                    padding: '6px 12px', borderRadius: tokens.radius.sm,
                    fontSize: '12px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px',
                    cursor: hasUnsavedChanges ? 'not-allowed' : 'pointer',
                    opacity: hasUnsavedChanges ? 0.4 : 1,
                    border: isLive ? '1px solid #16a34a' : 'none',
                    background: isLive ? 'transparent' : '#2563eb',
                    color: isLive ? '#16a34a' : '#fff',
                  }}>
                  {isLive ? 'Publicado ✓' : 'Publicar'}
                </button>
              );
            })()}

            <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex' }}>
              <Settings size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {activeTab === 'leads' ? (
            <QuizLeads quizId={quiz.id} isDark={isDark} theme={theme} />
          ) : (
            <>

          {/* ══ LEFT COLUMN ═════════════════════════════════════════════════ */}
          <div style={{ width: '232px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${border}`, background: cardBg }}>
            {/* Page list */}
            <div ref={pageListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>

              {/* Fixed: Capa */}
              {(() => {
                const active = fixedCardActive('cover');
                return (
                  <div onClick={() => setSelectedPageId('cover')} style={{
                    padding: '10px 10px 10px 8px', borderRadius: '10px', marginBottom: '3px',
                    cursor: 'pointer', border: `1.5px solid ${active ? '#2563eb' : 'transparent'}`,
                    background: active ? hexToRgba('#2563eb', 0.06) : 'transparent',
                    opacity: selectedPageType === 'question' ? 0.4 : 1,
                    transition: `${tokens.transition}, opacity 150ms ease`,
                  }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px' }}>📋</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? '#2563eb' : textMain }}>Capa</div>
                        <div style={{ fontSize: '10px', color: textMut }}>Página inicial</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Questions grouped by bloco */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={flatPerguntas.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {blocos.length > 0 && (
                    <div style={{ borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, marginBottom: '3px', paddingTop: '4px', paddingBottom: '4px' }}>
                      {[...blocos].sort((a, b) => a.ordem - b.ordem).map(bloco => {
                        const blocoFlatPergs = flatPerguntas.filter(p => p.bloco_id === bloco.id);
                        const isEditingBloco = editingBlocoId === bloco.id;
                        const isEmpty = blocoFlatPergs.length === 0;
                        return (
                          <div key={bloco.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 4px 3px' }}
                              onClick={e => e.stopPropagation()}>
                              {bloco.emoji && <span style={{ fontSize: '12px', flexShrink: 0 }}>{bloco.emoji}</span>}
                              {isEditingBloco ? (
                                <input autoFocus value={bloco.titulo}
                                  onChange={e => updateBlocoField(bloco.id, 'titulo', e.target.value)}
                                  onBlur={() => setEditingBlocoId(null)}
                                  onKeyDown={e => e.key === 'Enter' && setEditingBlocoId(null)}
                                  style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: textMain, border: '1px solid #2563eb', borderRadius: '4px', padding: '1px 5px', background: inputBg, outline: 'none', fontFamily: 'inherit' }} />
                              ) : (
                                <span onClick={() => setEditingBlocoId(bloco.id)} title="Clique para renomear"
                                  style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'text' }}>
                                  {bloco.titulo}
                                </span>
                              )}
                              {isEmpty && (
                                <button onClick={() => deleteBloco(bloco.id)} title="Excluir bloco vazio"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
                                  <Trash2 style={{ width: '10px', height: '10px' }} />
                                </button>
                              )}
                            </div>
                            {isEmpty && (
                              <div style={{ padding: '4px 8px 6px', fontSize: '10px', color: textMut, fontStyle: 'italic' }}>
                                Bloco vazio — arraste etapas aqui ou exclua
                              </div>
                            )}
                            {blocoFlatPergs.map(perg => (
                              <SortablePerguntaCard
                                key={perg.id}
                                perg={perg}
                                isActive={selectedPageId === perg.id}
                                isHovered={hoveredCard === perg.id}
                                isDimmed={selectedPageType === 'question' && selectedPageId !== perg.id}
                                primary={primary}
                                textMain={textMain}
                                textMut={textMut}
                                isDark={isDark}
                                onSelect={() => setSelectedPageId(perg.id)}
                                onHover={setHoveredCard}
                                onDuplicate={() => duplicatePergunta(perg.id)}
                                onDelete={() => setShowDeleteModal(perg.id)}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SortableContext>
              </DndContext>

              {/* Fixed: Analise, Approval */}
              {[
                { id: 'analise', icon: '⌛', label: 'Análise', sub: 'Página de transição' },
                { id: 'approval', icon: '✅', label: 'Aprovação', sub: 'Tela de sucesso' },
              ].map(({ id, icon, label, sub }) => {
                const active = fixedCardActive(id);
                return (
                  <div key={id} onClick={() => setSelectedPageId(id)} style={{
                    padding: '10px 10px 10px 8px', borderRadius: '10px', marginBottom: '3px',
                    cursor: 'pointer', border: `1.5px solid ${active ? '#2563eb' : 'transparent'}`,
                    background: active ? hexToRgba('#2563eb', 0.06) : 'transparent',
                    opacity: selectedPageType === 'question' ? 0.4 : 1,
                    transition: `${tokens.transition}, opacity 150ms ease`,
                  }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? '#2563eb' : textMain }}>{label}</div>
                        <div style={{ fontSize: '10px', color: textMut }}>{sub}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Collect with expandable sub-items */}
              {(() => {
                const isCollectActive = selectedPageId === 'collect';
                const dimmed = selectedPageType === 'question';
                return (
                  <div style={{ marginBottom: '3px', opacity: dimmed ? 0.4 : 1, transition: 'opacity 150ms ease' }}>
                    <div onClick={() => {
                        setSelectedPageId('collect');
                        const first = currentColetaConfig[0];
                        if (first) { setExpandedColetaCampo(first.campo); setPreviewColetaIdx(0); setPreviewPhase('coleta'); }
                      }} style={{
                      padding: '10px 10px 10px 8px', borderRadius: '10px',
                      cursor: 'pointer', border: `1.5px solid ${isCollectActive ? '#2563eb' : 'transparent'}`,
                      background: isCollectActive ? hexToRgba('#2563eb', 0.06) : 'transparent',
                      transition: tokens.transition,
                    }}
                      onMouseEnter={e => { if (!isCollectActive) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                      onMouseLeave={e => { if (!isCollectActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '14px' }}>📝</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: isCollectActive ? 700 : 500, color: isCollectActive ? '#2563eb' : textMain }}>Coleta de dados</div>
                          <div style={{ fontSize: '10px', color: textMut }}>Formulário</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: isCollectActive ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                          <path d="M2 4l4 4 4-4" stroke={textMut} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>

                    {isCollectActive && (
                      <div style={{ paddingLeft: '10px', paddingBottom: '2px' }}>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => {
                          const { active, over } = event;
                          if (!over || active.id === over.id) return;
                          const idA = String(active.id).replace('sidebar-coleta-', '');
                          const idB = String(over.id).replace('sidebar-coleta-', '');
                          const idxA = currentColetaConfig.findIndex(c => c.campo === idA);
                          const idxB = currentColetaConfig.findIndex(c => c.campo === idB);
                          if (idxA < 0 || idxB < 0) return;
                          const reordered = arrayMove([...currentColetaConfig], idxA, idxB).map((c, i) => ({ ...c, ordem: i + 1 }));
                          updateColetaConfig(reordered);
                        }}>
                          <SortableContext items={currentColetaConfig.map(c => `sidebar-coleta-${c.campo}`)} strategy={verticalListSortingStrategy}>
                            {currentColetaConfig.map((cfg, i) => (
                              <SortableColetaSidebarItem
                                key={cfg.campo}
                                cfg={cfg}
                                index={i}
                                isActive={expandedColetaCampo === cfg.campo}
                                isDark={isDark}
                                textMain={textMain}
                                textMut={textMut}
                                border={border}
                                primary='#2563eb'
                                onClick={() => {
                                  setExpandedColetaCampo(cfg.campo);
                                  setPreviewColetaIdx(i);
                                  setPreviewPhase('coleta');
                                }}
                                onDelete={() => {
                                  const next = currentColetaConfig.filter(c => c.campo !== cfg.campo).map((c, j) => ({ ...c, ordem: j + 1 }));
                                  updateColetaConfig(next);
                                  const fallback = next[Math.max(0, i - 1)];
                                  if (fallback) { setExpandedColetaCampo(fallback.campo); setPreviewColetaIdx(Math.max(0, i - 1)); }
                                  else setExpandedColetaCampo(null);
                                }}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                        <button
                          onClick={() => { setSelectedPageId('collect'); setShowAddColeta(true); setExpandedColetaCampo(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 7px', borderRadius: '8px', border: `1px dashed ${border}`, background: 'transparent', color: textMut, fontSize: '10px', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '2px' }}>
                          <Plus style={{ width: '9px', height: '9px' }} /> Adicionar campo
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Fixed: Rejection */}
              {[{ id: 'rejection', icon: '❌', label: 'Reprovação', sub: 'Tela de reprova' }].map(({ id, icon, label, sub }) => {
                const active = fixedCardActive(id);
                return (
                  <div key={id} onClick={() => setSelectedPageId(id)} style={{
                    padding: '10px 10px 10px 8px', borderRadius: '10px', marginBottom: '3px',
                    cursor: 'pointer', border: `1.5px solid ${active ? '#2563eb' : 'transparent'}`,
                    background: active ? hexToRgba('#2563eb', 0.06) : 'transparent',
                    opacity: selectedPageType === 'question' ? 0.4 : 1,
                    transition: `${tokens.transition}, opacity 150ms ease`,
                  }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? '#2563eb' : textMain }}>{label}</div>
                        <div style={{ fontSize: '10px', color: textMut }}>{sub}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={addPergunta} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '7px', borderRadius: tokens.radius.sm,
                  border: `1.5px dashed ${border}`, background: 'transparent',
                  color: textMut, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <Plus style={{ width: '11px', height: '11px' }} /> Nova etapa
                </button>
                <button onClick={addBloco} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '7px', borderRadius: tokens.radius.sm,
                  border: `1.5px dashed ${border}`, background: 'transparent',
                  color: textMut, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <Plus style={{ width: '11px', height: '11px' }} /> Novo bloco
                </button>
                <button onClick={() => window.open(quizLink, '_blank')} title="Abrir quiz" style={{
                  padding: '7px 9px', borderRadius: tokens.radius.sm,
                  border: 'none', background: '#2563eb', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
                }}>
                  <ExternalLink style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button disabled={history.length === 0} onClick={handleUndo} title="Desfazer (Ctrl+Z)" style={{
                  flex: 1, padding: '6px', borderRadius: tokens.radius.sm,
                  border: `1px solid ${history.length > 0 ? '#2563eb' : border}`, background: 'transparent',
                  color: history.length === 0 ? hexToRgba(textMut, 0.3) : '#2563eb', fontSize: '11px', cursor: history.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  fontWeight: history.length > 0 ? 600 : 400
                }}>
                  <RotateCcw style={{ width: '11px', height: '11px' }} /> Desfazer
                </button>
                <button disabled={redoHistory.length === 0} onClick={handleRedo} title="Refazer (Ctrl+Y)" style={{
                  flex: 1, padding: '6px', borderRadius: tokens.radius.sm,
                  border: `1px solid ${redoHistory.length > 0 ? '#2563eb' : border}`, background: 'transparent',
                  color: redoHistory.length === 0 ? hexToRgba(textMut, 0.3) : '#2563eb', fontSize: '11px', cursor: redoHistory.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  fontWeight: redoHistory.length > 0 ? 600 : 400
                }}>
                  <RotateCcw style={{ width: '11px', height: '11px', transform: 'scaleX(-1)' }} /> Refazer
                </button>
              </div>
            </div>
          </div>

          {/* ══ CENTER COLUMN: Phone preview ════════════════════════════════ */}
          <div className="quiz-phone-panel" style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: previewBg }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 40px 48px', minWidth: 'min-content' }}>
              {/* Phone frame — iPhone 17 */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {/* Power button (right) */}
                <div style={{ position: 'absolute', right: '-3px', top: '160px', width: '3px', height: '70px', background: '#2c2c2e', borderRadius: '0 2px 2px 0' }} />
                {/* Volume up (left) */}
                <div style={{ position: 'absolute', left: '-3px', top: '120px', width: '3px', height: '36px', background: '#2c2c2e', borderRadius: '2px 0 0 2px' }} />
                {/* Volume down (left) */}
                <div style={{ position: 'absolute', left: '-3px', top: '168px', width: '3px', height: '36px', background: '#2c2c2e', borderRadius: '2px 0 0 2px' }} />
                {/* Ground shadow */}
                <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '55%', height: '16px', background: 'rgba(0,0,0,0.2)', filter: 'blur(16px)', borderRadius: '50%', zIndex: 0 }} />
                <div style={{ width: '360px', height: '680px', borderRadius: '48px', border: '10px solid #1c1c1e', boxShadow: '0 40px 80px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.05)', overflow: 'hidden', background: quiz?.cor_fundo || '#ffffff', position: 'relative', zIndex: 1 }}>
                  {/* Dynamic Island pill */}
                  <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '22px', background: '#0a0a0a', borderRadius: '12px', zIndex: 30 }} />
                  {/* Scrollable content */}
                  <div className="no-scrollbar" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                    {quiz && (
                      <QuizRenderer quiz={quiz} blocos={blocos} phase={previewPhase}
                        currentPergunta={previewPerguntaWithOpcoes as any} currentBloco={previewCurrentBloco}
                        currentIdx={previewIdx} totalVisible={flatPerguntas.length}
                        selectedOpcao={previewSelectedOpcao}
                        onStart={() => { setPreviewPhase('quiz'); setPreviewIdx(0); setPreviewSelectedOpcao(null); }}
                        onOpcaoClick={handlePreviewOpcaoClick as any}
                        onContinue={advancePreview}
                        onGoToColeta={() => { setPreviewPhase('coleta'); setPreviewColetaIdx(0); }}
                        coletaStep={previewPhase === 'coleta' ? previewColetaIdx : undefined}
                        onColetaNext={() => setPreviewColetaIdx(i => Math.min(i + 1, currentColetaConfig.length - 1))}
                        isBuilderPreview={selectedPageType === 'collect' && activeTab === 'editor'}
                        selectedColetaElement={selectedColetaElement}
                        onSelectColetaElement={setSelectedColetaElement}
                        isPreview />
                    )}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: textMut, opacity: 0.5, letterSpacing: '0.05em' }}>quiz/{quiz.slug}</p>
            </div>
          </div>

          {/* ══ RIGHT COLUMN: Edit/Design panel ══════════════════════════════ */}
          <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${border}`, background: cardBg }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: textMain }}>
                {activeTab === 'design' ? '🎨 Design' :
                  selectedPageType === 'cover' ? '📋 Capa' :
                    selectedPageType === 'approval' ? '✅ Aprovação' :
                      selectedPageType === 'analise' ? '⌛ Análise' :
                        selectedPageType === 'collect' ? (showAddColeta ? '📝 Novo campo' : expandedColetaCampo ? `📝 ${currentColetaConfig.find(c => c.campo === expandedColetaCampo)?.label ?? 'Coleta'}` : '📝 Coleta') :
                          selectedPageType === 'rejection' ? '❌ Reprovação' :
                            `Etapa ${selectedPergunta?.globalIndex ?? ''}`}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'design' ? renderDesignPanel() : renderRightPanel()}
            </div>
            </div>
          </>
        )}
      </div>

      {/* ── SETTINGS MODAL ─────────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setShowSettings(false)}>
          <div style={{ background: cardBg, borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.modal, width: '100%', maxWidth: '500px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: textMain }}>Configurações do quiz</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: inputBg }}>
              {['Geral', 'Pixel/Scripts'].map(t => (
                <button key={t} onClick={() => setSettingsTab(t)} style={{
                  flex: 1, padding: '12px', border: 'none', background: settingsTab === t ? cardBg : 'transparent',
                  color: settingsTab === t ? '#2563eb' : textMut, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  borderBottom: settingsTab === t ? `2px solid #2563eb` : 'none'
                }}>{t}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {settingsTab === 'Geral' ? (
                <>
                  <div>
                    <label style={lbl}>Título</label>
                    <input value={quiz.titulo} onChange={e => updateQuizField('titulo', e.target.value)} style={iStyle} />
                  </div>
                  <div>
                    <label style={lbl}>Slug (URL)</label>
                    <input value={quiz.slug}
                      onChange={e => updateQuizField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      style={iStyle} />
                    <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#2563eb' }}>{quizLink}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: textMain }}>Status do Quiz</span>
                    <div onClick={toggleAtivo} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', padding: '6px 11px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg }}>
                      <div style={{ width: '28px', height: '15px', borderRadius: 99, background: quiz.ativo ? '#16a34a' : (isDark ? '#333' : '#d4cfc9'), position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '2px', left: quiz.ativo ? '13px' : '2px', width: '11px', height: '11px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: quiz.ativo ? '#16a34a' : textMut }}>{quiz.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={lbl}>Google Tag Manager ID</label>
                    <input value={(quiz as any).gtm_id || ''} onChange={e => updateQuizField('gtm_id', e.target.value)} placeholder="GTM-XXXXXX" style={iStyle} />
                  </div>
                  <div>
                    <label style={lbl}>Facebook Pixel ID</label>
                    <input value={quiz.pixel_id || ''} onChange={e => updateQuizField('pixel_id', e.target.value)} placeholder="Apenas os números" style={iStyle} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', background: inputBg }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: textMain }}>Disparar evento de Lead</span>
                      <span style={{ fontSize: '11px', color: textMut }}>Somente na página de aprovação</span>
                    </div>
                    <div onClick={() => updateQuizField('pixel_fire_lead_event', !(quiz as any).pixel_fire_lead_event)} style={{ width: '32px', height: '18px', borderRadius: 99, background: (quiz as any).pixel_fire_lead_event !== false ? '#2563eb' : '#d1d5db', position: 'relative', cursor: 'pointer' }}>
                      <div style={{ position: 'absolute', top: '2px', left: (quiz as any).pixel_fire_lead_event !== false ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: textMain }}>Rastreamento de Anúncios</span>
                    <p style={{ fontSize: '12px', color: textMut, margin: 0, lineHeight: '1.4' }}>Copie os parâmetros UTM para seus anúncios no Facebook:</p>
                    <button
                      onClick={() => { const utm = 'utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}'; navigator.clipboard.writeText(utm); toast.success('Parâmetros UTM copiados!'); }}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px dashed ${isDark ? '#333' : '#cbd5e1'}`, background: 'transparent', color: textMain, fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = hexToRgba('#2563eb', 0.05); }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#333' : '#cbd5e1'; e.currentTarget.style.color = textMain; e.currentTarget.style.background = 'transparent'; }}>
                      <Copy size={14} /> Copiar parâmetros de UTM
                    </button>
                  </div>

                  <div style={{ borderTop: `1px solid ${border}`, paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowAdvanced(!showAdvanced)}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: textMain, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avançado (Scripts)</span>
                      {showAdvanced ? <ChevronUp style={{ width: '16px' }} /> : <ChevronDown style={{ width: '16px' }} />}
                    </div>
                    {showAdvanced && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                        <div>
                          <label style={lbl}>Scripts no Head</label>
                          <textarea value={(quiz as any).script_head || ''} onChange={e => updateQuizField('script_head', e.target.value)} style={{ ...iStyle, height: '80px', fontFamily: 'monospace', fontSize: '11px' }} />
                        </div>
                        <div>
                          <label style={lbl}>Scripts no Body (Início)</label>
                          <textarea value={(quiz as any).script_body || ''} onChange={e => updateQuizField('script_body', e.target.value)} style={{ ...iStyle, height: '80px', fontFamily: 'monospace', fontSize: '11px' }} />
                        </div>
                        <div>
                          <label style={lbl}>Scripts no Footer</label>
                          <textarea value={(quiz as any).script_footer || ''} onChange={e => updateQuizField('script_footer', e.target.value)} style={{ ...iStyle, height: '80px', fontFamily: 'monospace', fontSize: '11px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '20px 24px', borderTop: `1px solid ${border}`, background: inputBg, display: 'flex', gap: '12px' }}>
              <button onClick={handleCopyLink} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg, color: textMain, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Copy style={{ width: '14px' }} /> Copiar Link
              </button>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.sm, border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Concluído</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE PREVIEW MODAL ────────────────────────────────────────────── */}
      {showPreviewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: isDark ? '#0d0d0f' : '#f4f2ef', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${border}`, background: cardBg }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: textMain }}>Preview</span>
            <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex' }}>
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: previewBg, padding: '40px' }}>
            <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-start' }}>
              <div style={{ position: 'absolute', right: '-3px', top: '160px', width: '3px', height: '70px', background: '#2c2c2e', borderRadius: '0 2px 2px 0' }} />
              <div style={{ position: 'absolute', left: '-3px', top: '120px', width: '3px', height: '36px', background: '#2c2c2e', borderRadius: '2px 0 0 2px' }} />
              <div style={{ position: 'absolute', left: '-3px', top: '168px', width: '3px', height: '36px', background: '#2c2c2e', borderRadius: '2px 0 0 2px' }} />
              <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', width: '55%', height: '16px', background: 'rgba(0,0,0,0.2)', filter: 'blur(16px)', borderRadius: '50%', zIndex: 0 }} />
              <div style={{ width: '360px', height: '680px', borderRadius: '48px', border: '10px solid #1c1c1e', boxShadow: '0 40px 80px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(255,255,255,0.05)', overflow: 'hidden', background: quiz?.cor_fundo || '#ffffff', position: 'relative', zIndex: 1 }}>
                <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '80px', height: '22px', background: '#0a0a0a', borderRadius: '12px', zIndex: 30 }} />
                <div className="no-scrollbar" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                  {quiz && (
                    <QuizRenderer quiz={quiz} blocos={blocos} phase={previewPhase}
                      currentPergunta={previewPerguntaWithOpcoes as any} currentBloco={previewCurrentBloco}
                      currentIdx={previewIdx} totalVisible={flatPerguntas.length}
                      selectedOpcao={previewSelectedOpcao}
                      onStart={() => { setPreviewPhase('quiz'); setPreviewIdx(0); setPreviewSelectedOpcao(null); }}
                      onOpcaoClick={handlePreviewOpcaoClick as any}
                      onContinue={advancePreview}
                      onGoToColeta={() => { setPreviewPhase('coleta'); setPreviewColetaIdx(0); }}
                      coletaStep={previewPhase === 'coleta' ? previewColetaIdx : undefined}
                      onColetaNext={() => setPreviewColetaIdx(i => Math.min(i + 1, currentColetaConfig.length - 1))}
                      isPreview />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BUG 4: DELETE MODAL ─────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowDeleteModal(null)}>
          <div style={{ background: cardBg, borderRadius: '16px', boxShadow: tokens.shadow.modal, width: '100%', maxWidth: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: textMain }}>Excluir etapa?</h3>
            <p style={{ margin: 0, fontSize: '13px', color: textMut }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setShowDeleteModal(null)} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: 'transparent', color: textMain, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={async () => { const id = showDeleteModal; setShowDeleteModal(null); await deletePergunta(id); }} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FEATURE 1: PUBLISH MODAL ────────────────────────────────────────── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowPublishModal(false)}>
          <div style={{ background: cardBg, borderRadius: '16px', boxShadow: tokens.shadow.modal, width: '100%', maxWidth: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: textMain }}>Publicar quiz?</h3>
            <p style={{ margin: 0, fontSize: '13px', color: textMut }}>
              Suas alterações ficarão visíveis para todos.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setShowPublishModal(false)} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: 'transparent', color: textMain, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handlePublish} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FEATURE 1: UNPUBLISH MODAL ──────────────────────────────────────── */}
      {showUnpublishModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setShowUnpublishModal(false)}>
          <div style={{ background: cardBg, borderRadius: '16px', boxShadow: tokens.shadow.modal, width: '100%', maxWidth: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: textMain }}>Despublicar quiz?</h3>
            <p style={{ margin: 0, fontSize: '13px', color: textMut }}>O quiz ficará inacessível para novos visitantes.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setShowUnpublishModal(false)} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: 'transparent', color: textMain, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleUnpublish} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Despublicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .quiz-phone-panel { display: none !important; }
          .quiz-mobile-bar { display: flex !important; }
        }
      `}</style>
    </AppLayout>
  );
}
