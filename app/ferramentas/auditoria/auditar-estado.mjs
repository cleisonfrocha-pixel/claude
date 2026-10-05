// Auditoria estrutural do estado do painel (Fase 12, Sprint 9). Só lê.
// Uso: baixe as coleções com o ArtifactData (out_dir) e rode
//   node app/ferramentas/auditoria/auditar-estado.mjs <pasta-do-estado>
// Checa referências quebradas, validade, transferências com pernas inconsistentes,
// duplicatas, faturas sem pagamento, lotes sem registro e o volume. Sai com código 1
// se houver achado ALTA. Não guarda dado pessoal.
import fs from 'node:fs'; import path from 'node:path';
const ler=(dir)=>fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>({...JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),id:f.slice(0,-5)})):[];
const B=(process.argv[2]||'.').replace(/\/?$/,'/');
const E={}; for (const c of ['pessoas','contas','cartoes','categorias','fontesRenda','dividas','ativos','objetivos','recorrencias','faturas','transacoes','lotesImportacao']) E[c]=ler(B+c);
const achados=[]; const A=(sev,area,msg,n=1,ex=[])=>achados.push({sev,area,msg,n,ex:ex.slice(0,4)});
const ids=(c)=>new Set(E[c].map(x=>x.id));
const I={pessoas:ids('pessoas'),contas:ids('contas'),cartoes:ids('cartoes'),categorias:ids('categorias'),fontes:ids('fontesRenda'),dividas:ids('dividas'),faturas:ids('faturas'),recs:ids('recorrencias')};
const esq=await import('../../src/domain/esquema.js');
// 1 referências
const T=E.transacoes;
const quebra=(campo,set,cond=()=>true)=>T.filter(t=>t[campo]&&cond(t)&&!set.has(t[campo]));
for (const [campo,set] of [['contaId',I.contas],['cartaoId',I.cartoes],['categoriaId',I.categorias],['pessoaId',I.pessoas],['faturaId',I.faturas],['fonteRendaId',I.fontes],['dividaId',I.dividas],['recorrenciaId',I.recs]]) {
  const q=quebra(campo,set); if(q.length) A('ALTA','referência',`${q.length} lançamento(s) com ${campo} que não existe`,q.length,q.map(t=>t.id));
}
const semCat=T.filter(t=>['despesa','receita'].includes(t.tipo)&&!t.categoriaId); if(semCat.length) A('MÉDIA','dados',`${semCat.length} despesa/receita sem categoria`,semCat.length,semCat.map(t=>t.descricao));
const semPessoa=T.filter(t=>!t.pessoaId); if(semPessoa.length) A('MÉDIA','dados',`${semPessoa.length} lançamento(s) sem pessoa`,semPessoa.length,semPessoa.map(t=>t.descricao));
for (const f of E.faturas) if(!I.cartoes.has(f.cartaoId)) A('ALTA','referência',`fatura ${f.id} aponta para cartão inexistente`);
for (const c of E.cartoes) if(c.contaPagamentoId&&!I.contas.has(c.contaPagamentoId)) A('ALTA','referência',`cartão ${c.apelido} paga por conta inexistente`);
for (const r of E.recorrencias) { if(r.contaId&&!I.contas.has(r.contaId)||r.categoriaId&&!I.categorias.has(r.categoriaId)) A('ALTA','referência',`recorrência ${r.descricao} com referência quebrada`); }
// 2 validade
let inval=0,exInv=[]; for(const t of T){const e=esq.validarTransacao(t); if(e.length){inval++;exInv.push(t.id+':'+e[0]);}} if(inval) A('ALTA','validade',`${inval} lançamento(s) que o próprio validador do app recusaria`,inval,exInv);
const dataRuim=T.filter(t=>!/^\d{4}-\d{2}-\d{2}$/.test(t.data||'')); if(dataRuim.length) A('ALTA','validade',`${dataRuim.length} data(s) fora do formato`,dataRuim.length);
const compErr=T.filter(t=>!t.cartaoId&&t.competencia&&t.competencia!==(t.data||'').slice(0,7)); if(compErr.length) A('MÉDIA','validade',`${compErr.length} competência diferente do mês da data (fora cartão)`,compErr.length,compErr.map(t=>t.descricao+' '+t.data+' '+t.competencia));
const naoInt=T.filter(t=>!Number.isInteger(t.valorCentavos)); if(naoInt.length) A('ALTA','validade',`${naoInt.length} valor não inteiro`,naoInt.length);
const pagoEmRuim=T.filter(t=>t.pagoEm&&t.status!=='pago'); if(pagoEmRuim.length) A('BAIXA','validade',`${pagoEmRuim.length} com pagoEm mas não pago`,pagoEmRuim.length);
// 3 transferências
const tr=new Map(); for(const t of T) if(t.tipo==='transferencia') (tr.get(t.transferenciaId)||tr.set(t.transferenciaId,[]).get(t.transferenciaId)).push(t);
let trRuim=[]; for(const [k,v] of tr){ const s=v.find(x=>x.direcao==='saida'),e=v.find(x=>x.direcao==='entrada'); if(v.length!==2||!s||!e||s.valorCentavos!==e.valorCentavos||s.contaId===e.contaId||s.data!==e.data) trRuim.push(k); }
if(trRuim.length) A('ALTA','transferência',`${trRuim.length} transferência(s) com pernas inconsistentes`,trRuim.length,trRuim); 
// 4 duplicatas
const grp=new Map(); for(const t of T){ if(t.status==='cancelado')continue; const k=[t.tipo,t.contaId||t.cartaoId,t.data,t.valorCentavos,(t.descricao||'').toLowerCase()].join('|'); (grp.get(k)||grp.set(k,[]).get(k)).push(t); }
const dup=[...grp.values()].filter(v=>v.length>1&&!v.every(x=>x.tipo==='transferencia')); 
if(dup.length) A('MÉDIA','duplicata',`${dup.length} grupo(s) idênticos (mesma conta, data, valor e descrição)`,dup.length,dup.map(v=>v[0].descricao+' '+v[0].data+' x'+v.length));
// 5 faturas
const compras=new Set(T.filter(t=>t.tipo==='despesa'&&t.faturaId).map(t=>t.faturaId));
const pags=T.filter(t=>t.tipo==='pagamento_fatura');
const semPag=E.faturas.filter(f=>f.status==='paga'&&!pags.some(p=>p.faturaId===f.id)); if(semPag.length) A('ALTA','fatura',`${semPag.length} fatura(s) "paga" sem nenhum pagamento`,semPag.length);
const pagSemFat=pags.filter(p=>!p.faturaId); if(pagSemFat.length) A('ALTA','fatura',`${pagSemFat.length} pagamento(s) sem fatura`,pagSemFat.length);
const semDet=E.faturas.filter(f=>!compras.has(f.id)&&pags.some(p=>p.faturaId===f.id)); A('MÉDIA','fatura',`${semDet.length} fatura(s) paga(s) sem nenhuma compra lançada (entram como "sem detalhe": R$ ${(pags.filter(p=>semDet.some(f=>f.id===p.faturaId)).reduce((s,p)=>s+p.valorCentavos,0)/100).toFixed(2)})`,semDet.length);
// 6 lote
const porOrigem={}; for(const t of T) porOrigem[t.origemId]=(porOrigem[t.origemId]||0)+1;
for(const l of E.lotesImportacao) { if(porOrigem[l.id]) console.log('lote',l.id,'docs:',porOrigem[l.id]); }
const orfaos=Object.keys(porOrigem).filter(k=>k!=='null'&&k!=='undefined'&&!E.lotesImportacao.some(l=>l.id===k)&&T.find(t=>t.origemId===k&&t.origem==='chat')); if(orfaos.length) A('MÉDIA','lote',`lançamentos de chat sem registro de lote: ${orfaos.length} origemId`,orfaos.length,orfaos);
// 7 revisão
const naoRev=T.filter(t=>t.revisado===false); A('INFO','revisão',`${naoRev.length} lançamentos "não revisados"`,naoRev.length);
const outros=T.filter(t=>t.categoriaId&&E.categorias.find(c=>c.id===t.categoriaId)?.nome==='Outros'&&t.tipo==='despesa'); A('MÉDIA','classificação',`${outros.length} despesa(s) em "Outros": R$ ${(outros.reduce((s,t)=>s+t.valorCentavos,0)/100).toFixed(2)}`,outros.length);
// 8 datas futuras pagas
const hoje=new Date().toISOString().slice(0,10); const futPago=T.filter(t=>t.status==='pago'&&t.data>hoje&&!t.pagoEm); if(futPago.length) A('MÉDIA','data',`${futPago.length} lançamento(s) pago(s) com data futura`,futPago.length,futPago.map(t=>t.descricao+' '+t.data));
// 9 contagem/tamanho
A('INFO','volume',`transacoes=${T.length}, bytes médios ${Math.round(JSON.stringify(T).length/T.length)}, total ${(JSON.stringify(T).length/1024).toFixed(0)} KB`);
for(const a of achados) console.log(a.sev.padEnd(6),a.area.padEnd(14),a.msg, a.ex.length?JSON.stringify(a.ex):'');

if (achados.some((x) => x.sev === 'ALTA')) process.exit(1);
