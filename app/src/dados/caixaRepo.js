// Painel de clareza de caixa (domain/caixa.js) sobre a leitura única de
// dados/base.js: saldo, o que sai e o que entra nos próximos dias —
// inclusive renda cadastrada, parcela de dívida e conta mensal.

import { carregarBase, assinarBase } from "./base.js";
import { calcularClarezaDeCaixa } from "../domain/caixa.js";
import { hojeISO } from "../domain/tempo.js";

const calcular = (horizonteDias) => (base) => calcularClarezaDeCaixa({ ...base, hoje: hojeISO(), horizonteDias });

export async function calcularAgora(horizonteDias) {
  return calcular(horizonteDias)(await carregarBase());
}

export function assinarClarezaDeCaixa(cb, horizonteDias) {
  return assinarBase(calcular(horizonteDias), cb);
}
