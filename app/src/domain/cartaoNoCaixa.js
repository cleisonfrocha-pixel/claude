// O cartão como ferramenta de caixa. Compra no cartão já é compromisso (reduz o
// limite e entra numa fatura), mas o dinheiro só sai da conta no dia em que a
// fatura é paga. Cartão nunca é renda: aqui o limite livre e o saldo da conta
// aparecem lado a lado e jamais somados. Puro (CLAUDE.md).

import { calcularVisaoCartao } from "./cartoes.js";
import { competenciaFatura, dataPagamentoPrevisto, dataVencimentoFatura } from "./transacoes.js";

/** Menor saldo da trilha a partir de uma data (inclusive). null se a trilha não chega lá. */
function menorSaldoDesde(pontos, data) {
  const dep = (pontos || []).filter((p) => p.data >= data);
  return dep.length ? Math.min(...dep.map((p) => p.saldoCentavos)) : null;
}

/**
 * Para cada cartão ativo: limite livre, o que já está na próxima fatura, quando
 * ela sai da conta, se o caixa cobre naquele dia, e quanto ainda cabe comprar
 * agora sem faltar dinheiro no dia da fatura.
 *
 * `pontos`: trilha diária de saldo (calcularClarezaDeCaixa().pontos).
 * `naContaCentavos`: saldo de hoje, usado quando a fatura sai depois do horizonte.
 */
export function cartoesNoCaixa({ cartoes, faturas, transacoes, pontos, naContaCentavos = 0, hoje }) {
  return (cartoes || []).filter((c) => c.status !== "inativo" && c.status !== "cancelado").map((cartao) => {
    const faturasDele = (faturas || []).filter((f) => f.cartaoId === cartao.id);
    const visao = calcularVisaoCartao({ cartao, transacoesDoCartao: (transacoes || []).filter((t) => t.cartaoId === cartao.id), faturasDoCartao: faturasDele, hoje });

    // Uma compra feita hoje cai nesta fatura:
    const competenciaDaCompra = competenciaFatura(cartao, hoje);
    const faturaDaCompra = visao.faturaAtual && [visao.faturaAtual, visao.proximaFatura, ...visao.comprometimentoFuturo].filter(Boolean).find((f) => f.competencia === competenciaDaCompra);
    const saiEm = dataPagamentoPrevisto(cartao, competenciaDaCompra);
    const vence = dataVencimentoFatura(cartao, competenciaDaCompra);
    const jaNaFaturaCentavos = faturaDaCompra ? faturaDaCompra.totalCentavos : 0;

    const folgaNoDia = menorSaldoDesde(pontos, saiEm);
    const alemDoHorizonte = folgaNoDia === null;
    const folga = alemDoHorizonte ? naContaCentavos : folgaNoDia;
    const limiteLivreCentavos = visao.disponivelCentavos;
    const quantoCabeCentavos = Math.max(0, Math.min(limiteLivreCentavos, folga));
    return {
      cartaoId: cartao.id, apelido: cartao.apelido,
      limiteTotalCentavos: visao.limiteTotalCentavos, limiteLivreCentavos,
      previstoCentavos: visao.previstoCentavos || 0,
      proximaFatura: { competencia: competenciaDaCompra, jaNaFaturaCentavos, saiEm, vence, contaPagamentoId: cartao.contaPagamentoId || null },
      // A fatura de hoje já está dentro da trilha: se a folga naquele dia é negativa, ela não é coberta.
      caixaCobreAFatura: folga >= 0,
      folgaNoDiaCentavos: folga,
      alemDoHorizonte,
      quantoCabeCentavos,
      limiteDecide: limiteLivreCentavos <= folga,
      nivelAlerta: visao.nivelAlerta,
    };
  });
}

/** Total já comprometido nas próximas faturas de todos os cartões (o que sairá da conta). */
export function totalNasFaturas(cartoesNoCaixaLista) {
  return (cartoesNoCaixaLista || []).reduce((s, c) => s + c.proximaFatura.jaNaFaturaCentavos, 0);
}
