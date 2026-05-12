import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
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
import {
  Plus, Trash2, Copy, ExternalLink,
  Loader2, Settings, Eye, Check, X, Upload, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BASE_URL = 'https://floowdashboard.vercel.app';

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
          border: `1.5px solid ${isActive ? primary : 'transparent'}`,
          background: isActive ? hexToRgba(primary, 0.06) : isHovered ? (isDark ? '#1a1a1e' : '#f9fafb') : 'transparent',
          opacity: isDragging ? 0.5 : isDimmed ? 0.4 : 1,
          transition: 'background 0.1s, border-color 0.1s, opacity 150ms ease',
          boxShadow: isActive ? `0 0 0 3px ${hexToRgba(primary, 0.12)}` : 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div {...listeners} style={{ color: textMut, cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, touchAction: 'none', display: 'flex' }}>
            <GripVertical style={{ width: '12px', height: '12px' }} />
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: isActive ? primary : textMut, flexShrink: 0 }}>{perg.globalIndex}.</span>
          <span style={{ flex: 1, fontSize: '11px', fontWeight: isActive ? 700 : 500, color: isActive ? primary : textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuizBuilderPage() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Data
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
  const [activeCoverTab, setActiveCoverTab] = useState<'content' | 'appearance'>('content');
  const [newBenefit, setNewBenefit] = useState('');
  const [showConditional, setShowConditional] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [editingBlocoId, setEditingBlocoId] = useState<string | null>(null);
  const [expandedColetaCampo, setExpandedColetaCampo] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Preview state (interactive phone preview)
  const [previewPhase, setPreviewPhase] = useState<Phase>('capa');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewSelectedOpcao, setPreviewSelectedOpcao] = useState<string | null>(null);
  const previewAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedRecentlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const capaInputRef = useRef<HTMLInputElement>(null);
  const pageListRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const bg       = isDark ? '#0d0d0f' : '#f4f2ef';
  const cardBg   = isDark ? '#111113' : '#ffffff';
  const border   = isDark ? '#1e1e22' : '#e8e6e3';
  const textMut  = isDark ? 'rgba(255,255,255,0.4)' : '#9d9189';
  const textMain = isDark ? '#f4f4f5' : '#1a1918';
  const inputBg  = isDark ? '#1a1a1e' : '#f7f6f4';

  // Computed flat list
  const flatPerguntas: FlatPergunta[] = [...blocos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap(b => (perguntas[b.id] || []).sort((a, b) => a.ordem - b.ordem).map(p => ({ ...p, blocoTitulo: b.titulo })))
    .map((p, i) => ({ ...p, globalIndex: i + 1 }));

  const quizLink = quiz ? `${BASE_URL}/quiz/${quiz.slug}` : '';

  type PageType = 'cover' | 'question' | 'approval' | 'collect' | 'rejection';
  const selectedPageType: PageType =
    selectedPageId === 'cover'     ? 'cover'    :
    selectedPageId === 'approval'  ? 'approval' :
    selectedPageId === 'collect'   ? 'collect'  :
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
    } else if (selectedPageId === 'rejection') {
      setPreviewPhase('reprovado');
    } else {
      const idx = flatPerguntas.findIndex(p => p.id === selectedPageId);
      setPreviewPhase('quiz');
      setPreviewIdx(Math.max(0, idx));
    }
    setPreviewSelectedOpcao(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  useEffect(() => {
    setShowConditional(!!selectedPergunta?.condicao_pergunta_id);
  }, [selectedPergunta?.id]);

  useEffect(() => {
    if (!ready || !orgId) return;
    loadData();
  }, [ready, orgId]);

  // ── Data loading ────────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    const { data: quizData } = await db.from('quizzes').select('*').eq('org_id', orgId).maybeSingle();
    if (!quizData) { setLoading(false); return; }
    setQuiz(quizData);

    const { data: bData } = await db.from('quiz_blocos').select('*').eq('quiz_id', quizData.id).order('ordem');
    setBlocos(bData || []);
    if (!bData?.length) { setLoading(false); return; }

    const blocoIds = bData.map((b: Bloco) => b.id);
    const { data: pData } = await db.from('quiz_perguntas').select('*').in('bloco_id', blocoIds).order('ordem');

    const pergMap: Record<string, Pergunta[]> = {};
    for (const b of bData) pergMap[b.id] = [];
    for (const p of (pData || [])) { if (pergMap[p.bloco_id]) pergMap[p.bloco_id].push(p); }
    setPerguntas(pergMap);

    if (!pData?.length) { setLoading(false); return; }

    const pergIds = pData.map((p: Pergunta) => p.id);
    const { data: oData } = await db.from('quiz_opcoes').select('*').in('pergunta_id', pergIds).order('ordem');

    const opMap: Record<string, Opcao[]> = {};
    for (const p of pData) opMap[p.id] = [];
    for (const o of (oData || [])) { if (opMap[o.pergunta_id]) opMap[o.pergunta_id].push(o); }
    setOpcoes(opMap);
    setLoading(false);
  }

  // ── Create quiz ─────────────────────────────────────────────────────────────
  async function handleCreateQuiz(withSeed = false) {
    if (!orgId) return;
    setCreating(true);
    try {
      const { data: org } = await db.from('organizations').select('nome').eq('id', orgId).single();
      const slug = (org?.nome || 'meu-quiz').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: newQuiz, error } = await db.from('quizzes').insert({
        org_id: orgId,
        titulo: org?.nome ? `Quiz ${org.nome}` : 'Meu Quiz',
        slug, cor_primaria: '#2563eb', redirect_whatsapp: '',
        corte_verde: 35, corte_amarelo: 25,
        mensagem_aprovado: 'Parabéns! Seu perfil foi aprovado.',
        mensagem_reprovado: 'Obrigada pela participação!',
        ativo: true, publicado: false,
        capa_titulo: null, capa_subtitulo: null, capa_imagem_url: null,
        capa_beneficios: [], capa_botao_texto: 'Clique para iniciar →',
        coleta_campos: ['nome', 'whatsapp', 'cidade', 'instagram'],
        coleta_config: DEFAULT_COLETA_CONFIG,
      }).select().single();
      if (error) throw error;
      if (withSeed) await seedQuizBecker(newQuiz.id);
      toast.success('Quiz criado com sucesso!');
      await loadData();
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
    setCreating(false);
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
  function updateQuizField(field: string, value: any) {
    if (!quiz) return;
    setQuiz({ ...quiz, [field]: value } as QuizConfig);
    const quizId = quiz.id;
    debounce(`quiz_${field}`, async () => {
      const { error } = await db.from('quizzes').update({ [field]: value }).eq('id', quizId);
      if (error) throw new Error(error.message);
    });
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
  async function handleManualSave() {
    if (!quiz) return;
    setIsSaving(true);
    try {
      const { error } = await db.from('quizzes').update({ ...quiz }).eq('id', quiz.id);
      if (error) throw new Error(error.message);
      toast.success('✓ Salvo com sucesso');
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    }
    setIsSaving(false);
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!quiz) return;
    const { error } = await db.from('quizzes').update({ publicado: true, ativo: true }).eq('id', quiz.id);
    if (error) { toast.error(error.message); return; }
    setQuiz(q => q ? { ...q, publicado: true, ativo: true } : q);
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
    const { data: np, error: npErr } = await db.from('quiz_perguntas').insert({
      quiz_id: quiz.id,
      bloco_id: targetBlocoId, texto: '', ordem: maxOrdem + 1,
      subtexto: null, tipo_resposta: 'unica',
      condicao_pergunta_id: null, condicao_opcao_id: null,
    }).select().single();
    if (npErr || !np) { toast.error(`Erro ao criar etapa${npErr ? ': ' + npErr.message : ''}`); return; }
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
    const { data: np, error: npErr } = await db.from('quiz_perguntas').insert({
      quiz_id: quiz!.id,
      bloco_id: perg.bloco_id, texto: perg.texto, ordem: maxOrdem + 1,
      subtexto: perg.subtexto, tipo_resposta: perg.tipo_resposta,
      condicao_pergunta_id: null, condicao_opcao_id: null,
    }).select().single();
    if (npErr || !np) { toast.error(`Erro ao duplicar${npErr ? ': ' + npErr.message : ''}`); return; }
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

  // DnD reorder via @dnd-kit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const idA = active.id as string;
    const idB = over.id as string;
    const pergA = flatPerguntas.find(p => p.id === idA);
    const pergB = flatPerguntas.find(p => p.id === idB);
    if (!pergA || !pergB || pergA.bloco_id !== pergB.bloco_id) return;
    const blocoPergs = [...(perguntas[pergA.bloco_id] || [])].sort((a, b) => a.ordem - b.ordem);
    const oldIndex = blocoPergs.findIndex(p => p.id === idA);
    const newIndex = blocoPergs.findIndex(p => p.id === idB);
    const reordered = arrayMove(blocoPergs, oldIndex, newIndex).map((p, i) => ({ ...p, ordem: i + 1 }));
    setPerguntas(prev => ({ ...prev, [pergA.bloco_id]: reordered }));
    await Promise.all(reordered.map(p => db.from('quiz_perguntas').update({ ordem: p.ordem }).eq('id', p.id)));
  }

  function updatePergunta(id: string, field: string, value: string | null) {
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].map(p => p.id === id ? { ...p, [field]: value } : p);
      return next;
    });
    debounce(`perg_${id}_${field}`, async () => {
      const { error } = await db.from('quiz_perguntas').update({ [field]: value }).eq('id', id);
      if (error) throw new Error(error.message);
    });
  }

  async function deletePergunta(id: string) {
    const { error } = await db.from('quiz_perguntas').delete().eq('id', id);
    if (error) { toast.error(`Erro ao deletar: ${error.message}`); return; }
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].filter(p => p.id !== id);
      return next;
    });
    setOpcoes(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedPageId === id) setSelectedPageId('cover');
  }

  async function addOpcao(pergId: string) {
    const ordem = (opcoes[pergId]?.length || 0) + 1;
    const { data: no, error } = await db.from('quiz_opcoes').insert({
      pergunta_id: pergId, texto: '', pontos: 0, reprova_imediato: false, ordem, emoji: null,
    }).select().single();
    if (error) { toast.error(`Erro ao adicionar opção: ${error.message}`); return; }
    if (no) setOpcoes(p => ({ ...p, [pergId]: [...(p[pergId] || []), no] }));
  }

  function updateOpcao(id: string, field: string, value: string | number | boolean | null) {
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].map(o => o.id === id ? { ...o, [field]: value } : o);
      return next;
    });
    debounce(`opcao_${id}_${field}`, async () => {
      const { error } = await db.from('quiz_opcoes').update({ [field]: value }).eq('id', id);
      if (error) throw new Error(error.message);
    });
  }

  async function deleteOpcao(id: string) {
    const { error } = await db.from('quiz_opcoes').delete().eq('id', id);
    if (error) { toast.error(`Erro ao deletar opção: ${error.message}`); return; }
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter(o => o.id !== id);
      return next;
    });
  }

  function updateBlocoField(id: string, field: string, value: string) {
    setBlocos(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    debounce(`bloco_${id}_${field}`, async () => {
      const { error } = await db.from('quiz_blocos').update({ [field]: value }).eq('id', id);
      if (error) throw new Error(error.message);
    });
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
    if (nextIdx < flatPerguntas.length) setPreviewIdx(nextIdx);
    else setPreviewPhase('aprovado_form');
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

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!quiz) {
    return (
      <AppLayout>
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#fff' }}>
          <div style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h1 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '28px', fontWeight: 800, color: '#111', marginBottom: '10px', letterSpacing: '-0.02em' }}>
                Crie seu quiz
              </h1>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.6, margin: 0 }}>
                Escolha como deseja começar
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button onClick={() => handleCreateQuiz(true)} disabled={creating} style={{ padding: '32px 24px', borderRadius: '16px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#111', cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease' }}
                onMouseEnter={e => { if (!creating) { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2563eb'; el.style.boxShadow = '0 4px 16px rgba(37,99,235,0.12)'; el.style.transform = 'translateY(-2px)'; } }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e5e7eb'; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; el.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: '28px', marginBottom: '14px' }}>🎯</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Usar modelo Becker</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.55 }}>Quiz de semijoias pronto para usar</div>
              </button>
              <button onClick={() => handleCreateQuiz(false)} disabled={creating} style={{ padding: '32px 24px', borderRadius: '16px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#111', cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease' }}
                onMouseEnter={e => { if (!creating) { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#111'; el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; el.style.transform = 'translateY(-2px)'; } }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e5e7eb'; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; el.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: '28px', marginBottom: '14px' }}>📝</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Começar em branco</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.55 }}>Comece do zero</div>
              </button>
            </div>
            {creating && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px', color: '#9ca3af', fontSize: '13px' }}>
                <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 0.7s linear infinite' }} />
                Criando quiz...
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </AppLayout>
    );
  }

  const primary = quiz.cor_primaria || '#2563eb';
  const isPublicado = !!quiz.publicado;

  // ── Fixed page card style ──────────────────────────────────────────────────
  const fixedCardActive = (id: string) => selectedPageId === id;

  // ── Coleta config for collect panel ────────────────────────────────────────
  const currentColetaConfig: ColetaCampo[] = quiz.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : [...DEFAULT_COLETA_CONFIG];

  // ── Right panel ────────────────────────────────────────────────────────────
  function renderRightPanel() {
    if (!quiz) return null;

    // COVER
    if (selectedPageType === 'cover') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, flexShrink: 0, background: cardBg }}>
            {(['content', 'appearance'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveCoverTab(tab)} style={{
                flex: 1, padding: '10px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
                fontWeight: activeCoverTab === tab ? 700 : 400,
                color: activeCoverTab === tab ? textMain : textMut,
                borderBottom: `2px solid ${activeCoverTab === tab ? '#2563eb' : 'transparent'}`,
                marginBottom: '-1px',
              }}>
                {tab === 'content' ? 'Conteúdo' : 'Aparência'}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeCoverTab === 'content' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={lbl}>Título da capa</label>
                  <textarea value={quiz.capa_titulo || ''} rows={2}
                    onChange={e => updateQuizField('capa_titulo', e.target.value)}
                    placeholder={quiz.titulo} style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>Subtítulo</label>
                  <textarea value={quiz.capa_subtitulo || ''} rows={2}
                    onChange={e => updateQuizField('capa_subtitulo', e.target.value)}
                    placeholder="Texto de apoio..." style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>Imagem de capa</label>
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
                            const qId = quiz.id;
                            setQuiz(q => q ? { ...q, capa_imagem_height: val } : q);
                            debounce('quiz_capa_imagem_height', async () => {
                              const { error } = await db.from('quizzes').update({ capa_imagem_height: val }).eq('id', qId);
                              if (error) throw new Error(error.message);
                            }, 500);
                          }}
                          style={{ width: '100%', marginTop: '4px', accentColor: primary }} />
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
                  <label style={lbl}>Benefícios</label>
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
                  <label style={lbl}>Texto do botão</label>
                  <input value={quiz.capa_botao_texto || ''} style={iStyle}
                    onChange={e => updateQuizField('capa_botao_texto', e.target.value)}
                    placeholder="Clique para iniciar →" />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  <label style={lbl}>Logo</label>
                  {quiz.logo_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg }}>
                      <img src={quiz.logo_url} alt="Logo" style={{ height: '26px', maxWidth: '80px', objectFit: 'contain', borderRadius: 4 }} />
                      <span style={{ flex: 1, fontSize: '12px', color: textMut }}>Logo ativa</span>
                      <button onClick={async () => { await db.from('quizzes').update({ logo_url: null }).eq('id', quiz.id); setQuiz(q => q ? { ...q, logo_url: null } : q); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                        <X style={{ width: '14px', height: '14px' }} />
                      </button>
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
            )}
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
            <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Opções</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {selectedPergOpcoes.map(op => (
                <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input value={op.texto}
                    onChange={e => updateOpcao(op.id, 'texto', e.target.value)}
                    placeholder="Texto da opção (ex: 💎 Quero renda extra)"
                    style={{ ...iStyle, flex: 1, padding: '6px 8px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <input type="number" value={op.pontos} title="Pontos"
                      onChange={e => updateOpcao(op.id, 'pontos', Number(e.target.value))}
                      style={{ ...iStyle, width: '52px', textAlign: 'center', padding: '6px 4px' }} />
                    <span style={{ fontSize: '10px', color: textMut, flexShrink: 0 }}>pts</span>
                  </div>
                  <div title="Reprova imediato"
                    onClick={() => updateOpcao(op.id, 'reprova_imediato', !op.reprova_imediato)}
                    style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: '26px', height: '14px', borderRadius: 99, background: op.reprova_imediato ? '#ef4444' : (isDark ? '#333' : '#d1d5db'), position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: '2px', left: op.reprova_imediato ? '13px' : '2px', width: '10px', height: '10px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
                    </div>
                    <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>✗</span>
                  </div>
                  <button onClick={() => deleteOpcao(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => addOpcao(selectedPergunta.id)} style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
              borderRadius: tokens.radius.sm, border: `1px dashed ${border}`,
              background: 'transparent', color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Adicionar opção
            </button>
          </div>
          <div style={{ paddingTop: '12px', borderTop: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', marginBottom: '8px' }}
              onClick={() => {
                const next = !showConditional;
                setShowConditional(next);
                if (!next) {
                  updatePergunta(selectedPergunta.id, 'condicao_pergunta_id', null);
                  updatePergunta(selectedPergunta.id, 'condicao_opcao_id', null);
                }
              }}>
              <div style={{ width: '28px', height: '15px', borderRadius: 99, background: showConditional ? '#2563eb' : (isDark ? '#333' : '#d4cfc9'), position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: '2px', left: showConditional ? '13px' : '2px', width: '11px', height: '11px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: textMut }}>Etapa condicional</span>
            </div>
            {showConditional && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select value={selectedPergunta.condicao_pergunta_id || ''}
                  onChange={e => { updatePergunta(selectedPergunta.id, 'condicao_pergunta_id', e.target.value || null); updatePergunta(selectedPergunta.id, 'condicao_opcao_id', null); }}
                  style={{ ...iStyle }}>
                  <option value="">Selecionar etapa...</option>
                  {flatPerguntas.filter(p => p.id !== selectedPergunta.id).map(p => (
                    <option key={p.id} value={p.id}>{p.texto.slice(0, 60) || `Etapa ${p.globalIndex}`}</option>
                  ))}
                </select>
                {selectedPergunta.condicao_pergunta_id && (
                  <select value={selectedPergunta.condicao_opcao_id || ''}
                    onChange={e => updatePergunta(selectedPergunta.id, 'condicao_opcao_id', e.target.value || null)}
                    style={{ ...iStyle }}>
                    <option value="">Qualquer resposta</option>
                    {conditionalOpcoes.map(o => (
                      <option key={o.id} value={o.id}>{o.texto}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // APPROVAL — FEATURE 2: Pixel Meta
    if (selectedPageType === 'approval') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Mensagem de aprovação</label>
            <textarea value={quiz.mensagem_aprovado} rows={3}
              onChange={e => updateQuizField('mensagem_aprovado', e.target.value)}
              style={{ ...iStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={lbl}>WhatsApp de redirecionamento</label>
            <input value={quiz.redirect_whatsapp}
              onChange={e => updateQuizField('redirect_whatsapp', e.target.value)}
              placeholder="5511999999999" style={iStyle} />
            <p style={{ fontSize: '11px', color: textMut, margin: '3px 0 0' }}>Número com DDI. Ex: 5511999999999</p>
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
          {/* Pixel Meta */}
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Pixel Meta (opcional)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={lbl}>Pixel ID</label>
                <input value={quiz.pixel_id || ''}
                  onChange={e => updateQuizField('pixel_id', e.target.value || null)}
                  placeholder="ex: 1234567890" style={iStyle} />
              </div>
              <div>
                <label style={lbl}>Evento</label>
                <input value={quiz.pixel_evento_lead || 'Lead'}
                  onChange={e => updateQuizField('pixel_evento_lead', e.target.value || 'Lead')}
                  placeholder="Lead" style={iStyle} />
              </div>
              <p style={{ fontSize: '11px', color: textMut, margin: 0, lineHeight: 1.5 }}>
                Dispara <code style={{ background: inputBg, padding: '1px 4px', borderRadius: 4 }}>fbq('track', '{quiz.pixel_evento_lead || 'Lead'}')</code> quando o lead for aprovado.
              </p>
            </div>
          </div>
          {/* Coleta de dados inline */}
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Campos do formulário</p>
              <button onClick={() => setSelectedPageId('collect')} style={{ fontSize: '10px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>
                Editar campos →
              </button>
            </div>
            {currentColetaConfig.map(cfg => (
              <div key={cfg.campo} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg, marginBottom: '4px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check style={{ width: '8px', height: '8px', color: '#fff', strokeWidth: 3 }} />
                </div>
                <span style={{ fontSize: '11px', color: textMain }}>{cfg.label}</span>
                {cfg.obrigatorio && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 700, marginLeft: 'auto' }}>obrigatório</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // COLLECT — FEATURE 3: Visual coleta config editor
    if (selectedPageType === 'collect') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Editor de campos</p>
          {currentColetaConfig.map(cfg => {
            const isExpanded = expandedColetaCampo === cfg.campo;
            return (
              <div key={cfg.campo} style={{ borderRadius: tokens.radius.md, border: `1px solid ${isExpanded ? primary : border}`, background: cardBg, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpandedColetaCampo(isExpanded ? null : cfg.campo)}>
                  <span style={{ fontSize: '13px' }}>
                    {{ nome: '👤', whatsapp: '📱', cidade: '🏙️', instagram: '📸' }[cfg.campo] ?? '📝'}
                  </span>
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: textMain }}>{cfg.label}</span>
                  {cfg.obrigatorio && <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>obrigatório</span>}
                  {isExpanded
                    ? <ChevronUp style={{ width: '14px', height: '14px', color: textMut }} />
                    : <ChevronDown style={{ width: '14px', height: '14px', color: textMut }} />
                  }
                </div>
                {/* Expanded editor */}
                {isExpanded && (
                  <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
                    <div>
                      <label style={lbl}>Label</label>
                      <input value={cfg.label}
                        onChange={e => updateColetaConfig(currentColetaConfig.map(c => c.campo === cfg.campo ? { ...c, label: e.target.value } : c))}
                        style={iStyle} />
                    </div>
                    <div>
                      <label style={lbl}>Placeholder</label>
                      <input value={cfg.placeholder}
                        onChange={e => updateColetaConfig(currentColetaConfig.map(c => c.campo === cfg.campo ? { ...c, placeholder: e.target.value } : c))}
                        style={iStyle} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: textMain }}>Obrigatório</span>
                      <div style={{ width: '30px', height: '16px', borderRadius: 99, background: cfg.obrigatorio ? primary : (isDark ? '#333' : '#d1d5db'), position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => updateColetaConfig(currentColetaConfig.map(c => c.campo === cfg.campo ? { ...c, obrigatorio: !c.obrigatorio } : c))}>
                        <div style={{ position: 'absolute', top: '2px', left: cfg.obrigatorio ? '15px' : '2px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Ordem</label>
                      <input type="number" min={1} max={10} value={cfg.ordem}
                        onChange={e => updateColetaConfig(currentColetaConfig.map(c => c.campo === cfg.campo ? { ...c, ordem: Number(e.target.value) } : c))}
                        style={{ ...iStyle, width: '70px' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // REJECTION
    if (selectedPageType === 'rejection') {
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Mensagem de reprovação</label>
            <textarea value={quiz.mensagem_reprovado} rows={4}
              onChange={e => updateQuizField('mensagem_reprovado', e.target.value)}
              style={{ ...iStyle, resize: 'vertical' }} />
          </div>
        </div>
      );
    }

    return null;
  }

  // ── SCALE for phone preview ─────────────────────────────────────────────────
  const PHONE_INNER_W = 242;
  const SCALE = PHONE_INNER_W / 480;
  const PHONE_INNER_H = 485;
  const CONTENT_H = Math.round(PHONE_INNER_H / SCALE);

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* Mobile top bar */}
        <div className="quiz-mobile-bar" style={{ display: 'none', padding: '10px 16px', borderBottom: `1px solid ${border}`, background: cardBg, alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: textMain }}>{quiz.titulo}</span>
          <button onClick={() => setShowPreviewModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg, color: textMain, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Eye style={{ width: '13px', height: '13px' }} /> Preview
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ══ LEFT COLUMN ═════════════════════════════════════════════════ */}
          <div style={{ width: '232px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${border}`, background: cardBg }}>
            {/* Header — FEATURE 1: Salvar + Publicar */}
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: textMain, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{quiz.titulo}</p>
                  <p style={{ fontSize: '10px', color: textMut, margin: '1px 0 0' }}>/{quiz.slug}</p>
                </div>
                <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '4px', flexShrink: 0 }}>
                  <Settings style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {/* Salvar */}
                <button onClick={handleManualSave} disabled={isSaving} style={{
                  flex: 1, padding: '5px 8px', borderRadius: 7, border: `1px solid ${border}`,
                  background: 'transparent', color: textMut, fontSize: '11px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                }}>
                  {isSaving
                    ? <><Loader2 style={{ width: '10px', height: '10px', animation: 'spin 0.7s linear infinite' }} /> Salvando...</>
                    : saving
                      ? <><Loader2 style={{ width: '10px', height: '10px', animation: 'spin 0.7s linear infinite' }} /> Auto...</>
                      : savedRecently
                        ? <><Check style={{ width: '10px', height: '10px', color: '#16a34a' }} /> <span style={{ color: '#16a34a' }}>Salvo</span></>
                        : 'Salvar'
                  }
                </button>
                {/* Publicar */}
                {isPublicado ? (
                  <button onClick={() => setShowUnpublishModal(true)} style={{
                    flex: 1, padding: '5px 8px', borderRadius: 7, border: '1px solid #16a34a',
                    background: 'transparent', color: '#16a34a', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Publicado ✓
                  </button>
                ) : (
                  <button onClick={() => setShowPublishModal(true)} style={{
                    flex: 1, padding: '5px 8px', borderRadius: 7, border: 'none',
                    background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Publicar
                  </button>
                )}
              </div>
            </div>

            {/* Page list */}
            <div ref={pageListRef} style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>

              {/* Fixed: Capa */}
              {(() => {
                const active = fixedCardActive('cover');
                return (
                  <div onClick={() => setSelectedPageId('cover')} style={{
                    padding: '10px 10px 10px 8px', borderRadius: '10px', marginBottom: '3px',
                    cursor: 'pointer', border: `1.5px solid ${active ? primary : 'transparent'}`,
                    background: active ? hexToRgba(primary, 0.06) : 'transparent',
                    opacity: selectedPageType === 'question' ? 0.4 : 1,
                    transition: `${tokens.transition}, opacity 150ms ease`,
                  }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px' }}>📋</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? primary : textMain }}>Capa</div>
                        <div style={{ fontSize: '10px', color: textMut }}>Página inicial</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Questions grouped by bloco */}
              {flatPerguntas.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div style={{ borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, marginBottom: '3px', paddingTop: '4px', paddingBottom: '4px' }}>
                  {[...blocos].sort((a, b) => a.ordem - b.ordem).map(bloco => {
                    const blocoFlatPergs = flatPerguntas.filter(p => p.bloco_id === bloco.id);
                    if (blocoFlatPergs.length === 0) return null;
                    const isEditingBloco = editingBlocoId === bloco.id;
                    return (
                      <div key={bloco.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 4px 3px' }}
                          onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize: '12px', flexShrink: 0 }}>{bloco.emoji || defaultEmojiForBloco(bloco.titulo)}</span>
                          {isEditingBloco ? (
                            <input autoFocus value={bloco.titulo}
                              onChange={e => updateBlocoField(bloco.id, 'titulo', e.target.value)}
                              onBlur={() => setEditingBlocoId(null)}
                              onKeyDown={e => e.key === 'Enter' && setEditingBlocoId(null)}
                              style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: textMain, border: `1px solid ${primary}`, borderRadius: '4px', padding: '1px 5px', background: inputBg, outline: 'none', fontFamily: 'inherit' }} />
                          ) : (
                            <span onClick={() => setEditingBlocoId(bloco.id)} title="Clique para renomear"
                              style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'text' }}>
                              {bloco.titulo}
                            </span>
                          )}
                        </div>
                        <SortableContext items={blocoFlatPergs.map(p => p.id)} strategy={verticalListSortingStrategy}>
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
                        </SortableContext>
                      </div>
                    );
                  })}
                </div>
                </DndContext>
              )}

              {/* Fixed: Approval, Collect, Rejection */}
              {[
                { id: 'approval',  icon: '✅', label: 'Aprovação',      sub: 'Tela de sucesso' },
                { id: 'collect',   icon: '📝', label: 'Coleta de dados', sub: 'Formulário' },
                { id: 'rejection', icon: '❌', label: 'Reprovação',      sub: 'Tela de reprova' },
              ].map(({ id, icon, label, sub }) => {
                const active = fixedCardActive(id);
                return (
                  <div key={id} onClick={() => setSelectedPageId(id)} style={{
                    padding: '10px 10px 10px 8px', borderRadius: '10px', marginBottom: '3px',
                    cursor: 'pointer', border: `1.5px solid ${active ? primary : 'transparent'}`,
                    background: active ? hexToRgba(primary, 0.06) : 'transparent',
                    opacity: selectedPageType === 'question' ? 0.4 : 1,
                    transition: `${tokens.transition}, opacity 150ms ease`,
                  }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? '#1a1a1e' : '#f9fafb'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px' }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: active ? 700 : 500, color: active ? primary : textMain }}>{label}</div>
                        <div style={{ fontSize: '10px', color: textMut }}>{sub}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '6px' }}>
              <button onClick={addPergunta} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '8px', borderRadius: tokens.radius.sm,
                border: `1.5px dashed ${border}`, background: 'transparent',
                color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Plus style={{ width: '12px', height: '12px' }} /> Nova etapa
              </button>
              <button onClick={() => window.open(quizLink, '_blank')} title="Abrir quiz" style={{
                padding: '8px 10px', borderRadius: tokens.radius.sm,
                border: 'none', background: '#2563eb', color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                <ExternalLink style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          </div>

          {/* ══ CENTER COLUMN: Phone preview ════════════════════════════════ */}
          <div className="quiz-phone-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: '24px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: textMut, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Preview ao vivo</p>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['capa', 'quiz', 'aprovado_form', 'coleta', 'reprovado'] as Phase[]).map(ph => (
                    <button key={ph} onClick={() => { setPreviewPhase(ph); if (ph === 'quiz') setPreviewIdx(0); setPreviewSelectedOpcao(null); }}
                      style={{ padding: '2px 6px', fontSize: '9px', borderRadius: 4, border: `1px solid ${border}`, background: previewPhase === ph ? '#2563eb' : 'transparent', color: previewPhase === ph ? '#fff' : textMut, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                      {ph === 'capa' ? 'Capa' : ph === 'quiz' ? 'Quiz' : ph === 'aprovado_form' ? 'Ok' : ph === 'coleta' ? 'Coleta' : 'X'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Phone frame */}
              <div style={{ width: '260px', height: '520px', borderRadius: '44px', border: `9px solid ${isDark ? '#1c1c20' : '#111111'}`, boxShadow: isDark ? '0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' : '0 40px 80px rgba(0,0,0,0.28), 0 8px 20px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.5)', overflow: 'hidden', background: '#fff', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '72px', height: '17px', background: isDark ? '#1c1c20' : '#111111', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', zIndex: 20 }} />
                <div style={{ width: '100%', height: '100%', paddingTop: '17px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '17px', left: 0, width: `${480}px`, height: `${CONTENT_H}px`, transformOrigin: 'top left', transform: `scale(${SCALE})` }}>
                    {quiz && (
                      <QuizRenderer quiz={quiz} blocos={blocos} phase={previewPhase}
                        currentPergunta={previewPerguntaWithOpcoes as any} currentBloco={previewCurrentBloco}
                        currentIdx={previewIdx} totalVisible={flatPerguntas.length}
                        selectedOpcao={previewSelectedOpcao}
                        onStart={() => { setPreviewPhase('quiz'); setPreviewIdx(0); setPreviewSelectedOpcao(null); }}
                        onOpcaoClick={handlePreviewOpcaoClick as any}
                        onContinue={advancePreview}
                        onGoToColeta={() => setPreviewPhase('coleta')}
                        isPreview />
                    )}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: textMut, opacity: 0.6 }}>quiz/{quiz.slug}</p>
            </div>
          </div>

          {/* ══ RIGHT COLUMN: Edit panel ════════════════════════════════════ */}
          <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${border}`, background: cardBg }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: textMain }}>
                {selectedPageType === 'cover'     ? '📋 Capa' :
                 selectedPageType === 'approval'  ? '✅ Aprovação' :
                 selectedPageType === 'collect'   ? '📝 Coleta' :
                 selectedPageType === 'rejection' ? '❌ Reprovação' :
                 `Etapa ${selectedPergunta?.globalIndex ?? ''}`}
              </span>
              <span style={{ fontSize: '11px', color: textMut, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {saving && <><Loader2 style={{ width: '11px', height: '11px', animation: 'spin 0.7s linear infinite' }} /> Auto...</>}
                {!saving && savedRecently && <><Check style={{ width: '11px', height: '11px', color: '#16a34a' }} /> <span style={{ color: '#16a34a' }}>Salvo</span></>}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* ── SETTINGS MODAL ─────────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={() => setShowSettings(false)}>
          <div style={{ background: cardBg, borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.modal, width: '100%', maxWidth: '440px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: textMain }}>Configurações do quiz</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '4px' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div>
              <label style={lbl}>Título</label>
              <input value={quiz.titulo} onChange={e => updateQuizField('titulo', e.target.value)} style={iStyle} />
            </div>
            <div>
              <label style={lbl}>Slug (URL)</label>
              <input value={quiz.slug}
                onChange={e => updateQuizField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                style={iStyle} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#2563eb', flex: 1, wordBreak: 'break-all' }}>{quizLink}</p>
                <button onClick={handleCopyLink} style={{ padding: '4px 8px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: copied ? '#dcfce7' : 'transparent', color: copied ? '#15803d' : textMain, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  {copied ? <Check style={{ width: '11px', height: '11px' }} /> : <Copy style={{ width: '11px', height: '11px' }} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: textMain }}>Status</span>
              <div onClick={toggleAtivo} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', padding: '6px 11px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg }}>
                <div style={{ width: '28px', height: '15px', borderRadius: 99, background: quiz.ativo ? '#16a34a' : (isDark ? '#333' : '#d4cfc9'), position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '2px', left: quiz.ativo ? '13px' : '2px', width: '11px', height: '11px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: quiz.ativo ? '#16a34a' : textMut }}>{quiz.ativo ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
            <button onClick={() => window.open(quizLink, '_blank')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '10px', borderRadius: tokens.radius.sm, border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <ExternalLink style={{ width: '13px', height: '13px' }} /> Abrir quiz
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: `1px solid ${border}` }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(quizLink)}&bgcolor=ffffff&color=111111&margin=10`} alt="QR Code" style={{ width: '120px', height: '120px', borderRadius: tokens.radius.sm, border: `1px solid ${border}` }} />
              <p style={{ margin: 0, fontSize: '11px', color: textMut }}>Compartilhe via QR Code</p>
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ width: '260px', height: '520px', borderRadius: '44px', border: `9px solid ${isDark ? '#1c1c20' : '#111111'}`, boxShadow: '0 32px 64px rgba(0,0,0,0.3)', overflow: 'hidden', background: '#fff', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '72px', height: '17px', background: isDark ? '#1c1c20' : '#111111', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', zIndex: 20 }} />
              <div style={{ width: '100%', height: '100%', paddingTop: '17px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '17px', left: 0, width: `${480}px`, height: `${CONTENT_H}px`, transformOrigin: 'top left', transform: `scale(${SCALE})` }}>
                  {quiz && (
                    <QuizRenderer quiz={quiz} blocos={blocos} phase={previewPhase}
                      currentPergunta={previewPerguntaWithOpcoes as any} currentBloco={previewCurrentBloco}
                      currentIdx={previewIdx} totalVisible={flatPerguntas.length}
                      selectedOpcao={previewSelectedOpcao}
                      onStart={() => { setPreviewPhase('quiz'); setPreviewIdx(0); setPreviewSelectedOpcao(null); }}
                      onOpcaoClick={handlePreviewOpcaoClick as any}
                      onContinue={advancePreview}
                      onGoToColeta={() => setPreviewPhase('coleta')}
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
              <span style={{ color: '#2563eb', fontWeight: 600 }}>{quizLink}</span> ficará público e visível para todos.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setShowPublishModal(false)} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: 'transparent', color: textMain, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handlePublish} style={{ flex: 1, padding: '10px', borderRadius: tokens.radius.sm, border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Publicar agora
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
