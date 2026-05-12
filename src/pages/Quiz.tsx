import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { seedQuizBecker } from '@/utils/seedQuizBecker';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, GripVertical, Copy, ExternalLink, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BASE_URL = 'https://floowdashboard.vercel.app';

interface QuizConfig {
  id: string;
  org_id: string;
  titulo: string;
  slug: string;
  cor_primaria: string;
  redirect_whatsapp: string;
  corte_verde: number;
  corte_amarelo: number;
  mensagem_aprovado: string;
  mensagem_reprovado: string;
  ativo: boolean;
  logo_url: string | null;
}

interface Bloco {
  id: string;
  quiz_id: string;
  titulo: string;
  ordem: number;
}

interface Pergunta {
  id: string;
  bloco_id: string;
  texto: string;
  ordem: number;
  condicao_pergunta_id: string | null;
  condicao_opcao_id: string | null;
}

interface Opcao {
  id: string;
  pergunta_id: string;
  texto: string;
  pontos: number;
  reprova_imediato: boolean;
  ordem: number;
}

// ── SortableQuestion component ─────────────────────────────────────────────
function SortableQuestion({
  pergunta, opcoes, todasPerguntas, todasOpcoes, isDark,
  onUpdatePergunta, onDeletePergunta,
  onAddOpcao, onUpdateOpcao, onDeleteOpcao, onMoveOpcao,
}: {
  pergunta: Pergunta;
  opcoes: Opcao[];
  todasPerguntas: Pergunta[];
  todasOpcoes: Record<string, Opcao[]>;
  isDark: boolean;
  onUpdatePergunta: (id: string, field: string, value: string | null) => void;
  onDeletePergunta: (id: string) => void;
  onAddOpcao: (pergId: string) => void;
  onUpdateOpcao: (id: string, field: string, value: string | number | boolean) => void;
  onDeleteOpcao: (id: string) => void;
  onMoveOpcao: (pergId: string, fromIdx: number, toIdx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pergunta.id });
  const [expanded, setExpanded] = useState(true);
  const [showConditional, setShowConditional] = useState(!!(pergunta.condicao_pergunta_id));

  const cardBg = isDark ? '#161618' : '#ffffff';
  const border = isDark ? '#2a2a2e' : '#e5e7eb';
  const textMut = isDark ? 'rgba(255,255,255,0.5)' : '#6b7280';
  const inputBg = isDark ? '#1a1a1e' : '#f9fafb';
  const inputColor = isDark ? '#f0f0f0' : '#111';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // All perguntas except this one (for conditional selector)
  const otherPerguntas = todasPerguntas.filter(p => p.id !== pergunta.id);

  // Opcoes of the selected conditional pergunta
  const conditionalOpcoes = pergunta.condicao_pergunta_id
    ? (todasOpcoes[pergunta.condicao_pergunta_id] || [])
    : [];

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: '10px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px' }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab', color: textMut, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <GripVertical style={{ width: '16px', height: '16px' }} />
          </div>

          <input
            value={pergunta.texto}
            onChange={e => onUpdatePergunta(pergunta.id, 'texto', e.target.value)}
            placeholder="Texto da pergunta..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '14px', fontWeight: 600, color: inputColor, fontFamily: 'inherit',
            }}
          />

          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '2px' }}
          >
            {expanded ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
          </button>

          <button
            onClick={() => onDeletePergunta(pergunta.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}
          >
            <Trash2 style={{ width: '15px', height: '15px' }} />
          </button>
        </div>

        {/* Body */}
        {expanded && (
          <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${border}` }}>
            {/* Opcoes */}
            <p style={{ fontSize: '11px', fontWeight: 600, color: textMut, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '12px 0 8px' }}>
              Opções
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {opcoes.map((op, idx) => (
                <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Move up/down */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <button
                      onClick={() => onMoveOpcao(pergunta.id, idx, idx - 1)}
                      disabled={idx === 0}
                      style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: textMut, opacity: idx === 0 ? 0.3 : 1, padding: '1px', display: 'flex' }}
                    >
                      <ChevronUp style={{ width: '13px', height: '13px' }} />
                    </button>
                    <button
                      onClick={() => onMoveOpcao(pergunta.id, idx, idx + 1)}
                      disabled={idx === opcoes.length - 1}
                      style={{ background: 'none', border: 'none', cursor: idx === opcoes.length - 1 ? 'default' : 'pointer', color: textMut, opacity: idx === opcoes.length - 1 ? 0.3 : 1, padding: '1px', display: 'flex' }}
                    >
                      <ChevronDown style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>

                  <input
                    value={op.texto}
                    onChange={e => onUpdateOpcao(op.id, 'texto', e.target.value)}
                    placeholder="Texto da opção"
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: '7px',
                      border: `1px solid ${border}`, background: inputBg,
                      color: inputColor, fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                    }}
                  />

                  <input
                    type="number"
                    value={op.pontos}
                    onChange={e => onUpdateOpcao(op.id, 'pontos', Number(e.target.value))}
                    title="Pontos"
                    style={{
                      width: '54px', padding: '7px 8px', borderRadius: '7px',
                      border: `1px solid ${border}`, background: inputBg,
                      color: inputColor, fontSize: '13px', fontFamily: 'inherit', outline: 'none', textAlign: 'center',
                    }}
                  />

                  <label title="Reprova imediato" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={op.reprova_imediato}
                      onChange={e => onUpdateOpcao(op.id, 'reprova_imediato', e.target.checked)}
                      style={{ accentColor: '#ef4444' }}
                    />
                    <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>Reprova</span>
                  </label>

                  <button
                    onClick={() => onDeleteOpcao(op.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}
                  >
                    <Trash2 style={{ width: '13px', height: '13px' }} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => onAddOpcao(pergunta.id)}
              style={{
                marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', borderRadius: '7px', border: `1px dashed ${border}`,
                background: 'transparent', color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus style={{ width: '13px', height: '13px' }} /> Adicionar opção
            </button>

            {/* Condicional toggle */}
            <div style={{ marginTop: '14px', borderTop: `1px solid ${border}`, paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <div
                  onClick={() => {
                    const next = !showConditional;
                    setShowConditional(next);
                    if (!next) {
                      onUpdatePergunta(pergunta.id, 'condicao_pergunta_id', null);
                      onUpdatePergunta(pergunta.id, 'condicao_opcao_id', null);
                    }
                  }}
                  style={{
                    width: '30px', height: '16px', borderRadius: '99px',
                    background: showConditional ? '#2563eb' : (isDark ? '#333' : '#d1d5db'),
                    position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px',
                    left: showConditional ? '14px' : '2px',
                    width: '12px', height: '12px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: textMut }}>Pergunta condicional</span>
              </label>

              {showConditional && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={pergunta.condicao_pergunta_id || ''}
                    onChange={e => {
                      onUpdatePergunta(pergunta.id, 'condicao_pergunta_id', e.target.value || null);
                      onUpdatePergunta(pergunta.id, 'condicao_opcao_id', null);
                    }}
                    style={{
                      padding: '7px 10px', borderRadius: '7px', border: `1px solid ${border}`,
                      background: inputBg, color: inputColor, fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                    }}
                  >
                    <option value="">Selecionar pergunta...</option>
                    {otherPerguntas.map(p => (
                      <option key={p.id} value={p.id}>{p.texto.slice(0, 60)}</option>
                    ))}
                  </select>

                  {pergunta.condicao_pergunta_id && (
                    <select
                      value={pergunta.condicao_opcao_id || ''}
                      onChange={e => onUpdatePergunta(pergunta.id, 'condicao_opcao_id', e.target.value || null)}
                      style={{
                        padding: '7px 10px', borderRadius: '7px', border: `1px solid ${border}`,
                        background: inputBg, color: inputColor, fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                      }}
                    >
                      <option value="">Qualquer resposta na pergunta acima</option>
                      {conditionalOpcoes.map(o => (
                        <option key={o.id} value={o.id}>{o.texto}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Quiz page ─────────────────────────────────────────────────────────
export default function QuizBuilderPage() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[]>>({}); // blocoId → Pergunta[]
  const [opcoes, setOpcoes] = useState<Record<string, Opcao[]>>({}); // perguntaId → Opcao[]
  const [saving, setSaving] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const bg = isDark ? '#090909' : '#f4f4f5';
  const cardBg = isDark ? '#111113' : '#ffffff';
  const border = isDark ? '#1e1e22' : '#e5e7eb';
  const textMut = isDark ? 'rgba(255,255,255,0.45)' : '#6b7280';
  const textMain = isDark ? '#f4f4f5' : '#111827';
  const inputBg = isDark ? '#1a1a1e' : '#f9fafb';

  // All perguntas flat (for conditional selector)
  const todasPerguntas: Pergunta[] = blocos.flatMap(b => perguntas[b.id] || []);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !orgId) return;
    loadData();
  }, [ready, orgId]);

  async function loadData() {
    setLoading(true);
    const { data: quizData } = await db
      .from('quizzes')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    if (!quizData) { setLoading(false); return; }
    setQuiz(quizData);

    const { data: bData } = await db
      .from('quiz_blocos')
      .select('*')
      .eq('quiz_id', quizData.id)
      .order('ordem');

    setBlocos(bData || []);

    if (!bData?.length) { setLoading(false); return; }

    const blocoIds = bData.map((b: Bloco) => b.id);
    const { data: pData } = await db
      .from('quiz_perguntas')
      .select('*')
      .in('bloco_id', blocoIds)
      .order('ordem');

    const pergMap: Record<string, Pergunta[]> = {};
    for (const b of bData) pergMap[b.id] = [];
    for (const p of (pData || [])) {
      if (pergMap[p.bloco_id]) pergMap[p.bloco_id].push(p);
    }
    setPerguntas(pergMap);

    if (!pData?.length) { setLoading(false); return; }

    const pergIds = pData.map((p: Pergunta) => p.id);
    const { data: oData } = await db
      .from('quiz_opcoes')
      .select('*')
      .in('pergunta_id', pergIds)
      .order('ordem');

    const opMap: Record<string, Opcao[]> = {};
    for (const p of pData) opMap[p.id] = [];
    for (const o of (oData || [])) {
      if (opMap[o.pergunta_id]) opMap[o.pergunta_id].push(o);
    }
    setOpcoes(opMap);
    setLoading(false);
  }

  // ── Create quiz from scratch ─────────────────────────────────────────────
  async function handleCreateQuiz() {
    if (!orgId) return;
    setCreating(true);
    try {
      // Get org name for slug
      const { data: org } = await db
        .from('organizations')
        .select('nome')
        .eq('id', orgId)
        .single();

      const slug = (org?.nome || 'meu-quiz')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: newQuiz, error } = await db
        .from('quizzes')
        .insert({
          org_id: orgId,
          titulo: org?.nome ? `Quiz ${org.nome}` : 'Meu Quiz',
          slug,
          cor_primaria: '#2563eb',
          redirect_whatsapp: '',
          corte_verde: 35,
          corte_amarelo: 25,
          mensagem_aprovado: 'Parabéns! Seu perfil foi aprovado. Preencha seus dados para começar.',
          mensagem_reprovado: 'Obrigada pela participação! No momento seu perfil não se encaixa no que buscamos.',
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Seed with Becker questions
      await seedQuizBecker(newQuiz.id);
      toast.success('Quiz criado com sucesso!');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao criar quiz: ${msg}`);
    }
    setCreating(false);
  }

  // ── Debounced save helper ────────────────────────────────────────────────
  function debounce(key: string, fn: () => Promise<void>, delay = 800) {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      setSaving(true);
      try { await fn(); } catch { /* silently ignore */ }
      setSaving(false);
    }, delay);
  }

  // ── Quiz config updates ──────────────────────────────────────────────────
  function updateQuizField(field: string, value: string | number | boolean) {
    if (!quiz) return;
    const updated = { ...quiz, [field]: value } as QuizConfig;
    setQuiz(updated);
    debounce(`quiz_${field}`, async () => {
      await db.from('quizzes').update({ [field]: value }).eq('id', quiz.id);
    });
  }

  // ── Bloco operations ─────────────────────────────────────────────────────
  async function addBloco() {
    if (!quiz) return;
    const ordem = blocos.length + 1;
    const { data: nb } = await db
      .from('quiz_blocos')
      .insert({ quiz_id: quiz.id, titulo: `Bloco ${ordem}`, ordem })
      .select().single();
    if (nb) {
      setBlocos(prev => [...prev, nb]);
      setPerguntas(prev => ({ ...prev, [nb.id]: [] }));
    }
  }

  async function updateBlocoTitulo(id: string, titulo: string) {
    setBlocos(prev => prev.map(b => b.id === id ? { ...b, titulo } : b));
    debounce(`bloco_${id}`, async () => {
      await db.from('quiz_blocos').update({ titulo }).eq('id', id);
    });
  }

  async function deleteBloco(id: string) {
    if (!confirm('Deletar este bloco e todas as perguntas?')) return;
    await db.from('quiz_blocos').delete().eq('id', id);
    setBlocos(prev => prev.filter(b => b.id !== id));
    setPerguntas(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  // ── Pergunta operations ──────────────────────────────────────────────────
  async function addPergunta(blocoId: string) {
    const ordem = (perguntas[blocoId]?.length || 0) + 1;
    const { data: np } = await db
      .from('quiz_perguntas')
      .insert({ bloco_id: blocoId, texto: '', ordem })
      .select().single();
    if (np) {
      setPerguntas(prev => ({ ...prev, [blocoId]: [...(prev[blocoId] || []), np] }));
      setOpcoes(prev => ({ ...prev, [np.id]: [] }));
    }
  }

  function updatePergunta(id: string, field: string, value: string | null) {
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) {
        next[bid] = next[bid].map(p => p.id === id ? { ...p, [field]: value } : p);
      }
      return next;
    });
    debounce(`perg_${id}_${field}`, async () => {
      await db.from('quiz_perguntas').update({ [field]: value }).eq('id', id);
    });
  }

  async function deletePergunta(id: string) {
    await db.from('quiz_perguntas').delete().eq('id', id);
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) {
        next[bid] = next[bid].filter(p => p.id !== id);
      }
      return next;
    });
    setOpcoes(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  // DnD reorder perguntas within a bloco
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(blocoId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPerguntas(prev => {
      const items = prev[blocoId] || [];
      const oldIdx = items.findIndex(p => p.id === active.id);
      const newIdx = items.findIndex(p => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(items, oldIdx, newIdx).map((p, i) => ({ ...p, ordem: i + 1 }));
      // Save new order
      reordered.forEach(p => {
        db.from('quiz_perguntas').update({ ordem: p.ordem }).eq('id', p.id);
      });
      return { ...prev, [blocoId]: reordered };
    });
  }

  // ── Opcao operations ─────────────────────────────────────────────────────
  async function addOpcao(pergId: string) {
    const ordem = (opcoes[pergId]?.length || 0) + 1;
    const { data: no } = await db
      .from('quiz_opcoes')
      .insert({ pergunta_id: pergId, texto: '', pontos: 0, reprova_imediato: false, ordem })
      .select().single();
    if (no) setOpcoes(prev => ({ ...prev, [pergId]: [...(prev[pergId] || []), no] }));
  }

  function updateOpcao(id: string, field: string, value: string | number | boolean) {
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].map(o => o.id === id ? { ...o, [field]: value } : o);
      }
      return next;
    });
    debounce(`opcao_${id}_${field}`, async () => {
      await db.from('quiz_opcoes').update({ [field]: value }).eq('id', id);
    });
  }

  async function deleteOpcao(id: string) {
    await db.from('quiz_opcoes').delete().eq('id', id);
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].filter(o => o.id !== id);
      }
      return next;
    });
  }

  function moveOpcao(pergId: string, fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= (opcoes[pergId]?.length || 0)) return;
    setOpcoes(prev => {
      const items = [...(prev[pergId] || [])];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      const reordered = items.map((o, i) => ({ ...o, ordem: i + 1 }));
      reordered.forEach(o => {
        db.from('quiz_opcoes').update({ ordem: o.ordem }).eq('id', o.id);
      });
      return { ...prev, [pergId]: reordered };
    });
  }

  // ── Toggle ativo ─────────────────────────────────────────────────────────
  async function toggleAtivo() {
    if (!quiz) return;
    const newVal = !quiz.ativo;
    setQuiz({ ...quiz, ativo: newVal });
    await db.from('quizzes').update({ ativo: newVal }).eq('id', quiz.id);
    toast.success(newVal ? 'Quiz ativado' : 'Quiz desativado');
  }

  const quizLink = quiz ? `${BASE_URL}/quiz/${quiz.slug}` : '';

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    padding: '9px 12px', borderRadius: '8px',
    border: `1px solid ${border}`, background: inputBg,
    color: textMain, fontSize: '14px', fontFamily: 'inherit', outline: 'none',
  };

  const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 600 as const,
    color: textMut, marginBottom: '5px',
  };

  const sectionCard = {
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (!ready || loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <Loader2 style={{ width: '28px', height: '28px', animation: 'spin 0.7s linear infinite', color: '#2563eb' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  // No quiz yet
  if (!quiz) {
    return (
      <AppLayout>
        <div style={{ padding: '32px 24px', maxWidth: '540px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: textMain, marginBottom: '8px' }}>Quiz de Qualificação</h1>
          <p style={{ fontSize: '14px', color: textMut, marginBottom: '32px', lineHeight: 1.6 }}>
            Crie um quiz público de qualificação para filtrar leads automaticamente antes de entrar em contato.
          </p>
          <button
            onClick={handleCreateQuiz}
            disabled={creating}
            style={{
              padding: '13px 28px', borderRadius: '10px', border: 'none',
              background: '#2563eb', color: '#fff', fontSize: '15px', fontWeight: 700,
              cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '8px',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? (
              <><Loader2 style={{ width: '16px', height: '16px', animation: 'spin 0.7s linear infinite' }} /> Criando...</>
            ) : (
              <><Plus style={{ width: '16px', height: '16px' }} /> Criar meu quiz</>
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>

        {/* ── Page header ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: textMain, margin: 0 }}>Quiz de Qualificação</h1>
            <p style={{ fontSize: '13px', color: textMut, margin: '2px 0 0' }}>
              Configure e gerencie seu quiz público de leads
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saving && (
              <span style={{ fontSize: '12px', color: textMut, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Salvando...
              </span>
            )}
            {/* Toggle ativo */}
            <div
              onClick={toggleAtivo}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                padding: '7px 12px', borderRadius: '8px',
                border: `1px solid ${border}`, background: cardBg,
                userSelect: 'none',
              }}
            >
              <div style={{
                width: '32px', height: '17px', borderRadius: '99px',
                background: quiz.ativo ? '#16a34a' : (isDark ? '#333' : '#d1d5db'),
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: quiz.ativo ? '15px' : '2px',
                  width: '13px', height: '13px', borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: quiz.ativo ? '#16a34a' : textMut }}>
                {quiz.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>

        {/* ── SEÇÃO 1: Configurações ──────────────────────────────────── */}
        <div style={sectionCard}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: textMain, margin: '0 0 16px' }}>
            Configurações Gerais
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Título do quiz</label>
              <input
                value={quiz.titulo}
                onChange={e => updateQuizField('titulo', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Slug (URL)</label>
              <input
                value={quiz.slug}
                onChange={e => updateQuizField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                style={inputStyle}
              />
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: textMut }}>
                floowdashboard.vercel.app/quiz/{quiz.slug}
              </p>
            </div>

            <div>
              <label style={labelStyle}>Cor primária</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={quiz.cor_primaria || '#2563eb'}
                  onChange={e => updateQuizField('cor_primaria', e.target.value)}
                  style={{ width: '40px', height: '38px', borderRadius: '8px', border: `1px solid ${border}`, cursor: 'pointer', padding: '2px' }}
                />
                <input
                  value={quiz.cor_primaria || '#2563eb'}
                  onChange={e => updateQuizField('cor_primaria', e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>WhatsApp de redirecionamento</label>
              <input
                value={quiz.redirect_whatsapp}
                onChange={e => updateQuizField('redirect_whatsapp', e.target.value)}
                placeholder="5511999999999"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Corte Verde (score mínimo)</label>
              <input
                type="number"
                value={quiz.corte_verde}
                onChange={e => updateQuizField('corte_verde', Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Corte Amarelo (score mínimo)</label>
              <input
                type="number"
                value={quiz.corte_amarelo}
                onChange={e => updateQuizField('corte_amarelo', Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Mensagem de aprovação</label>
              <textarea
                value={quiz.mensagem_aprovado}
                onChange={e => updateQuizField('mensagem_aprovado', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Mensagem de reprovação</label>
              <textarea
                value={quiz.mensagem_reprovado}
                onChange={e => updateQuizField('mensagem_reprovado', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* ── SEÇÃO 3: Preview / Link ─────────────────────────────────── */}
        <div style={{ ...sectionCard, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '0' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: textMut, marginBottom: '4px' }}>Link público do quiz</p>
            <p style={{
              margin: 0, fontSize: '13px', color: '#2563eb',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {quizLink}
            </p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(quizLink); toast.success('Link copiado!'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: `1px solid ${border}`,
              background: 'transparent', color: textMain, fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Copy style={{ width: '14px', height: '14px' }} /> Copiar
          </button>
          <button
            onClick={() => window.open(quizLink, '_blank')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <ExternalLink style={{ width: '14px', height: '14px' }} /> Abrir quiz
          </button>
        </div>

        {/* ── SEÇÃO 2: Builder de perguntas ──────────────────────────── */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: textMain, margin: 0 }}>
              Perguntas
            </h2>
            <button
              onClick={addBloco}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: `1px solid ${border}`,
                background: cardBg, color: textMain, fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} /> Adicionar bloco
            </button>
          </div>

          {blocos.map(bloco => (
            <div key={bloco.id} style={{ marginBottom: '20px' }}>
              {/* Bloco header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '10px',
                background: isDark ? '#1a1a1e' : '#f0f0f5',
                marginBottom: '8px',
              }}>
                <input
                  value={bloco.titulo}
                  onChange={e => updateBlocoTitulo(bloco.id, e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: '13px', fontWeight: 700, color: textMain, fontFamily: 'inherit',
                    letterSpacing: '0.02em', textTransform: 'uppercase',
                  }}
                />
                <button
                  onClick={() => addPergunta(bloco.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 10px', borderRadius: '6px', border: `1px solid ${border}`,
                    background: cardBg, color: textMain, fontSize: '12px', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Plus style={{ width: '12px', height: '12px' }} /> Pergunta
                </button>
                <button
                  onClick={() => deleteBloco(bloco.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>

              {/* Perguntas com DnD */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={event => handleDragEnd(bloco.id, event)}
              >
                <SortableContext
                  items={(perguntas[bloco.id] || []).map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {(perguntas[bloco.id] || []).map(perg => (
                    <SortableQuestion
                      key={perg.id}
                      pergunta={perg}
                      opcoes={opcoes[perg.id] || []}
                      todasPerguntas={todasPerguntas}
                      todasOpcoes={opcoes}
                      isDark={isDark}
                      onUpdatePergunta={updatePergunta}
                      onDeletePergunta={deletePergunta}
                      onAddOpcao={addOpcao}
                      onUpdateOpcao={updateOpcao}
                      onDeleteOpcao={deleteOpcao}
                      onMoveOpcao={moveOpcao}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {(perguntas[bloco.id] || []).length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px',
                  border: `1px dashed ${border}`, borderRadius: '10px',
                  color: textMut, fontSize: '13px',
                }}>
                  Nenhuma pergunta neste bloco.{' '}
                  <button
                    onClick={() => addPergunta(bloco.id)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600 }}
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}
