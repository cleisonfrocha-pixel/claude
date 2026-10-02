// Bens, dívidas ligadas e aviso de patrimônio incompleto. Puro (CLAUDE.md).
// Um bem financiado (carro) tem DOIS lados: o que vale e o que ainda se deve
// por ele. O patrimônio líquido já desconta a dívida uma vez, no total; o
// líquido do bem é só a leitura item a item e nunca é somado de novo.

import { calcularSaldoAtual, statusDivida } from "./dividas.js";

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** Valor, dívida ligada, líquido e custos mensais de um bem. */
export function leituraDoBem(ativo, dividas, recorrencias) {
  const valorCentavos = Number(ativo.valorAtualCentavos) || 0;
  const divida = ativo.dividaId ? (dividas || []).find((d) => d.id === ativo.dividaId) : null;
  const dividaCentavos = divida && statusDivida(divida, "9999-12-31") !== "quitada" ? calcularSaldoAtual(divida) : 0;
  const custos = (recorrencias || []).filter((r) => r.ativoId === ativo.id && r.ativa !== false && r.tipo !== "receita");
  const custosMensaisCentavos = custos.reduce((s, r) => s + (Number(r.valorEstimadoCentavos) || 0), 0);
  return {
    valorCentavos,
    dividaCentavos,
    dividaNome: divida ? divida.nome : null,
    liquidoCentavos: valorCentavos - dividaCentavos,
    custosMensaisCentavos,
    custos: custos.map((r) => ({ id: r.id, descricao: r.descricao, valorCentavos: Number(r.valorEstimadoCentavos) || 0 })),
  };
}

/** Dívidas em duas listas: as que têm acordo (parcela combinada, andando) e
 * as negativadas ou sem acordo, que não quitam sozinhas. Quitadas ficam de
 * fora. Cada lista traz o total que ela pesa. */
export function separarDividas(dividas, hoje) {
  const ativas = (dividas || []).filter((d) => statusDivida(d, hoje) !== "quitada");
  const semAcordo = (d) => d.negativada || !((Number(d.valorParcelaCentavos) || 0) > 0);
  const comAcordo = ativas.filter((d) => !semAcordo(d));
  const negativadas = ativas.filter(semAcordo);
  const soma = (l) => l.reduce((s, d) => s + calcularSaldoAtual(d), 0);
  return {
    comAcordo, negativadas,
    totalComAcordoCentavos: soma(comAcordo),
    totalNegativadasCentavos: soma(negativadas),
    parcelasMesCentavos: comAcordo.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0),
  };
}

/** Quando o patrimônio líquido não reflete a vida inteira: dívida contada sem
 * nenhum bem do outro lado, bem sem valor ou avaliação muito antiga. */
export function avisoPatrimonioIncompleto({ ativos, dividas, hoje }) {
  const motivos = [];
  const lista = ativos || [];
  const temDivida = (dividas || []).some((d) => statusDivida(d, hoje) !== "quitada");
  if (!lista.length) {
    motivos.push(temDivida
      ? "Nenhum bem cadastrado: o patrimônio mostra só as dívidas, como se você não tivesse nada. Cadastre carro, imóvel, investimentos e equipamentos."
      : "Nenhum bem cadastrado ainda.");
  }
  for (const a of lista) {
    if (!(Number(a.valorAtualCentavos) > 0)) motivos.push(`${a.nome} está sem valor.`);
    else if (a.dataAvaliacao && diasEntre(a.dataAvaliacao, hoje) > 365) motivos.push(`${a.nome} foi avaliado há mais de 1 ano.`);
  }
  return motivos.length ? { incompleto: true, motivos } : null;
}
