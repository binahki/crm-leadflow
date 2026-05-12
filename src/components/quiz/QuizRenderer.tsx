import React from 'react';
import { Check } from 'lucide-react';

// ── Shared types ─────────────────────────────────────────────────────────────
export interface QuizConfig {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; logo_url: string | null;
  capa_titulo?: string | null; capa_subtitulo?: string | null;
  capa_imagem_url?: string | null; capa_beneficios?: string[] | null;
  capa_botao_texto?: string | null; coleta_campos?: string[] | null;
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
export type Phase = 'loading' | 'capa' | 'quiz' | 'aprovado_form' | 'reprovado' | 'sucesso' | 'not_found';

export interface QuizRendererProps {
  quiz: QuizConfig;
  blocos: Bloco[];
  phase: Phase;
  currentPergunta: Pergunta | null;
  currentBloco?: Bloco | null;
  currentIdx: number;
  totalVisible: number;
  selectedOpcao: string | null;
  questionKey?: number;
  // Form
  coleta?: string[];
  nome?: string; whatsapp?: string; cidade?: string; instagram?: string;
  submitting?: boolean; canSubmit?: boolean;
  // Callbacks
  onStart?: () => void;
  onOpcaoClick?: (perg: Pergunta, opcao: Opcao) => void;
  onContinue?: () => void;
  onNomeChange?: (v: string) => void;
  onWhatsappChange?: (v: string) => void;
  onCidadeChange?: (v: string) => void;
  onInstagramChange?: (v: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  // Mode
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
  for (const [key, emoji] of Object.entries(map)) {
    if (t.includes(key)) return emoji;
  }
  return '📝';
}

// ── Component ─────────────────────────────────────────────────────────────────
export function QuizRenderer({
  quiz, phase, currentPergunta, currentBloco,
  currentIdx, totalVisible, selectedOpcao, questionKey = 0,
  coleta, nome = '', whatsapp = '', cidade = '', instagram = '',
  submitting = false, canSubmit = false,
  onStart, onOpcaoClick, onContinue,
  onNomeChange, onWhatsappChange, onCidadeChange, onInstagramChange, onSubmit,
  isPreview = false,
}: QuizRendererProps) {
  const primary = quiz.cor_primaria || '#2563eb';
  const coletaCampos = coleta || (quiz.coleta_campos as string[] | null) || ['nome', 'whatsapp', 'cidade', 'instagram'];
  const progress = totalVisible > 0 ? Math.round((currentIdx / totalVisible) * 100) : 0;
  const isMultipla = currentPergunta?.tipo_resposta === 'multipla';

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerEl = (
    <div style={{
      ...(isPreview
        ? { position: 'relative' }
        : { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }),
      background: '#fff', borderBottom: '1px solid #f3f4f6',
    }}>
      <div style={{ padding: '14px 24px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {quiz.logo_url ? (
          <img src={quiz.logo_url} alt={quiz.titulo}
            style={{ maxHeight: '32px', maxWidth: '120px', objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>{quiz.titulo}</span>
        )}
      </div>
      <div style={{ height: '10px', background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: primary,
          width: `${phase === 'capa' ? 0 : phase === 'quiz' ? Math.max(progress, 2) : 100}%`,
          borderRadius: '0 99px 99px 0', transition: 'width 500ms ease-out',
        }} />
      </div>
      {phase === 'quiz' && (
        <div style={{ padding: '3px 0 2px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
            Pergunta {currentIdx + 1} de {totalVisible}
          </span>
        </div>
      )}
      <div style={{ height: phase === 'quiz' ? '2px' : '4px' }} />
    </div>
  );

  // ── Spacer for fixed header (public quiz only) ───────────────────────────
  const spacerEl = !isPreview && (
    <div style={{ height: phase === 'quiz' ? '90px' : '74px' }} />
  );

  // ── Continue button wrapper ──────────────────────────────────────────────
  const continueBtn = phase === 'quiz' && selectedOpcao && isMultipla && (
    <div style={{
      ...(isPreview
        ? { padding: '12px 24px 20px' }
        : { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, padding: '12px 24px 28px' }),
      display: 'flex', justifyContent: 'center',
      background: 'linear-gradient(to top, #fff 60%, transparent)',
      animation: 'slideUp 200ms ease-out',
    }}>
      <button
        onClick={onContinue}
        style={{
          width: '100%', maxWidth: '432px', padding: '16px',
          borderRadius: '12px', border: 'none',
          background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
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
  );

  return (
    <div style={{
      minHeight: isPreview ? '100%' : '100vh',
      background: '#fff',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform:rotate(360deg); } }
        *{box-sizing:border-box;}
        input,textarea,button,select{font-family:inherit;}
      `}</style>

      {headerEl}
      {spacerEl}

      {/* ── CAPA ────────────────────────────────────────────────────────────── */}
      {phase === 'capa' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 80px', animation: 'fadeIn 0.35s ease' }}>
          {quiz.capa_imagem_url && (
            <img src={quiz.capa_imagem_url} alt=""
              style={{ width: '100%', borderRadius: '16px', marginBottom: '24px', objectFit: 'cover', maxHeight: '220px' }} />
          )}
          <h1 style={{
            fontSize: '28px', fontWeight: 800, color: '#111', lineHeight: 1.15,
            margin: '0 0 10px', letterSpacing: '-0.03em', textAlign: 'center',
          }}>
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
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', background: primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
                  }}>
                    <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                  </div>
                  <span style={{ fontSize: '15px', color: '#374151', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onStart}
            style={{
              width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
              background: '#111', color: '#fff', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '-0.01em',
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
            {quiz.capa_botao_texto || 'Clique para iniciar →'}
          </button>
        </div>
      )}

      {/* ── QUIZ ─────────────────────────────────────────────────────────────── */}
      {phase === 'quiz' && currentPergunta && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px 140px' }}>
          <div key={questionKey} style={{ animation: 'slideIn 0.3s ease-out' }}>
            {/* Badge - centered */}
            {currentBloco && (
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 12px 4px 8px', borderRadius: '999px',
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
              </div>
            )}

            {/* Question - centered */}
            <h2 style={{
              fontSize: '22px', fontWeight: 700, color: '#111',
              lineHeight: 1.35, margin: '0 0 8px', textAlign: 'center',
            }}>
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
                const isSelected = selectedOpcao === opcao.id;
                return (
                  <button
                    key={opcao.id}
                    onClick={() => onOpcaoClick?.(currentPergunta, opcao)}
                    disabled={!isMultipla && !!selectedOpcao && !isSelected}
                    style={{
                      width: '100%', padding: '16px 18px', borderRadius: '12px',
                      border: `${isSelected ? '2px' : '1.5px'} solid ${isSelected ? primary : '#e2e8f0'}`,
                      background: isSelected ? hexRgba(primary, 0.08) : '#fff',
                      cursor: (!isMultipla && selectedOpcao && !isSelected) ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      transition: 'all 150ms ease-out', textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected && (!selectedOpcao || isMultipla)) {
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
                    {opcao.emoji && (
                      <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{opcao.emoji}</span>
                    )}
                    <span style={{ flex: 1, fontSize: '15px', color: '#111', fontWeight: 500, lineHeight: 1.4 }}>
                      {opcao.texto}
                    </span>
                    {isSelected && (
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', background: primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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

      {continueBtn}

      {/* ── APROVADO FORM ────────────────────────────────────────────────────── */}
      {phase === 'aprovado_form' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>
              {quiz.emoji_aprovado || '🎉'}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              {quiz.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '999px', background: '#d1fae5', color: '#065f46', fontSize: '12px', fontWeight: 700 }}>
                <Check style={{ width: '11px', height: '11px', strokeWidth: 3 }} /> Perfil verificado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '999px', background: hexRgba(primary, 0.1), color: primary, fontSize: '12px', fontWeight: 700 }}>
                ✨ Pronta para começar
              </span>
            </div>
          </div>

          {!isPreview && (
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px', textAlign: 'center', lineHeight: 1.6 }}>
                Preencha seus dados para concluir o cadastro.
              </p>
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {coletaCampos.includes('nome') && (
                  <div>
                    <label style={lblS}>Nome completo <span style={{ color: '#9ca3af' }}>*</span></label>
                    <input type="text" value={nome} onChange={e => onNomeChange?.(e.target.value)}
                      placeholder="Seu nome completo" autoComplete="name" style={inpS}
                      onFocus={e => { e.currentTarget.style.borderColor = '#111'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }} />
                  </div>
                )}
                {coletaCampos.includes('whatsapp') && (
                  <div>
                    <label style={lblS}>WhatsApp <span style={{ color: '#9ca3af' }}>*</span></label>
                    <input type="tel" value={whatsapp}
                      onChange={e => onWhatsappChange?.(maskWhatsapp(e.target.value))}
                      placeholder="(99) 99999-9999" autoComplete="tel" inputMode="numeric" style={inpS}
                      onFocus={e => { e.currentTarget.style.borderColor = '#111'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }} />
                  </div>
                )}
                {coletaCampos.includes('cidade') && (
                  <div>
                    <label style={lblS}>Cidade <span style={{ color: '#9ca3af' }}>*</span></label>
                    <input type="text" value={cidade} onChange={e => onCidadeChange?.(e.target.value)}
                      placeholder="Sua cidade" autoComplete="address-level2" style={inpS}
                      onFocus={e => { e.currentTarget.style.borderColor = '#111'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }} />
                  </div>
                )}
                {coletaCampos.includes('instagram') && (
                  <div>
                    <label style={lblS}>Instagram <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
                    <input type="text" value={instagram} onChange={e => onInstagramChange?.(e.target.value)}
                      placeholder="@seuperfil" style={inpS}
                      onFocus={e => { e.currentTarget.style.borderColor = '#111'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }} />
                  </div>
                )}
                <button type="submit" disabled={submitting || !canSubmit} style={{
                  width: '100%', padding: '16px', marginTop: '4px', borderRadius: '12px', border: 'none',
                  background: !canSubmit || submitting ? '#9ca3af' : '#111',
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
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Formulário de cadastro aparece aqui</p>
            </div>
          )}
        </div>
      )}

      {/* ── SUCESSO ──────────────────────────────────────────────────────────── */}
      {phase === 'sucesso' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '60px 24px', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check style={{ width: '36px', height: '36px', color: '#059669', strokeWidth: 2.5 }} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111', margin: '0 0 8px' }}>Cadastro realizado!</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Você será redirecionada para o WhatsApp em instantes...</p>
        </div>
      )}

      {/* ── REPROVADO ────────────────────────────────────────────────────────── */}
      {phase === 'reprovado' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '52px', lineHeight: 1, marginBottom: '16px' }}>
              {quiz.emoji_reprovado || '🌱'}
            </div>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, marginBottom: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Perfil em desenvolvimento
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111', lineHeight: 1.4, margin: '0 0 20px' }}>
              {quiz.mensagem_reprovado || 'Obrigada pela participação!'}
            </h2>
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px 20px', textAlign: 'left', border: '1px solid #f0f0f0' }}>
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
  );
}

const lblS: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};
const inpS: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb',
  fontSize: '15px', color: '#111', outline: 'none', transition: 'all 150ms ease-out', background: '#fff',
};
