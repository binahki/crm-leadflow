import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Quiz {
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

interface Opcao {
  id: string;
  pergunta_id: string;
  texto: string;
  pontos: number;
  reprova_imediato: boolean;
  ordem: number;
}

interface Pergunta {
  id: string;
  bloco_id: string;
  texto: string;
  ordem: number;
  condicao_pergunta_id: string | null;
  condicao_opcao_id: string | null;
  opcoes: Opcao[];
}

type Phase = 'loading' | 'quiz' | 'aprovado_form' | 'reprovado' | 'sucesso' | 'not_found';

export default function QuizPublico() {
  const { slug } = useParams<{ slug: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [todasPerguntas, setTodasPerguntas] = useState<Pergunta[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // perguntaId → opcaoId
  const [currentIdx, setCurrentIdx] = useState(0);
  const [faixa, setFaixa] = useState<'verde' | 'amarelo' | null>(null);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Lead form fields
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [instagram, setInstagram] = useState('');

  // Load quiz data
  useEffect(() => {
    if (!slug) { setPhase('not_found'); return; }

    async function loadQuiz() {
      const { data: quizData, error } = await db
        .from('quizzes')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .single();

      if (error || !quizData) { setPhase('not_found'); return; }
      setQuiz(quizData);

      // Fetch blocos
      const { data: blocos } = await db
        .from('quiz_blocos')
        .select('id, ordem')
        .eq('quiz_id', quizData.id)
        .order('ordem');

      if (!blocos?.length) { setPhase('not_found'); return; }

      const blocoIds = blocos.map((b: { id: string }) => b.id);

      // Fetch all perguntas
      const { data: pergs } = await db
        .from('quiz_perguntas')
        .select('*')
        .in('bloco_id', blocoIds)
        .order('ordem');

      if (!pergs?.length) { setPhase('not_found'); return; }

      // Fetch all opcoes
      const pergIds = pergs.map((p: { id: string }) => p.id);
      const { data: ops } = await db
        .from('quiz_opcoes')
        .select('*')
        .in('pergunta_id', pergIds)
        .order('ordem');

      // Build flat list ordered by bloco.ordem then pergunta.ordem
      const blocoOrder: Record<string, number> = {};
      blocos.forEach((b: { id: string; ordem: number }) => { blocoOrder[b.id] = b.ordem; });

      const perguntasComOpcoes: Pergunta[] = pergs
        .sort((a: Pergunta, b: Pergunta) => {
          const blocoA = blocoOrder[a.bloco_id] ?? 0;
          const blocoB = blocoOrder[b.bloco_id] ?? 0;
          if (blocoA !== blocoB) return blocoA - blocoB;
          return a.ordem - b.ordem;
        })
        .map((p: Pergunta) => ({
          ...p,
          opcoes: (ops || [])
            .filter((o: Opcao) => o.pergunta_id === p.id)
            .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
        }));

      setTodasPerguntas(perguntasComOpcoes);
      setPhase('quiz');
    }

    loadQuiz();
  }, [slug]);

  // Visible questions based on current answers
  const visiblePerguntas = useCallback((): Pergunta[] => {
    return todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const answeredOpcaoId = answers[p.condicao_pergunta_id];
      if (!answeredOpcaoId) return false;
      if (p.condicao_opcao_id) return answeredOpcaoId === p.condicao_opcao_id;
      return true; // has condicao_pergunta_id but no specific opcao — show if answered
    });
  }, [todasPerguntas, answers]);

  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const progress = totalVisible > 0 ? Math.round((currentIdx / totalVisible) * 100) : 0;
  const currentPergunta = visible[currentIdx] ?? null;

  function handleOpcaoClick(pergunta: Pergunta, opcao: Opcao) {
    const newAnswers = { ...answers, [pergunta.id]: opcao.id };
    setAnswers(newAnswers);

    // Reprova imediato
    if (opcao.reprova_imediato) {
      setPhase('reprovado');
      return;
    }

    // Check if this is last visible question (recalculate with new answers)
    const newVisible = todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const ans = newAnswers[p.condicao_pergunta_id];
      if (!ans) return false;
      if (p.condicao_opcao_id) return ans === p.condicao_opcao_id;
      return true;
    });

    const nextIdx = currentIdx + 1;

    if (nextIdx >= newVisible.length) {
      // Calculate score
      let totalScore = 0;
      for (const [pergId, opcId] of Object.entries(newAnswers)) {
        const perg = todasPerguntas.find(p => p.id === pergId);
        const op = perg?.opcoes.find(o => o.id === opcId);
        if (op) totalScore += op.pontos ?? 0;
      }

      setScore(totalScore);

      if (!quiz) return;

      if (totalScore >= quiz.corte_verde) {
        setFaixa('verde');
        setPhase('aprovado_form');
      } else if (totalScore >= quiz.corte_amarelo) {
        setFaixa('amarelo');
        setPhase('aprovado_form');
      } else {
        setPhase('reprovado');
      }
    } else {
      setCurrentIdx(nextIdx);
    }
  }

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz || !faixa) return;
    if (!nome.trim() || !whatsapp.trim() || !cidade.trim()) return;

    setSubmitting(true);

    // Build quiz_respostas object
    const quizRespostas: Record<string, string> = {};
    for (const [pergId, opcId] of Object.entries(answers)) {
      const perg = todasPerguntas.find(p => p.id === pergId);
      const op = perg?.opcoes.find(o => o.id === opcId);
      if (perg && op) {
        quizRespostas[perg.texto] = op.texto;
      }
    }

    const { error } = await db.from('leads').insert({
      nome: nome.trim(),
      whatsapp: whatsapp.trim().replace(/\D/g, ''),
      cidade: cidade.trim(),
      instagram: instagram.trim() || null,
      score,
      faixa,
      status: 0,
      org_id: quiz.org_id,
      quiz_respostas: quizRespostas,
      created_at: new Date().toISOString(),
    });

    setSubmitting(false);

    if (error) {
      alert('Erro ao salvar. Tente novamente.');
      return;
    }

    setPhase('sucesso');

    // Redirect to WhatsApp after 1.5s
    setTimeout(() => {
      const num = quiz.redirect_whatsapp.replace(/\D/g, '');
      if (num) window.location.href = `https://wa.me/${num}`;
    }, 1500);
  }

  const primary = quiz?.cor_primaria || '#2563eb';

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `3px solid ${primary}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── NOT FOUND ────────────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '24px' }}>
        <p style={{ fontSize: '20px', fontWeight: 700, color: '#111' }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* ── Header area ───────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#ffffff', borderBottom: '1px solid #f0f0f0' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px 12px' }}>
          {quiz?.logo_url ? (
            <img src={quiz.logo_url} alt={quiz.titulo} style={{ maxHeight: '40px', maxWidth: '160px', objectFit: 'contain' }} />
          ) : (
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#111', margin: 0 }}>{quiz?.titulo}</p>
          )}
        </div>

        {/* Progress bar — only during quiz */}
        {phase === 'quiz' && (
          <div style={{ height: '4px', background: '#f0f0f0' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: primary,
              transition: 'width 0.4s ease',
              borderRadius: '0 2px 2px 0',
            }} />
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* ── QUIZ ──────────────────────────────────────────────────── */}
        {phase === 'quiz' && currentPergunta && (
          <div key={currentPergunta.id} style={{ animation: 'fadeUp 0.25s ease' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
              {currentIdx + 1} / {totalVisible}
            </p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', lineHeight: 1.35, marginBottom: '28px' }}>
              {currentPergunta.texto}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentPergunta.opcoes.map(opcao => (
                <button
                  key={opcao.id}
                  onClick={() => handleOpcaoClick(currentPergunta, opcao)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border: `2px solid ${answers[currentPergunta.id] === opcao.id ? primary : '#e5e7eb'}`,
                    background: answers[currentPergunta.id] === opcao.id ? `${primary}12` : '#ffffff',
                    color: '#111',
                    fontSize: '15px',
                    fontWeight: 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    if (answers[currentPergunta.id] !== opcao.id) {
                      (e.currentTarget as HTMLElement).style.borderColor = primary;
                      (e.currentTarget as HTMLElement).style.background = `${primary}08`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (answers[currentPergunta.id] !== opcao.id) {
                      (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                      (e.currentTarget as HTMLElement).style.background = '#ffffff';
                    }
                  }}
                >
                  {opcao.texto}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── APROVADO — FORMULÁRIO ─────────────────────────────────── */}
        {phase === 'aprovado_form' && (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '20px', marginBottom: '20px',
              background: faixa === 'verde' ? '#d1fae5' : '#fef9c3',
              color: faixa === 'verde' ? '#065f46' : '#854d0e',
              fontSize: '13px', fontWeight: 600,
            }}>
              <span>{faixa === 'verde' ? '✓' : '~'}</span>
              {faixa === 'verde' ? 'Perfil aprovado!' : 'Perfil aprovado'}
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', marginBottom: '10px', lineHeight: 1.3 }}>
              {quiz?.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '28px' }}>
              Preencha seus dados para concluir o cadastro.
            </p>

            <form onSubmit={handleSubmitLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Nome completo *', value: nome, setter: setNome, type: 'text', placeholder: 'Seu nome completo' },
                { label: 'WhatsApp *', value: whatsapp, setter: setWhatsapp, type: 'tel', placeholder: '(99) 99999-9999' },
                { label: 'Cidade *', value: cidade, setter: setCidade, type: 'text', placeholder: 'Sua cidade' },
                { label: 'Instagram (opcional)', value: instagram, setter: setInstagram, type: 'text', placeholder: '@seuperfil' },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={e => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 14px', borderRadius: '10px',
                      border: '1.5px solid #e5e7eb',
                      fontSize: '16px', color: '#111',
                      outline: 'none', fontFamily: 'inherit',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = primary)}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={submitting || !nome.trim() || !whatsapp.trim() || !cidade.trim()}
                style={{
                  width: '100%', padding: '15px',
                  borderRadius: '12px', border: 'none',
                  background: primary, color: '#fff',
                  fontSize: '16px', fontWeight: 700,
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: (submitting || !nome.trim() || !whatsapp.trim() || !cidade.trim()) ? 0.6 : 1,
                  fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                  marginTop: '6px',
                }}
              >
                {submitting ? 'Enviando...' : 'Confirmar meu cadastro →'}
              </button>
            </form>
          </div>
        )}

        {/* ── SUCESSO ───────────────────────────────────────────────── */}
        {phase === 'sucesso' && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease', paddingTop: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
              Cadastro realizado!
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Você será redirecionada em instantes...
            </p>
          </div>
        )}

        {/* ── REPROVADO ─────────────────────────────────────────────── */}
        {phase === 'reprovado' && (
          <div style={{ animation: 'fadeUp 0.3s ease', paddingTop: '20px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '20px', marginBottom: '20px',
              background: '#fee2e2', color: '#991b1b',
              fontSize: '13px', fontWeight: 600,
            }}>
              Perfil não aprovado
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: '10px' }}>
              {quiz?.mensagem_reprovado || 'Obrigada pela participação!'}
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              No momento seu perfil não se encaixa no que buscamos.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
