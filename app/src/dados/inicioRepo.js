// Leitura do que a tela Início mostra além do caixa: confiança do número,
// próximos 7 dias e o que falta cadastrar. Tudo calculado na leitura.

import { assinarBase } from "./base.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { confiancaDoNumero, proximosDias, completarRetrato } from "../domain/inicio.js";
import { obterMetas } from "./orcamentoRepo.js";
import { hojeISO } from "../domain/tempo.js";

const HORIZONTE_DIAS = 30;

export function calcularInicio(base, hoje = hojeISO(), metas = null) {
  const caixa = calcularClarezaDeCaixa({ ...base, hoje, horizonteDias: HORIZONTE_DIAS });
  return {
    caixa,
    confianca: confiancaDoNumero(caixa.detalhes.entradas),
    proximos: proximosDias({ compromissos: caixa.detalhes.compromissos, entradas: caixa.detalhes.entradas, hoje, dias: 7 }),
    retrato: completarRetrato({ ...base, metas, hoje }),
    horizonteDias: HORIZONTE_DIAS,
  };
}

export function assinarInicio(cb) {
  return assinarBase(async (base) => calcularInicio(base, hojeISO(), await obterMetas()), cb);
}
