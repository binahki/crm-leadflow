const fs = require('fs');
const p = 'src/pages/Campanhas.tsx';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('  async function marcarCampanhaCriada() {');
const end = s.indexOf('\n\n  return (', start);
if (start < 0 || end < 0) throw new Error('function markers not found');
const fn = [
'  async function concluirCampanhaMestre(ignorado = false) {',
'    if (!campanhaMestre) return;',
'    const executada = {',
"      tipo: 'criar_campanha',",
'      ok: true,',
'      automatico: false,',
'      aprovado: !ignorado,',
'      ignorado,',
'      campanha_base: campanhaMestre.campanha_base,',
'      campanha_base_id: campanhaMestre.campanha_base_id,',
'      publico: campanhaMestre.publico,',
'      criativo: campanhaMestre.criativo,',
'      budget_diario_sugerido: campanhaMestre.budget_diario_sugerido,',
'      motivo: campanhaMestre.motivo,',
'      executado_em: new Date().toISOString(),',
'    };',
'    const novasExecutadas = [...(log.acoes_executadas || []), executada];',
"    const novoStatus = sugestoes.length === 0 ? (ignorado ? 'ignorado' : 'executado') : log.status;",
'    const updated = { ...log, campanha_mestre: null, acoes_executadas: novasExecutadas, status: novoStatus };',
'    try {',
'      const { error } = await (supabase as any)',
"        .from('ai_optimization_logs')",
'        .update({ campanha_mestre: null, acoes_executadas: novasExecutadas, status: novoStatus })',
"        .eq('id', log.id);",
'      if (error) throw error;',
'      onLogUpdate?.(updated);',
"      setToast?.({ msg: ignorado ? 'Sugestão de campanha ignorada' : 'Sugestão de campanha marcada como criada', ok: true });",
'      setTimeout(() => setToast?.(null), 3500);',
'    } catch {',
"      setToast?.({ msg: 'Não consegui fechar essa sugestão agora', ok: false });",
'    }',
'  }',
'',
'  async function marcarCampanhaCriada() {',
'    await concluirCampanhaMestre(false);',
'  }',
'',
'  async function ignorarCampanhaMestre() {',
'    await concluirCampanhaMestre(true);',
'  }'
].join('\n');
s = s.slice(0, start) + fn + s.slice(end);
s = s.replace(/\s*<>\r?\n\s*<div style=\{\{ height: '1px', background: border \}\} \/>/, "\n              <div style={{ order: 9, display: 'grid', gap: '12px' }}>\n                <div style={{ height: '1px', background: border }} />");
s = s.replace(/\s*<\/>\r?\n\s*\)}/, "\n              </div>\n            )}");
const oldButton = `                      <button
                        onClick={() => window.open('https://adsmanager.facebook.com/adsmanager/manage/campaigns', '_blank', 'noopener,noreferrer')}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '34px', borderRadius: '10px', border: 'none', background: '#111827', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <ExternalLink size={14} />
                        Abrir Meta
                      </button>`;
const newButton = `                      <button
                        onClick={ignorarCampanhaMestre}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '34px', borderRadius: '10px', border: \`1px solid \${border}\`, background: 'transparent', color: txtMid, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Ignorar
                      </button>`;
s = s.replace(oldButton, newButton);
fs.writeFileSync(p, s, 'utf8');
console.log('updated');

