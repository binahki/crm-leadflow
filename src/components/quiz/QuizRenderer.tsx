import React from 'react';
import { Check } from 'lucide-react';

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
  capa_imagem_height?: number | null; logo_altura?: number | null;
  emoji_aprovado?: string | null; emoji_reprovado?: string | null;
}
export interface Bloco { id: string; titulo: string; ordem: number; emoji?: string | null; }
export interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
  emoji?: string | null;
}
export interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto?: string | null; tipo_resposta?: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
  opcoes: Opcao[];
}
export type Phase = 'loading' | 'capa' | 'quiz' | 'aprovado_form' | 'coleta' | 'reprovado' | 'sucesso' | 'not_found';

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

// Eased progress: faster at start, slower at end (false acceleration effect)
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
}: QuizRendererProps) {
  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;
  const coletaCampos = coleta || (quiz.coleta_campos as string[] | null) || ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coletaCampos.includes(d.campo));
  const progress = easedProgress(currentIdx, totalVisible);
  const isMultipla = currentPergunta?.tipo_resposta === 'multipla';
  const hasSelection = isMultipla ? selectedOpcoes.length > 0 : !!selectedOpcao;
  const imgAltura = quiz.capa_imagem_height || 200;

  const headerPos: React.CSSProperties = isPreview
    ? { position: 'relative' }
    : { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 };

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
        @keyframes questionIn {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        *{box-sizing:border-box;}
        input,textarea,button,select{font-family:inherit;}
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ ...headerPos, background: quiz.cor_fundo || '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '14px 24px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {quiz.logo_url ? (
            <img src={quiz.logo_url} alt={quiz.titulo}
              style={{ maxHeight: `${quiz.logo_altura || 32}px`, maxWidth: '160px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{quiz.titulo}</span>
          )}
        </div>
        {/* Progress bar — centered, max-width, rounded */}
        <div style={{ padding: '0 24px' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: primary,
              width: `${phase === 'capa' ? 0 : phase === 'quiz' ? Math.max(progress, 2) : 100}%`,
              borderRadius: '999px',
              transition: 'width 600ms cubic-bezier(0.25,0.46,0.45,0.94)',
            }} />
          </div>
        </div>
        <div style={{ height: '6px' }} />
      </div>

      {/* Spacer */}
      {!isPreview && <div style={{ height: phase === 'quiz' ? '76px' : '76px' }} />}

      {/* ── CAPA ─────────────────────────────────────────────────────────── */}
      {phase === 'capa' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 80px', animation: 'fadeIn 0.35s ease' }}>
          {quiz.capa_imagem_url && (
            <img src={quiz.capa_imagem_url} alt=""
              style={{ width: '100%', borderRadius: '16px', marginBottom: '24px', objectFit: 'cover', maxHeight: `${imgAltura}px` }} />
          )}
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111', lineHeight: 1.15, margin: '0 0 10px', letterSpacing: '-0.03em', textAlign: 'center' }}>
            {quiz.capa_titulo || quiz.titulo}
          </h1>
          {quiz.capa_subtitulo && (
            <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' }}>
              {quiz.capa_subtitulo}
            </p>
          )}
          {(quiz.capa_beneficios?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {quiz.capa_beneficios!.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                  </div>
                  <span style={{ fontSize: '15px', color: '#374151', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={onStart} style={{
            width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
            background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '-0.01em',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
          >
            {quiz.capa_botao_texto || 'Clique para iniciar →'}
          </button>
        </div>
      )}

      {/* ── QUIZ ──────────────────────────────────────────────────────────── */}
      {phase === 'quiz' && currentPergunta && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 140px' }}>
          <div
            key={questionKey}
            style={{ animation: 'questionIn 0.32s cubic-bezier(0.25,0.46,0.45,0.94) forwards', willChange: 'transform, opacity' }}
          >
            {/* Badge — centered */}
            {currentBloco && (
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 14px 5px 10px', borderRadius: '999px',
                  background: hexRgba(primary, 0.08),
                  border: `1px solid ${hexRgba(primary, 0.18)}`,
                }}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>
                    {currentBloco.emoji || defaultEmojiForBloco(currentBloco.titulo)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: primary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {currentBloco.titulo}
                  </span>
                </span>
              </div>
            )}

            {/* Question */}
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111', lineHeight: 1.35, margin: '0 0 8px', textAlign: 'center' }}>
              {currentPergunta.texto}
            </h2>
            {currentPergunta.subtexto ? (
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px', lineHeight: 1.5, textAlign: 'center' }}>
                {currentPergunta.subtexto}
              </p>
            ) : (
              <div style={{ height: '20px' }} />
            )}

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentPergunta.opcoes.map(opcao => {
                const isSelected = isMultipla
                  ? selectedOpcoes.includes(opcao.id)
                  : selectedOpcao === opcao.id;
                const isDisabled = !isMultipla && !!selectedOpcao && !isSelected;
                return (
                  <button
                    key={opcao.id}
                    onClick={() => !isDisabled && onOpcaoClick?.(currentPergunta, opcao)}
                    style={{
                      width: '100%', padding: '16px 18px', borderRadius: '12px',
                      border: `${isSelected ? '2px' : '1.5px'} solid ${isSelected ? primary : '#e2e8f0'}`,
                      background: isSelected ? hexRgba(primary, 0.08) : '#fff',
                      cursor: isDisabled ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      transition: 'all 150ms ease-out', textAlign: 'left',
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!isDisabled && !isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = primary;
                        (e.currentTarget as HTMLElement).style.background = hexRgba(primary, 0.05);
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                        (e.currentTarget as HTMLElement).style.background = '#fff';
                      }
                    }}
                  >
                    {/* Checkbox indicator for multiple, circle for single */}
                    {isMultipla ? (
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                        border: `2px solid ${isSelected ? primary : '#d1d5db'}`,
                        background: isSelected ? primary : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 150ms ease-out',
                      }}>
                        {isSelected && <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />}
                      </div>
                    ) : (
                      isSelected && (
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />
                        </div>
                      )
                    )}
                    {opcao.emoji && (
                      <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{opcao.emoji}</span>
                    )}
                    <span style={{ flex: 1, fontSize: '15px', color: '#111', fontWeight: 500, lineHeight: 1.4 }}>
                      {opcao.texto}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTINUE BUTTON (only for múltipla) ───────────────────────────── */}
      {phase === 'quiz' && isMultipla && hasSelection && (
        <div style={{
          ...continueBtnPos,
          display: 'flex', justifyContent: 'center',
          padding: '12px 24px 28px',
          background: 'linear-gradient(to top, #fff 60%, transparent)',
          animation: 'slideUp 200ms ease-out',
        }}>
          <button onClick={onContinue} style={{
            width: '100%', maxWidth: '432px', padding: '16px',
            borderRadius: '12px', border: 'none',
            background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
          >
            Continuar ({selectedOpcoes.length} selecionada{selectedOpcoes.length !== 1 ? 's' : ''}) →
          </button>
        </div>
      )}

      {/* ── APROVADO FORM ──────────────────────────────────────────────────── */}
      {phase === 'aprovado_form' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>{quiz.emoji_aprovado || '🎉'}</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              {quiz.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '999px', background: '#d1fae5', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Perfil verificado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '999px', background: hexRgba(primary, 0.1), color: primary, fontSize: '12px', fontWeight: 700 }}>
                ✨ Pronta para começar
              </span>
            </div>
          </div>
          <button onClick={onGoToColeta} style={{
            width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
            background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '-0.01em',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
          >
            Preencher meus dados →
          </button>
        </div>
      )}

      {/* ── COLETA ─────────────────────────────────────────────────────────── */}
      {phase === 'coleta' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          {!isPreview && (
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                Preencha seus dados para concluir o cadastro.
              </p>
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {coletaConfig.map(cfg => {
                  const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
                  const val = fieldValues[cfg.campo] ?? '';
                  const autoCompleteMap: Record<string, string> = { nome: 'name', whatsapp: 'tel', cidade: 'address-level2' };
                  return (
                    <div key={cfg.campo}>
                      <label style={lblS}>
                        {cfg.label}{' '}
                        <span style={{ fontWeight: 400, color: '#9ca3af' }}>
                          {cfg.obrigatorio ? '*' : '(opcional)'}
                        </span>
                      </label>
                      <input
                        type={cfg.campo === 'whatsapp' ? 'tel' : 'text'}
                        value={val}
                        onChange={e => {
                          if (cfg.campo === 'nome') onNomeChange?.(e.target.value);
                          else if (cfg.campo === 'whatsapp') onWhatsappChange?.(maskWhatsapp(e.target.value));
                          else if (cfg.campo === 'cidade') onCidadeChange?.(e.target.value);
                          else if (cfg.campo === 'instagram') onInstagramChange?.(e.target.value);
                        }}
                        placeholder={cfg.placeholder}
                        autoComplete={autoCompleteMap[cfg.campo]}
                        inputMode={cfg.campo === 'whatsapp' ? 'numeric' : undefined}
                        style={inpS}
                        onFocus={e => { e.currentTarget.style.borderColor = '#111'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                      />
                    </div>
                  );
                })}
                <button type="submit" disabled={submitting || !canSubmit} style={{
                  width: '100%', padding: '16px', marginTop: '4px', borderRadius: '12px', border: 'none',
                  background: !canSubmit || submitting ? '#9ca3af' : btnColor,
                  color: '#fff', fontSize: '15px', fontWeight: 700,
                  cursor: (!canSubmit || submitting) ? 'default' : 'pointer',
                }}>
                  {submitting ? 'Enviando...' : 'Enviar meus dados →'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                  ⏰ Responda em até 24h para garantir sua vaga
                </p>
              </form>
            </div>
          )}
          {isPreview && (
            <div style={{ padding: '0 0 20px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px', textAlign: 'center', lineHeight: 1.6 }}>
                Preencha seus dados para concluir o cadastro.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {coletaConfig.map(cfg => (
                  <div key={cfg.campo}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      {cfg.label}
                      {cfg.obrigatorio
                        ? <span style={{ color: '#ef4444' }}> *</span>
                        : <span style={{ color: '#9ca3af' }}> (opcional)</span>}
                    </label>
                    <div style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#9ca3af', background: '#f9fafb' }}>
                      {cfg.placeholder}
                    </div>
                  </div>
                ))}
                <div style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '14px', fontWeight: 700, textAlign: 'center', marginTop: '4px' }}>
                  Enviar meus dados →
                </div>
                <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                  ⏰ Responda em até 24h para garantir sua vaga
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUCESSO ────────────────────────────────────────────────────────── */}
      {phase === 'sucesso' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check style={{ width: '36px', height: '36px', color: '#059669', strokeWidth: 2.5 }} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: '0 0 8px' }}>Cadastro realizado!</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Você será redirecionada para o WhatsApp em instantes...</p>
        </div>
      )}

      {/* ── REPROVADO ──────────────────────────────────────────────────────── */}
      {phase === 'reprovado' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '16px' }}>{quiz.emoji_reprovado || '🌱'}</div>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, marginBottom: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Perfil em desenvolvimento
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', lineHeight: 1.4, margin: '0 0 20px' }}>
              {quiz.mensagem_reprovado || 'Obrigada pela participação!'}
            </h2>
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px 20px', textAlign: 'left', border: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>O que você pode fazer agora</p>
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
  );
}

const lblS: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};
const inpS: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb',
  fontSize: '15px', color: '#111', outline: 'none', transition: 'all 150ms ease-out', background: '#fff',
};
