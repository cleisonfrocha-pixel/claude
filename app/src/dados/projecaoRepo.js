// Fluxo de caixa e projeção (domain/projecao.js): os quatro horizontes do
// §7 a partir do saldo das contas de operação (reserva fica de fora, D8),
// sobre a leitura única de dados/base.js.

import { carregarBase, assinarBase } from "./base.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { calcularProjecao } from "../domain/projecao.js";
import { gastoDiaADiaMensal } from "../domain/previstos.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

function calcular(base) {
  const contasOperacao = base.contas.filter((c) => c.status === "ativa" && !c.ehReserva);
  const saldoInicialCentavos = contasOperacao.reduce((s, c) => s + calcularSaldoConta(c, base.transacoes), 0);
  const gastoDiaADiaMensalCentavos = gastoDiaADiaMensal({ ...base, competencia: competenciaAtual() });
  return calcularProjecao({ ...base, saldoInicialCentavos, gastoDiaADiaMensalCentavos, hoje: hojeISO() });
}

export async function calcularProjecaoAgora() {
  return calcular(await carregarBase());
}

export function assinarProjecao(cb) {
  return assinarBase(calcular, cb);
}
