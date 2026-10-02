// Fechamento do mês (§21): o que realmente aconteceu, comparado com o mês
// anterior, sem opinar. Puro (CLAUDE.md): tudo calculado na leitura, nada
// gravado. Receita e despesa só contam o que está PAGO; o que ainda estava
// aberto no mês aparece à parte, como "não realizado".

import { calcularCustos, competenciasComDados } from "./orcamento.js";
import { somarMeses } from "./tempo.js";

const ABERTO = new Set(["previsto", "agendado", "atrasado"]);

function receitaPaga(transacoes, competencia) {
  return (transacoes || []).filter((t) => t.tipo === "receita" && t.status === "pago" && t.competencia === competencia)
    .reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
}

function despesaPorCategoria(transacoes, competencia) {
  const m = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const k = t.categoriaId || "sem-categoria";
    m.set(k, (m.get(k) || 0) + (Number(t.valorCentavos) || 0));
  }
  return m;
}

/** Resultado de um mês: renda paga menos custo pago (mesma conta de Renda). */
export function resultadoDoMes(transacoes, categorias, competencia) {
  const receitaCentavos = receitaPaga(transacoes, competencia);
  const despesaCentavos = calcularCustos(transacoes, categorias, competencia).atualCentavos;
  return { competencia, receitaCentavos, despesaCentavos, resultadoCentavos: receitaCentavos - despesaCentavos };
}

export function montarFechamento({ competencia, competenciaAtual, transacoes, categorias, snapshots, decisoes }) {
  const anterior = somarMeses(competencia, -1);
  const atual = resultadoDoMes(transacoes, categorias, competencia);
  const mesAnterior = resultadoDoMes(transacoes, categorias, anterior);
  const temDadosAnterior = competenciasComDados(transacoes).has(anterior);

  const abertos = (transacoes || []).filter((t) => t.competencia === competencia && ABERTO.has(t.status) && (t.tipo === "receita" || t.tipo === "despesa"));
  const naoRealizado = {
    receitaCentavos: abertos.filter((t) => t.tipo === "receita").reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0),
    despesaCentavos: abertos.filter((t) => t.tipo === "despesa").reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0),
    quantidade: abertos.length,
  };

  const nomes = new Map((categorias || []).map((c) => [c.id, c.nome]));
  const agora = despesaPorCategoria(transacoes, competencia);
  const antes = despesaPorCategoria(transacoes, anterior);
  const mudancas = [...new Set([...agora.keys(), ...antes.keys()])].map((k) => ({
    categoriaId: k, nome: nomes.get(k) || "Sem categoria",
    atualCentavos: agora.get(k) || 0, anteriorCentavos: antes.get(k) || 0,
    variacaoCentavos: (agora.get(k) || 0) - (antes.get(k) || 0),
  })).filter((m) => m.variacaoCentavos !== 0)
    .sort((a, b) => Math.abs(b.variacaoCentavos) - Math.abs(a.variacaoCentavos)).slice(0, 4);

  const snapshotDe = (c) => (snapshots || []).find((s) => s.competencia === c) || null;
  const sAtual = snapshotDe(competencia);
  const sAnt = snapshotDe(anterior);
  const patrimonio = sAtual ? {
    liquidoCentavos: sAtual.liquidoCentavos, ativosCentavos: sAtual.ativosCentavos, passivosCentavos: sAtual.passivosCentavos,
    variacaoLiquidoCentavos: sAnt ? sAtual.liquidoCentavos - sAnt.liquidoCentavos : null,
    variacaoDividaCentavos: sAnt ? sAtual.passivosCentavos - sAnt.passivosCentavos : null,
  } : null;

  const decisoesDoMes = (decisoes || []).filter((d) => d.status && d.status !== "pendente" && (d.decididoEm || "").startsWith(competencia));

  const historico = [...competenciasComDados(transacoes)].sort().slice(-6).map((c) => resultadoDoMes(transacoes, categorias, c));

  return {
    competencia, anterior,
    situacao: competencia < competenciaAtual ? "fechado" : "em andamento",
    atual, mesAnterior: temDadosAnterior ? mesAnterior : null,
    variacaoResultadoCentavos: temDadosAnterior ? atual.resultadoCentavos - mesAnterior.resultadoCentavos : null,
    naoRealizado, mudancas, patrimonio, decisoesDoMes, historico,
  };
}
