import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  QuizRenderer,
  type QuizConfig, type Bloco, type Opcao, type Pergunta, type Phase,
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [selectedOpcao, setSelectedOpcao] = useState<string | null>(null);
  const [faixa, setFaixa] = useState<'verde' | 'amarelo' | null>(null);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [instagram, setInstagram] = useState('');

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load quiz ───────────────────────────────────────────────────────────────
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

  // ── Confetti on approval ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'aprovado_form' && quiz) {
      launchConfetti(quiz.cor_primaria || '#2563eb');
    }
  }, [phase, quiz]);

  // ── Visible questions (conditional filtering) ───────────────────────────────
  const visiblePerguntas = useCallback((): Pergunta[] => {
    return todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const answeredOpcaoId = answers[p.condicao_pergunta_id];
      if (!answeredOpcaoId) return false;
      if (p.condicao_opcao_id) return answeredOpcaoId === p.condicao_opcao_id;
      return true;
    });
  }, [todasPerguntas, answers]);

  // ── Advance logic ───────────────────────────────────────────────────────────
  function doAdvance(pergunta: Pergunta, opcaoId: string) {
    const opcao = pergunta.opcoes.find(o => o.id === opcaoId);
    if (!opcao) return;

    const newAnswers = { ...answers, [pergunta.id]: opcaoId };
    setAnswers(newAnswers);
    setSelectedOpcao(null);

    if (opcao.reprova_imediato) { setPhase('reprovado'); return; }

    const newVisible = todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const ans = newAnswers[p.condicao_pergunta_id];
      if (!ans) return false;
      if (p.condicao_opcao_id) return ans === p.condicao_opcao_id;
      return true;
    });

    const nextIdx = currentIdx + 1;
    if (nextIdx >= newVisible.length) {
      let totalScore = 0;
      for (const [pergId, oId] of Object.entries(newAnswers)) {
        const perg = todasPerguntas.find(p => p.id === pergId);
        const op = perg?.opcoes.find(o => o.id === oId);
        if (op) totalScore += op.pontos ?? 0;
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
    if (selectedOpcao) return;
    navigator.vibrate?.(10);
    setSelectedOpcao(opcao.id);

    const isMultipla = pergunta.tipo_resposta === 'multipla';
    if (!isMultipla) {
      // Single select: auto-advance after 350ms
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        doAdvance(pergunta, opcao.id);
      }, 350);
    }
    // Multiple: wait for Continue button click
  }

  function handleContinue() {
    if (!selectedOpcao || !currentPergunta) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    doAdvance(currentPergunta, selectedOpcao);
  }

  // ── Submit lead ─────────────────────────────────────────────────────────────
  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz || !faixa) return;
    const rawWa = whatsapp.replace(/\D/g, '');
    if (!nome.trim() || rawWa.length < 10 || !cidade.trim()) return;
    setSubmitting(true);

    const quizRespostas: Record<string, string> = {};
    for (const [pergId, opcId] of Object.entries(answers)) {
      const perg = todasPerguntas.find(p => p.id === pergId);
      const op = perg?.opcoes.find(o => o.id === opcId);
      if (perg && op) quizRespostas[perg.texto] = op.texto;
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

  // ── Derived state ───────────────────────────────────────────────────────────
  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id) ?? null;
  const coleta = (quiz?.coleta_campos as string[] | null) || ['nome', 'whatsapp', 'cidade', 'instagram'];
  const canSubmit = !!(nome.trim() && whatsapp.replace(/\D/g, '').length >= 10 && cidade.trim());
  const primary = quiz?.cor_primaria || '#2563eb';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2.5px solid #e5e7eb`, borderTopColor: primary, animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ fontSize: '40px' }}>🔍</div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // ── Render via QuizRenderer ─────────────────────────────────────────────────
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
      onNomeChange={setNome}
      onWhatsappChange={setWhatsapp}
      onCidadeChange={setCidade}
      onInstagramChange={setInstagram}
      onSubmit={handleSubmitLead}
    />
  );
}
