// Domínio puro: clareza de caixa (§4). É o primeiro bloco do produto que
// entrega algo que uma planilha não entrega — a pergunta central:
// "Quanto eu posso gastar sem criar um problema mais adiante?"
//
// Saldo bancário não é dinheiro disponível para gastar (§4, texto do
// blueprint). Por isso o painel nunca mostra só "quanto tem na conta" —
// mostra quatro números, cada um explicável pelos lançamentos que o
// compõem, nunca uma caixa preta.

import { somarDias } from "./tempo.js";
import { efeitoNaConta, dataVencimentoFatura, statusEfetivo } from "./transacoes.js";
import { compromissosPorDia } from "./calendario.js";
import { eventosFuturos } from "./previstos.js";

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
    // O dinheiro mexe na conta no dia em que SAIU ou ENTROU (`pagoEm`), nunca no
    // vencimento: uma conta que venceu em setembro e foi paga hoje tira o
    // dinheiro de hoje. Sem `pagoEm` (lançamento antigo) vale a data do lançamento.
    const dia = t.pagoEm || t.data;
    if (conta.dataSaldoInicial && dia <= conta.dataSaldoInicial) {
      // Saldo conferido no meio do dia: o que foi lançado DEPOIS da conferência,
      // mesmo no mesmo dia, ainda não está no saldo informado.
      const depois = conta.saldoConferidoEm && dia === conta.dataSaldoInicial
        && (t.atualizadoEm || t.criadoEm || "") > conta.saldoConferidoEm;
      if (!depois) continue;
    }
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
export function calcularComprometido({ transacoes, faturas, cartoes, hoje, horizonteAte, extras = [] }) {
  const itens = [];

  // Saídas derivadas dos cadastros (parcela de dívida, conta mensal ainda
  // não gerada) — ver domain/previstos.js.
  for (const e of extras) {
    if (e.tipo === "receita" || e.data > horizonteAte) continue;
    itens.push({ tipo: e.origem?.tipo === "divida" ? "parcela" : "previsto", descricao: e.descricao, valorCentavos: e.valorCentavos, data: e.data, atrasado: !!e.atrasado, origem: e.origem });
  }

  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || !t.contaId) continue;
    if (t.status === "pago" || t.status === "cancelado") continue;
    if (t.status !== "atrasado" && t.data > horizonteAte) continue;
    itens.push({
      tipo: "despesa", descricao: t.descricao || "Despesa", valorCentavos: Number(t.valorCentavos) || 0,
      data: t.data, atrasado: statusEfetivo(t, hoje) === "atrasado", semDia: !!t.semDia,
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
export function calcularClarezaDeCaixa({ contas, transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda, hoje, horizonteDias = 30, soConfirmado = false }) {
  const horizonteAte = somarDias(hoje, horizonteDias);

  const contasAtivas = (contas || []).filter((c) => c.status === "ativa");
  const operacao = contasAtivas.filter((c) => !c.ehReserva);
  const reserva = contasAtivas.filter((c) => c.ehReserva);

  const saldosOperacao = operacao.map((conta) => ({ conta, saldoCentavos: calcularSaldoConta(conta, transacoes) }));
  const saldosReserva = reserva.map((conta) => ({ conta, saldoCentavos: calcularSaldoConta(conta, transacoes) }));

  const saldoAtualCentavos = saldosOperacao.reduce((s, x) => s + x.saldoCentavos, 0);
  const saldoReservaCentavos = saldosReserva.reduce((s, x) => s + x.saldoCentavos, 0);

  const extras = eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda, cartoes, faturas, de: hoje, ate: horizonteAte, hoje });
  // Uma trilha só: o que sai, o que entra e o ponto mais baixo saem dos MESMOS
  // itens. Antes "vai sair" somava uma lista e o "pode gastar" caminhava outra
  // (a trilha descartava despesa de data passada que não era atrasada) e os
  // números do mesmo cartão não fechavam entre si.
  const dias = compromissosPorDia({ transacoes, faturas, cartoes, de: hoje, ate: horizonteAte, hoje, extras });
  let saldo = saldoAtualCentavos;
  let menorSaldoCentavos = saldoAtualCentavos;
  let diaMaisApertado = null;
  let entradasPrevistasCentavos = 0;
  let comprometidoCentavos = 0;
  const compromissos = [];
  const pontos = [];
  let primeiroBuraco = null;
  let proximaEntrada = null;
  for (const dia of dias) {
    const saldoAntes = saldo;
    for (const i of dia.itens) {
      if (i.tipo === "receita") {
        if (i.certeza === "incerto" || (soConfirmado && (i.certeza || "confirmado") !== "confirmado")) continue;
        saldo += i.valorCentavos; entradasPrevistasCentavos += i.valorCentavos;
      } else {
        saldo -= i.valorCentavos; comprometidoCentavos += i.valorCentavos;
        compromissos.push({
          tipo: i.origem?.tipo === "divida" ? "parcela" : i.tipo, descricao: i.descricao, valorCentavos: i.valorCentavos,
          data: dia.data, vencimento: i.vencimento || dia.data, atrasado: !!i.atrasado, semDia: !!i.semDia, origem: i.origem,
          categoriaId: i.categoriaId || null, transacaoId: i.transacaoId || null, faturaId: i.faturaId || null,
        });
      }
    }
    if (saldo < menorSaldoCentavos) { menorSaldoCentavos = saldo; diaMaisApertado = dia.data; }
    pontos.push({ data: dia.data, saldoCentavos: saldo });
    if (!proximaEntrada && dia.data > hoje) {
      const conta = (i) => i.tipo === "receita" && i.certeza !== "incerto" && !(soConfirmado && (i.certeza || "confirmado") !== "confirmado");
      const e = dia.itens.find(conta);
      if (e) proximaEntrada = { data: dia.data, valorCentavos: dia.itens.filter(conta).reduce((a, i) => a + i.valorCentavos, 0), descricao: e.descricao, certeza: e.certeza || "confirmado" };
    }
    if (!primeiroBuraco && saldo < 0) {
      primeiroBuraco = {
        data: dia.data, faltaCentavos: -saldo,
        causas: dia.itens.filter((i) => i.tipo !== "receita").sort((a, b) => b.valorCentavos - a.valorCentavos).map((i) => ({ descricao: i.descricao, valorCentavos: i.valorCentavos, origem: i.origem || null })),
        saldoAntesCentavos: saldoAntes,
      };
    }
  }
  // Até a próxima entrada: o mais baixo que o saldo toca ANTES de ela chegar.
  // É o número que responde "posso gastar isso até o dinheiro entrar?".
  const antesDaEntrada = proximaEntrada ? pontos.filter((p) => p.data < proximaEntrada.data) : pontos;
  const seguroAteAProximaEntradaCentavos = Math.min(saldoAtualCentavos, ...antesDaEntrada.map((p) => p.saldoCentavos));
  // "Livre" responde "e se não entrasse nada?": saldo menos tudo que sai.
  const livreCentavos = saldoAtualCentavos - comprometidoCentavos;
  const seguroParaGastarCentavos = Math.min(saldoAtualCentavos, menorSaldoCentavos);

  return {
    saldoAtualCentavos,
    saldoReservaCentavos,
    comprometidoCentavos,
    entradasPrevistasCentavos,
    livreCentavos,
    seguroParaGastarCentavos,
    seguroAteAProximaEntradaCentavos,
    pontos,
    proximaEntrada,
    primeiroBuraco,
    diaMaisApertado,
    horizonteAte,
    detalhes: {
      contasOperacao: saldosOperacao,
      contasReserva: saldosReserva,
      compromissos: compromissos.sort((a, b) => (a.data || "").localeCompare(b.data || "")),
      entradas: dias.flatMap((d) => d.itens.filter((i) => i.tipo === "receita" && i.certeza !== "incerto" && !(soConfirmado && (i.certeza || "confirmado") !== "confirmado")).map((i) => ({ ...i, data: d.data }))),
    },
  };
}
