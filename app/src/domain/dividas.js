// Domínio puro: dívidas e plano de saída (§11). A central mostra não só o
// saldo devido, mas a pressão que cada dívida exerce sobre o fluxo mensal.
//
// Saldo atual e status (ativa/atrasada/quitada) nunca são gravados — são
// sempre calculados a partir do saldo original e das parcelas pagas (regra
// "nada de total gravado" do CLAUDE.md). "Comprometimento mensal da renda"
// (bullet do blueprint) só divide de verdade pela renda a partir da Fase 8
// (§12, Renda) — até lá, mostra o comprometimento mensal em centavos.

import { somarMeses, competenciaDeData, dataDeCompetencia } from "./tempo.js";

export const STATUS_DIVIDA = ["ativa", "atrasada", "quitada"];

/** Saldo devido agora — original menos o que já foi pago pelas parcelas. */
export function calcularSaldoAtual(divida) {
  const pago = (Number(divida.parcelasPagas) || 0) * (Number(divida.valorParcelaCentavos) || 0);
  return Math.max(0, (Number(divida.saldoOriginalCentavos) || 0) - pago);
}

export function parcelasRestantes(divida) {
  return Math.max(0, (Number(divida.quantidadeParcelas) || 0) - (Number(divida.parcelasPagas) || 0));
}

/** Data de vencimento da parcela de índice `indice` (0 = primeira),
 * contando a partir de `dataInicio` — mesmo padrão de rolagem de mês que
 * `dataVencimentoFatura` usa para cartões (o dia se mantém, o mês rola). */
function dataDaParcela(divida, indice) {
  if (!divida.dataInicio) return null;
  const dia = Number(divida.dataInicio.slice(8, 10));
  const competencia = somarMeses(competenciaDeData(divida.dataInicio), indice);
  return dataDeCompetencia(competencia, dia);
}

/** A data em que a PRÓXIMA parcela (a primeira ainda não paga) vence. */
export function dataProximoVencimento(divida) {
  if (parcelasRestantes(divida) <= 0) return null;
  return dataDaParcela(divida, Number(divida.parcelasPagas) || 0);
}

/** A data da ÚLTIMA parcela — quando a dívida quita, sem nenhum aporte extra. */
export function dataEstimadaQuitacao(divida) {
  const total = Number(divida.quantidadeParcelas) || 0;
  if (total <= 0) return null;
  return dataDaParcela(divida, total - 1);
}

/** Status sempre derivado na leitura: quitada (nada mais a pagar), atrasada
 * (a próxima parcela já devia ter vencido), ou ativa. */
export function statusDivida(divida, hoje) {
  if (parcelasRestantes(divida) <= 0) return "quitada";
  const proximo = dataProximoVencimento(divida);
  if (proximo && hoje && proximo < hoje) return "atrasada";
  return "ativa";
}

/** Visão consolidada de todas as dívidas — cada número somado na leitura a
 * partir das dívidas individuais, nenhum total gravado. */
export function calcularVisaoConsolidada(dividas, hoje) {
  const todas = dividas || [];
  const ativas = todas.filter((d) => statusDivida(d, hoje) !== "quitada");
  const atrasadas = ativas.filter((d) => statusDivida(d, hoje) === "atrasada");
  const emRisco = ativas.filter((d) => d.emRisco);

  const saldoTotalAtualCentavos = ativas.reduce((s, d) => s + calcularSaldoAtual(d), 0);
  const saldoTotalOriginalCentavos = todas.reduce((s, d) => s + (Number(d.saldoOriginalCentavos) || 0), 0);
  const comprometimentoMensalCentavos = ativas.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0);

  const datasQuitacao = ativas.map((d) => dataEstimadaQuitacao(d)).filter(Boolean).sort();
  const dataQuitacaoTotal = datasQuitacao.length ? datasQuitacao[datasQuitacao.length - 1] : null;

  return {
    quantidadeAtivas: ativas.length,
    quantidadeAtrasadas: atrasadas.length,
    quantidadeEmRisco: emRisco.length,
    saldoTotalAtualCentavos,
    saldoTotalOriginalCentavos,
    comprometimentoMensalCentavos,
    dataQuitacaoTotal,
  };
}
