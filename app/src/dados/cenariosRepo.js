// Carrega a BASE dos cenários (domain/cenarios.js) a partir dos dados
// reais. A simulação em si roda na tela, na hora, a cada ajuste de
// parâmetro — nada de cenário é gravado (CLAUDE.md: simulação não escreve
// no dado real), então esta camada só lê.

import { carregarBase, assinarBase } from "./base.js";
import { obterMetas } from "./orcamentoRepo.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { montarBaseCenarios } from "../domain/cenarios.js";
import { hojeISO, competenciaAtual } from "../domain/tempo.js";

async function montarBase(dados) {
  const hoje = hojeISO();
  const clareza = calcularClarezaDeCaixa({ ...dados, hoje, horizonteDias: 30 });
  const { investimentoMinimoMensalCentavos } = await obterMetas();
  return montarBaseCenarios({ ...dados, clareza, competencia: competenciaAtual(), hoje, investimentoMinimoMensalCentavos });
}

export async function calcularBaseCenarios() {
  return montarBase(await carregarBase());
}

export function assinarBaseCenarios(cb) {
  return assinarBase(montarBase, cb);
}
