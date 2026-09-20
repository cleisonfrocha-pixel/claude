// Domínio puro: diagnóstico financeiro (§8). "O diagnóstico deve explicar
// a situação sem moralizar — o sistema apresenta fatos, relações e causas
// observáveis" (texto do blueprint). Por isso este arquivo não inventa
// número novo nenhum: cada bloco reaproveita um cálculo que já existe em
// outra parte do domínio (clareza de caixa, dívidas, transações) e só
// organiza a leitura.

import { agregarPeriodoPago } from "./transacoes.js";
import { somarMeses } from "./tempo.js";
import { calcularVisaoConsolidada } from "./dividas.js";
import { calcularComposicaoAtivos, calcularPatrimonioLiquido } from "./patrimonio.js";

function despesasPorCategoria(transacoes, competencia) {
  const porCategoria = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const chave = t.categoriaId || "sem-categoria";
    porCategoria.set(chave, (porCategoria.get(chave) || 0) + (Number(t.valorCentavos) || 0));
  }
  return porCategoria;
}

/** Pressão das despesas fixas: fatia das despesas pagas do mês que vem de
 * categoria marcada como essencial. */
export function calcularPressaoFixas(transacoes, categorias, competencia) {
  const essenciaisIds = new Set((categorias || []).filter((c) => c.essencial).map((c) => c.id));
  let fixasCentavos = 0, totalCentavos = 0;
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    totalCentavos += v;
    if (essenciaisIds.has(t.categoriaId)) fixasCentavos += v;
  }
  const percentual = totalCentavos > 0 ? Math.round((fixasCentavos / totalCentavos) * 100) : 0;
  return { fixasCentavos, totalCentavos, percentual };
}

/** Previsibilidade (fatia confirmada) e concentração (fatia da maior fonte
 * única) da receita do mês. */
export function calcularReceita(transacoes, competencia) {
  let totalCentavos = 0, confirmadoCentavos = 0;
  const porCategoria = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "receita" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    totalCentavos += v;
    if (t.certeza === "confirmado") confirmadoCentavos += v;
    const chave = t.categoriaId || "sem-categoria";
    porCategoria.set(chave, (porCategoria.get(chave) || 0) + v);
  }
  const maiorFonteCentavos = porCategoria.size ? Math.max(...porCategoria.values()) : 0;
  return {
    totalCentavos,
    previsibilidadePercentual: totalCentavos > 0 ? Math.round((confirmadoCentavos / totalCentavos) * 100) : 0,
    concentracaoPercentual: totalCentavos > 0 ? Math.round((maiorFonteCentavos / totalCentavos) * 100) : 0,
    quantidadeFontes: porCategoria.size,
  };
}

function calcularEvolucao(transacoes, competencia, campo) {
  const atual = agregarPeriodoPago(transacoes, { de: competencia, ate: competencia })[campo];
  const anterior = agregarPeriodoPago(transacoes, { de: somarMeses(competencia, -1), ate: somarMeses(competencia, -1) })[campo];
  const variacaoCentavos = atual - anterior;
  const variacaoPercentual = anterior > 0 ? Math.round((variacaoCentavos / anterior) * 100) : null;
  return { atualCentavos: atual, anteriorCentavos: anterior, variacaoCentavos, variacaoPercentual };
}

/** Evolução do custo de vida: despesa paga deste mês vs do mês anterior. */
export function calcularEvolucaoCustoDeVida(transacoes, competencia) {
  return calcularEvolucao(transacoes, competencia, "despesas");
}

/** Mesma leitura para a receita — metade de "o que mudou desde o mês passado". */
export function calcularEvolucaoReceita(transacoes, competencia) {
  return calcularEvolucao(transacoes, competencia, "receitas");
}

/**
 * Despesas fora do padrão: categorias cujo gasto do mês passa muito da
 * média dos `mesesBase` meses ANTERIORES (o mês atual nunca entra na
 * própria média, senão um gasto alto se esconderia puxando a média junto).
 */
