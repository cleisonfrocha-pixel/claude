// Bens, dívidas ligadas e aviso de patrimônio incompleto. Puro (CLAUDE.md).
// Um bem financiado (carro) tem DOIS lados: o que vale e o que ainda se deve
// por ele. O patrimônio líquido já desconta a dívida uma vez, no total; o
// líquido do bem é só a leitura item a item e nunca é somado de novo.

import { calcularSaldoAtual, statusDivida, classificarDivida, parcelasRestantes, dataEstimadaQuitacao } from "./dividas.js";

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
    parcelasRestantes: divida ? parcelasRestantes(divida) : 0,
    parcelaCentavos: divida ? Number(divida.valorParcelaCentavos) || 0 : 0,
    quitacao: divida ? dataEstimadaQuitacao(divida) : null,
    dividaNome: divida ? divida.nome : null,
    liquidoCentavos: valorCentavos - dividaCentavos,
    custosMensaisCentavos,
    custos: custos.map((r) => ({ id: r.id, descricao: r.descricao, valorCentavos: Number(r.valorEstimadoCentavos) || 0 })),
  };
}

/** Dívidas em três grupos. "Dívidas": o que está atrasado, negativado, sem
 * acordo ou em risco, o que realmente suja o nome. "Financiamentos em dia":
 * parcelado com acordo e pago certinho, que é compromisso mensal, não
 * alarme. "Quitadas" ficam de fora dos totais. Cada grupo traz o que pesa. */
export function separarDividas(dividas, hoje) {
  const todas = dividas || [];
  const grupo = (g) => todas.filter((d) => classificarDivida(d, hoje) === g);
  const problemas = grupo("divida");
  const financiamentos = grupo("financiamento");
  const quitadas = grupo("quitada");
  const soma = (l) => l.reduce((s, d) => s + calcularSaldoAtual(d), 0);
  const parcelas = (l) => l.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0);
  return {
    problemas, financiamentos, quitadas,
    totalProblemasCentavos: soma(problemas),
    totalFinanciamentosCentavos: soma(financiamentos),
    parcelasProblemasCentavos: parcelas(problemas),
    parcelasFinanciamentosCentavos: parcelas(financiamentos),
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
