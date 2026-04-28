import { useState } from 'react';
import { Check } from 'lucide-react';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export const MOTIVOS_REPROVACAO = [
  'Sem retorno',
  'Fora de SP',
  'Nome sujo',
  'Sem reserva',
  'Não compareceu à reunião',
  'Desistiu',
  'Outro',
];

interface MotivoModalProps {
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  dark: boolean;
  initialValue?: string;
}

export function MotivoModal({ onConfirm, onCancel, dark, initialValue }: MotivoModalProps) {
  const isCustom = initialValue && !MOTIVOS_REPROVACAO.includes(initialValue);
  const [selected, setSelected] = useState(isCustom ? 'Outro' : (initialValue || ''));
  const [outro, setOutro] = useState(isCustom ? initialValue : '');

  const motivo = selected === 'Outro' ? outro.trim() : selected;

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }} onClick={onCancel} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:101, background:dark?'#111113':'#fff', borderRadius:'18px', padding:'24px', width:'90%', maxWidth:'360px', boxShadow:dark?'0 24px 60px rgba(0,0,0,0.6)':'0 24px 60px rgba(0,0,0,0.15)', fontFamily:FONT, animation:'ld-up 0.2s cubic-bezier(0.32,0.72,0,1)' }}>
        
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(239,68,68,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:'18px' }}>❌</span>
          </div>
          <div>
            <h3 style={{ margin:0, fontSize:'15px', fontWeight:600, color:dark?'#fff':'#111827', fontFamily:FONT }}>Motivo da reprovação</h3>
            <p style={{ margin:0, fontSize:'12px', color:dark?'#71717a':'#9ca3af', fontFamily:FONT }}>Selecione o motivo para registrar</p>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
          {MOTIVOS_REPROVACAO.map(m => (
            <button key={m} onClick={() => setSelected(m)} style={{
              width:'100%', textAlign:'left', padding:'10px 12px', borderRadius:'10px',
              border:`1px solid ${selected===m?'#ef4444':(dark?'#1e1e22':'#e5e7eb')}`,
              background: selected===m?(dark?'rgba(239,68,68,0.1)':'#fff1f2'):(dark?'rgba(255,255,255,0.02)':'#f9fafb'),
              color: selected===m?'#ef4444':(dark?'#d4d4d8':'#374151'),
              fontSize:'13px', fontWeight:selected===m?600:400, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              transition:'all 0.15s', fontFamily:FONT,
            }}>
              {m}
              {selected===m && <Check style={{ width:'14px', height:'14px', color:'#ef4444', flexShrink:0 }} />}
            </button>
          ))}
        </div>

        {selected === 'Outro' && (
          <input
            autoFocus
            placeholder="Descreva o motivo..."
            value={outro}
            onChange={e => setOutro(e.target.value)}
            style={{ width:'100%', padding:'10px 12px', borderRadius:'10px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#1a1a1e':'#f9fafb', color:dark?'#f4f4f5':'#111827', fontSize:'13px', outline:'none', fontFamily:FONT, marginBottom:'12px', boxSizing:'border-box' }}
          />
        )}

        <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
          <button onClick={onCancel} style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:'transparent', color:dark?'#a1a1aa':'#6b7280', fontSize:'13px', cursor:'pointer', fontFamily:FONT }}>
            Cancelar
          </button>
          <button onClick={() => motivo && onConfirm(motivo)} disabled={!motivo} style={{ flex:1, padding:'10px', borderRadius:'10px', border:'none', background:motivo?'#ef4444':(dark?'#27272a':'#e5e7eb'), color:motivo?'#fff':(dark?'#52525b':'#9ca3af'), fontSize:'13px', fontWeight:600, cursor:motivo?'pointer':'default', fontFamily:FONT, transition:'all 0.15s' }}>
            Confirmar
          </button>
        </div>
      </div>
      <style>{`
        @keyframes ld-up { from{opacity:0;transform:translate(-50%,-48%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </>
  );
}