export function calcularDespesasForaDoPadrao(transacoes, competencia, { mesesBase = 3, limiarPercentual = 50 } = {}) {
  const atual = despesasPorCategoria(transacoes, competencia);
  const somaBase = new Map();
  for (let i = 1; i <= mesesBase; i++) {
    for (const [cat, v] of despesasPorCategoria(transacoes, somarMeses(competencia, -i))) {
      somaBase.set(cat, (somaBase.get(cat) || 0) + v);
    }
  }
  const achados = [];
  for (const [categoriaId, valorCentavos] of atual) {
    const mediaCentavos = Math.round((somaBase.get(categoriaId) || 0) / mesesBase);
    if (mediaCentavos <= 0) continue; // sem histórico — não dá pra chamar de "fora do padrão"
    const percentualAcima = Math.round(((valorCentavos - mediaCentavos) / mediaCentavos) * 100);
    if (percentualAcima >= limiarPercentual) achados.push({ categoriaId, valorCentavos, mediaCentavos, percentualAcima });
  }
  return achados.sort((a, b) => b.percentualAcima - a.percentualAcima);
}

/** O que falta cadastrar para o diagnóstico ficar mais confiável — cada
 * item aponta o que fazer, não só que "algo está incompleto" (§9/§17: todo
 * alerta aponta os dados que o originaram). */
export function calcularCompletude({ pessoas, contas, categorias, transacoes }) {
  const pendencias = [];
  if (!(pessoas || []).length) pendencias.push("Nenhuma pessoa cadastrada.");
  if (!(contas || []).length) pendencias.push("Nenhuma conta cadastrada.");
  if ((contas || []).length && !(contas || []).some((c) => c.ehReserva)) {
    pendencias.push("Nenhuma conta marcada como reserva — a margem de segurança fica sem separação clara.");
  }
  if ((categorias || []).length && !(categorias || []).some((c) => c.essencial)) {
    pendencias.push("Nenhuma categoria marcada como essencial — a pressão de despesas fixas não pode ser calculada.");
  }
  const semCategoria = (transacoes || []).filter((t) => (t.tipo === "despesa" || t.tipo === "receita") && !t.categoriaId).length;
  if (semCategoria > 0) pendencias.push(`${semCategoria} lançamento${semCategoria > 1 ? "s" : ""} sem categoria.`);
  return { completo: pendencias.length === 0, pendencias };
}

/**
 * O diagnóstico inteiro (§8), uma leitura só. `patrimonioLiquido` reaproveita
 * o motor da Fase 9 (§14) — ativos menos as mesmas dívidas já consolidadas
 * aqui embaixo, sem recalcular passivo duas vezes.
 */
export function calcularDiagnostico({ contas, transacoes, categorias, dividas, pessoas, ativos, clareza, competenciaAtual, hoje }) {
  const visaoDividas = calcularVisaoConsolidada(dividas || [], hoje);
  const { totalCentavos: ativosCentavos } = calcularComposicaoAtivos(ativos || []);
  const passivosCentavos = visaoDividas.saldoTotalAtualCentavos;
  const evolucaoDespesa = calcularEvolucaoCustoDeVida(transacoes, competenciaAtual);
  const evolucaoReceita = calcularEvolucaoReceita(transacoes, competenciaAtual);

  return {
    estadoCaixa: {
      seguroParaGastarCentavos: clareza.seguroParaGastarCentavos,
      livreCentavos: clareza.livreCentavos,
    },
    pressaoFixas: calcularPressaoFixas(transacoes, categorias, competenciaAtual),
    pesoDividas: {
      comprometimentoMensalCentavos: visaoDividas.comprometimentoMensalCentavos,
      quantidadeAtrasadas: visaoDividas.quantidadeAtrasadas,
      saldoTotalAtualCentavos: visaoDividas.saldoTotalAtualCentavos,
    },
    receita: calcularReceita(transacoes, competenciaAtual),
    evolucaoCustoDeVida: evolucaoDespesa,
    mudancasVsMesAnterior: { despesa: evolucaoDespesa, receita: evolucaoReceita },
    foraDoPadrao: calcularDespesasForaDoPadrao(transacoes, competenciaAtual),
    reserva: {
      saldoReservaCentavos: clareza.saldoReservaCentavos,
      temReserva: (contas || []).some((c) => c.ehReserva && c.status === "ativa"),
    },
    patrimonioLiquido: {
      disponivel: true,
      liquidoCentavos: calcularPatrimonioLiquido({ ativosCentavos, passivosCentavos }),
      ativosCentavos, passivosCentavos,
    },
    completude: calcularCompletude({ pessoas, contas, categorias, transacoes }),
  };
}
