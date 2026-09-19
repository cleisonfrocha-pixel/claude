// Domínio puro: visão de cartão (§5). Cartões precisam ser tratados como
// fonte de obrigações futuras, não só como uma fatura mensal — por isso
// "utilizado" aqui é o compromisso inteiro ainda não pago (inclusive
// parcelas que só vão fechar fatura daqui a meses), não só o que já está
// na fatura corrente.

import { dataDeCompetencia } from "./tempo.js";
import { dataVencimentoFatura } from "./transacoes.js";

/** A partir de que valor de utilização o cartão entra em alerta.
 * §5 pede "destacar aproximação de limite" — dois degraus: atenção e
 * crítico. "Aumento anormal de utilização" (comparado ao padrão histórico)
 * é §17, Anomalias — Fase 10, não aqui: esta fase não tem histórico
 * suficiente para julgar o que é "anormal". */
export const LIMIAR_ATENCAO_PCT = 70;
export const LIMIAR_CRITICO_PCT = 90;

/** Data em que a fatura de uma competência fecha — depois disso, novas
 * compras não entram mais nela (viram a fatura do mês seguinte). */
export function dataFechamentoFatura(cartao, competenciaDaFatura) {
  return dataDeCompetencia(competenciaDaFatura, cartao.diaFechamento);
}

/** Verdadeiro quando a fatura já passou do fechamento — não aceita mais
 * compra nova (mas parcelas já lançadas continuam valendo). */
export function faturaFechada(cartao, fatura, hoje) {
  return hoje > dataFechamentoFatura(cartao, fatura.competencia);
}

/**
 * A visão completa de um cartão: limite, utilizado (todo compromisso ainda
 * não pago, incluindo parcelas futuras — "comprometimento futuro" do §5),
 * disponível, nível de alerta, a fatura atual (a mais próxima — aberta e
 * ainda aceitando compra, ou já fechada esperando pagamento) e próxima, e
 * o restante como compromisso futuro (parcelas mais à frente).
 *
 * `faturasDoCartao` precisa vir com `id` embutido (para cruzar com
 * `transacao.faturaId`) — mesma exigência de domain/caixa.js.
 */
export function calcularVisaoCartao({ cartao, transacoesDoCartao, faturasDoCartao, hoje }) {
  const totalPorFatura = new Map();
  for (const t of transacoesDoCartao || []) {
    if (!t.faturaId) continue;
    totalPorFatura.set(t.faturaId, (totalPorFatura.get(t.faturaId) || 0) + (Number(t.valorCentavos) || 0));
  }

  const emAberto = (faturasDoCartao || [])
    .filter((f) => f.status !== "paga")
    .map((f) => ({
      ...f,
      totalCentavos: totalPorFatura.get(f.id) || 0,
      vencimento: dataVencimentoFatura(cartao, f.competencia),
      fechada: faturaFechada(cartao, f, hoje),
    }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia));

  const utilizadoCentavos = emAberto.reduce((s, f) => s + f.totalCentavos, 0);
  const limiteTotalCentavos = Number(cartao.limiteTotalCentavos) || 0;
  const disponivelCentavos = limiteTotalCentavos - utilizadoCentavos;
  const percentualUtilizado = limiteTotalCentavos > 0
    ? Math.max(0, (utilizadoCentavos / limiteTotalCentavos) * 100)
    : 0;

  let nivelAlerta = "normal";
  if (percentualUtilizado >= LIMIAR_CRITICO_PCT) nivelAlerta = "critico";
  else if (percentualUtilizado >= LIMIAR_ATENCAO_PCT) nivelAlerta = "atencao";

  const [faturaAtual = null, proximaFatura = null, ...comprometimentoFuturo] = emAberto;

  return {
    limiteTotalCentavos, utilizadoCentavos, disponivelCentavos, percentualUtilizado, nivelAlerta,
    faturaAtual, proximaFatura, comprometimentoFuturo,
  };
}
