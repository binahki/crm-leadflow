import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  QuizRenderer,
  DEFAULT_COLETA_CONFIG,
  type ColetaCampo, type QuizConfig, type Bloco, type Opcao, type Pergunta, type Phase,
} from '@/components/quiz/QuizRenderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

declare global {
  interface Window { confetti?: (opts: Record<string, unknown>) => void; }
}

function launchConfetti(primary: string) {
  const fire = () => {
    window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.55 }, colors: [primary, '#ffd700', '#ffffff'] });
    setTimeout(() => window.confetti?.({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: [primary, '#ffd700'] }), 300);
  };
  if (window.confetti) { fire(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  s.onload = fire;
  document.head.appendChild(s);
}

export default function QuizPublico() {
  const { slug } = useParams<{ slug: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [todasPerguntas, setTodasPerguntas] = useState<Pergunta[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multipleAnswers, setMultipleAnswers] = useState<Record<string, string[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [selectedOpcao, setSelectedOpcao] = useState<string | null>(null);
  const [selectedOpcoes, setSelectedOpcoes] = useState<string[]>([]);
  const [faixa, setFaixa] = useState<'verde' | 'amarelo' | null>(null);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [instagram, setInstagram] = useState('');

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load quiz ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setPhase('not_found'); return; }
    async function loadQuiz() {
      const { data: quizData, error } = await db
        .from('quizzes').select('*').eq('slug', slug).eq('ativo', true).single();
      if (error || !quizData) { setPhase('not_found'); return; }
      setQuiz(quizData);

      const { data: blocoData } = await db
        .from('quiz_blocos').select('*').eq('quiz_id', quizData.id).order('ordem');
      if (!blocoData?.length) { setPhase('not_found'); return; }
      setBlocos(blocoData);

      const blocoIds = blocoData.map((b: Bloco) => b.id);
      const { data: pergs } = await db
        .from('quiz_perguntas').select('*').in('bloco_id', blocoIds).order('ordem');
      if (!pergs?.length) { setPhase('not_found'); return; }

      const pergIds = pergs.map((p: { id: string }) => p.id);
      const { data: ops } = await db
        .from('quiz_opcoes').select('*').in('pergunta_id', pergIds).order('ordem');

      const blocoOrder: Record<string, number> = {};
      blocoData.forEach((b: Bloco) => { blocoOrder[b.id] = b.ordem; });

      const perguntasComOpcoes: Pergunta[] = pergs
        .sort((a: Pergunta, b: Pergunta) => {
          const bA = blocoOrder[a.bloco_id] ?? 0;
          const bB = blocoOrder[b.bloco_id] ?? 0;
          return bA !== bB ? bA - bB : a.ordem - b.ordem;
        })
        .map((p: Pergunta) => ({
          ...p,
          opcoes: (ops || [])
            .filter((o: Opcao) => o.pergunta_id === p.id)
            .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
        }));

      setTodasPerguntas(perguntasComOpcoes);
      setPhase('capa');
    }
    loadQuiz();
  }, [slug]);

  // ── Confetti on approval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'aprovado_form' && quiz) {
      launchConfetti(quiz.cor_primaria || '#2563eb');
    }
  }, [phase, quiz]);

  // ── FB Pixel on approval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'aprovado_form' || !quiz?.pixel_id) return;
    const pixelId = quiz.pixel_id;
    const evento = quiz.pixel_evento_lead || 'Lead';

    function fireFbq() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbq = (window as any).fbq;
      if (typeof fbq !== 'function') return;
      fbq('init', pixelId);
      fbq('track', evento);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).fbq === 'function') {
      fireFbq();
    } else {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      s.onload = fireFbq;
      document.head.appendChild(s);
    }
  }, [phase, quiz]);

  // ── Visible questions (conditional filtering) ─────────────────────────────────
  const visiblePerguntas = useCallback((): Pergunta[] => {
    return todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const answeredOpcaoId = answers[p.condicao_pergunta_id];
      if (!answeredOpcaoId) return false;
      if (p.condicao_opcao_id) return answeredOpcaoId === p.condicao_opcao_id;
      return true;
    });
  }, [todasPerguntas, answers]);

  // ── Advance logic ─────────────────────────────────────────────────────────────
  function doAdvance(pergunta: Pergunta, opcaoIds: string[]) {
    if (opcaoIds.length === 0) return;
    const isMultipla = pergunta.tipo_resposta === 'multipla';

    // Check reprova on any selected option
    const hasReprova = opcaoIds.some(id => pergunta.opcoes.find(o => o.id === id)?.reprova_imediato);

    // For conditional logic, use the first selected option as primary answer
    const primaryAnswer = opcaoIds[0];
    const newAnswers = { ...answers, [pergunta.id]: primaryAnswer };

    // Store multiple selections for scoring
    const newMultipleAnswers = isMultipla
      ? { ...multipleAnswers, [pergunta.id]: opcaoIds }
      : multipleAnswers;

    setAnswers(newAnswers);
    setMultipleAnswers(newMultipleAnswers);
    setSelectedOpcao(null);
    setSelectedOpcoes([]);

    if (hasReprova) { setPhase('reprovado'); return; }

    const newVisible = todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const ans = newAnswers[p.condicao_pergunta_id];
      if (!ans) return false;
      if (p.condicao_opcao_id) return ans === p.condicao_opcao_id;
      return true;
    });

    const nextIdx = currentIdx + 1;
    if (nextIdx >= newVisible.length) {
      // Calculate total score (handles both single and multiple choice)
      let totalScore = 0;
      for (const [pergId, oId] of Object.entries(newAnswers)) {
        const perg = todasPerguntas.find(p => p.id === pergId);
        if (!perg) continue;
        if (perg.tipo_resposta === 'multipla') {
          const selectedIds = newMultipleAnswers[pergId] || [oId];
          for (const opId of selectedIds) {
            const op = perg.opcoes.find(o => o.id === opId);
            if (op) totalScore += op.pontos ?? 0;
          }
        } else {
          const op = perg.opcoes.find(o => o.id === oId);
          if (op) totalScore += op.pontos ?? 0;
        }
      }
      setScore(totalScore);
      if (!quiz) return;
      if (totalScore >= quiz.corte_verde) {
        setFaixa('verde'); setPhase('aprovado_form');
      } else if (totalScore >= quiz.corte_amarelo) {
        setFaixa('amarelo'); setPhase('aprovado_form');
      } else {
        setPhase('reprovado');
      }
    } else {
      setCurrentIdx(nextIdx);
      setQuestionKey(k => k + 1);
    }
  }

  function handleOpcaoClick(pergunta: Pergunta, opcao: Opcao) {
    const isMultipla = pergunta.tipo_resposta === 'multipla';

    if (isMultipla) {
      // Toggle selection in array
      navigator.vibrate?.(10);
      setSelectedOpcoes(prev =>
        prev.includes(opcao.id) ? prev.filter(id => id !== opcao.id) : [...prev, opcao.id]
      );
      return;
    }

    // Single choice: auto-advance after 350ms
    if (selectedOpcao) return;
    navigator.vibrate?.(10);
    setSelectedOpcao(opcao.id);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      doAdvance(pergunta, [opcao.id]);
    }, 280);
  }

  function handleContinue() {
    if (!currentPergunta) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const isMultipla = currentPergunta.tipo_resposta === 'multipla';
    if (isMultipla) {
      if (selectedOpcoes.length === 0) return;
      doAdvance(currentPergunta, selectedOpcoes);
    } else {
      if (!selectedOpcao) return;
      doAdvance(currentPergunta, [selectedOpcao]);
    }
  }

  // ── Submit lead ───────────────────────────────────────────────────────────────
  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz || !faixa) return;
    const rawWa = whatsapp.replace(/\D/g, '');
    if (!nome.trim() || rawWa.length < 10 || !cidade.trim()) return;
    setSubmitting(true);

    const quizRespostas: Record<string, string> = {};
    for (const [pergId, opcId] of Object.entries(answers)) {
      const perg = todasPerguntas.find(p => p.id === pergId);
      if (!perg) continue;
      if (perg.tipo_resposta === 'multipla') {
        const selectedIds = multipleAnswers[pergId] || [opcId];
        const textos = selectedIds
          .map(id => perg.opcoes.find(o => o.id === id)?.texto)
          .filter(Boolean).join(', ');
        quizRespostas[perg.texto] = textos;
      } else {
        const op = perg.opcoes.find(o => o.id === opcId);
        if (op) quizRespostas[perg.texto] = op.texto;
      }
    }

    const { error } = await db.from('leads').insert({
      nome: nome.trim(), whatsapp: rawWa, cidade: cidade.trim(),
      instagram: instagram.trim() || null, score, faixa, status: 0,
      org_id: quiz.org_id, quiz_respostas: quizRespostas,
      created_at: new Date().toISOString(),
    });

    setSubmitting(false);
    if (error) { alert('Erro ao salvar. Tente novamente.'); return; }

    setPhase('sucesso');
    setTimeout(() => {
      const num = quiz.redirect_whatsapp.replace(/\D/g, '');
      if (num) window.location.href = `https://wa.me/${num}`;
    }, 2000);
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id) ?? null;
  const coleta = (quiz?.coleta_campos as string[] | null) || ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz?.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coleta.includes(d.campo));
  const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
  const canSubmit = coletaConfig
    .filter(c => c.obrigatorio)
    .every(c => {
      const val = fieldValues[c.campo] ?? '';
      if (c.campo === 'whatsapp') return val.replace(/\D/g, '').length >= 10;
      return val.trim().length > 0;
    });
  const primary = quiz?.cor_primaria || '#2563eb';

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2.5px solid #e5e7eb`, borderTopColor: primary, animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ fontSize: '40px' }}>🔍</div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // ── Render via QuizRenderer ───────────────────────────────────────────────────
  return (
    <QuizRenderer
      quiz={quiz!}
      blocos={blocos}
      phase={phase}
      currentPergunta={currentPergunta}
      currentBloco={currentBloco}
      currentIdx={currentIdx}
      totalVisible={totalVisible}
      selectedOpcao={selectedOpcao}
      selectedOpcoes={selectedOpcoes}
      questionKey={questionKey}
      coleta={coleta}
      nome={nome}
      whatsapp={whatsapp}
      cidade={cidade}
      instagram={instagram}
      submitting={submitting}
      canSubmit={canSubmit}
      onStart={() => setPhase('quiz')}
      onOpcaoClick={handleOpcaoClick}
      onContinue={handleContinue}
      onGoToColeta={() => setPhase('coleta')}
      onNomeChange={setNome}
      onWhatsappChange={setWhatsapp}
      onCidadeChange={setCidade}
      onInstagramChange={setInstagram}
      onSubmit={handleSubmitLead}
    />
  );
}
