import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOrgId } from '@/hooks/useOrgId';
import { useQuizTracker } from '@/hooks/useQuizTracker';
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

function isProbablyMale(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  const firstWord = n.split(' ')[0];
  
  const commonMaleNames = ['joao', 'joão', 'pedro', 'lucas', 'mateus', 'matheus', 'vitor', 'victor', 'gabriel', 'rafael', 'felipe', 'gustavo', 'igor', 'caio', 'bruno', 'diego', 'tiago', 'thiago', 'samuel', 'daniel', 'miguel', 'arthur', 'artur', 'davi', 'david', 'marcos', 'paulo', 'ricardo', 'fernando', 'anderson', 'rodrigo', 'marcelo', 'alexandre', 'guilherme', 'henrique', 'murilo', 'vinicius', 'vitor', 'eduardo', 'leonardo', 'gabriel', 'rafael', 'thiago', 'bruno', 'felipe', 'gustavo', 'igor', 'caio', 'diego', 'marcelo', 'ricardo', 'andré', 'andre'];
  if (commonMaleNames.includes(firstWord)) return true;

  return false;
}

export default function QuizPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

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

  const { iniciarSessao, registrarEtapa, marcarConcluido } = useQuizTracker(
    slug || '',
    quiz?.org_id,
    todasPerguntas.length
  );

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
      
      // Start Session
      if (!isPreview) iniciarSessao();
    }
    loadQuiz();
  }, [slug, isPreview, iniciarSessao]);

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

  function calculateScore(ans: Record<string, string>, multiAns: Record<string, string[]>) {
    let totalScore = 0;
    for (const [pergId, oId] of Object.entries(ans)) {
      const perg = todasPerguntas.find(p => p.id === pergId);
      if (!perg) continue;
      if (perg.tipo_resposta === 'multipla') {
        const selectedIds = multiAns[pergId] || [oId];
        for (const opId of selectedIds) {
          const op = perg.opcoes.find(o => o.id === opId);
          if (op) totalScore += op.pontos ?? 0;
        }
      } else {
        const op = perg.opcoes.find(o => o.id === oId);
        if (op) totalScore += op.pontos ?? 0;
      }
    }
    return totalScore;
  }

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
    
    // Custom redirection logic
    const selectedOpcaoObj = pergunta.opcoes.find(o => o.id === primaryAnswer);
    if (selectedOpcaoObj?.target_pergunta_id) {
      const targetId = selectedOpcaoObj.target_pergunta_id;
      if (targetId === 'approval') {
        const score = calculateScore(newAnswers, newMultipleAnswers);
        setScore(score); setFaixa(score >= (quiz?.corte_verde ?? 35) ? 'verde' : 'amarelo');
        setPhase('aprovado_form'); return;
      }
      if (targetId === 'collect') {
        const score = calculateScore(newAnswers, newMultipleAnswers);
        setScore(score); setFaixa(score >= (quiz?.corte_verde ?? 35) ? 'verde' : 'amarelo');
        setPhase('coleta'); return;
      }
      
      const targetIdx = newVisible.findIndex(p => p.id === targetId);
      if (targetIdx !== -1) {
        setCurrentIdx(targetIdx);
        setQuestionKey(k => k + 1);
        return;
      }
    }

    if (nextIdx >= newVisible.length) {
      const totalScore = calculateScore(newAnswers, newMultipleAnswers);
      setScore(totalScore);
      if (!quiz) return;
      
      const isApproved = totalScore >= quiz.corte_verde || totalScore >= (quiz.corte_amarelo ?? 0);
      setFaixa(totalScore >= quiz.corte_verde ? 'verde' : 'amarelo');
      
      setPhase('analise');
      registrarEtapa(newVisible.length, 'Análise', 'Iniciou análise');
      
      const duration = (quiz.analise_duracao || 4) * 1000;
      setTimeout(() => {
        if (isApproved) {
          setPhase('aprovado_form');
          registrarEtapa(newVisible.length + 1, 'Formulário', 'Viu formulário');
        } else {
          setPhase('reprovado');
        }
      }, duration);
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
    
    // Registrar etapa no tracker
    registrarEtapa(currentIdx + 1, pergunta.texto, opcao.texto);

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
    
    // Validações
    if (isProbablyMale(nome)) {
      alert('Desculpe, este quiz é exclusivo para o público feminino.');
      return;
    }
    if (rawWa.length !== 11) {
      alert('Por favor, informe um WhatsApp válido com DDD (11 dígitos).');
      return;
    }
    if (rawWa[2] !== '9') {
      alert('O número de WhatsApp deve ser um celular (começar com 9).');
      return;
    }

    // Validate all required coleta fields
    const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
    for (const cfg of coletaConfig) {
      if (!cfg.obrigatorio) continue;
      if (cfg.campo === 'whatsapp') continue; // already validated above
      const val = (fieldValues[cfg.campo] ?? '').trim();
      if (!val) {
        alert(`Por favor, preencha o campo "${cfg.label}".`);
        return;
      }
    }

    setSubmitting(true);

    const stripEmojis = (str: string) => str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    const quizRespostas: Record<string, string> = {};
    for (const perg of todasPerguntas) {
      const opcId = answers[perg.id];
      if (!opcId) continue;
      
      if (perg.tipo_resposta === 'multipla') {
        const selectedIds = multipleAnswers[perg.id] || [opcId as string];
        const textos = selectedIds
          .map(id => perg.opcoes.find(o => o.id === id)?.texto)
          .filter(Boolean).map(t => stripEmojis(t!)).join(', ');
        quizRespostas[perg.texto] = textos;
      } else {
        const op = perg.opcoes.find(o => o.id === opcId as string);
        if (op) quizRespostas[perg.texto] = stripEmojis(op.texto);
      }
    }

      const leadData = {
        org_id: quiz.org_id,
        nome: nome.trim(),
        whatsapp: rawWa,
        cidade: cidade.trim(),
        instagram: instagram.trim(),
        status: 1,
        quiz_respostas: quizRespostas,
        score,
        faixa,
        created_at: new Date().toISOString(),
        ...utms.current
      };
      
      const { data: newLead, error } = await db.from('leads').insert(leadData).select().single();

    if (error) { setSubmitting(false); alert('Erro ao salvar. Tente novamente.'); return; }

    // Marcar sessão como concluída IMEDIATAMENTE após o insert, antes de qualquer redirect
    if (newLead?.id) await marcarConcluido(newLead.id);
    setSubmitting(false);

    const num = quiz.redirect_whatsapp?.replace(/\D/g, '');
    const msg = `Oi! Acabei de ser aprovada no quiz ✨\nMeu nome é ${nome}\nSou de ${cidade}`;
    const redirectUrl = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : null;

    if ((quiz as any).whatsapp_redirecionar_direto && redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    setPhase('sucesso');
    if (redirectUrl) {
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 2000);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id) ?? null;
  const rawColeta = (quiz?.coleta_campos as string[] | null);
  const coleta = rawColeta?.length ? rawColeta : ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz?.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coleta.includes(d.campo));
  const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
  const canSubmit = coletaConfig
    .filter(c => c.obrigatorio)
    .every(c => {
      const val = fieldValues[c.campo] ?? '';
      if (c.campo === 'whatsapp') return val.replace(/\D/g, '').length === 11;
      return val.trim().length > 0;
    });
  const primary = quiz?.cor_primaria || '#2563eb';

  const utms = useRef<Record<string, string>>({});

  useEffect(() => {
    // Capture UTMs on mount
    const captured: Record<string, string> = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'fbclid', 'gclid'];
    utmKeys.forEach(key => {
      const val = searchParams.get(key);
      if (val) captured[key] = val;
    });
    utms.current = captured;
  }, [searchParams]);

  useEffect(() => {
    if (!quiz) return;

    // ── Inject Scripts ──────────────────────────────────────────────────────
    const injectScript = (content: string, position: 'head' | 'body' | 'footer') => {
      if (!content) return;
      const el = document.createElement('div');
      el.innerHTML = content;
      const scripts = el.querySelectorAll('script');
      scripts.forEach(s => {
        const newS = document.createElement('script');
        if (s.src) newS.src = s.src;
        else newS.textContent = s.textContent;
        if (position === 'head') document.head.appendChild(newS);
        else if (position === 'body') document.body.prepend(newS);
        else document.body.appendChild(newS);
      });
    };

    // GTM
    if ((quiz as any).gtm_id) {
      const gtmId = (quiz as any).gtm_id;
      const script = document.createElement('script');
      script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(script);
    }

    // Facebook Pixel
    if (quiz.pixel_id) {
      const script = document.createElement('script');
      script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${quiz.pixel_id}');fbq('track', 'PageView');`;
      document.head.appendChild(script);
    }

    // Custom Scripts
    if ((quiz as any).script_head) injectScript((quiz as any).script_head, 'head');
    if ((quiz as any).script_body) injectScript((quiz as any).script_body, 'body');
    if ((quiz as any).script_footer) injectScript((quiz as any).script_footer, 'footer');

  }, [quiz?.id]);

  useEffect(() => {
    // Fire Lead Event on Approval
    if (phase === 'aprovado_form' && quiz?.pixel_id) {
      // 1. Standard Lead event
      if ((quiz as any).pixel_fire_lead_event !== false) {
        if ((window as any).fbq) (window as any).fbq('track', 'Lead');
      }

      // 2. Custom Script / Event from Approval Page
      const custom = (quiz as any).pixel_custom_event_name;
      if (custom) {
        // If it looks like a script or complex JS, inject it
        if (custom.includes('<script') || custom.includes('fbq(') || custom.includes('gtag(')) {
          const s = document.createElement('script');
          if (custom.includes('<script')) {
            const temp = document.createElement('div');
            temp.innerHTML = custom;
            const found = temp.querySelector('script');
            s.textContent = found ? found.textContent : custom;
          } else {
            s.textContent = custom;
          }
          document.body.appendChild(s);
        } else {
          // Otherwise treat as a simple event name
          if ((window as any).fbq) (window as any).fbq('track', custom);
        }
      }
    }
  }, [phase, quiz?.id]);

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
      onStart={() => {
        setPhase('quiz');
        registrarEtapa(0, 'Início', 'Iniciou o quiz');
      }}
      onOpcaoClick={handleOpcaoClick}
      onContinue={handleContinue}
      onGoToColeta={() => {
        setPhase('coleta');
        registrarEtapa(totalVisible, 'Coleta Manual', 'Acessou coleta manual');
      }}
      onNomeChange={setNome}
      onWhatsappChange={setWhatsapp}
      onCidadeChange={setCidade}
      onInstagramChange={setInstagram}
      onSubmit={handleSubmitLead}
    />
  );
}
