// Histórico do ano (domain/historicoAno.js) sobre o retrato único. Nada é gravado.

import { assinarBase } from "./base.js";
import { montarHistoricoAno } from "../domain/historicoAno.js";
import { hojeISO } from "../domain/tempo.js";

export function calcularHistoricoAno(base, { pessoaId = null, hoje = hojeISO() } = {}) {
  return {
    pessoas: (base.pessoas || []).filter((p) => p.ativo !== false),
    historico: montarHistoricoAno({
      transacoes: base.transacoes, categorias: base.categorias, fontesRenda: base.fontesRenda,
      contas: base.contas, hoje, pessoaId,
    }),
  };
}

export function assinarHistoricoAno(opcoes, cb) {
  return assinarBase((base) => calcularHistoricoAno(base, opcoes), cb);
}
