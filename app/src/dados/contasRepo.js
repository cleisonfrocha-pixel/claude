// Contas do mês (domain/contasDoMes.js): lê o retrato único e calcula o
// estado de cada conta. Recalcula quando qualquer cadastro mudar.

import { carregarBase, assinarBase } from "./base.js";
import { contasDoMes } from "../domain/contasDoMes.js";
import { hojeISO } from "../domain/tempo.js";

function montar(base, competencia) {
  return { ...contasDoMes({ ...base, competencia, hoje: hojeISO() }), hoje: hojeISO(), contas: base.contas };
}

export async function calcularContasDoMes(competencia) {
  return montar(await carregarBase(), competencia);
}

export function assinarContasDoMes(competencia, cb) {
  return assinarBase((base) => montar(base, competencia), cb);
}
