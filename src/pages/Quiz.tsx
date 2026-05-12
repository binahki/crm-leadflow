import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { seedQuizBecker } from '@/utils/seedQuizBecker';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Copy, ExternalLink,
  Loader2, Settings, Eye, Check, X, Upload,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BASE_URL = 'https://floowdashboard.vercel.app';

const tokens = {
  radius: { sm: 8, md: 12, lg: 16, pill: 9999 },
  shadow: { card: '0 1px 4px rgba(0,0,0,0.06)', modal: '0 8px 32px rgba(0,0,0,0.12)' },
  transition: 'all 150ms ease-out',
  font: { sm: 12, md: 14, base: 15, lg: 18, xl: 22, xxl: 28 },
};

const EMOJI_LIST = [
  '💰','🏠','🚀','⭐','💼','🏡','🔍','✅','❌','⚡',
  '📱','📸','👶','😊','💫','🌟','🌱','✨','🎯','💪',
  '🏆','🎉','🙏','❤️','🤝','🎁','💎','🔑','📊','🌈',
];

type QuizPageType = 'cover' | 'question' | 'approval' | 'collect' | 'rejection';

interface QuizConfig {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; logo_url: string | null;
  capa_titulo: string | null; capa_subtitulo: string | null;
  capa_imagem_url: string | null; capa_beneficios: string[] | null;
  capa_botao_texto: string | null; coleta_campos: string[] | null;
}

interface Bloco { id: string; quiz_id: string; titulo: string; ordem: number; emoji?: string | null; }

interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
}

interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number; emoji: string | null;
}

interface FlatPergunta extends Pergunta { blocoTitulo: string; globalIndex: number; }

function hexRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute', zIndex: 300, top: '110%', left: 0,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: tokens.radius.md, padding: '8px',
        boxShadow: tokens.shadow.modal,
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '2px',
        width: '192px',
      }}
      onClick={e => e.stopPropagation()}
    >
      {EMOJI_LIST.map(e => (
        <button key={e}
          onClick={() => { onSelect(e); onClose(); }}
          style={{ fontSize: '15px', padding: '4px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', lineHeight: 1 }}
          onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.background = '#f3f4f6'; }}
          onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >{e}</button>
      ))}
    </div>
  );
}

