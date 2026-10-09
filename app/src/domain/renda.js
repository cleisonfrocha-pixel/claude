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
  // "sem-fonte" é receita sem fonte de renda vinculada — entra na conta do
  // percentual (é dinheiro de verdade), mas não conta como uma fonte
  // cadastrada de verdade: dizer "concentrado em 1 fonte" quando não existe
  // fonte nenhuma cadastrada seria inventar um cadastro que não existe.
  const quantidadeFontes = Array.from(porFonte.keys()).filter((chave) => chave !== "sem-fonte").length;
  return {
    totalCentavos,
    concentracaoPercentual: totalCentavos > 0 ? Math.round((maiorFonteCentavos / totalCentavos) * 100) : 0,
    quantidadeFontes,
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
 * A PERGUNTA CENTRAL do §12: HAVENDO déficit, diz se o problema é de
 * gasto, de timing de caixa, de dívida, de renda, ou de uma combinação.
 *
 * Primeiro decide se há déficit — o mês não fecha (renda abaixo do que
 * saiu, ou abaixo de essencial + parcelas) ou o caixa aperta num dia
 * específico. Só então procura a causa. Antes, uma "causa" disparava
 * sozinha e a tela gritava "déficit" num mês com sobra.
 *
 * `custoEssencialCentavos` vem de `calcularCustos` (sem parcela de
 * dívida); `custoAtualCentavos` inclui as parcelas pagas no mês
 * (`custoDividasPagasCentavos`), que por isso saem antes de comparar o
 * gasto do dia a dia com o essencial.
 */
export function diagnosticarCausaDeficit({ rendaAtualCentavos, custoEssencialCentavos, custoAtualCentavos, custoDividasPagasCentavos = 0, comprometimentoMensalDividasCentavos = 0, seguroParaGastarCentavos }) {
  const causas = [];
  const compromissoFixo = custoEssencialCentavos + comprometimentoMensalDividasCentavos;
  const mesNaoFecha = rendaAtualCentavos < custoAtualCentavos || rendaAtualCentavos < compromissoFixo;

  if (mesNaoFecha) {
    if (rendaAtualCentavos < custoEssencialCentavos) {
      causas.push({
        tipo: "renda",
        titulo: "A renda atual não cobre o custo essencial",
        dados: { rendaAtualCentavos, custoEssencialCentavos, faltaCentavos: custoEssencialCentavos - rendaAtualCentavos },
      });
    }

    const gastoDoDiaADia = custoAtualCentavos - custoDividasPagasCentavos;
    const limiteGasto = Math.round(custoEssencialCentavos * (1 + MARGEM_GASTO_ACIMA_DO_ESSENCIAL_PCT / 100));
    if (gastoDoDiaADia > limiteGasto && custoAtualCentavos > rendaAtualCentavos) {
      causas.push({
        tipo: "gasto",
        titulo: "O gasto do mês passou do que a renda sustenta",
        dados: { custoAtualCentavos, custoEssencialCentavos, rendaAtualCentavos, excedenteCentavos: custoAtualCentavos - rendaAtualCentavos },
      });
    }

    const sobraAposEssencial = rendaAtualCentavos - custoEssencialCentavos;
    if (comprometimentoMensalDividasCentavos > 0 && sobraAposEssencial < comprometimentoMensalDividasCentavos) {
      causas.push({
        tipo: "divida",
        titulo: "Depois do essencial, o que sobra não paga as parcelas de dívida",
        dados: { sobraAposEssencial, comprometimentoMensalDividasCentavos, faltaCentavos: comprometimentoMensalDividasCentavos - sobraAposEssencial },
      });
    }
  } else if (seguroParaGastarCentavos < 0) {
    causas.push({
      tipo: "timing",
      titulo: "O mês fecha no papel, mas o caixa aperta pelas datas de vencimento",
      dados: { seguroParaGastarCentavos },
    });
  }

  return { temDeficit: causas.length > 0 || mesNaoFecha, causas };
}
