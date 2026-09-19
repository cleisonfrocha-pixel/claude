// Carrega os dados do fluxo de caixa e projeção (domain/projecao.js): os
// quatro horizontes do §7, a partir do mesmo saldo inicial das contas de
// operação — mesma definição de "saldo atual" da clareza de caixa (D8):
// reserva fica de fora, é margem de segurança, não caixa de giro.

import { contas, cartoes } from "./repositorios.js";
import { transacoes } from "./transacoesRepo.js";
import { faturas } from "./faturasRepo.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { calcularProjecao } from "../domain/projecao.js";
import { hojeISO } from "../domain/tempo.js";

function comId(lista) {
  return lista.map((item) => ({ id: item.id, ...item.dados }));
}

async function carregarTudo() {
  const [listaContas, listaCartoes, listaFaturas, listaTransacoes] = await Promise.all([
    contas.listar(), cartoes.listar(), faturas.listar(), transacoes.listar(),
  ]);
  return {
    contas: comId(listaContas),
    cartoes: comId(listaCartoes),
    faturas: comId(listaFaturas),
    transacoes: listaTransacoes.map((t) => t.dados),
  };
}

export async function calcularProjecaoAgora() {
  const dados = await carregarTudo();
  const hoje = hojeISO();
  const contasOperacao = dados.contas.filter((c) => c.status === "ativa" && !c.ehReserva);
  const saldoInicialCentavos = contasOperacao.reduce((s, c) => s + calcularSaldoConta(c, dados.transacoes), 0);
  return calcularProjecao({ ...dados, saldoInicialCentavos, hoje });
}

/** Assina a projeção ao vivo — recalcula sempre que conta ou transação mudar. */
export function assinarProjecao(cb) {
  let cancelada = false;
  async function recalcular() {
    if (cancelada) return;
    const r = await calcularProjecaoAgora();
    if (cancelada) return;
    cb(r);
  }
  const pararContas = contas.assinar(recalcular);
  const pararTransacoes = transacoes.assinar(recalcular);
  return () => {
    cancelada = true;
    pararContas();
    pararTransacoes();
  };
}
