// Domínio puro: anomalias e inteligência de comportamento (§17). Detecta
// desvios contra um histórico, não contra um limite fixo — "fora do
// padrão" só faz sentido comparado ao que já aconteceu antes. Duas das
// seis detecções do blueprint (gasto fora do padrão histórico, aumento
// persistente de categoria) já existiam: `domain/diagnostico.js`
// (`calcularDespesasForaDoPadrao`, §8) e `domain/orcamento.js`
// (`identificarCategoriasCrescentes`, §13) — nenhuma das duas é repetida
// aqui, `dados/decisoesRepo.js` reaproveita as duas direto. Este arquivo
// só tem o que ainda não existia: recorrência nova ou com valor diferente
// do esperado, cartão com gasto atípico, e o comparador genérico usado
// tanto para "mudança relevante em receita" (§17) quanto para "queda de
// margem" (§24) — a mesma pergunta ("isso mudou muito desde o período
// anterior?") feita sobre dois números diferentes.

import { somarMeses } from "./tempo.js";

/** Recorrências cujo início cai exatamente na competência atual —
 * `inicio` é o mês em que o compromisso passa a valer (domain/esquema.js),
 * sinal mais confiável do que a data de criação do registro (que poderia
 * ter sido cadastrado com atraso ou editada). */
export function detectarNovaRecorrencia(recorrencias, competencia) {
  return (recorrencias || [])
    .filter((r) => r.ativa && r.inicio === competencia)
    .map((r) => ({ recorrenciaId: r.id, descricao: r.descricao, tipo: r.tipo, valorEstimadoCentavos: r.valorEstimadoCentavos }));
}

/**
 * Recorrências cujo lançamento real da competência atual difere do valor
 * estimado além do limiar — a "diferença entre esperado e realizado" do
 * §17. Uma assinatura que reajustou, um financiamento com juro variável.
 */
export function detectarRecorrenciaValorDiferente(recorrencias, transacoes, competencia, { limiarPercentual = 20 } = {}) {
  const achados = [];
  for (const r of recorrencias || []) {
    if (!r.ativa || !r.valorEstimadoCentavos) continue;
    const t = (transacoes || []).find((x) => x.recorrenciaId === r.id && x.competencia === competencia && x.status !== "cancelado");
    if (!t) continue;
    const realizadoCentavos = Number(t.valorCentavos) || 0;
    if (!realizadoCentavos) continue;
    const percentual = Math.round(((realizadoCentavos - r.valorEstimadoCentavos) / r.valorEstimadoCentavos) * 100);
    if (Math.abs(percentual) < limiarPercentual) continue;
    achados.push({
      recorrenciaId: r.id, descricao: r.descricao,
      esperadoCentavos: r.valorEstimadoCentavos, realizadoCentavos, percentual,
      dataTransacao: t.data,
    });
  }
  return achados;
}

/**
 * Cartões cuja fatura da competência atual passa muito da média das
 * `mesesBase` faturas anteriores — mesmo raciocínio de
 * `calcularDespesasForaDoPadrao` (§8), mas sobre gasto de cartão em vez
 * de categoria: o mês atual nunca entra na própria média, e sem
 * histórico suficiente não há "padrão" contra o qual comparar.
 */
export function detectarAumentoCartao(cartoes, faturas, transacoes, competencia, { mesesBase = 3, limiarPercentual = 50 } = {}) {
  const achados = [];
  for (const cartao of cartoes || []) {
    const faturasDoCartao = (faturas || []).filter((f) => f.cartaoId === cartao.id);
    const totalPorCompetencia = new Map();
    for (const f of faturasDoCartao) {
      const total = (transacoes || [])
        .filter((t) => t.faturaId === f.id)
        .reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
      totalPorCompetencia.set(f.competencia, total);
    }
    const atualCentavos = totalPorCompetencia.get(competencia) || 0;
    if (atualCentavos <= 0) continue;

    let somaBase = 0, contBase = 0;
    for (let i = 1; i <= mesesBase; i++) {
      const c = somarMeses(competencia, -i);
      if (totalPorCompetencia.has(c)) { somaBase += totalPorCompetencia.get(c); contBase++; }
    }
    if (contBase === 0) continue; // sem histórico — não dá pra chamar de "atípico"
    const mediaCentavos = Math.round(somaBase / contBase);
    if (mediaCentavos <= 0) continue;
    const percentualAcima = Math.round(((atualCentavos - mediaCentavos) / mediaCentavos) * 100);
    if (percentualAcima >= limiarPercentual) {
      achados.push({ cartaoId: cartao.id, apelido: cartao.apelido, atualCentavos, mediaCentavos, percentualAcima });
    }
  }
  return achados.sort((a, b) => b.percentualAcima - a.percentualAcima);
}

/**
 * Fontes de renda fixas/recorrentes sem nenhuma receita paga registrada
 * nesta competência, quando o mês já está avançado o bastante pra isso
 * ser um sinal (não um falso alarme no dia 2 do mês).
 */
export function detectarReceitaEsperadaNaoRecebida(fontesRenda, transacoes, competencia, hoje, { diaMinimo = 20 } = {}) {
  const diaDoMes = Number((hoje || "").slice(8, 10)) || 0;
  if (diaDoMes < diaMinimo) return [];
  const achados = [];
  for (const fonte of fontesRenda || []) {
    if (!fonte.ativa || (fonte.tipo !== "fixa" && fonte.tipo !== "recorrente")) continue;
    if (!fonte.valorEsperadoCentavos) continue;
    const recebidoCentavos = (transacoes || [])
      .filter((t) => t.fonteRendaId === fonte.id && t.competencia === competencia && t.status === "pago")
      .reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
    if (recebidoCentavos > 0) continue;
    achados.push({ fonteId: fonte.id, nome: fonte.nome, valorEsperadoCentavos: fonte.valorEsperadoCentavos });
  }
  return achados;
}

/**
 * Comparador genérico "isso mudou muito desde o período anterior?" — usado
 * tanto para receita (§17) quanto para margem (§24), mesma pergunta sobre
 * dois números diferentes. `null` sem base anterior (nada a comparar) ou
 * abaixo do limiar (mudança normal, não anomalia).
 */
export function compararComPeriodoAnterior(atualCentavos, anteriorCentavos, { limiarPercentual = 30 } = {}) {
  if (!anteriorCentavos) return null;
  const variacaoCentavos = atualCentavos - anteriorCentavos;
  const variacaoPercentual = Math.round((variacaoCentavos / Math.abs(anteriorCentavos)) * 100);
  if (Math.abs(variacaoPercentual) < limiarPercentual) return null;
  return { atualCentavos, anteriorCentavos, variacaoCentavos, variacaoPercentual, subiu: variacaoCentavos > 0 };
}
