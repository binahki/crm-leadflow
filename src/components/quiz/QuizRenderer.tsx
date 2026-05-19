import React from 'react';
import { Check, X, Instagram, MessageCircle } from 'lucide-react';

// ── Shared types ─────────────────────────────────────────────────────────────
export interface ColetaCampo {
  campo: string; label: string; placeholder: string;
  obrigatorio: boolean; ordem: number;
}

export const DEFAULT_COLETA_CONFIG: ColetaCampo[] = [
  { campo: 'nome',      label: 'Nome completo', placeholder: 'Digite seu nome',      obrigatorio: true,  ordem: 1 },
  { campo: 'whatsapp',  label: 'WhatsApp',      placeholder: '(XX) XXXXX-XXXX',      obrigatorio: true,  ordem: 2 },
  { campo: 'cidade',    label: 'Cidade',         placeholder: 'Sua cidade',           obrigatorio: false, ordem: 3 },
  { campo: 'instagram', label: 'Instagram',      placeholder: '@seuinstagram',        obrigatorio: false, ordem: 4 },
];

export interface QuizConfig {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; publicado?: boolean; logo_url: string | null;
  capa_titulo?: string | null; capa_subtitulo?: string | null;
  capa_imagem_url?: string | null; capa_imagem_altura?: number | null;
  capa_beneficios?: string[] | null;
  capa_botao_texto?: string | null; coleta_campos?: string[] | null;
  coleta_config?: ColetaCampo[] | null;
  pixel_id?: string | null; pixel_evento_lead?: string | null;
  cor_botao?: string | null; cor_fundo?: string | null;
  cor_titulo?: string | null; cor_subtitulo?: string | null;
  capa_imagem_height?: number | null; logo_altura?: number | null;
  emoji_aprovado?: string | null; emoji_reprovado?: string | null;
  mensagem_aprovado_subtitulo?: string | null;
  mensagem_reprovado_subtitulo?: string | null;
  reprovado_conteudo?: string[] | null;
  capa_ordem?: any | null;
  reprovado_botao_url?: string | null;
  analise_duracao?: number | null;
  analise_titulo?: string | null;
  analise_subtitulo?: string | null;
  analise_texto_carregando?: string | null;
  analise_depoimentos?: any[] | null;
  whatsapp_mensagem_personalizada?: string | null;
  whatsapp_redirecionar_direto?: boolean | null;
}
export interface Bloco { id: string; titulo: string; ordem: number; emoji?: string | null; }
export interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
  emoji?: string | null;
  target_pergunta_id?: string | null;
}
export interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto?: string | null; tipo_resposta?: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
  opcoes: Opcao[];
}
export type Phase = 'loading' | 'capa' | 'quiz' | 'analise' | 'aprovado_form' | 'coleta' | 'reprovado' | 'sucesso' | 'not_found';

