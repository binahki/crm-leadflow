import { useState, useEffect, useRef } from 'react';
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
  Plus, Trash2, GripVertical, Copy, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Settings, List, Eye, Check, Upload, X,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BASE_URL = 'https://floowdashboard.vercel.app';
type Tab = 'config' | 'perguntas' | 'preview';

interface QuizConfig {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; logo_url: string | null;
}
interface Bloco { id: string; quiz_id: string; titulo: string; ordem: number; }
interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
}
interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
}

function hexRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Phone Frame Preview ─────────────────────────────────────────────────────
function PhonePreview({ quiz, blocos, perguntas, opcoes, isDark }: {
  quiz: QuizConfig;
  blocos: Bloco[];
  perguntas: Record<string, Pergunta[]>;
  opcoes: Record<string, Opcao[]>;
  isDark: boolean;
}) {
  const primary = quiz.cor_primaria || '#2563eb';
  const firstBloco = blocos[0];
  const firstPergs = firstBloco ? (perguntas[firstBloco.id] || []) : [];
  const firstPerg = firstPergs[0];
  const firstOpcoes = firstPerg ? (opcoes[firstPerg.id] || []).slice(0, 3) : [];
  const BLOCO_EMOJIS: Record<number, string> = { 1: '🔥', 2: '👤', 3: '💼', 4: '🔒' };
  const blocoEmoji = firstBloco ? (BLOCO_EMOJIS[firstBloco.ordem] ?? '✦') : '🔥';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(160deg, #faf9f7 0%, ${hexRgba(primary, 0.07)} 100%)`,
      padding: '8px 10px 16px',
      overflowY: 'auto',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');`}</style>

      {/* Progress bar */}
      <div style={{ height: '2px', background: hexRgba(primary, 0.15), borderRadius: '1px', marginBottom: '10px' }}>
        <div style={{ height: '100%', width: '30%', background: primary, borderRadius: '1px' }} />
      </div>

      {/* Logo / title */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        {quiz.logo_url ? (
          <img src={quiz.logo_url} alt={quiz.titulo} style={{ maxHeight: '24px', maxWidth: '80px', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: '9px', fontWeight: 600, color: '#7d7671', letterSpacing: '0.03em' }}>{quiz.titulo}</span>
        )}
      </div>

      {firstBloco && (
        <>
          {/* Block badge + counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 9px 3px 7px', borderRadius: '99px',
              background: hexRgba(primary, 0.1),
              border: `1px solid ${hexRgba(primary, 0.18)}`,
            }}>
              <span style={{ fontSize: '9px' }}>{blocoEmoji}</span>
              <span style={{ fontSize: '7px', fontWeight: 700, color: primary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {firstBloco.titulo}
              </span>
            </div>
            <span style={{ fontSize: '8px', color: '#b5ada6', fontWeight: 500 }}>1 / {firstPergs.length}</span>
          </div>

          {/* Question */}
          {firstPerg ? (
            <>
              <h3 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '12px', fontWeight: 600, color: '#1a1918',
                lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center',
              }}>
                {firstPerg.texto.length > 60 ? firstPerg.texto.slice(0, 60) + '...' : firstPerg.texto}
              </h3>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {firstOpcoes.map((op, i) => (
                  <div key={op.id} style={{
                    padding: '8px 10px', borderRadius: '8px',
                    border: `1.5px solid ${i === 0 ? primary : 'rgba(26,25,24,0.1)'}`,
                    background: i === 0 ? hexRgba(primary, 0.07) : '#ffffff',
                    fontSize: '10px', color: '#1a1918',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    {i === 0 && (
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <span style={{ flex: 1, lineHeight: 1.4 }}>
                      {op.texto.length > 32 ? op.texto.slice(0, 32) + '...' : op.texto}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#b5ada6', fontSize: '10px' }}>
              Nenhuma pergunta configurada
            </div>
          )}
        </>
      )}

      {!firstBloco && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#b5ada6', fontSize: '10px' }}>
          Adicione blocos e perguntas para ver o preview
        </div>
      )}
    </div>
  );
}

// ── SortableQuestion ────────────────────────────────────────────────────────
function SortableQuestion({
  pergunta, opcoes, todasPerguntas, todasOpcoes, isDark,
  onUpdatePergunta, onDeletePergunta,
  onAddOpcao, onUpdateOpcao, onDeleteOpcao, onMoveOpcao,
}: {
  pergunta: Pergunta; opcoes: Opcao[];
  todasPerguntas: Pergunta[]; todasOpcoes: Record<string, Opcao[]>;
  isDark: boolean;
  onUpdatePergunta: (id: string, field: string, value: string | null) => void;
  onDeletePergunta: (id: string) => void;
  onAddOpcao: (pergId: string) => void;
  onUpdateOpcao: (id: string, field: string, value: string | number | boolean) => void;
  onDeleteOpcao: (id: string) => void;
  onMoveOpcao: (pergId: string, fromIdx: number, toIdx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pergunta.id });
  const [expanded, setExpanded] = useState(false);
  const [showConditional, setShowConditional] = useState(!!(pergunta.condicao_pergunta_id));

  const cardBg  = isDark ? '#161618' : '#ffffff';
  const border  = isDark ? '#2a2a2e' : '#e8e6e3';
  const textMut = isDark ? 'rgba(255,255,255,0.4)' : '#9d9189';
  const inputBg = isDark ? '#1a1a1e' : '#f7f6f4';
  const textMain = isDark ? '#f0f0f0' : '#1a1918';

  const conditionalOpcoes = pergunta.condicao_pergunta_id
    ? (todasOpcoes[pergunta.condicao_pergunta_id] || []) : [];

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, marginBottom: '5px' }}>
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 13px' }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab', color: textMut, flexShrink: 0, display: 'flex', touchAction: 'none' }}>
            <GripVertical style={{ width: '14px', height: '14px' }} />
          </div>

          <input
            value={pergunta.texto}
            onChange={e => onUpdatePergunta(pergunta.id, 'texto', e.target.value)}
            placeholder="Texto da pergunta..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: textMain, fontFamily: 'inherit' }}
          />

          <span style={{
            fontSize: '10px', fontWeight: 600, color: textMut,
            background: isDark ? 'rgba(255,255,255,0.06)' : '#f0ede9',
            padding: '2px 7px', borderRadius: '99px', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {opcoes.length}
          </span>

          <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '2px', flexShrink: 0 }}>
            {expanded ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
          </button>

          <button onClick={() => onDeletePergunta(pergunta.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
            <Trash2 style={{ width: '13px', height: '13px' }} />
          </button>
        </div>

        {/* Body */}
        {expanded && (
          <div style={{ borderTop: `1px solid ${border}`, padding: '13px 13px' }}>
            <p style={{ margin: '0 0 7px', fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Opções
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
              {opcoes.map((op, idx) => (
                <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <button onClick={() => onMoveOpcao(pergunta.id, idx, idx - 1)} disabled={idx === 0}
                      style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: textMut, opacity: idx === 0 ? 0.2 : 1, padding: '1px', display: 'flex' }}>
                      <ChevronUp style={{ width: '11px', height: '11px' }} />
                    </button>
                    <button onClick={() => onMoveOpcao(pergunta.id, idx, idx + 1)} disabled={idx === opcoes.length - 1}
                      style={{ background: 'none', border: 'none', cursor: idx === opcoes.length - 1 ? 'default' : 'pointer', color: textMut, opacity: idx === opcoes.length - 1 ? 0.2 : 1, padding: '1px', display: 'flex' }}>
                      <ChevronDown style={{ width: '11px', height: '11px' }} />
                    </button>
                  </div>

                  <input
                    value={op.texto}
                    onChange={e => onUpdateOpcao(op.id, 'texto', e.target.value)}
                    placeholder="Texto da opção"
                    style={{ flex: 1, padding: '6px 9px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}
                  />

                  <input
                    type="number" value={op.pontos} title="Pontos"
                    onChange={e => onUpdateOpcao(op.id, 'pontos', Number(e.target.value))}
                    style={{ width: '48px', padding: '6px 5px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '12.5px', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
                  />

                  <label title="Reprova imediato" style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={op.reprova_imediato}
                      onChange={e => onUpdateOpcao(op.id, 'reprova_imediato', e.target.checked)}
                      style={{ accentColor: '#ef4444', width: '13px', height: '13px' }} />
                    <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>Reprova</span>
                  </label>

                  <button onClick={() => onDeleteOpcao(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => onAddOpcao(pergunta.id)} style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px',
              borderRadius: '6px', border: `1px dashed ${border}`, background: 'transparent',
              color: textMut, fontSize: '11.5px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Adicionar opção
            </button>

            {/* Condicional */}
            <div style={{ marginTop: '12px', paddingTop: '11px', borderTop: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => {
                  const next = !showConditional;
                  setShowConditional(next);
                  if (!next) {
                    onUpdatePergunta(pergunta.id, 'condicao_pergunta_id', null);
                    onUpdatePergunta(pergunta.id, 'condicao_opcao_id', null);
                  }
                }}>
                <div style={{
                  width: '28px', height: '15px', borderRadius: '99px',
                  background: showConditional ? '#2563eb' : (isDark ? '#333' : '#d4cfc9'),
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: '2px',
                    left: showConditional ? '13px' : '2px',
                    width: '11px', height: '11px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }} />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: textMut }}>Pergunta condicional</span>
              </div>

              {showConditional && (
                <div style={{ marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <select value={pergunta.condicao_pergunta_id || ''}
                    onChange={e => {
                      onUpdatePergunta(pergunta.id, 'condicao_pergunta_id', e.target.value || null);
                      onUpdatePergunta(pergunta.id, 'condicao_opcao_id', null);
                    }}
                    style={{ padding: '6px 9px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}>
                    <option value="">Selecionar pergunta condicionante...</option>
                    {todasPerguntas.filter(p => p.id !== pergunta.id).map(p => (
                      <option key={p.id} value={p.id}>{p.texto.slice(0, 65)}</option>
                    ))}
                  </select>

                  {pergunta.condicao_pergunta_id && (
                    <select value={pergunta.condicao_opcao_id || ''}
                      onChange={e => onUpdatePergunta(pergunta.id, 'condicao_opcao_id', e.target.value || null)}
                      style={{ padding: '6px 9px', borderRadius: '6px', border: `1px solid ${border}`, background: inputBg, color: textMain, fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}>
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
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function QuizBuilderPage() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [perguntas, setPerguntas] = useState<Record<string, Pergunta[]>>({});
  const [opcoes, setOpcoes] = useState<Record<string, Opcao[]>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);

  const bg       = isDark ? '#0d0d0f' : '#f4f2ef';
  const cardBg   = isDark ? '#111113' : '#ffffff';
  const border   = isDark ? '#1e1e22' : '#e8e6e3';
  const textMut  = isDark ? 'rgba(255,255,255,0.4)' : '#9d9189';
  const textMain = isDark ? '#f4f4f5' : '#1a1918';
  const inputBg  = isDark ? '#1a1a1e' : '#f7f6f4';
  const panelBg  = isDark ? '#0a0a0c' : '#eceae6';

  const todasPerguntas: Pergunta[] = blocos.flatMap(b => perguntas[b.id] || []);
  const quizLink = quiz ? `${BASE_URL}/quiz/${quiz.slug}` : '';
  const totalPergs = todasPerguntas.length;

  useEffect(() => {
    if (!ready || !orgId) return;
    loadData();
  }, [ready, orgId]);

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
        ativo: true,
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

  function debounce(key: string, fn: () => Promise<void>, delay = 800) {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      setSaving(true);
      try { await fn(); } catch { /* ignore */ }
      setSaving(false);
    }, delay);
  }

  function updateQuizField(field: string, value: string | number | boolean) {
    if (!quiz) return;
    setQuiz({ ...quiz, [field]: value } as QuizConfig);
    debounce(`quiz_${field}`, async () => {
      await db.from('quizzes').update({ [field]: value }).eq('id', quiz.id);
    });
  }

  async function saveConfig() {
    if (!quiz) return;
    setConfigSaving(true);
    const { error } = await db.from('quizzes').update({
      titulo: quiz.titulo, slug: quiz.slug, cor_primaria: quiz.cor_primaria,
      redirect_whatsapp: quiz.redirect_whatsapp, corte_verde: quiz.corte_verde,
      corte_amarelo: quiz.corte_amarelo, mensagem_aprovado: quiz.mensagem_aprovado,
      mensagem_reprovado: quiz.mensagem_reprovado,
    }).eq('id', quiz.id);
    setConfigSaving(false);
    if (error) toast.error('Erro ao salvar'); else toast.success('Configurações salvas!');
  }

  async function toggleAtivo() {
    if (!quiz) return;
    const newVal = !quiz.ativo;
    setQuiz({ ...quiz, ativo: newVal });
    await db.from('quizzes').update({ ativo: newVal }).eq('id', quiz.id);
    toast.success(newVal ? 'Quiz ativado' : 'Quiz desativado');
  }

  async function handleLogoUpload(file: File) {
    if (!quiz) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `quiz-logos/${quiz.id}.${ext}`;
      const { error: upErr } = await (supabase as any).storage
        .from('quiz-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = (supabase as any).storage.from('quiz-assets').getPublicUrl(path);
      const logoUrl = urlData.publicUrl;
      await db.from('quizzes').update({ logo_url: logoUrl }).eq('id', quiz.id);
      setQuiz(q => q ? { ...q, logo_url: logoUrl } : q);
      toast.success('Logo atualizada!');
    } catch (err: unknown) {
      toast.error(`Erro no upload: ${err instanceof Error ? err.message : 'Tente novamente'}`);
    }
    setUploading(false);
  }

  async function handleRemoveLogo() {
    if (!quiz) return;
    await db.from('quizzes').update({ logo_url: null }).eq('id', quiz.id);
    setQuiz(q => q ? { ...q, logo_url: null } : q);
    toast.success('Logo removida');
  }

  async function addBloco() {
    if (!quiz) return;
    const ordem = blocos.length + 1;
    const { data: nb } = await db.from('quiz_blocos').insert({ quiz_id: quiz.id, titulo: `Bloco ${ordem}`, ordem }).select().single();
    if (nb) { setBlocos(p => [...p, nb]); setPerguntas(p => ({ ...p, [nb.id]: [] })); }
  }

  async function updateBlocoTitulo(id: string, titulo: string) {
    setBlocos(p => p.map(b => b.id === id ? { ...b, titulo } : b));
    debounce(`bloco_${id}`, async () => { await db.from('quiz_blocos').update({ titulo }).eq('id', id); });
  }

  async function deleteBloco(id: string) {
    if (!confirm('Deletar este bloco e todas as perguntas?')) return;
    await db.from('quiz_blocos').delete().eq('id', id);
    setBlocos(p => p.filter(b => b.id !== id));
    setPerguntas(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function addPergunta(blocoId: string) {
    const ordem = (perguntas[blocoId]?.length || 0) + 1;
    const { data: np } = await db.from('quiz_perguntas').insert({ bloco_id: blocoId, texto: '', ordem }).select().single();
    if (np) { setPerguntas(p => ({ ...p, [blocoId]: [...(p[blocoId] || []), np] })); setOpcoes(p => ({ ...p, [np.id]: [] })); }
  }

  function updatePergunta(id: string, field: string, value: string | null) {
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].map(p => p.id === id ? { ...p, [field]: value } : p);
      return next;
    });
    debounce(`perg_${id}_${field}`, async () => { await db.from('quiz_perguntas').update({ [field]: value }).eq('id', id); });
  }

  async function deletePergunta(id: string) {
    await db.from('quiz_perguntas').delete().eq('id', id);
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].filter(p => p.id !== id);
      return next;
    });
    setOpcoes(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

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
      reordered.forEach(p => db.from('quiz_perguntas').update({ ordem: p.ordem }).eq('id', p.id));
      return { ...prev, [blocoId]: reordered };
    });
  }

  async function addOpcao(pergId: string) {
    const ordem = (opcoes[pergId]?.length || 0) + 1;
    const { data: no } = await db.from('quiz_opcoes').insert({ pergunta_id: pergId, texto: '', pontos: 0, reprova_imediato: false, ordem }).select().single();
    if (no) setOpcoes(p => ({ ...p, [pergId]: [...(p[pergId] || []), no] }));
  }

  function updateOpcao(id: string, field: string, value: string | number | boolean) {
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].map(o => o.id === id ? { ...o, [field]: value } : o);
      return next;
    });
    debounce(`opcao_${id}_${field}`, async () => { await db.from('quiz_opcoes').update({ [field]: value }).eq('id', id); });
  }

  async function deleteOpcao(id: string) {
    await db.from('quiz_opcoes').delete().eq('id', id);
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter(o => o.id !== id);
      return next;
    });
  }

  function moveOpcao(pergId: string, fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= (opcoes[pergId]?.length || 0)) return;
    setOpcoes(prev => {
      const items = [...(prev[pergId] || [])];
      const [m] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, m);
      const reordered = items.map((o, i) => ({ ...o, ordem: i + 1 }));
      reordered.forEach(o => db.from('quiz_opcoes').update({ ordem: o.ordem }).eq('id', o.id));
      return { ...prev, [pergId]: reordered };
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(quizLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: '8px',
    border: `1px solid ${border}`, background: inputBg, color: textMain,
    fontSize: '13.5px', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: textMut,
    marginBottom: '5px', letterSpacing: '0.03em', textTransform: 'uppercase',
  };

  // ── LOADING ─────────────────────────────────────────────────────────────────
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

  // ── EMPTY STATE ─────────────────────────────────────────────────────────────
  if (!quiz) {
    return (
      <AppLayout>
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: '520px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1 }}>📋</div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: textMain, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Quiz de Qualificação
              </h1>
              <p style={{ fontSize: '14px', color: textMut, lineHeight: 1.65, maxWidth: '360px', margin: '0 auto' }}>
                Crie um quiz público para qualificar leads automaticamente, antes de entrar em contato.
              </p>
            </div>

            {/* Option cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button onClick={() => handleCreateQuiz(true)} disabled={creating}
                style={{
                  padding: '24px 20px', borderRadius: '14px',
                  border: `2px solid #2563eb`,
                  background: '#2563eb10', color: textMain,
                  cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>✨</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: '#2563eb' }}>Modelo Becker</div>
                <div style={{ fontSize: '12px', color: textMut, lineHeight: 1.5 }}>Quiz de semijoias pronto para usar</div>
              </button>

              <button onClick={() => handleCreateQuiz(false)} disabled={creating}
                style={{
                  padding: '24px 20px', borderRadius: '14px',
                  border: `1.5px solid ${border}`,
                  background: cardBg, color: textMain,
                  cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>📄</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: textMain }}>Em branco</div>
                <div style={{ fontSize: '12px', color: textMut, lineHeight: 1.5 }}>Comece do zero com suas perguntas</div>
              </button>
            </div>

            {creating && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px', color: textMut, fontSize: '13px' }}>
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

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: `1px solid ${border}`,
          background: cardBg, flexShrink: 0, gap: '12px',
        }}>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: textMain, margin: 0, letterSpacing: '-0.01em' }}>
              {quiz.titulo}
            </h1>
            <p style={{ fontSize: '11px', color: textMut, margin: '1px 0 0' }}>
              /quiz/{quiz.slug}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saving && (
              <span style={{ fontSize: '11px', color: textMut, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 0.7s linear infinite' }} />
                Salvando
              </span>
            )}

            {/* Status toggle */}
            <div onClick={toggleAtivo} style={{
              display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
              padding: '6px 11px', borderRadius: '8px',
              border: `1px solid ${border}`, background: cardBg, userSelect: 'none',
            }}>
              <div style={{
                width: '28px', height: '15px', borderRadius: '99px',
                background: quiz.ativo ? '#16a34a' : (isDark ? '#333' : '#d4cfc9'),
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: quiz.ativo ? '13px' : '2px',
                  width: '11px', height: '11px', borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: quiz.ativo ? '#16a34a' : textMut }}>
                {quiz.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <button onClick={() => window.open(quizLink, '_blank')} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 13px', borderRadius: '8px', border: 'none',
              background: '#2563eb', color: '#fff',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <ExternalLink style={{ width: '12px', height: '12px' }} />
              Ver quiz
            </button>
          </div>
        </div>

        {/* ── SPLIT LAYOUT ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT PANEL: Editor */}
          <div style={{
            width: '480px', minWidth: '360px', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${border}`,
            background: bg,
          }}>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: '2px', padding: '10px 14px 0',
              background: cardBg, flexShrink: 0,
              borderBottom: `1px solid ${border}`,
            }}>
              {([
                { id: 'config',    label: 'Configurações', icon: Settings },
                { id: 'perguntas', label: 'Perguntas',      icon: List },
                { id: 'preview',   label: 'Link',           icon: Eye },
              ] as { id: Tab; label: string; icon: React.ElementType }[]).map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    padding: '8px 10px 10px', borderRadius: '0', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: 'transparent',
                    color: active ? textMain : textMut,
                    fontSize: '12.5px', fontWeight: active ? 700 : 500,
                    borderBottom: active ? `2px solid #2563eb` : '2px solid transparent',
                    transition: 'all 0.15s',
                    marginBottom: '-1px',
                  }}>
                    <tab.icon style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

              {/* ── CONFIG TAB ─────────────────────────────────────── */}
              {activeTab === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Logo */}
                  <div>
                    <label style={lbl}>Logo</label>
                    {quiz.logo_url ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '9px',
                        border: `1px solid ${border}`, background: cardBg,
                      }}>
                        <img src={quiz.logo_url} alt="Logo" style={{ height: '28px', maxWidth: '80px', objectFit: 'contain', borderRadius: '4px' }} />
                        <span style={{ flex: 1, fontSize: '12px', color: textMut }}>Logo ativa</span>
                        <button onClick={handleRemoveLogo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                          <X style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                        <button onClick={() => logoInputRef.current?.click()} disabled={uploading}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '9px',
                            border: `1.5px dashed ${border}`, background: 'transparent',
                            color: textMut, fontSize: '12.5px', cursor: 'pointer',
                            fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '6px',
                          }}>
                          {uploading
                            ? <><Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Enviando...</>
                            : <><Upload style={{ width: '13px', height: '13px' }} /> Fazer upload da logo</>
                          }
                        </button>
                      </>
                    )}
                  </div>

                  {/* Título */}
                  <div>
                    <label style={lbl}>Título do quiz</label>
                    <input value={quiz.titulo}
                      onChange={e => updateQuizField('titulo', e.target.value)}
                      style={inputStyle} />
                  </div>

                  {/* Slug */}
                  <div>
                    <label style={lbl}>Slug (URL)</label>
                    <input value={quiz.slug}
                      onChange={e => updateQuizField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      style={inputStyle} />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#2563eb' }}>
                      floowdashboard.vercel.app/quiz/{quiz.slug}
                    </p>
                  </div>

                  {/* Cor primária */}
                  <div>
                    <label style={lbl}>Cor primária</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="color" value={quiz.cor_primaria || '#2563eb'}
                        onChange={e => updateQuizField('cor_primaria', e.target.value)}
                        style={{ width: '38px', height: '36px', borderRadius: '7px', border: `1px solid ${border}`, cursor: 'pointer', padding: '2px', background: 'none' }} />
                      <input value={quiz.cor_primaria || '#2563eb'}
                        onChange={e => updateQuizField('cor_primaria', e.target.value)}
                        style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label style={lbl}>WhatsApp de redirecionamento</label>
                    <input value={quiz.redirect_whatsapp}
                      onChange={e => updateQuizField('redirect_whatsapp', e.target.value)}
                      placeholder="5511999999999"
                      style={inputStyle} />
                  </div>

                  {/* Cortes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={lbl}>Corte Verde (pts)</label>
                      <input type="number" value={quiz.corte_verde}
                        onChange={e => updateQuizField('corte_verde', Number(e.target.value))}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={lbl}>Corte Amarelo (pts)</label>
                      <input type="number" value={quiz.corte_amarelo}
                        onChange={e => updateQuizField('corte_amarelo', Number(e.target.value))}
                        style={inputStyle} />
                    </div>
                  </div>

                  {/* Mensagens */}
                  <div>
                    <label style={lbl}>Mensagem de aprovação</label>
                    <textarea value={quiz.mensagem_aprovado}
                      onChange={e => updateQuizField('mensagem_aprovado', e.target.value)}
                      rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={lbl}>Mensagem de reprovação</label>
                    <textarea value={quiz.mensagem_reprovado}
                      onChange={e => updateQuizField('mensagem_reprovado', e.target.value)}
                      rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>

                  {/* Save button */}
                  <div style={{ paddingTop: '4px' }}>
                    <button onClick={saveConfig} disabled={configSaving} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 18px', borderRadius: '8px', border: 'none',
                      background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600,
                      cursor: configSaving ? 'default' : 'pointer', fontFamily: 'inherit',
                      opacity: configSaving ? 0.7 : 1,
                    }}>
                      {configSaving
                        ? <><Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Salvando...</>
                        : <><Check style={{ width: '13px', height: '13px' }} /> Salvar configurações</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── PERGUNTAS TAB ──────────────────────────────────── */}
              {activeTab === 'perguntas' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', color: textMut, fontWeight: 500 }}>
                      {blocos.length} blocos · {totalPergs} perguntas
                    </span>
                    <button onClick={addBloco} style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 12px', borderRadius: '7px',
                      border: `1px solid ${border}`, background: cardBg,
                      color: textMain, fontSize: '12px', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Plus style={{ width: '13px', height: '13px' }} /> Bloco
                    </button>
                  </div>

                  {blocos.map(bloco => (
                    <div key={bloco.id} style={{ marginBottom: '16px' }}>
                      {/* Bloco header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 11px', borderRadius: '9px',
                        background: isDark ? '#1a1a1e' : '#e8e5e0',
                        marginBottom: '5px',
                      }}>
                        <input value={bloco.titulo}
                          onChange={e => updateBlocoTitulo(bloco.id, e.target.value)}
                          style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            fontSize: '11px', fontWeight: 800, color: textMain, fontFamily: 'inherit',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                          }} />
                        <span style={{ fontSize: '10px', color: textMut, flexShrink: 0 }}>
                          {(perguntas[bloco.id] || []).length}p
                        </span>
                        <button onClick={() => addPergunta(bloco.id)} style={{
                          display: 'flex', alignItems: 'center', gap: '3px',
                          padding: '4px 9px', borderRadius: '5px',
                          border: `1px solid ${border}`, background: cardBg,
                          color: textMain, fontSize: '11px', fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                        }}>
                          <Plus style={{ width: '10px', height: '10px' }} /> Pergunta
                        </button>
                        <button onClick={() => deleteBloco(bloco.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0 }}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>

                      {/* Perguntas */}
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(bloco.id, e)}>
                        <SortableContext items={(perguntas[bloco.id] || []).map(p => p.id)} strategy={verticalListSortingStrategy}>
                          {(perguntas[bloco.id] || []).map(perg => (
                            <SortableQuestion
                              key={perg.id} pergunta={perg} opcoes={opcoes[perg.id] || []}
                              todasPerguntas={todasPerguntas} todasOpcoes={opcoes} isDark={isDark}
                              onUpdatePergunta={updatePergunta} onDeletePergunta={deletePergunta}
                              onAddOpcao={addOpcao} onUpdateOpcao={updateOpcao}
                              onDeleteOpcao={deleteOpcao} onMoveOpcao={moveOpcao}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>

                      {(perguntas[bloco.id] || []).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '14px', border: `1px dashed ${border}`, borderRadius: '9px', color: textMut, fontSize: '12px' }}>
                          <button onClick={() => addPergunta(bloco.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600 }}>
                            + Adicionar primeira pergunta
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── PREVIEW TAB ────────────────────────────────────── */}
              {activeTab === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Link */}
                  <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '11px', padding: '16px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Link público
                    </p>
                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#2563eb', wordBreak: 'break-all', lineHeight: 1.5 }}>
                      {quizLink}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={handleCopyLink} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '8px 14px', borderRadius: '7px',
                        border: `1px solid ${border}`,
                        background: copied ? '#dcfce7' : 'transparent',
                        color: copied ? '#15803d' : textMain,
                        fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s',
                      }}>
                        {copied ? <Check style={{ width: '13px', height: '13px' }} /> : <Copy style={{ width: '13px', height: '13px' }} />}
                        {copied ? 'Copiado!' : 'Copiar link'}
                      </button>
                      <button onClick={() => window.open(quizLink, '_blank')} style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '8px 14px', borderRadius: '7px', border: 'none',
                        background: '#2563eb', color: '#fff',
                        fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        <ExternalLink style={{ width: '13px', height: '13px' }} /> Abrir quiz
                      </button>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '11px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      QR Code
                    </p>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(quizLink)}&bgcolor=ffffff&color=111111&margin=10`}
                      alt="QR Code"
                      style={{ width: '150px', height: '150px', borderRadius: '8px', border: `1px solid ${border}` }}
                    />
                    <p style={{ margin: 0, fontSize: '11px', color: textMut }}>Compartilhe escaneando</p>
                  </div>

                  {/* Stats */}
                  <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '11px', padding: '16px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Estrutura
                    </p>
                    {[
                      { label: 'Blocos',    value: blocos.length },
                      { label: 'Perguntas', value: totalPergs },
                      { label: 'Corte verde',    value: `≥ ${quiz.corte_verde} pts` },
                      { label: 'Corte amarelo',  value: `≥ ${quiz.corte_amarelo} pts` },
                    ].map(stat => (
                      <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: textMut }}>{stat.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>{stat.value}</span>
                      </div>
                    ))}
                    <div style={{ paddingTop: '8px', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', color: textMut }}>Status</span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px',
                        background: quiz.ativo ? '#dcfce7' : (isDark ? 'rgba(255,255,255,0.06)' : '#f0ede9'),
                        color: quiz.ativo ? '#15803d' : textMut,
                      }}>
                        {quiz.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Phone preview */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: panelBg, padding: '32px',
            overflow: 'hidden',
          }} className="quiz-phone-panel">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: textMut, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Preview ao vivo
              </p>

              {/* Phone frame */}
              <div style={{
                width: '280px', height: '560px',
                borderRadius: '38px',
                border: `9px solid ${isDark ? '#1c1c20' : '#1a1918'}`,
                boxShadow: isDark
                  ? '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.03)'
                  : '0 32px 64px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.1)',
                overflow: 'hidden', background: '#faf9f7',
                position: 'relative', flexShrink: 0,
              }}>
                {/* Notch */}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '72px', height: '18px',
                  background: isDark ? '#1c1c20' : '#1a1918',
                  borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px',
                  zIndex: 10,
                }} />

                {/* Screen */}
                <div style={{ width: '100%', height: '100%', paddingTop: '18px' }}>
                  <PhonePreview quiz={quiz} blocos={blocos} perguntas={perguntas} opcoes={opcoes} isDark={isDark} />
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '10px', color: textMut, opacity: 0.6 }}>
                {quiz.slug && `quiz/${quiz.slug}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .quiz-phone-panel { display: none !important; }
        }
      `}</style>
    </AppLayout>
  );
}
