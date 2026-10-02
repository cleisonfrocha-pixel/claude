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

/** Qual fatura em aberto um pagamento feito em `dataPagamento` quita: a
 * mais recente que JÁ FECHOU até essa data (é ela que está vencendo). Só
 * se nenhuma fechou ainda (pagamento adiantado), a mais antiga em aberto.
 * Escolher pela competência do mês do pagamento erra em cartão que fecha
 * no fim do mês e vence no começo do seguinte (fecha 25, vence 5): o
 * pagamento de 5/8 é da fatura de julho, não da de agosto. */
export function faturaParaPagamento(cartao, faturasEmAberto, dataPagamento) {
  const ordenadas = [...(faturasEmAberto || [])].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const fechadas = ordenadas.filter((f) => dataFechamentoFatura(cartao, f.competencia) <= dataPagamento);
  return fechadas.length ? fechadas[fechadas.length - 1] : ordenadas[0] || null;
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

// ---- fatura lançada em resumo x compras detalhadas ----
// Enquanto a pessoa não tem o extrato do cartão, a fatura entra como UM
// lançamento resumido ("Compras até o fechamento…"). Quando as compras de
// verdade chegam, somar as duas coisas conta o mesmo dinheiro duas vezes
// (CLAUDE.md: compra no cartão ≠ pagamento da fatura; nada de contar em dobro).
// Em vez de adivinhar, o painel avisa e deixa cancelar o resumo com um toque.

export const PADRAO_RESUMO_FATURA = /^compras (até o fechamento|previstas)/i;

export function ehResumoDeFatura(t) {
  return !!t.resumoDeFatura || PADRAO_RESUMO_FATURA.test(t.descricao || "");
}

/** Faturas que têm resumo E compras detalhadas ao mesmo tempo. `transacoes`
 * precisa trazer `id`. Cancelado não conta. */
export function faturasContadasEmDobro(transacoes) {
  const porFatura = new Map();
  for (const t of transacoes || []) {
    if (!t.faturaId || t.tipo !== "despesa" || t.status === "cancelado") continue;
    if (!porFatura.has(t.faturaId)) porFatura.set(t.faturaId, { faturaId: t.faturaId, cartaoId: t.cartaoId || null, resumos: [], resumoCentavos: 0, detalhadoCentavos: 0 });
    const f = porFatura.get(t.faturaId);
    const v = Number(t.valorCentavos) || 0;
    if (ehResumoDeFatura(t)) { f.resumos.push(t.id); f.resumoCentavos += v; } else f.detalhadoCentavos += v;
  }
  return [...porFatura.values()].filter((f) => f.resumos.length && f.detalhadoCentavos > 0);
}