// ── Phone Preview ─────────────────────────────────────────────────────────────
function PhonePreview({ pageType, quiz, flatPerguntas, opcoes, selectedPergId }: {
  pageType: QuizPageType; quiz: QuizConfig; flatPerguntas: FlatPergunta[];
  opcoes: Record<string, Opcao[]>; selectedPergId?: string;
}) {
  const primary = quiz.cor_primaria || '#2563eb';

  return (
    <div style={{
      width: '100%', height: '100%', background: '#fff', overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', padding: '7px 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
          {quiz.logo_url
            ? <img src={quiz.logo_url} alt="" style={{ maxHeight: 16, maxWidth: 65, objectFit: 'contain' }} />
            : <span style={{ fontSize: '7px', fontWeight: 700, color: '#111' }}>{quiz.titulo || 'Nome do quiz'}</span>
          }
        </div>
        <div style={{ height: '3px', background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: primary,
            width: pageType === 'cover' ? '2%' : pageType === 'question' ? '45%' : '100%',
            borderRadius: '0 99px 99px 0', transition: 'width 400ms ease-out',
          }} />
        </div>
        <div style={{ height: 3 }} />
      </div>

      {/* Cover */}
      {pageType === 'cover' && (() => {
        const title = quiz.capa_titulo || quiz.titulo || 'Título do Quiz';
        const benefits = quiz.capa_beneficios || [];
        return (
          <div style={{ padding: '10px 10px 20px' }}>
            {quiz.capa_imagem_url && (
              <img src={quiz.capa_imagem_url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8, objectFit: 'cover', maxHeight: 70 }} />
            )}
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#111', lineHeight: 1.2, marginBottom: 5, letterSpacing: '-0.02em' }}>
              {title.length > 55 ? title.slice(0, 55) + '...' : title}
            </div>
            {quiz.capa_subtitulo && (
              <div style={{ fontSize: '8px', color: '#6b7280', marginBottom: 8, lineHeight: 1.5 }}>
                {quiz.capa_subtitulo.length > 80 ? quiz.capa_subtitulo.slice(0, 80) + '...' : quiz.capa_subtitulo}
              </div>
            )}
            {benefits.slice(0, 3).map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: primary, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <span style={{ fontSize: '7px', color: '#374151', lineHeight: 1.4 }}>{b}</span>
              </div>
            ))}
            <div style={{ width: '100%', padding: '7px', borderRadius: 7, background: '#111', color: '#fff', fontSize: '8px', fontWeight: 700, textAlign: 'center', marginTop: benefits.length > 0 ? 8 : 4 }}>
              {quiz.capa_botao_texto || 'Clique para iniciar →'}
            </div>
          </div>
        );
      })()}

      {/* Question */}
      {pageType === 'question' && (() => {
        const perg = flatPerguntas.find(p => p.id === selectedPergId) || flatPerguntas[0];
        if (!perg) return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: '#9ca3af', fontSize: '8px' }}>
            Adicione uma pergunta
          </div>
        );
        const ops = (opcoes[perg.id] || []).slice(0, 3);
        return (
          <div style={{ padding: '8px 10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 99,
                background: hexRgba(primary, 0.08), border: `1px solid ${hexRgba(primary, 0.18)}`,
                fontSize: '6px', fontWeight: 700, color: primary, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                📝 {perg.blocoTitulo.length > 14 ? perg.blocoTitulo.slice(0, 14) : perg.blocoTitulo}
              </span>
              <span style={{ fontSize: '6px', color: '#9ca3af' }}>{perg.globalIndex} / {flatPerguntas.length}</span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: 7 }}>
              {perg.texto.length > 70 ? perg.texto.slice(0, 70) + '...' : (perg.texto || 'Texto da pergunta')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ops.map((op, i) => (
                <div key={op.id} style={{
                  padding: '5px 7px', borderRadius: 7,
                  border: `1.5px solid ${i === 0 ? primary : '#e2e8f0'}`,
                  background: i === 0 ? hexRgba(primary, 0.08) : '#fff',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {op.emoji && <span style={{ fontSize: '10px' }}>{op.emoji}</span>}
                  <span style={{ flex: 1, fontSize: '7px', color: '#111', fontWeight: 500 }}>
                    {op.texto.length > 30 ? op.texto.slice(0, 30) + '...' : (op.texto || 'Opção')}
                  </span>
                  {i === 0 && (
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: primary, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="5" height="5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                </div>
              ))}
              {ops.length === 0 && (
                <div style={{ textAlign: 'center', padding: '8px', color: '#9ca3af', fontSize: '7px', border: '1px dashed #e5e7eb', borderRadius: 7 }}>
                  Adicione opções
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Approval */}
      {pageType === 'approval' && (
        <div style={{ padding: '16px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: 6 }}>🎉</div>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>
            {(quiz.mensagem_aprovado || 'Parabéns! Você foi aprovada.').slice(0, 60)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 6px', borderRadius: 99, background: '#d1fae5', color: '#065f46', fontSize: '6px', fontWeight: 700 }}>✓ Perfil verificado</span>
            <span style={{ padding: '2px 6px', borderRadius: 99, background: hexRgba(primary, 0.1), color: primary, fontSize: '6px', fontWeight: 700 }}>✨ Pronta para começar</span>
          </div>
        </div>
      )}

      {/* Collect */}
      {pageType === 'collect' && (() => {
        const fields = quiz.coleta_campos || ['nome', 'whatsapp', 'cidade', 'instagram'];
        const labels: Record<string, string> = { nome: 'Nome completo *', whatsapp: 'WhatsApp *', cidade: 'Cidade *', instagram: 'Instagram' };
        const placeholders: Record<string, string> = { nome: 'Seu nome completo', whatsapp: '(99) 99999-9999', cidade: 'Sua cidade', instagram: '@seuperfil' };
        return (
          <div style={{ padding: '10px' }}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
              {fields.map(f => (
                <div key={f} style={{ marginBottom: 5 }}>
                  <div style={{ fontSize: '6px', fontWeight: 600, color: '#374151', marginBottom: 1 }}>{labels[f] || f}</div>
                  <div style={{ padding: '4px 6px', borderRadius: 5, border: '1.5px solid #e5e7eb', fontSize: '6px', color: '#9ca3af' }}>
                    {placeholders[f] || f}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '6px', borderRadius: 7, background: '#111', color: '#fff', fontSize: '7px', fontWeight: 700, textAlign: 'center' }}>
                Enviar meus dados →
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rejection */}
      {pageType === 'rejection' && (
        <div style={{ padding: '12px 10px' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '14px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: 5 }}>🌱</div>
            <div style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontSize: '5px', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' }}>
              Perfil em desenvolvimento
            </div>
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#111', lineHeight: 1.4 }}>
              {(quiz.mensagem_reprovado || 'Obrigada pela participação!').slice(0, 80)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  // UI
  const [selectedPageId, setSelectedPageId] = useState<string>('cover');
  const [saving, setSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openEmojiFor, setOpenEmojiFor] = useState<string | null>(null);
  const [activeCoverTab, setActiveCoverTab] = useState<'content' | 'appearance'>('content');
  const [newBenefit, setNewBenefit] = useState('');
  const [showConditional, setShowConditional] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedRecentlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Theme colors
  const bg        = isDark ? '#0d0d0f' : '#f4f2ef';
  const cardBg    = isDark ? '#111113' : '#ffffff';
  const border    = isDark ? '#1e1e22' : '#e8e6e3';
  const textMut   = isDark ? 'rgba(255,255,255,0.4)' : '#9d9189';
  const textMain  = isDark ? '#f4f4f5' : '#1a1918';
  const inputBg   = isDark ? '#1a1a1e' : '#f7f6f4';

  // Computed flat list of questions
  const flatPerguntas: FlatPergunta[] = [...blocos]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap(b => (perguntas[b.id] || []).sort((a, b) => a.ordem - b.ordem).map(p => ({ ...p, blocoTitulo: b.titulo })))
    .map((p, i) => ({ ...p, globalIndex: i + 1 }));

  const quizLink = quiz ? `${BASE_URL}/quiz/${quiz.slug}` : '';

  const selectedPageType: QuizPageType =
    selectedPageId === 'cover'     ? 'cover'    :
    selectedPageId === 'approval'  ? 'approval' :
    selectedPageId === 'collect'   ? 'collect'  :
    selectedPageId === 'rejection' ? 'rejection' : 'question';

  const selectedPergunta = selectedPageType === 'question'
    ? flatPerguntas.find(p => p.id === selectedPageId) ?? null
    : null;

  const selectedPergOpcoes = selectedPergunta ? (opcoes[selectedPergunta.id] || []) : [];

  // When selected pergunta changes, sync conditional toggle
  useEffect(() => {
    setShowConditional(!!selectedPergunta?.condicao_pergunta_id);
  }, [selectedPergunta?.id]);

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
        capa_titulo: null, capa_subtitulo: null, capa_imagem_url: null,
        capa_beneficios: [], capa_botao_texto: 'Clique para iniciar →',
        coleta_campos: ['nome', 'whatsapp', 'cidade', 'instagram'],
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
      setSavedRecently(false);
      try { await fn(); } catch { /* ignore */ }
      setSaving(false);
      setSavedRecently(true);
      if (savedRecentlyTimer.current) clearTimeout(savedRecentlyTimer.current);
      savedRecentlyTimer.current = setTimeout(() => setSavedRecently(false), 2000);
    }, delay);
  }

  function updateQuizField(field: string, value: string | number | boolean | string[] | null) {
    if (!quiz) return;
    setQuiz({ ...quiz, [field]: value } as QuizConfig);
    debounce(`quiz_${field}`, async () => {
      await db.from('quizzes').update({ [field]: value }).eq('id', quiz.id);
    });
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
      const { error: upErr } = await (supabase as any).storage.from('quiz-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = (supabase as any).storage.from('quiz-assets').getPublicUrl(path);
      await db.from('quizzes').update({ logo_url: urlData.publicUrl }).eq('id', quiz.id);
      setQuiz(q => q ? { ...q, logo_url: urlData.publicUrl } : q);
      toast.success('Logo atualizada!');
    } catch (err: unknown) {
      toast.error(`Erro no upload: ${err instanceof Error ? err.message : 'Tente novamente'}`);
    }
    setUploading(false);
  }

  async function addPergunta() {
    if (!quiz) return;
    let targetBlocoId: string;
    if (blocos.length === 0) {
      const { data: nb } = await db.from('quiz_blocos').insert({ quiz_id: quiz.id, titulo: 'Perguntas', ordem: 1 }).select().single();
      if (!nb) return;
      setBlocos([nb]);
      setPerguntas({ [nb.id]: [] });
      targetBlocoId = nb.id;
    } else {
      const lastBloco = [...blocos].sort((a, b) => a.ordem - b.ordem).at(-1)!;
      targetBlocoId = lastBloco.id;
    }
    const blocoPergs = perguntas[targetBlocoId] || [];
    const maxOrdem = blocoPergs.reduce((mx, p) => Math.max(mx, p.ordem), 0);
    const { data: np } = await db.from('quiz_perguntas').insert({
      bloco_id: targetBlocoId, texto: '', ordem: maxOrdem + 1,
      subtexto: null, condicao_pergunta_id: null, condicao_opcao_id: null,
    }).select().single();
    if (np) {
      setPerguntas(p => ({ ...p, [targetBlocoId]: [...(p[targetBlocoId] || []), np] }));
      setOpcoes(o => ({ ...o, [np.id]: [] }));
      setSelectedPageId(np.id);
    }
  }

  async function movePergunta(flatIdx: number, dir: -1 | 1) {
    const a = flatPerguntas[flatIdx];
    const b = flatPerguntas[flatIdx + dir];
    if (!b || b.bloco_id !== a.bloco_id) return;
    await Promise.all([
      db.from('quiz_perguntas').update({ ordem: b.ordem }).eq('id', a.id),
      db.from('quiz_perguntas').update({ ordem: a.ordem }).eq('id', b.id),
    ]);
    await loadData();
  }

  function updatePergunta(id: string, field: string, value: string | null) {
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].map(p => p.id === id ? { ...p, [field]: value } : p);
      return next;
    });
    debounce(`perg_${id}_${field}`, async () => {
      await db.from('quiz_perguntas').update({ [field]: value }).eq('id', id);
    });
  }

  async function deletePergunta(id: string) {
    if (!confirm('Deletar esta pergunta?')) return;
    await db.from('quiz_perguntas').delete().eq('id', id);
    setPerguntas(prev => {
      const next = { ...prev };
      for (const bid of Object.keys(next)) next[bid] = next[bid].filter(p => p.id !== id);
      return next;
    });
    setOpcoes(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedPageId('cover');
  }

  async function addOpcao(pergId: string) {
    const ordem = (opcoes[pergId]?.length || 0) + 1;
    const { data: no } = await db.from('quiz_opcoes').insert({
      pergunta_id: pergId, texto: '', pontos: 0, reprova_imediato: false, ordem, emoji: null,
    }).select().single();
    if (no) setOpcoes(p => ({ ...p, [pergId]: [...(p[pergId] || []), no] }));
  }

  function updateOpcao(id: string, field: string, value: string | number | boolean | null) {
    setOpcoes(prev => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) next[pid] = next[pid].map(o => o.id === id ? { ...o, [field]: value } : o);
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
      for (const pid of Object.keys(next)) next[pid] = next[pid].filter(o => o.id !== id);
      return next;
    });
  }

  function toggleColetaCampo(campo: string) {
    if (!quiz) return;
    const current = quiz.coleta_campos || ['nome', 'whatsapp', 'cidade', 'instagram'];
    const next = current.includes(campo) ? current.filter(c => c !== campo) : [...current, campo];
    updateQuizField('coleta_campos', next);
  }

  function addBenefit() {
    if (!newBenefit.trim() || !quiz) return;
    const benefits = [...(quiz.capa_beneficios || []), newBenefit.trim()];
    updateQuizField('capa_beneficios', benefits);
    setNewBenefit('');
  }

  function removeBenefit(idx: number) {
    if (!quiz) return;
    const benefits = (quiz.capa_beneficios || []).filter((_, i) => i !== idx);
    updateQuizField('capa_beneficios', benefits);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(quizLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  // ── LOADING ──────────────────────────────────────────────────────────────────
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

  // ── EMPTY STATE ──────────────────────────────────────────────────────────────
  if (!quiz) {
    return (
      <AppLayout>
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: '520px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <div style={{ fontSize: '48px', marginBottom: '14px', lineHeight: 1 }}>📋</div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: textMain, marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Crie seu quiz
              </h1>
              <p style={{ fontSize: '14px', color: textMut, lineHeight: 1.65, maxWidth: '360px', margin: '0 auto' }}>
                Qualifique leads automaticamente com um quiz personalizado.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button onClick={() => handleCreateQuiz(true)} disabled={creating} style={{
                padding: '24px 20px', borderRadius: '14px',
                border: `2px solid #2563eb`, background: '#2563eb10', color: textMain,
                cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>✨</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: '#2563eb' }}>Modelo Becker</div>
                <div style={{ fontSize: '12px', color: textMut, lineHeight: 1.5 }}>Quiz de semijoias pronto para usar</div>
              </button>
              <button onClick={() => handleCreateQuiz(false)} disabled={creating} style={{
                padding: '24px 20px', borderRadius: '14px',
                border: `1.5px solid ${border}`, background: cardBg, color: textMain,
                cursor: creating ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>📄</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: textMain }}>Em branco</div>
                <div style={{ fontSize: '12px', color: textMut, lineHeight: 1.5 }}>Comece do zero</div>
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

  // ── Page list items ──────────────────────────────────────────────────────────
  const fixedPageStyle = (id: string): React.CSSProperties => {
    const active = selectedPageId === id;
    return {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 12px', cursor: 'pointer', userSelect: 'none',
      borderLeft: `2px solid ${active ? '#2563eb' : 'transparent'}`,
      background: active ? '#eff6ff' : 'transparent',
      color: active ? '#2563eb' : textMain,
      fontSize: '13px', fontWeight: active ? 600 : 400,
      transition: tokens.transition,
    };
  };

  const primary = quiz.cor_primaria || '#2563eb';

  // ── RIGHT PANEL CONTENT ──────────────────────────────────────────────────────
  function renderRightPanel() {
    if (!quiz) return null;

    // COVER
    if (selectedPageType === 'cover') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Tabs */}
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
                    placeholder={quiz.titulo}
                    style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>Subtítulo</label>
                  <textarea value={quiz.capa_subtitulo || ''} rows={2}
                    onChange={e => updateQuizField('capa_subtitulo', e.target.value)}
                    placeholder="Texto de apoio..."
                    style={{ ...iStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={lbl}>URL da imagem de capa</label>
                  <input value={quiz.capa_imagem_url || ''} style={iStyle}
                    onChange={e => updateQuizField('capa_imagem_url', e.target.value || null)}
                    placeholder="https://..." />
                  {quiz.capa_imagem_url && (
                    <img src={quiz.capa_imagem_url} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: tokens.radius.sm, marginTop: 6 }} />
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
                        onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
                      <button onClick={() => logoInputRef.current?.click()} disabled={uploading} style={{
                        width: '100%', padding: '10px 12px', borderRadius: tokens.radius.sm,
                        border: `1.5px dashed ${border}`, background: 'transparent',
                        color: textMut, fontSize: '12px', cursor: 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}>
                        {uploading
                          ? <><Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.7s linear infinite' }} /> Enviando...</>
                          : <><Upload style={{ width: '13px', height: '13px' }} /> Upload da logo</>
                        }
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
            <label style={lbl}>Texto da pergunta</label>
            <textarea value={selectedPergunta.texto}
              onChange={e => updatePergunta(selectedPergunta.id, 'texto', e.target.value)}
              placeholder="Digite a pergunta..."
              rows={3} style={{ ...iStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={lbl}>Sub-texto <span style={{ fontWeight: 400, color: textMut }}>(opcional)</span></label>
            <input value={selectedPergunta.subtexto || ''}
              onChange={e => updatePergunta(selectedPergunta.id, 'subtexto', e.target.value || null)}
              placeholder="Contexto adicional..."
              style={iStyle} />
          </div>

          {/* Options */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Opções</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {selectedPergOpcoes.map(op => (
                <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {/* Emoji picker */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setOpenEmojiFor(openEmojiFor === op.id ? null : op.id)}
                      style={{
                        width: '28px', height: '28px', borderRadius: tokens.radius.sm,
                        border: `1px solid ${border}`, background: inputBg,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '15px', lineHeight: 1,
                      }}
                    >
                      {op.emoji || <span style={{ fontSize: '12px', color: textMut }}>+</span>}
                    </button>
                    {openEmojiFor === op.id && (
                      <EmojiPicker
                        onSelect={e => updateOpcao(op.id, 'emoji', e)}
                        onClose={() => setOpenEmojiFor(null)}
                      />
                    )}
                  </div>

                  <input value={op.texto}
                    onChange={e => updateOpcao(op.id, 'texto', e.target.value)}
                    placeholder="Texto da opção"
                    style={{ ...iStyle, flex: 1, padding: '6px 8px' }} />

                  <input type="number" value={op.pontos} title="Pontos"
                    onChange={e => updateOpcao(op.id, 'pontos', Number(e.target.value))}
                    style={{ ...iStyle, width: '56px', textAlign: 'center', padding: '6px 4px', flexShrink: 0 }} />

                  <label title="Reprova imediato" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={op.reprova_imediato}
                      onChange={e => updateOpcao(op.id, 'reprova_imediato', e.target.checked)}
                      style={{ accentColor: '#ef4444', width: '13px', height: '13px' }} />
                    <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, marginLeft: '3px', whiteSpace: 'nowrap' }}>Reprova</span>
                  </label>

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

          {/* Conditional */}
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
              <span style={{ fontSize: '12px', fontWeight: 500, color: textMut }}>Pergunta condicional</span>
            </div>

            {showConditional && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <select value={selectedPergunta.condicao_pergunta_id || ''}
                  onChange={e => {
                    updatePergunta(selectedPergunta.id, 'condicao_pergunta_id', e.target.value || null);
                    updatePergunta(selectedPergunta.id, 'condicao_opcao_id', null);
                  }}
                  style={{ ...iStyle }}>
                  <option value="">Selecionar pergunta...</option>
                  {flatPerguntas.filter(p => p.id !== selectedPergunta.id).map(p => (
                    <option key={p.id} value={p.id}>{p.texto.slice(0, 60) || `Pergunta ${p.globalIndex}`}</option>
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

    // APPROVAL
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
              placeholder="5511999999999"
              style={iStyle} />
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
          <div style={{ padding: '12px', borderRadius: tokens.radius.md, background: hexRgba('#2563eb', 0.06), border: `1px solid ${hexRgba('#2563eb', 0.15)}` }}>
            <p style={{ fontSize: '11px', color: '#2563eb', margin: 0, lineHeight: 1.5 }}>
              ✅ Verde: ≥ {quiz.corte_verde} pts &nbsp;·&nbsp; 🟡 Amarelo: ≥ {quiz.corte_amarelo} pts &nbsp;·&nbsp; ❌ Reprovado: abaixo de {quiz.corte_amarelo} pts
            </p>
          </div>
        </div>
      );
    }

    // COLLECT
    if (selectedPageType === 'collect') {
      const campos = ['nome', 'whatsapp', 'cidade', 'instagram'];
      const campoLabels: Record<string, string> = { nome: 'Nome completo', whatsapp: 'WhatsApp', cidade: 'Cidade', instagram: 'Instagram (opcional)' };
      const current = quiz.coleta_campos || ['nome', 'whatsapp', 'cidade', 'instagram'];
      return (
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Campos do formulário</p>
          {campos.map(campo => (
            <div key={campo} onClick={() => toggleColetaCampo(campo)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: tokens.radius.md,
                border: `1px solid ${border}`, background: cardBg,
                cursor: 'pointer', userSelect: 'none',
              }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                border: `2px solid ${current.includes(campo) ? '#2563eb' : border}`,
                background: current.includes(campo) ? '#2563eb' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {current.includes(campo) && <Check style={{ width: '10px', height: '10px', color: '#fff', strokeWidth: 3 }} />}
              </div>
              <span style={{ fontSize: '13px', color: textMain }}>{campoLabels[campo]}</span>
            </div>
          ))}
          {current.length < 2 && (
            <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>Mantenha pelo menos nome e WhatsApp.</p>
          )}
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

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* Mobile top bar */}
        <div className="quiz-mobile-bar" style={{
          display: 'none', padding: '10px 16px',
          borderBottom: `1px solid ${border}`, background: cardBg,
          alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: textMain }}>{quiz.titulo}</span>
          <button onClick={() => setShowPreviewModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: tokens.radius.sm,
            border: `1px solid ${border}`, background: cardBg,
            color: textMain, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Eye style={{ width: '13px', height: '13px' }} /> Preview
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── LEFT COLUMN: Page list (220px) ───────────────────────────── */}
          <div style={{
            width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${border}`, background: cardBg,
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 14px', borderBottom: `1px solid ${border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: textMain, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {quiz.titulo}
                </p>
                <p style={{ fontSize: '11px', color: textMut, margin: '1px 0 0' }}>/{quiz.slug}</p>
              </div>
              <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex', padding: '4px', flexShrink: 0 }}>
                <Settings style={{ width: '15px', height: '15px' }} />
              </button>
            </div>

            {/* Page list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Cover */}
              <div onClick={() => setSelectedPageId('cover')} style={fixedPageStyle('cover')}>
                <span>📋</span>
                <span>Capa</span>
              </div>

              {/* Questions */}
              {flatPerguntas.map((perg, flatIdx) => {
                const active = selectedPageId === perg.id;
                const prevSameBloco = flatIdx > 0 && flatPerguntas[flatIdx - 1].bloco_id === perg.bloco_id;
                const nextSameBloco = flatIdx < flatPerguntas.length - 1 && flatPerguntas[flatIdx + 1].bloco_id === perg.bloco_id;
                return (
                  <div key={perg.id} onClick={() => setSelectedPageId(perg.id)} style={{
                    display: 'flex', alignItems: 'center',
                    padding: '8px 12px 8px 12px', cursor: 'pointer',
                    borderLeft: `2px solid ${active ? '#2563eb' : 'transparent'}`,
                    background: active ? '#eff6ff' : 'transparent',
                    transition: tokens.transition,
                  }}>
                    <span style={{ fontSize: '11px', color: active ? '#93c5fd' : textMut, fontWeight: 600, minWidth: '18px', flexShrink: 0 }}>
                      {perg.globalIndex}.
                    </span>
                    <span style={{ flex: 1, fontSize: '12px', color: active ? '#2563eb' : textMain, fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {perg.texto ? perg.texto.slice(0, 35) : 'Sem texto'}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0, marginLeft: '4px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => movePergunta(flatIdx, -1)} disabled={!prevSameBloco}
                        style={{ background: 'none', border: 'none', cursor: prevSameBloco ? 'pointer' : 'default', color: textMut, opacity: prevSameBloco ? 1 : 0.2, padding: '1px', display: 'flex' }}>
                        <ChevronUp style={{ width: '11px', height: '11px' }} />
                      </button>
                      <button onClick={() => movePergunta(flatIdx, 1)} disabled={!nextSameBloco}
                        style={{ background: 'none', border: 'none', cursor: nextSameBloco ? 'pointer' : 'default', color: textMut, opacity: nextSameBloco ? 1 : 0.2, padding: '1px', display: 'flex' }}>
                        <ChevronDown style={{ width: '11px', height: '11px' }} />
                      </button>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deletePergunta(perg.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px', flexShrink: 0, marginLeft: '2px', opacity: 0.7 }}>
                      <Trash2 style={{ width: '11px', height: '11px' }} />
                    </button>
                  </div>
                );
              })}

              {/* Fixed pages */}
              <div style={{ borderTop: `1px solid ${border}`, marginTop: '4px' }}>
                <div onClick={() => setSelectedPageId('approval')} style={fixedPageStyle('approval')}>
                  <span>✅</span><span>Aprovação</span>
                </div>
                <div onClick={() => setSelectedPageId('collect')} style={fixedPageStyle('collect')}>
                  <span>📝</span><span>Coleta de dados</span>
                </div>
                <div onClick={() => setSelectedPageId('rejection')} style={fixedPageStyle('rejection')}>
                  <span>❌</span><span>Reprovação</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${border}`, flexShrink: 0, display: 'flex', gap: '6px' }}>
              <button onClick={addPergunta} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '8px', borderRadius: tokens.radius.sm,
                border: `1.5px dashed ${border}`, background: 'transparent',
                color: textMut, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Plus style={{ width: '12px', height: '12px' }} /> Pergunta
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

          {/* ── CENTER COLUMN: Phone preview (flex-1) ────────────────────── */}
          <div className="quiz-phone-panel" style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: bg, padding: '24px', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: textMut, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Preview ao vivo
              </p>
              {/* Phone frame */}
              <div style={{
                width: '270px', height: '540px', borderRadius: '38px',
                border: `9px solid ${isDark ? '#1c1c20' : '#1a1918'}`,
                boxShadow: isDark
                  ? '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
                  : '0 32px 64px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.1)',
                overflow: 'hidden', background: '#fff', position: 'relative', flexShrink: 0,
              }}>
                {/* Notch */}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '70px', height: '17px', background: isDark ? '#1c1c20' : '#1a1918',
                  borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', zIndex: 10,
                }} />
                <div style={{ width: '100%', height: '100%', paddingTop: '17px' }}>
                  <PhonePreview
                    pageType={selectedPageType}
                    quiz={quiz}
                    flatPerguntas={flatPerguntas}
                    opcoes={opcoes}
                    selectedPergId={selectedPergunta?.id}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '10px', color: textMut, opacity: 0.6 }}>quiz/{quiz.slug}</p>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Edit panel (300px) ─────────────────────────── */}
          <div style={{
            width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderLeft: `1px solid ${border}`, background: cardBg,
          }}>
            {/* Save indicator */}
            <div style={{
              padding: '8px 14px', borderBottom: `1px solid ${border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: textMain }}>
                {selectedPageType === 'cover' ? '📋 Capa' :
                 selectedPageType === 'approval' ? '✅ Aprovação' :
                 selectedPageType === 'collect' ? '📝 Coleta' :
                 selectedPageType === 'rejection' ? '❌ Reprovação' :
                 `Pergunta ${selectedPergunta?.globalIndex ?? ''}`}
              </span>
              <span style={{ fontSize: '11px', color: textMut, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {saving && <><Loader2 style={{ width: '11px', height: '11px', animation: 'spin 0.7s linear infinite' }} /> Salvando...</>}
                {!saving && savedRecently && <><Check style={{ width: '11px', height: '11px', color: '#16a34a' }} /> <span style={{ color: '#16a34a' }}>Salvo</span></>}
              </span>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {renderRightPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* ── SETTINGS MODAL ───────────────────────────────────────────────── */}
      {showSettings && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }} onClick={() => setShowSettings(false)}>
          <div style={{
            background: cardBg, borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadow.modal,
            width: '100%', maxWidth: '440px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
          }} onClick={e => e.stopPropagation()}>
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
                <p style={{ margin: 0, fontSize: '11px', color: '#2563eb', flex: 1, wordBreak: 'break-all' }}>
                  {quizLink}
                </p>
                <button onClick={handleCopyLink} style={{
                  padding: '4px 8px', borderRadius: tokens.radius.sm,
                  border: `1px solid ${border}`, background: copied ? '#dcfce7' : 'transparent',
                  color: copied ? '#15803d' : textMain, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0,
                }}>
                  {copied ? <Check style={{ width: '11px', height: '11px' }} /> : <Copy style={{ width: '11px', height: '11px' }} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: textMain }}>Status do quiz</span>
              <div onClick={toggleAtivo} style={{
                display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
                padding: '6px 11px', borderRadius: tokens.radius.sm, border: `1px solid ${border}`, background: cardBg,
              }}>
                <div style={{
                  width: '28px', height: '15px', borderRadius: 99,
                  background: quiz.ativo ? '#16a34a' : (isDark ? '#333' : '#d4cfc9'),
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: '2px', left: quiz.ativo ? '13px' : '2px',
                    width: '11px', height: '11px', borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: quiz.ativo ? '#16a34a' : textMut }}>
                  {quiz.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => window.open(quizLink, '_blank')} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '10px', borderRadius: tokens.radius.sm, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <ExternalLink style={{ width: '13px', height: '13px' }} /> Abrir quiz
              </button>
            </div>

            {/* QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: `1px solid ${border}` }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(quizLink)}&bgcolor=ffffff&color=111111&margin=10`}
                alt="QR Code"
                style={{ width: '120px', height: '120px', borderRadius: tokens.radius.sm, border: `1px solid ${border}` }}
              />
              <p style={{ margin: 0, fontSize: '11px', color: textMut }}>Compartilhe via QR Code</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE PREVIEW MODAL ─────────────────────────────────────────── */}
      {showPreviewModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: isDark ? '#0d0d0f' : '#f4f2ef',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${border}`, background: cardBg }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: textMain }}>Preview</span>
            <button onClick={() => setShowPreviewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex' }}>
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{
              width: '270px', height: '540px', borderRadius: '38px',
              border: `9px solid ${isDark ? '#1c1c20' : '#1a1918'}`,
              boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
              overflow: 'hidden', background: '#fff', position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '70px', height: '17px', background: isDark ? '#1c1c20' : '#1a1918', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', zIndex: 10 }} />
              <div style={{ width: '100%', height: '100%', paddingTop: '17px' }}>
                <PhonePreview
                  pageType={selectedPageType}
                  quiz={quiz}
                  flatPerguntas={flatPerguntas}
                  opcoes={opcoes}
                  selectedPergId={selectedPergunta?.id}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .quiz-phone-panel { display: none !important; }
          .quiz-mobile-bar { display: flex !important; }
        }
      `}</style>
    </AppLayout>
  );
}
