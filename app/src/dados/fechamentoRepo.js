// Fechamento do mês (domain/fechamento.js) sobre o retrato único, mais os
// retratos mensais de patrimônio e as decisões já tomadas.

import * as db from "./db.js";
import { carregarBase, assinarBase } from "./base.js";
import { montarFechamento } from "../domain/fechamento.js";
import { competenciaAtual } from "../domain/tempo.js";

async function calcular(base, competencia) {
  const [snapshots, decisoes] = await Promise.all([db.listar("patrimonioSnapshots"), db.listar("decisoes")]);
  return montarFechamento({
    competencia, competenciaAtual: competenciaAtual(),
    transacoes: base.transacoes, categorias: base.categorias,
    snapshots: snapshots.map((s) => s.dados),
    decisoes: decisoes.map((d) => ({ id: d.id, ...d.dados })),
  });
}

export async function calcularFechamento(competencia) {
  return calcular(await carregarBase(), competencia);
}

export function assinarFechamento(competencia, cb) {
  return assinarBase((base) => calcular(base, competencia), cb);
}
