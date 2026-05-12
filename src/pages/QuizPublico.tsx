import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

declare global {
  interface Window { confetti?: (opts: Record<string, unknown>) => void; }
}

interface Quiz {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; logo_url: string | null;
}
interface Bloco { id: string; titulo: string; ordem: number; }
interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
}
interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
  opcoes: Opcao[];
}
type Phase = 'loading' | 'quiz' | 'aprovado_form' | 'reprovado' | 'sucesso' | 'not_found';

const BLOCO_EMOJIS: Record<number, string> = { 1: '🔥', 2: '👤', 3: '💼', 4: '🔒' };

function emojiForText(text: string): string {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('imediatamente')) return '⚡';
  if (t.includes('7 dias')) return '📅';
  if (t.includes('avaliando')) return '🤔';
  if (t.includes('whatsapp')) return '💬';
  if (t.includes('instagram') || t.includes('facebook')) return '📱';
  if (t.includes('presencial')) return '🤝';
  if (t.includes('ja tenho clientes') || t.includes('clientes')) return '👥';
  if (t.includes('independencia')) return '🦋';
  if (t.includes('proprio negocio')) return '🏢';
  if (t.includes('renda extra')) return '💰';
  if (t.includes('trabalhar de casa')) return '🏠';
  if (t.includes('clt')) return '🗂️';
  if (t.includes('mei')) return '📋';
  if (t.includes('autonoma') || t.includes('catalogo') || t.includes('informal')) return '📦';
  if (t.includes('desempregada')) return '🔍';
  if (t.includes('do lar') || t.includes('lar')) return '🏠';
  if (t.includes('enfermagem')) return '🏥';
  if (t.includes('professor') || t.includes('educacao')) return '📚';
  if (t.includes('beleza') || t.includes('estetica') || t.includes('salao')) return '💅';
  if (t.includes('comercio') || t.includes('atendimento') || t.includes('vendas')) return '🛍️';
  if (t.includes('recepcao') || t.includes('clinica') || t.includes('administrativo')) return '💼';
  if (t.includes('frequencia') && t.includes('vendo')) return '🌟';
  if (t.includes('as vezes') && t.includes('vendo')) return '🕐';
  if (t.includes('nunca vendi')) return '🌱';
  if (t.includes('tentei, mas')) return '💪';
  if (t.includes('sucesso')) return '✨';
  if (t.includes('menos de 18')) return '🚫';
  if (t.includes('mais de 10')) return '💪';
  if (t.includes('5 a 10')) return '⏰';
  if (t.includes('menos de 5')) return '🕐';
  if (t.includes('nao tenho certeza') || t.includes('ainda nao sei')) return '🤔';
  if (t.includes('cartao') || t.includes('credito')) return '💳';
  if (t.includes('reserva')) return '🏦';
  if (t.includes('tenho os dois') || t.includes('ambos')) return '🎯';
  if (t.includes('negativado') && !t.includes('nao')) return '⚠️';
  if (t.includes('apoio total')) return '🤗';
  if (t.includes('apoio parcial')) return '🤲';
  if (t.includes('organizar')) return '💪';
  if (t.includes('posto com')) return '📸';
  if (t.includes('posto pouco')) return '📷';
  if (t.includes('quase nao')) return '😴';
  if (t.includes('sim')) return '✅';
  if (t.includes('nao')) return '❌';
  if (t.includes('mais de r$3') || t.includes('mais de 3')) return '🚀';
  if (t.includes('1.000 a 3') || t.includes('r$1')) return '💵';
  if (t.includes('500 a 1') || t.includes('r$500')) return '💸';
  if (t.includes('ate r$500') || t.includes('ate 500')) return '🌱';
  return '→';
}

function hexRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function maskWhatsapp(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function launchConfetti(primary: string) {
  const fire = () => {
    window.confetti?.({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.55 },
      colors: [primary, '#ffd700', '#ffffff', '#f8b4d9'],
      scalar: 1.1,
    });
    setTimeout(() => {
      window.confetti?.({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: [primary, '#ffd700'] });
    }, 300);
  };
  if (window.confetti) { fire(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
  s.onload = fire;
  document.head.appendChild(s);
}

export default function QuizPublico() {
  const { slug } = useParams<{ slug: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
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

  useEffect(() => {
    if (!slug) { setPhase('not_found'); return; }
    async function loadQuiz() {
      const { data: quizData, error } = await db
        .from('quizzes').select('*').eq('slug', slug).eq('ativo', true).single();
      if (error || !quizData) { setPhase('not_found'); return; }
      setQuiz(quizData);

      const { data: blocoData } = await db
        .from('quiz_blocos').select('id, titulo, ordem')
        .eq('quiz_id', quizData.id).order('ordem');
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
          opcoes: (ops || []).filter((o: Opcao) => o.pergunta_id === p.id)
            .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
        }));

      setTodasPerguntas(perguntasComOpcoes);
      setPhase('quiz');
    }
    loadQuiz();
  }, [slug]);

  useEffect(() => {
    if (phase === 'aprovado_form' && quiz) {
      launchConfetti(quiz.cor_primaria || '#2563eb');
    }
  }, [phase, quiz]);

  const visiblePerguntas = useCallback((): Pergunta[] => {
    return todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const answeredOpcaoId = answers[p.condicao_pergunta_id];
      if (!answeredOpcaoId) return false;
      if (p.condicao_opcao_id) return answeredOpcaoId === p.condicao_opcao_id;
      return true;
    });
  }, [todasPerguntas, answers]);

  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const progress = totalVisible > 0 ? Math.round(((currentIdx) / totalVisible) * 100) : 0;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id);
  const blocoEmoji = currentBloco ? (BLOCO_EMOJIS[currentBloco.ordem] ?? '✦') : '✦';

  function handleOpcaoClick(pergunta: Pergunta, opcao: Opcao) {
    if (selectedOpcao) return;
    navigator.vibrate?.(10);
    setSelectedOpcao(opcao.id);

    setTimeout(() => {
      const newAnswers = { ...answers, [pergunta.id]: opcao.id };
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
        for (const [pergId, opcId] of Object.entries(newAnswers)) {
          const perg = todasPerguntas.find(p => p.id === pergId);
          const op = perg?.opcoes.find(o => o.id === opcId);
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
    }, 320);
  }

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

  const primary = quiz?.cor_primaria || '#2563eb';

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2.5px solid ${hexRgba(primary, 0.2)}`, borderTopColor: primary, animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── NOT FOUND ────────────────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', padding: '24px', fontFamily: '"DM Sans", sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ fontSize: '40px' }}>🔍</div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#1a1918', margin: 0 }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#9d9189', margin: 0 }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const canSubmit = nome.trim() && whatsapp.replace(/\D/g, '').length >= 10 && cidade.trim();

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(160deg, #faf9f7 0%, ${hexRgba(primary, 0.07)} 100%)`,
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@500;600;700&display=swap');

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.8); }
          60%  { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        * { box-sizing: border-box; }
        input, textarea, button, select { font-family: "DM Sans", sans-serif; }

        .quiz-option:hover:not(:disabled) {
          border-color: var(--primary) !important;
          background: var(--primary-05) !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px var(--primary-12) !important;
        }

        .form-input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--primary-10) !important;
        }
      `}</style>

      <style>{`
        :root {
          --primary: ${primary};
          --primary-05: ${hexRgba(primary, 0.05)};
          --primary-10: ${hexRgba(primary, 0.10)};
          --primary-12: ${hexRgba(primary, 0.12)};
        }
      `}</style>

      {/* ── PROGRESS BAR ──────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: hexRgba(primary, 0.15), zIndex: 100 }}>
        <div style={{
          height: '100%', background: primary,
          width: `${phase === 'quiz' ? progress : 100}%`,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* ── HEADER: LOGO ─────────────────────────────────────────────────── */}
      <div style={{ paddingTop: '28px', paddingBottom: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {quiz?.logo_url ? (
          <img src={quiz.logo_url} alt={quiz.titulo}
            style={{ maxHeight: '38px', maxWidth: '130px', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#7d7671', letterSpacing: '0.03em' }}>
            {quiz?.titulo}
          </span>
        )}
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '468px', margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* ══ FASE: QUIZ ══════════════════════════════════════════════════ */}
        {phase === 'quiz' && currentPergunta && (
          <div key={questionKey} style={{ animation: 'slideInRight 0.42s cubic-bezier(0.16, 1, 0.3, 1)' }}>

            {/* Block badge + counter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', marginTop: '8px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '5px 14px 5px 10px', borderRadius: '99px',
                background: hexRgba(primary, 0.1),
                border: `1px solid ${hexRgba(primary, 0.18)}`,
              }}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>{blocoEmoji}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: primary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {currentBloco?.titulo}
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#b5ada6' }}>
                {currentIdx + 1}<span style={{ opacity: 0.5, margin: '0 2px' }}>/</span>{totalVisible}
              </span>
            </div>

            {/* Question text */}
            <h2 style={{
              fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
              fontSize: '21px', fontWeight: 600, color: '#1a1918',
              lineHeight: 1.5, margin: '0 0 22px', textAlign: 'center',
              letterSpacing: '-0.01em',
            }}>
              {currentPergunta.texto}
            </h2>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {currentPergunta.opcoes.map(opcao => {
                const isSelected = selectedOpcao === opcao.id;
                const emoji = emojiForText(opcao.texto);
                return (
                  <button
                    key={opcao.id}
                    className="quiz-option"
                    onClick={() => handleOpcaoClick(currentPergunta, opcao)}
                    disabled={!!selectedOpcao}
                    style={{
                      width: '100%', padding: '14px 16px',
                      borderRadius: '14px',
                      border: `2px solid ${isSelected ? primary : 'rgba(26,25,24,0.1)'}`,
                      background: isSelected ? hexRgba(primary, 0.08) : '#ffffff',
                      color: '#1a1918',
                      fontSize: '15px', fontWeight: isSelected ? 600 : 400,
                      textAlign: 'left', cursor: selectedOpcao ? 'default' : 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      boxShadow: isSelected
                        ? `0 0 0 4px ${hexRgba(primary, 0.12)}, 0 2px 8px rgba(0,0,0,0.06)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span style={{ fontSize: '17px', lineHeight: 1, flexShrink: 0, minWidth: '20px', textAlign: 'center' }}>
                      {emoji}
                    </span>
                    <span style={{ flex: 1, lineHeight: 1.45 }}>{opcao.texto}</span>
                    {isSelected && (
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: primary, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                        animation: 'popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}>
                        <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ FASE: APROVADO — FORMULÁRIO ═════════════════════════════════ */}
        {phase === 'aprovado_form' && (
          <div style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>

            <div style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '12px' }}>
              <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '22px', animation: 'popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                🎉
              </div>

              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '26px', fontWeight: 700, color: '#1a1918',
                lineHeight: 1.35, margin: '0 0 14px', letterSpacing: '-0.02em',
              }}>
                {quiz?.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
              </h2>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '5px 13px', borderRadius: '99px',
                  background: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 600,
                }}>
                  <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Perfil verificado
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '5px 13px', borderRadius: '99px',
                  background: hexRgba(primary, 0.12), color: primary,
                  fontSize: '12px', fontWeight: 600,
                }}>
                  ✨ Pronta para começar
                </span>
              </div>
            </div>

            {/* Form card */}
            <div style={{
              background: '#ffffff', borderRadius: '22px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
              padding: '28px 24px',
            }}>
              <p style={{ fontSize: '14px', color: '#7d7671', margin: '0 0 22px', textAlign: 'center', lineHeight: 1.6 }}>
                Complete seu cadastro para garantir sua vaga.
              </p>

              <form onSubmit={handleSubmitLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Nome completo <span style={{ color: '#b5ada6' }}>*</span></label>
                  <input
                    type="text" value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome completo" autoComplete="name"
                    className="form-input"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>WhatsApp <span style={{ color: '#b5ada6' }}>*</span></label>
                  <input
                    type="tel" value={whatsapp}
                    onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                    placeholder="(99) 99999-9999" autoComplete="tel" inputMode="numeric"
                    className="form-input"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Cidade <span style={{ color: '#b5ada6' }}>*</span></label>
                  <input
                    type="text" value={cidade} onChange={e => setCidade(e.target.value)}
                    placeholder="Sua cidade" autoComplete="address-level2"
                    className="form-input"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Instagram <span style={{ color: '#b5ada6', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <input
                    type="text" value={instagram} onChange={e => setInstagram(e.target.value)}
                    placeholder="@seuperfil"
                    className="form-input"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  style={{
                    width: '100%', padding: '16px', marginTop: '4px',
                    borderRadius: '13px', border: 'none',
                    background: !canSubmit || submitting ? hexRgba(primary, 0.4) : primary,
                    color: '#fff', fontSize: '16px', fontWeight: 700,
                    cursor: (!canSubmit || submitting) ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {submitting ? 'Enviando...' : 'Garantir minha vaga →'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '12px', color: '#b5ada6', margin: 0, lineHeight: 1.5 }}>
                  🕐 Responda em até 24h para garantir sua vaga
                </p>
              </form>
            </div>
          </div>
        )}

        {/* ══ FASE: SUCESSO ═══════════════════════════════════════════════ */}
        {phase === 'sucesso' && (
          <div style={{ textAlign: 'center', animation: 'fadeInUp 0.4s ease', paddingTop: '60px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#dcfce7', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
              animation: 'popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <Check style={{ width: '34px', height: '34px', color: '#16a34a', strokeWidth: 2.5 }} />
            </div>
            <h2 style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '24px', fontWeight: 700, color: '#1a1918', margin: '0 0 10px',
            }}>
              Cadastro realizado!
            </h2>
            <p style={{ fontSize: '14px', color: '#9d9189', margin: 0, lineHeight: 1.6 }}>
              Você será redirecionada para o WhatsApp em instantes...
            </p>
          </div>
        )}

        {/* ══ FASE: REPROVADO ══════════════════════════════════════════════ */}
        {phase === 'reprovado' && (
          <div style={{ animation: 'fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)', paddingTop: '12px' }}>
            <div style={{
              background: '#ffffff', borderRadius: '22px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              padding: '36px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '52px', marginBottom: '20px', lineHeight: 1 }}>🌱</div>

              <div style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: '99px',
                background: '#fef3c7', color: '#92400e',
                fontSize: '11px', fontWeight: 700, marginBottom: '18px',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Perfil em desenvolvimento
              </div>

              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '21px', fontWeight: 600, color: '#1a1918',
                lineHeight: 1.45, margin: '0 0 22px',
              }}>
                {quiz?.mensagem_reprovado || 'Obrigada pela participação!'}
              </h2>

              <div style={{
                background: '#faf9f7', borderRadius: '14px',
                padding: '18px 20px', textAlign: 'left',
                border: '1px solid rgba(26,25,24,0.07)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#7d7671', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  O que você pode fazer agora
                </p>
                {[
                  { emoji: '📋', text: 'Regularize seu CPF caso esteja negativado' },
                  { emoji: '💪', text: 'Organize sua situação financeira' },
                  { emoji: '📱', text: 'Continue acompanhando nosso conteúdo' },
                  { emoji: '🔄', text: 'Tente novamente em alguns meses' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < 3 ? '10px' : 0 }}>
                    <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>{item.emoji}</span>
                    <span style={{ fontSize: '14px', color: '#5a5550', lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: '#5a5550', marginBottom: '6px', letterSpacing: '0.01em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px',
  borderRadius: '11px', border: '1.5px solid rgba(26,25,24,0.12)',
  fontSize: '15px', color: '#1a1918', outline: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s',
  background: '#ffffff',
};
