// Relatórios (domain/relatorios.js) sobre o retrato único. Nada é gravado.

import { assinarBase } from "./base.js";
import { gastosDoMes, vazamentos, composicaoDeDividas, serieMensal } from "../domain/relatorios.js";
import { calcularPlanoGeral } from "./planoGeralRepo.js";
import { cartoesNoCaixa } from "../domain/cartaoNoCaixa.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { hojeISO } from "../domain/tempo.js";

export function calcularRelatorios(base, competencia, hoje = hojeISO()) {
  const caixa = calcularClarezaDeCaixa({ ...base, hoje, horizonteDias: 30 });
  const plano = calcularPlanoGeral(base, hoje);
  return {
    competencia, hoje,
    gastos: gastosDoMes({ ...base, competencia, hoje }),
    vazamentos: vazamentos(base),
    dividas: composicaoDeDividas(base.dividas, hoje),
    serie: serieMensal(plano.mapa.linhas),
    cartoes: cartoesNoCaixa({ cartoes: base.cartoes, faturas: base.faturas, transacoes: base.transacoes, pontos: caixa.pontos, naContaCentavos: caixa.saldoAtualCentavos, hoje }),
  };
}

export function assinarRelatorios(competencia, cb) {
  return assinarBase((base) => calcularRelatorios(base, competencia), cb);
}