export interface QuizRendererProps {
  quiz: QuizConfig;
  blocos: Bloco[];
  phase: Phase;
  currentPergunta: Pergunta | null;
  currentBloco?: Bloco | null;
  currentIdx: number;
  totalVisible: number;
  selectedOpcao?: string | null;      // single choice
  selectedOpcoes?: string[];          // multiple choice
  questionKey?: number;
  coleta?: string[];
  nome?: string; whatsapp?: string; cidade?: string; instagram?: string;
  submitting?: boolean; canSubmit?: boolean;
  onStart?: () => void;
  onOpcaoClick?: (perg: Pergunta, opcao: Opcao) => void;
  onContinue?: () => void;
  onNomeChange?: (v: string) => void;
  onWhatsappChange?: (v: string) => void;
  onCidadeChange?: (v: string) => void;
  onInstagramChange?: (v: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onGoToColeta?: () => void;
  isPreview?: boolean;
  whatsappEnabled?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function hexRgba(hex: string, a: number): string {
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

export function defaultEmojiForBloco(titulo: string): string {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, string> = {
    aquecimento: '🔥', perfil: '👤', pessoal: '👤',
    comercial: '💼', financeira: '🔒', financeiro: '🔒',
  };
  for (const [key, emoji] of Object.entries(map)) if (t.includes(key)) return emoji;
  return '📝';
}

export const DEFAULT_DEPOIMENTOS = [
  { nome: 'Rafaela Nascimento', handle: '@rafaela.nascimento', texto: 'Comecei sem saber nada de vendas. Hoje faturei R$ 3.200 no mês passado só com as semi joias!' },
  { nome: 'Camila Ferreira', handle: '@camila.ferreira', texto: 'O consignado mudou minha vida! Recebi o kit em casa, sem investir nada. No primeiro mês já lucrei R$ 1.400' },
  { nome: 'Carla Ferraz', handle: '@carlamferraz_', texto: 'Sou mãe de 2 filhos e trabalho de casa. As semi joias me deram liberdade financeira e tempo com minha família!' },
];

function easedProgress(idx: number, total: number): number {
  if (total === 0) return 0;
  const raw = idx / total;
  return Math.round(Math.pow(raw, 0.62) * 100);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function QuizRenderer({
  quiz, phase, currentPergunta, currentBloco,
  currentIdx, totalVisible, selectedOpcao = null,
  selectedOpcoes = [], questionKey = 0,
  coleta, nome = '', whatsapp = '', cidade = '', instagram = '',
  submitting = false, canSubmit = false,
  onStart, onOpcaoClick, onContinue,
  onNomeChange, onWhatsappChange, onCidadeChange, onInstagramChange, onSubmit,
  onGoToColeta,
  isPreview = false,
  whatsappEnabled = false,
}: QuizRendererProps) {
  const [cities, setCities] = React.useState<string[]>([]);
  const [citySearch, setCitySearch] = React.useState('');
  const [showCitySugg, setShowCitySugg] = React.useState(false);
  const [analiseProgress, setAnaliseProgress] = React.useState(0);
  const [nomeErro, setNomeErro] = React.useState<string | null>(null);

  const isMaleName = (name: string): boolean => {
    const n = name.trim().toLowerCase();
    if (!n) return false;
    const firstWord = n.split(' ')[0];
    const commonMaleNames = ['joao', 'joão', 'pedro', 'lucas', 'mateus', 'matheus', 'vitor', 'victor', 'gabriel', 'rafael', 'felipe', 'gustavo', 'igor', 'caio', 'bruno', 'diego', 'tiago', 'thiago', 'samuel', 'daniel', 'miguel', 'arthur', 'artur', 'davi', 'david', 'marcos', 'paulo', 'ricardo', 'fernando', 'anderson', 'rodrigo', 'marcelo', 'alexandre', 'guilherme', 'henrique', 'murilo', 'vinicius', 'eduardo', 'leonardo', 'andré', 'andre'];
    if (commonMaleNames.includes(firstWord)) return true;
    return false;
  };

  React.useEffect(() => {
    if (phase === 'analise') {
      const dur = (quiz.analise_duracao || 4) * 1000;
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const p = Math.min(Math.round((elapsed / dur) * 100), 100);
        setAnaliseProgress(p);
        if (p >= 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [phase, quiz.analise_duracao]);


  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;
  const rawColetaCampos = coleta || (quiz.coleta_campos as string[] | null);
  const coletaCampos = rawColetaCampos?.length ? rawColetaCampos : ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coletaCampos.includes(d.campo));
  const progress = easedProgress(currentIdx, totalVisible);
  const isMultipla = currentPergunta?.tipo_resposta === 'multipla';
  const hasSelection = isMultipla ? selectedOpcoes.length > 0 : !!selectedOpcao;
  const imgAltura = quiz.capa_imagem_height || 200;

  const continueBtnPos: React.CSSProperties = isPreview
    ? {}
    : { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 };

  return (
    <div style={{
      minHeight: isPreview ? '100%' : '100vh',
      background: quiz.cor_fundo || '#ffffff',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');
        @keyframes appleIn {
          0% { opacity: 0; transform: scale(0.985) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .quiz-option {
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transform: perspective(1px) translateZ(0);
        }
        .quiz-option:active {
          transform: perspective(1px) scale(0.98) translateZ(0) !important;
        }
        .quiz-option span {
          transform: translateZ(0);
        }
        *{box-sizing:border-box;}
        input,textarea,button,select{font-family:inherit;}
      `}</style>

      <div style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', zIndex: 100 }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 24px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {quiz.logo_url ? (
            <img src={quiz.logo_url} alt={quiz.titulo}
              style={{ maxHeight: `${quiz.logo_altura || 32}px`, maxWidth: '160px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 700, color: quiz.cor_titulo || '#111111' }}>{quiz.titulo}</span>
          )}
        </div>
        <div style={{ padding: '0 24px' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: primary,
              width: `${phase === 'capa' ? 0 : phase === 'quiz' ? Math.max(progress, 2) : 100}%`,
              borderRadius: '999px',
              transition: 'width 800ms cubic-bezier(0.65, 0, 0.35, 1)',
            }} />
          </div>
        </div>
        <div style={{ height: '24px' }} />
      </div>

      {phase === 'capa' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 80px', animation: 'fadeIn 0.35s ease' }}>
          {(() => {
            const ordem = (quiz.capa_ordem as string[]) || ['titulo', 'subtitulo', 'imagem', 'beneficios', 'botao'];
            return ordem.map(key => {
              if (key === 'imagem' && quiz.capa_imagem_url) return (
                <img key="imagem" src={quiz.capa_imagem_url} alt=""
                  style={{ width: '100%', borderRadius: '16px', marginBottom: '24px', objectFit: 'cover', maxHeight: `${imgAltura}px` }} />
              );
              if (key === 'titulo') return (
                <h1 key="titulo" style={{ fontSize: '28px', fontWeight: 800, color: quiz.cor_titulo || '#111111', lineHeight: 1.15, margin: '0 0 10px', textAlign: 'center' }}>
                  {quiz.capa_titulo || quiz.titulo}
                </h1>
              );
              if (key === 'subtitulo' && quiz.capa_subtitulo) return (
                <p key="subtitulo" style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' }}>
                  {quiz.capa_subtitulo}
                </p>
              );
              if (key === 'beneficios' && (quiz.capa_beneficios?.length ?? 0) > 0) return (
                <div key="beneficios" style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quiz.capa_beneficios!.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                      </div>
                      <span style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>
              );
              if (key === 'botao') return (
                <button key="botao" onClick={onStart} style={{
                  width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
                  background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}>
                  {quiz.capa_botao_texto || 'Clique para iniciar →'}
                </button>
              );
              return null;
            });
          })()}
        </div>
      )}

      {phase === 'quiz' && currentPergunta && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 140px' }}>
            <div
              key={questionKey}
              style={{ 
                width: '100%', 
                maxWidth: '480px', 
                animation: 'appleIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards', 
                willChange: 'transform, opacity' 
              }}
            >
            {currentBloco && (
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px 5px 10px', borderRadius: '999px', background: hexRgba(primary, 0.08), border: `1px solid ${hexRgba(primary, 0.18)}` }}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>{currentBloco.emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: primary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{currentBloco.titulo}</span>
                </span>
              </div>
            )}
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: quiz.cor_titulo || '#111111', lineHeight: 1.35, margin: '0 0 8px', textAlign: 'center' }}>{currentPergunta.texto}</h2>
            {currentPergunta.subtexto ? <p style={{ fontSize: '14px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5, textAlign: 'center' }}>{currentPergunta.subtexto}</p> : <div style={{ height: '20px' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentPergunta.opcoes.map(opcao => {
                const isSelected = isMultipla ? selectedOpcoes.includes(opcao.id) : selectedOpcao === opcao.id;
                const isDisabled = !isMultipla && !!selectedOpcao && !isSelected;
                return (
                  <button key={opcao.id}
                    className="quiz-option"
                    onClick={() => !isDisabled && onOpcaoClick?.(currentPergunta, opcao)}
                    style={{
                      width: '100%', padding: '16px 20px', borderRadius: '16px',
                      border: `${isSelected ? '2.5px' : '1.5px'} solid ${isSelected ? primary : '#e2e8f0'}`,
                      background: isSelected ? hexRgba(primary, 0.08) : '#fff',
                      cursor: isDisabled ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 400ms cubic-bezier(0.2, 0.8, 0.2, 1)', textAlign: 'left',
                      opacity: isDisabled ? 0.5 : 1,
                      transform: isSelected ? 'scale(1.01) translateZ(0)' : 'scale(1) translateZ(0)',
                      boxShadow: isSelected ? `0 12px 32px ${hexRgba(primary, 0.12)}` : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isDisabled && !isSelected) {
                        const btn = e.currentTarget as HTMLElement;
                        btn.style.borderColor = primary;
                        btn.style.background = hexRgba(primary, 0.04);
                        btn.style.transform = 'perspective(1px) translateY(-2px) scale(1.01) translateZ(0)';
                        btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        const btn = e.currentTarget as HTMLElement;
                        btn.style.borderColor = '#e2e8f0';
                        btn.style.background = '#fff';
                        btn.style.transform = 'translateY(0) scale(1)';
                        btn.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {isMultipla ? (
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, border: `2px solid ${isSelected ? primary : '#d1d5db'}`, background: isSelected ? primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />}
                      </div>
                    ) : (
                      isSelected && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />
                        </div>
                      )
                    )}
                    {opcao.emoji && <span style={{ fontSize: '64px', lineHeight: 1, flexShrink: 0, transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>{opcao.emoji}</span>}
                    <span style={{ flex: 1, fontSize: '15px', color: quiz.cor_titulo || '#111', fontWeight: 500, lineHeight: 1.4 }}>{opcao.texto}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {phase === 'quiz' && isMultipla && hasSelection && (
        <div style={{ ...continueBtnPos, display: 'flex', justifyContent: 'center', padding: '12px 24px 28px', background: 'linear-gradient(to top, #fff 60%, transparent)', animation: 'slideUp 200ms ease-out' }}>
          <button onClick={onContinue} style={{ width: '100%', maxWidth: '432px', padding: '16px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            Continuar ({selectedOpcoes.length} selecionada{selectedOpcoes.length !== 1 ? 's' : ''}) →
          </button>
        </div>
      )}

      {phase === 'analise' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 100px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>⌛</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', lineHeight: 1.25, margin: '0 0 10px' }}>
              {quiz.analise_titulo || 'Estamos analisando seu perfil...'}
            </h2>
            <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', lineHeight: 1.6, margin: '0' }}>
              {quiz.analise_subtitulo || 'Aguarde enquanto verificamos se você tem o que é preciso para ser uma revendedora de sucesso!'}
            </p>
          </div>

          <div style={{ borderTop: '1px dashed #e5e7eb', borderBottom: '1px dashed #e5e7eb', padding: '20px 0', margin: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>Carregando...</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{analiseProgress}%</span>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', background: '#111', width: `${analiseProgress}%`, transition: 'width 100ms linear' }} />
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', margin: 0 }}>
              {analiseProgress < 30 ? 'Verificando seus dados...' : 
               analiseProgress < 60 ? 'Analisando respostas...' : 
               analiseProgress < 90 ? 'Cruzando informações...' : 'Finalizando análise...'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(quiz.analise_depoimentos && quiz.analise_depoimentos.length > 0 ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS).map((d, i) => (
              <div key={i} style={{ padding: '16px', borderRadius: '16px', border: '1.5px solid #f1f5f9', background: '#fff' }}>
                <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                  {[...Array(5)].map((_, j) => (
                    <span key={j} style={{ fontSize: '14px', color: '#fbbf24' }}>⭐</span>
                  ))}
                </div>
                <h4 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#111' }}>{d.nome}</h4>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ca3af' }}>{d.handle}</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>{d.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'aprovado_form' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>{quiz.emoji_aprovado || '🎉'}</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 10px', textAlign: 'center' }}>
              {quiz.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
            </h2>
            {quiz.mensagem_aprovado_subtitulo && (
              <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
                {quiz.mensagem_aprovado_subtitulo}
              </p>
            )}
          </div>
          <button onClick={onGoToColeta} style={{ width: '100%', padding: '18px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            Preencher meus dados →
          </button>
        </div>
      )}

      {phase === 'coleta' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '24px' }}>
            <p style={{ fontSize: '14px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>Preencha seus dados para concluir o cadastro.</p>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {coletaConfig.map(cfg => {
                const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
                const val = fieldValues[cfg.campo] ?? '';
                return (
                  <div key={cfg.campo}>
                    <label style={lblS}>{cfg.label} <span style={{ fontWeight: 400, color: '#9ca3af' }}>{cfg.obrigatorio ? '*' : '(opcional)'}</span></label>
                    {cfg.campo === 'cidade' ? (
                      <input 
                        value={cidade}
                        onChange={e => onCidadeChange?.(e.target.value.replace(/[0-9]/g, ''))}
                        placeholder="Ex: São Paulo" 
                        style={inpS} 
                      />
                    ) : cfg.campo === 'whatsapp' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input 
                          value={maskWhatsapp(whatsapp)}
                          onChange={e => onWhatsappChange?.(e.target.value)}
                          placeholder="(00) 00000-0000" 
                          style={inpS} 
                        />
                        <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ⚠️ Se o número estiver errado, você perderá sua vaga
                        </span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          value={fieldValues[cfg.campo] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (cfg.campo === 'nome') {
                              onNomeChange?.(val);
                              if (isMaleName(val)) setNomeErro('Opa! Este quiz é exclusivo para o público feminino. 🌸');
                              else setNomeErro(null);
                            } else if (cfg.campo === 'instagram') {
                              onInstagramChange?.(val);
                            }
                          }}
                          placeholder={cfg.placeholder}
                          style={{ ...inpS, borderColor: cfg.campo === 'nome' && nomeErro ? '#ef4444' : (cfg.campo === 'nome' && nome.length > 2 && !nomeErro ? '#10b981' : '#e2e8f0') }}
                        />
                        {cfg.campo === 'nome' && nomeErro && (
                          <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0', fontWeight: 600 }}>{nomeErro}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="submit"
                disabled={submitting || !canSubmit}
                style={{
                  width: '100%', padding: '16px', marginTop: '4px', borderRadius: '12px',
                  border: 'none',
                  background: !canSubmit || submitting ? '#9ca3af' : whatsappEnabled ? '#25d366' : btnColor,
                  color: '#fff', fontSize: '15px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!submitting && canSubmit) e.currentTarget.style.background = whatsappEnabled ? '#20c75a' : '#1d4ed8'; }}
                onMouseLeave={e => { if (!submitting && canSubmit) e.currentTarget.style.background = whatsappEnabled ? '#25d366' : btnColor; }}
              >
                {whatsappEnabled && !submitting && <MessageCircle size={20} strokeWidth={2.5} />}
                {submitting ? 'Enviando...' : whatsappEnabled ? 'Enviar e falar no WhatsApp' : 'Enviar meus dados →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {phase === 'reprovado' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px', textAlign: 'center', animation: 'fadeIn 0.35s ease' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <X style={{ width: '32px', height: '32px', strokeWidth: 3 }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 8px' }}>
            {quiz.mensagem_reprovado || 'Obrigada pela participação!'}
          </h2>
          {(quiz as any).mensagem_reprovado_subtitulo && (
            <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              {(quiz as any).mensagem_reprovado_subtitulo}
            </p>
          )}
          <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '20px', marginBottom: '32px', textAlign: 'left' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Para uma próxima tentativa:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(Array.isArray(quiz.reprovado_conteudo) && quiz.reprovado_conteudo.length > 0 ? quiz.reprovado_conteudo : [
                'Continue acompanhando nossas dicas no Instagram',
                'Mantenha seu CPF regularizado',
                'Tente novamente em 30 dias'
              ]).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db', marginTop: '6px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.4 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {(quiz as any).reprovado_botao_texto && (
            <button onClick={() => window.open((quiz as any).reprovado_botao_url || '#', '_blank')} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {(quiz as any).reprovado_botao_texto}
            </button>
          )}
        </div>
      )}
      {phase === 'sucesso' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px', textAlign: 'center', animation: 'fadeIn 0.35s ease' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check style={{ width: '32px', height: '32px', strokeWidth: 3 }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 8px' }}>
            Cadastro realizado!
          </h2>
          <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
            Seus dados foram enviados com sucesso! Em breve entraremos em contato.
          </p>
        </div>
      )}
    </div>
  );
}

const lblS: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const inpS: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '15px', color: '#111', outline: 'none', transition: 'all 150ms ease-out', background: '#fff' };
