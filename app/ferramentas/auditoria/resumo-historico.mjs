// Resumo do histórico real para quem vai escrever um plano (skill gerar-plano).
// Uso: node app/ferramentas/auditoria/resumo-historico.mjs <pasta-do-estado> [AAAA-MM-DD] [pessoaId]
// A pasta é a mesma baixada para o subir-painel (uma subpasta por coleção). Só lê; não grava nada.

import fs from "node:fs";
import path from "node:path";
import { montarHistoricoAno, baseRealDoPlano } from "../../src/domain/historicoAno.js";

const [pasta, hojeArg, pessoaId] = process.argv.slice(2);
if (!pasta) { console.error("uso: resumo-historico.mjs <pasta-do-estado> [hoje] [pessoaId]"); process.exit(2); }
const ler = (c) => {
  const d = path.join(pasta, c);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => ({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) })) : [];
};
const base = Object.fromEntries(["transacoes", "categorias", "fontesRenda", "contas"].map((c) => [c, ler(c)]));
const hoje = hojeArg || new Date().toISOString().slice(0, 10);
const h = montarHistoricoAno({ ...base, hoje, pessoaId: pessoaId || null });
const R = (c) => `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
console.log(baseRealDoPlano({ ...base, hoje }).frase);
console.log(`Resultado médio por mês (meses fechados): ${R(h.resultadoMedioCentavos)}`);
if (h.piorMes) console.log(`Pior mês: ${h.piorMes.competencia} ${R(h.piorMes.resultadoCentavos)} | melhor: ${h.melhorMes.competencia} ${R(h.melhorMes.resultadoCentavos)}`);
if (h.tendencia) console.log(`Últimos 3 meses: resultado médio ${R(h.tendencia.resultadoMedioCentavos)} contra ${R(h.tendencia.resultadoAnteriorCentavos)} nos 3 anteriores`);
console.log("\nMês a mês:");
for (const l of h.linhas) console.log(`  ${l.competencia}${l.parcial ? "*" : " "} entrou ${R(l.rendaCentavos)}  saiu ${R(l.saidaCentavos)}  resultado ${R(l.resultadoCentavos)}`);
console.log("  * mês em andamento, fora das médias\n\nFontes de renda (piso = menor mês real):");
for (const f of h.fontes) console.log(`  ${f.nome}: ${f.selo}, piso ${R(f.pisoCentavos)}, média ${R(f.mediaCentavos)} em ${f.baseadoEmMeses} meses`);
console.log(`\nGasto sem classificar: ${Math.round(h.semClassificar.percentual * 100)}% (${R(h.semClassificar.valorCentavos)}, ${h.semClassificar.quantidade} lançamentos)`);
