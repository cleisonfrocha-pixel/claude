// Domínio puro: renda e gap de renda (§12). "O sistema não deve olhar
// apenas para redução de despesas — precisa mostrar a capacidade de
// geração de renda e o valor que falta para sustentar o plano" (texto do
// blueprint). A pergunta central desta fase: havendo déficit, dizer se o
// problema é de gasto, de timing de caixa, de dívida, de renda, ou de uma
// combinação — nunca só "existe déficit".

import { agregarPeriodoPago } from "./transacoes.js";
import { somarMeses } from "./tempo.js";

/** Renda realizada (paga) na competência — o que de fato entrou, não o
 * que era esperado. */
export function calcularRendaAtual(transacoes, competencia) {
  return agregarPeriodoPago(transacoes, { de: competencia, ate: competencia }).receitas;
}

/** Concentração da renda do mês entre as fontes cadastradas — a fatia que
 * vem da maior fonte única. Receita sem `fonteRendaId` entra como
 * "sem-fonte", pra não desaparecer da conta. */
export function calcularConcentracaoRenda(transacoes, competencia) {
  let totalCentavos = 0;
  const porFonte = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "receita" || t.status !== "pago" || t.competencia !== competencia) continue;
    const v = Number(t.valorCentavos) || 0;
    totalCentavos += v;
    const chave = t.fonteRendaId || "sem-fonte";
    porFonte.set(chave, (porFonte.get(chave) || 0) + v);
  }
  const maiorFonteCentavos = porFonte.size ? Math.max(...porFonte.values()) : 0;
  return {
    totalCentavos,
    concentracaoPercentual: totalCentavos > 0 ? Math.round((maiorFonteCentavos / totalCentavos) * 100) : 0,
    quantidadeFontes: porFonte.size,
    porFonte,
  };
}

/** Previsibilidade de UMA fonte: a fatia do que ela trouxe nos últimos
 * `mesesLookback` meses que veio confirmada (não provável/incerta), mais
 * em quantos desses meses ela de fato entrou. `null` quando não há
 * nenhuma entrada no período — não dá pra julgar previsibilidade sem dado. */
export function calcularPrevisibilidadeFonte(fonte, transacoesDaFonte, { competenciaAtual, mesesLookback = 3 } = {}) {
  const competenciaMinima = somarMeses(competenciaAtual, -(mesesLookback - 1));
  const doPeriodo = (transacoesDaFonte || []).filter((t) =>
    t.tipo === "receita" && t.status === "pago" && t.competencia >= competenciaMinima && t.competencia <= competenciaAtual);

  if (!doPeriodo.length) return null;

  const totalCentavos = doPeriodo.reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
  const confirmadoCentavos = doPeriodo.filter((t) => t.certeza === "confirmado").reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0);
  const mesesComEntrada = new Set(doPeriodo.map((t) => t.competencia)).size;

  return {
    previsibilidadePercentual: totalCentavos > 0 ? Math.round((confirmadoCentavos / totalCentavos) * 100) : 0,
    mesesComEntrada,
    mesesLookback,
  };
}

/** Histórico de entradas de uma fonte, mais recente primeiro. */
export function historicoFonte(fonte, transacoes) {
  return (transacoes || [])
    .filter((t) => t.tipo === "receita" && t.fonteRendaId === fonte.id)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}

/** Os três gaps do §12 — cada um é renda atual menos um patamar de custo.
 * Positivo é sobra, negativo é falta. */
export function calcularGaps({ rendaAtualCentavos, custoEssencialCentavos, custoDesejadoCentavos, metaRecuperacaoCentavos }) {
  return {
    gapEssencialCentavos: rendaAtualCentavos - custoEssencialCentavos,
    gapDesejadoCentavos: custoDesejadoCentavos != null ? rendaAtualCentavos - custoDesejadoCentavos : null,
    gapRecuperacaoCentavos: metaRecuperacaoCentavos != null ? rendaAtualCentavos - metaRecuperacaoCentavos : null,
  };
}

// Quanto o gasto do mês pode passar do essencial antes de contar como
// causa "gasto" — uma folga pequena e deliberada (discricionário normal),
// não uma licença para gastar sem limite.
const MARGEM_GASTO_ACIMA_DO_ESSENCIAL_PCT = 10;

/**
 * A PERGUNTA CENTRAL do §12: havendo déficit, diz se o problema é de
 * gasto, de timing de caixa, de dívida, de renda, ou de uma combinação —
 * cada causa é um check independente sobre números já calculados em
 * outro lugar do domínio (clareza de caixa, dívidas, orçamento), então
 * mais de uma pode disparar ao mesmo tempo (a combinação é a lista ter
 * mais de um item, não um tipo à parte).
 */
export function diagnosticarCausaDeficit({ rendaAtualCentavos, custoEssencialCentavos, custoAtualCentavos, comprometimentoMensalDividasCentavos, seguroParaGastarCentavos }) {
  const causas = [];

  if (rendaAtualCentavos < custoEssencialCentavos) {
    causas.push({
      tipo: "renda",
      titulo: "A renda atual não cobre o custo essencial",
      dados: { rendaAtualCentavos, custoEssencialCentavos, faltaCentavos: custoEssencialCentavos - rendaAtualCentavos },
    });
  }

  const limiteGasto = Math.round(custoEssencialCentavos * (1 + MARGEM_GASTO_ACIMA_DO_ESSENCIAL_PCT / 100));
  if (custoAtualCentavos > limiteGasto || custoAtualCentavos > rendaAtualCentavos) {
    causas.push({
      tipo: "gasto",
      titulo: "O gasto do mês passou do que a renda ou o essencial sustentam",
      dados: { custoAtualCentavos, custoEssencialCentavos, rendaAtualCentavos, excedenteCentavos: custoAtualCentavos - Math.min(limiteGasto, rendaAtualCentavos) },
    });
  }

  const sobraAposEssencial = rendaAtualCentavos - custoEssencialCentavos;
  if (comprometimentoMensalDividasCentavos > 0 && sobraAposEssencial < comprometimentoMensalDividasCentavos) {
    causas.push({
      tipo: "divida",
      titulo: "O que sobra depois do essencial não cobre as parcelas de dívida",
      dados: { sobraAposEssencial, comprometimentoMensalDividasCentavos, faltaCentavos: comprometimentoMensalDividasCentavos - sobraAposEssencial },
    });
  }

  if (seguroParaGastarCentavos < 0 && rendaAtualCentavos >= custoAtualCentavos) {
    causas.push({
      tipo: "timing",
      titulo: "O mês fecha no papel, mas o caixa aperta pelas datas de vencimento",
      dados: { seguroParaGastarCentavos },
    });
  }

  const temDeficit = causas.length > 0 || seguroParaGastarCentavos < 0 || rendaAtualCentavos < custoAtualCentavos;

  return { temDeficit, causas };
}
