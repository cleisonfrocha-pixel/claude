// Verba do mês (mercado, combustível, lazer…): um valor reservado para a categoria, sem dia certo.
// O que ainda pesa no caixa é o que falta gastar dela, e isso é DERIVADO dos lançamentos reais da
// categoria no mês (CLAUDE.md: nada de total gravado). Antes a verba só diminuía quando o gasto era
// ligado a ela à mão, e o gasto real somava por cima: o mesmo dinheiro contado duas vezes.

import { competenciaDeData } from "./tempo.js";

const ehVerbaAberta = (t) => t.tipo === "despesa" && t.semDia && t.status !== "pago" && t.status !== "cancelado";

/** Gasto real que consome a verba: despesa paga (ou compra no cartão) da categoria, no mês, que não é
 * ela mesma um pedaço de verba já baixado (esses já saíram do valor aberto da verba). */
function consomeVerba(t) {
  if (t.tipo !== "despesa" || t.semDia || t.status === "cancelado") return false;
  return t.status === "pago" || !!t.cartaoId || !!t.faturaId;
}

const chave = (categoriaId, competencia) => `${categoriaId || ""}|${competencia}`;
const compDe = (t) => t.competencia || (t.data || "").slice(0, 7);

/**
 * Para cada verba aberta (chave: o id, ou o próprio objeto sem id): { totalCentavos, gastoCentavos, restanteCentavos, expirada }.
 * - total: o que a verba era no mês (aberto + pedaços já baixados).
 * - gasto: pedaços baixados + gasto real da categoria no mês.
 * - restante: o que ainda vai sair (nunca negativo). Duas verbas na mesma categoria dividem o gasto
 *   na proporção do valor de cada uma.
 * - verba de mês que já passou expira: não pesa mais no caixa nem vira "atrasada".
 */
export function lerVerbas(transacoes, hoje) {
  const competenciaHoje = competenciaDeData(hoje);
  const grupos = new Map();
  const grupo = (k) => {
    if (!grupos.has(k)) grupos.set(k, { abertas: [], aberto: 0, pagoDeVerba: 0, livre: 0 });
    return grupos.get(k);
  };
  for (const t of transacoes || []) {
    const v = Number(t.valorCentavos) || 0;
    if (ehVerbaAberta(t)) { const g = grupo(chave(t.categoriaId, compDe(t))); g.abertas.push(t); g.aberto += v; }
  }
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || !t.categoriaId) continue;
    const g = grupos.get(chave(t.categoriaId, compDe(t)));
    if (!g) continue;
    const v = Number(t.valorCentavos) || 0;
    if (t.semDia && t.status === "pago") g.pagoDeVerba += v;
    else if (consomeVerba(t)) g.livre += v;
  }
  const saida = new Map();
  for (const [k, g] of grupos) {
    const competencia = k.split("|")[1];
    const expirada = competencia < competenciaHoje;
    const restanteGrupo = expirada ? 0 : Math.max(0, g.aberto - g.livre);
    const total = g.aberto + g.pagoDeVerba;
    const gasto = g.pagoDeVerba + g.livre;
    // Repartição proporcional sem perder centavo: o resto vai para a maior verba.
    const ordenadas = [...g.abertas].sort((a, b) => (Number(b.valorCentavos) || 0) - (Number(a.valorCentavos) || 0));
    let distribuido = 0;
    ordenadas.forEach((t, i) => {
      const peso = g.aberto > 0 ? (Number(t.valorCentavos) || 0) / g.aberto : 0;
      const restante = Math.floor(restanteGrupo * peso);
      distribuido += restante;
      saida.set(t.id ?? t, { totalCentavos: Math.round(total * peso), gastoCentavos: Math.round(gasto * peso), restanteCentavos: restante, expirada });
    });
    if (ordenadas.length && restanteGrupo - distribuido > 0) saida.get(ordenadas[0].id ?? ordenadas[0]).restanteCentavos += restanteGrupo - distribuido;
  }
  return saida;
}
