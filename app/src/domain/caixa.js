// Domínio puro: clareza de caixa (§4). É o primeiro bloco do produto que
// entrega algo que uma planilha não entrega — a pergunta central:
// "Quanto eu posso gastar sem criar um problema mais adiante?"
//
// Saldo bancário não é dinheiro disponível para gastar (§4, texto do
// blueprint). Por isso o painel nunca mostra só "quanto tem na conta" —
// mostra quatro números, cada um explicável pelos lançamentos que o
// compõem, nunca uma caixa preta.

import { somarDias } from "./tempo.js";
import { efeitoNaConta, dataVencimentoFatura } from "./transacoes.js";

/**
 * Saldo de UMA conta: saldo inicial cadastrado + o efeito de toda transação
 * paga dela, ocorrida ESTRITAMENTE depois da data do saldo inicial (esse
 * saldo já reflete tudo até aquele dia — somar o mesmo dia de novo
 * duplicaria dinheiro que já está contado).
 */
export function calcularSaldoConta(conta, transacoes) {
  const inicial = Number(conta.saldoInicialCentavos) || 0;
  let efeito = 0;
  for (const t of transacoes || []) {
    if (t.contaId !== conta.id) continue;
    if (conta.dataSaldoInicial && t.data <= conta.dataSaldoInicial) continue;
    efeito += efeitoNaConta(t);
  }
  return inicial + efeito;
}

/**
 * As obrigações que ainda vão pressionar o caixa dentro do horizonte —
 * despesas lançadas direto numa conta que ainda não foram pagas (previsto,
 * agendado, ou atrasado — atrasado conta sempre, não importa a data), mais
 * o total de cada fatura de cartão ainda não paga cujo vencimento cai no
 * horizonte. Devolve a lista de itens que compõem a soma, não só o número —
 * é o que torna o resultado explicável linha a linha (portão da Fase 2).
 *
 * `faturas` precisa vir com `id` embutido em cada item (não só os campos —
 * ver dados/caixaRepo.js), porque este cálculo cruza `transacao.faturaId`
 * com o id da própria fatura; nada mais nesta função depende de id.
 */
export function calcularComprometido({ transacoes, faturas, cartoes, hoje, horizonteAte }) {
  const itens = [];

  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || !t.contaId) continue;
    if (t.status === "pago" || t.status === "cancelado") continue;
    if (t.status !== "atrasado" && t.data > horizonteAte) continue;
    itens.push({
      tipo: "despesa", descricao: t.descricao || "Despesa", valorCentavos: Number(t.valorCentavos) || 0,
      data: t.data, atrasado: t.status === "atrasado",
    });
  }

  const cartaoPorId = new Map((cartoes || []).map((c) => [c.id, c]));
  for (const f of faturas || []) {
    if (f.status === "paga") continue;
    const cartao = cartaoPorId.get(f.cartaoId);
    if (!cartao) continue;
    const vencimento = dataVencimentoFatura(cartao, f.competencia);
    if (vencimento > horizonteAte) continue;
    const totalFatura = (transacoes || [])
      .filter((t) => t.faturaId === f.id)
      .reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
    if (totalFatura <= 0) continue;
    itens.push({
      tipo: "fatura", descricao: `Fatura ${cartao.apelido || "do cartão"}`, valorCentavos: totalFatura,
      data: vencimento, atrasado: hoje ? vencimento < hoje : false,
    });
  }

  const totalCentavos = itens.reduce((s, i) => s + i.valorCentavos, 0);
  return { totalCentavos, itens };
}

/**
 * O painel de clareza de caixa. Contas marcadas `ehReserva` ficam de fora
 * do "posso gastar" por definição — são a margem de segurança que o
 * próprio usuário já separou (§15), então o "dinheiro seguro para gastar"
 * desta fase é o saldo livre das contas de operação: não inventamos uma
 * margem extra arbitrária por cima. Fases futuras (§8/§13, custo
 * essencial) podem sofisticar essa margem — decisão registrada em
 * docs/ARQUITETURA.md.
 *
 * `horizonteDias` (padrão 30) é o "horizonte escolhido" do §4 nesta fase —
 * um valor fixo até a Fase 5 trazer 7/30/90/365 lado a lado.
 */
export function calcularClarezaDeCaixa({ contas, transacoes, faturas, cartoes, hoje, horizonteDias = 30 }) {
  const horizonteAte = somarDias(hoje, horizonteDias);

  const contasAtivas = (contas || []).filter((c) => c.status === "ativa");
  const operacao = contasAtivas.filter((c) => !c.ehReserva);
  const reserva = contasAtivas.filter((c) => c.ehReserva);

  const saldosOperacao = operacao.map((conta) => ({ conta, saldoCentavos: calcularSaldoConta(conta, transacoes) }));
  const saldosReserva = reserva.map((conta) => ({ conta, saldoCentavos: calcularSaldoConta(conta, transacoes) }));

  const saldoAtualCentavos = saldosOperacao.reduce((s, x) => s + x.saldoCentavos, 0);
  const saldoReservaCentavos = saldosReserva.reduce((s, x) => s + x.saldoCentavos, 0);

  const comprometido = calcularComprometido({ transacoes, faturas, cartoes, hoje, horizonteAte });

  const livreCentavos = saldoAtualCentavos - comprometido.totalCentavos;
  const seguroParaGastarCentavos = livreCentavos;

  return {
    saldoAtualCentavos,
    saldoReservaCentavos,
    comprometidoCentavos: comprometido.totalCentavos,
    livreCentavos,
    seguroParaGastarCentavos,
    horizonteAte,
    detalhes: {
      contasOperacao: saldosOperacao,
      contasReserva: saldosReserva,
      compromissos: comprometido.itens.sort((a, b) => (a.data || "").localeCompare(b.data || "")),
    },
  };
}
