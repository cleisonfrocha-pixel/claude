// Evolução (domain/evolucao.js) sobre o retrato único. A única coisa gravada é
// o instantâneo de caixa do mês (pior momento visto e atrasos), um documento
// por competência, atualizado quando o Início é calculado.

import * as db from "./db.js";
import { carregarBase, assinarBase } from "./base.js";
import { montarEvolucao, mesclarInstantaneo } from "../domain/evolucao.js";
import { contasDoMes } from "../domain/contasDoMes.js";
import { hojeISO, competenciaDeData } from "../domain/tempo.js";

const CAMINHO = "instantaneosCaixa";
let ultimaChave = "";

async function lerInstantaneos() {
  return (await db.listar(CAMINHO)).map((d) => ({ id: d.id, ...d.dados }));
}

/** Guarda o pior momento do mês e as atrasadas. Idempotente: só grava se mudou. */
export async function registrarInstantaneo(base, situacao, hoje = hojeISO()) {
  const competencia = competenciaDeData(hoje);
  const c = contasDoMes({ ...base, competencia, hoje });
  const novo = {
    competencia, menorPontoCentavos: situacao.menorPontoCentavos, atrasadasQuantidade: c.resumo.quantidadeAtrasadas,
    atrasadasCentavos: c.resumo.atrasadasCentavos, livreGarantidoCentavos: situacao.livreGarantidoCentavos, hoje,
  };
  const chave = `${competencia}|${novo.menorPontoCentavos}|${novo.atrasadasQuantidade}|${novo.atrasadasCentavos}|${novo.livreGarantidoCentavos}`;
  if (chave === ultimaChave) return;
  ultimaChave = chave;
  const existente = (await lerInstantaneos()).find((i) => i.competencia === competencia) || null;
  await db.definir(CAMINHO, competencia, mesclarInstantaneo(existente, novo));
}

async function calcular(base) {
  const [snapshots, instantaneos] = await Promise.all([db.listar("patrimonioSnapshots"), lerInstantaneos()]);
  return montarEvolucao({
    transacoes: base.transacoes, categorias: base.categorias, dividas: base.dividas,
    snapshots: snapshots.map((s) => s.dados), instantaneos, hoje: hojeISO(),
  });
}

export async function calcularEvolucao() {
  return calcular(await carregarBase());
}

export function assinarEvolucao(cb) {
  return assinarBase(calcular, cb);
}
