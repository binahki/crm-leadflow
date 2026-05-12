import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Check } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

declare global {
  interface Window { confetti?: (opts: Record<string, unknown>) => void; }
}

const tokens = {
  radius: { sm: 8, md: 12, lg: 16, pill: 9999 },
  shadow: { card: '0 1px 4px rgba(0,0,0,0.06)', modal: '0 8px 32px rgba(0,0,0,0.12)' },
  transition: 'all 150ms ease-out',
  font: { sm: 12, md: 14, base: 15, lg: 18, xl: 22, xxl: 28 },
};

interface Quiz {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; logo_url: string | null;
  capa_titulo?: string | null;
  capa_subtitulo?: string | null;
  capa_imagem_url?: string | null;
  capa_beneficios?: string[] | null;
  capa_botao_texto?: string | null;
  coleta_campos?: string[] | null;
  emoji_aprovado?: string | null;
  emoji_reprovado?: string | null;
}
interface Bloco { id: string; titulo: string; ordem: number; emoji?: string | null; }
interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
  emoji?: string | null;
}
interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto?: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
  opcoes: Opcao[];
}
type Phase = 'loading' | 'capa' | 'quiz' | 'aprovado_form' | 'reprovado' | 'sucesso' | 'not_found';

const BLOCO_NAME_EMOJIS: Record<string, string> = {
  aquecimento: '🔥', perfil: '👤', pessoal: '👤',
  comercial: '💼', financeira: '🔒', financeiro: '🔒',
};

function defaultEmojiForBloco(titulo: string): string {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, emoji] of Object.entries(BLOCO_NAME_EMOJIS)) {
    if (t.includes(key)) return emoji;
  }
  return '📝';
}

function emojiForText(text: string): string {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('imediatamente')) return '⚡';
  if (t.includes('7 dias')) return '📅';
  if (t.includes('avaliando') || t.includes('nao sei')) return '🤔';
  if (t.includes('whatsapp')) return '💬';
  if (t.includes('instagram') || t.includes('facebook')) return '📱';
  if (t.includes('presencial')) return '🤝';
  if (t.includes('clientes')) return '👥';
  if (t.includes('independencia')) return '🦋';
  if (t.includes('proprio negocio')) return '🏢';
  if (t.includes('renda extra')) return '💰';
  if (t.includes('trabalhar de casa') || t.includes('do lar') || t.includes('lar')) return '🏠';
  if (t.includes('clt')) return '🗂️';
  if (t.includes('mei')) return '📋';
  if (t.includes('autonoma') || t.includes('catalogo') || t.includes('informal')) return '📦';
  if (t.includes('desempregada')) return '🔍';
  if (t.includes('enfermagem')) return '🏥';
  if (t.includes('professor') || t.includes('educacao')) return '📚';
  if (t.includes('beleza') || t.includes('estetica') || t.includes('salao')) return '💅';
  if (t.includes('comercio') || t.includes('atendimento') || t.includes('vendas')) return '🛍️';
  if (t.includes('cartao') || t.includes('credito')) return '💳';
  if (t.includes('reserva')) return '🏦';
  if (t.includes('apoio total')) return '🤗';
  if (t.includes('apoio parcial')) return '🤲';
  if (t.includes('frequencia') && t.includes('vendo')) return '🌟';
  if (t.includes('nunca vendi') || t.includes('nunca tentei')) return '🌱';
  if (t.includes('sucesso')) return '✨';
  if (t.includes('mais de 10')) return '💪';
  if (t.includes('5 a 10')) return '⏰';
  if (t.includes('menos de 5') || t.includes('menos de')) return '🕐';
  if (t.includes('negativado') && !t.includes('nao')) return '⚠️';
  if (t.includes('mais de r$3') || t.includes('mais de 3')) return '🚀';
  if (t.includes('sim')) return '✅';
  if (t.includes('nao')) return '❌';
  return '→';
}

function hexRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
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

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          opcoes: (ops || []).filter((o: Opcao) => o.pergunta_id === p.id)
            .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
        }));

      setTodasPerguntas(perguntasComOpcoes);
      setPhase('capa');
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
  const progress = totalVisible > 0 ? Math.round((currentIdx / totalVisible) * 100) : 0;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id);

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

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      doAdvance(pergunta, opcao.id);
    }, 350);
  }

  function handleContinue() {
    if (!selectedOpcao || !currentPergunta) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    doAdvance(currentPergunta, selectedOpcao);
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
  const coleta = (quiz?.coleta_campos as string[] | null) || ['nome', 'whatsapp', 'cidade', 'instagram'];
  const canSubmit = nome.trim() && whatsapp.replace(/\D/g, '').length >= 10 && cidade.trim();

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2.5px solid #e5e7eb`, borderTopColor: primary, animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── NOT FOUND ────────────────────────────────────────────────────────────────
  if (phase === 'not_found') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '40px' }}>🔍</div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const HEADER_H = phase === 'quiz' ? 88 : 74;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform:rotate(360deg); } }
        *{box-sizing:border-box;}
        input,textarea,button,select{font-family:inherit;}
      `}</style>

      {/* ── FIXED HEADER ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#ffffff', borderBottom: '1px solid #f3f4f6',
      }}>
        <div style={{ padding: '14px 24px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {quiz?.logo_url ? (
            <img src={quiz.logo_url} alt={quiz.titulo} style={{ maxHeight: '36px', maxWidth: '140px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#111' }}>{quiz?.titulo}</span>
          )}
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', margin: '0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: primary,
            width: `${phase === 'capa' ? 0 : phase === 'quiz' ? Math.max(progress, 2) : 100}%`,
            borderRadius: '0 99px 99px 0',
            transition: 'width 500ms ease-out',
          }} />
        </div>
        {phase === 'quiz' && (
          <div style={{ padding: '4px 24px 2px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
              Etapa {currentIdx + 1} de {totalVisible}
            </span>
          </div>
        )}
        <div style={{ height: phase === 'quiz' ? '2px' : '6px' }} />
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div style={{ paddingTop: `${HEADER_H}px` }}>

        {/* ══ CAPA ══════════════════════════════════════════════════════════ */}
        {phase === 'capa' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.35s ease' }}>
            {quiz?.capa_imagem_url && (
              <img src={quiz.capa_imagem_url} alt=""
                style={{ width: '100%', borderRadius: `${tokens.radius.lg}px`, marginBottom: '24px', objectFit: 'cover', maxHeight: '220px' }} />
            )}

            <h1 style={{ fontSize: `${tokens.font.xxl}px`, fontWeight: 800, color: '#111', lineHeight: 1.2, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {quiz?.capa_titulo || quiz?.titulo}
            </h1>

            {quiz?.capa_subtitulo && (
              <p style={{ fontSize: `${tokens.font.base}px`, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
                {quiz.capa_subtitulo}
              </p>
            )}

            {(quiz?.capa_beneficios?.length ?? 0) > 0 && (
              <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quiz!.capa_beneficios!.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: primary, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                    }}>
                      <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                    </div>
                    <span style={{ fontSize: `${tokens.font.base}px`, color: '#374151', lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setPhase('quiz')}
              style={{
                width: '100%', padding: '18px', borderRadius: `${tokens.radius.md}px`, border: 'none',
                background: '#111', color: '#fff', fontSize: `${tokens.font.base}px`, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}
            >
              {quiz?.capa_botao_texto || 'Clique para iniciar →'}
            </button>
          </div>
        )}

        {/* ══ QUIZ ══════════════════════════════════════════════════════════ */}
        {phase === 'quiz' && currentPergunta && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 140px' }}>
            <div key={questionKey} style={{ animation: 'slideIn 0.3s ease-out' }}>

              {/* Block badge */}
              {currentBloco && (
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 12px 4px 8px', borderRadius: `${tokens.radius.pill}px`,
                    background: hexRgba(primary, 0.08),
                    border: `1px solid ${hexRgba(primary, 0.18)}`,
                  }}>
                    <span style={{ fontSize: '13px', lineHeight: 1 }}>
                      {currentBloco.emoji || defaultEmojiForBloco(currentBloco.titulo)}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: primary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {currentBloco.titulo}
                    </span>
                  </span>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
                    {currentIdx + 1} / {totalVisible}
                  </span>
                </div>
              )}

              {/* Question */}
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '26px', fontWeight: 600, color: '#111', lineHeight: 1.3, margin: '0 0 6px' }}>
                {currentPergunta.texto}
              </h2>
              {currentPergunta.subtexto && (
                <p style={{ fontSize: `${tokens.font.md}px`, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
                  {currentPergunta.subtexto}
                </p>
              )}
              {!currentPergunta.subtexto && <div style={{ height: '20px' }} />}

              {/* Options */}
              <div>
                {currentPergunta.opcoes.map(opcao => {
                  const isSelected = selectedOpcao === opcao.id;
                  return (
                    <button
                      key={opcao.id}
                      onClick={() => handleOpcaoClick(currentPergunta, opcao)}
                      disabled={!!selectedOpcao}
                      style={{
                        width: '100%', padding: '15px 18px', marginBottom: '10px',
                        borderRadius: `${tokens.radius.md}px`,
                        border: `${isSelected ? '2px' : '1.5px'} solid ${isSelected ? primary : '#e2e8f0'}`,
                        background: isSelected ? hexRgba(primary, 0.08) : '#ffffff',
                        cursor: selectedOpcao ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        transition: tokens.transition, textAlign: 'left',
                      }}
                      onMouseEnter={e => {
                        if (!selectedOpcao && !isSelected) {
                          (e.currentTarget as HTMLElement).style.borderColor = primary;
                          (e.currentTarget as HTMLElement).style.background = hexRgba(primary, 0.05);
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                          (e.currentTarget as HTMLElement).style.background = '#ffffff';
                        }
                      }}
                    >
                      {opcao.emoji && (
                        <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>
                          {opcao.emoji}
                        </span>
                      )}
                      <span style={{ flex: 1, fontSize: '15px', color: '#111', fontWeight: 500, lineHeight: 1.4 }}>
                        {opcao.texto}
                      </span>
                      {isSelected && (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: primary, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ CONTINUE BUTTON (fixed bottom) ════════════════════════════════ */}
        {phase === 'quiz' && selectedOpcao && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            display: 'flex', justifyContent: 'center',
            padding: '12px 24px 28px',
            background: 'linear-gradient(to top, #ffffff 55%, transparent)',
            animation: 'slideUp 200ms ease-out',
          }}>
            <button
              onClick={handleContinue}
              style={{
                width: '100%', maxWidth: '432px', padding: '16px',
                borderRadius: `${tokens.radius.md}px`, border: 'none',
                background: '#111', color: '#fff',
                fontSize: `${tokens.font.base}px`, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ══ APROVADO — FORMULÁRIO ═════════════════════════════════════════ */}
        {phase === 'aprovado_form' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>
                {quiz?.emoji_aprovado || '🎉'}
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
                {quiz?.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: `${tokens.radius.pill}px`, background: '#d1fae5', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                  <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Perfil verificado
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: `${tokens.radius.pill}px`, background: hexRgba(primary, 0.1), color: primary, fontSize: '12px', fontWeight: 700 }}>
                  ✨ Pronta para começar
                </span>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: `${tokens.radius.lg}px`, boxShadow: tokens.shadow.modal, padding: '24px' }}>
              <p style={{ fontSize: `${tokens.font.md}px`, color: '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                Preencha seus dados para concluir o cadastro.
              </p>

              <form onSubmit={handleSubmitLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {coleta.includes('nome') && (
                  <div>
                    <label style={lblStyle}>Nome completo <Req /></label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo" autoComplete="name"
                      style={inputStyle(primary)} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                )}
                {coleta.includes('whatsapp') && (
                  <div>
                    <label style={lblStyle}>WhatsApp <Req /></label>
                    <input type="tel" value={whatsapp}
                      onChange={e => setWhatsapp(maskWhatsapp(e.target.value))}
                      placeholder="(99) 99999-9999" autoComplete="tel" inputMode="numeric"
                      style={inputStyle(primary)} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                )}
                {coleta.includes('cidade') && (
                  <div>
                    <label style={lblStyle}>Cidade <Req /></label>
                    <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
                      placeholder="Sua cidade" autoComplete="address-level2"
                      style={inputStyle(primary)} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                )}
                {coleta.includes('instagram') && (
                  <div>
                    <label style={lblStyle}>Instagram <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
                    <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)}
                      placeholder="@seuperfil"
                      style={inputStyle(primary)} onFocus={focusInput} onBlur={blurInput} />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  style={{
                    width: '100%', padding: '16px', marginTop: '4px',
                    borderRadius: `${tokens.radius.md}px`, border: 'none',
                    background: !canSubmit || submitting ? '#9ca3af' : '#111',
                    color: '#fff', fontSize: `${tokens.font.base}px`, fontWeight: 700,
                    cursor: (!canSubmit || submitting) ? 'default' : 'pointer',
                  }}
                >
                  {submitting ? 'Enviando...' : 'Enviar meus dados →'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                  ⏰ Responda em até 24h para garantir sua vaga
                </p>
              </form>
            </div>
          </div>
        )}

        {/* ══ SUCESSO ═══════════════════════════════════════════════════════ */}
        {phase === 'sucesso' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#d1fae5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <Check style={{ width: '36px', height: '36px', color: '#059669', strokeWidth: 2.5 }} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: '0 0 8px' }}>
              Cadastro realizado!
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Você será redirecionada para o WhatsApp em instantes...
            </p>
          </div>
        )}

        {/* ══ REPROVADO ═════════════════════════════════════════════════════ */}
        {phase === 'reprovado' && (
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
            <div style={{
              background: '#fff', borderRadius: `${tokens.radius.lg}px`,
              boxShadow: tokens.shadow.modal,
              padding: '32px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '16px' }}>
                {quiz?.emoji_reprovado || '🌱'}
              </div>
              <div style={{
                display: 'inline-block', padding: '4px 14px', borderRadius: `${tokens.radius.pill}px`,
                background: '#fef3c7', color: '#92400e',
                fontSize: '11px', fontWeight: 700, marginBottom: '14px',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                Perfil em desenvolvimento
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', lineHeight: 1.4, margin: '0 0 20px' }}>
                {quiz?.mensagem_reprovado || 'Obrigada pela participação!'}
              </h2>

              <div style={{ background: '#f9fafb', borderRadius: `${tokens.radius.md}px`, padding: '16px 20px', textAlign: 'left', border: '1px solid #f0f0f0' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                    <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>{item.text}</span>
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

// ── Helpers de estilo ────────────────────────────────────────────────────────
function Req() {
  return <span style={{ color: '#9ca3af' }}> *</span>;
}
const lblStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: '#374151', marginBottom: '6px',
};
function inputStyle(primary: string): React.CSSProperties {
  return {
    width: '100%', padding: '13px 14px',
    borderRadius: `${tokens.radius.md}px`, border: '1.5px solid #e5e7eb',
    fontSize: `${tokens.font.base}px`, color: '#111', outline: 'none',
    transition: tokens.transition, background: '#ffffff',
  };
}
function focusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#111';
}
function blurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#e5e7eb';
}
