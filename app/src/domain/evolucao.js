// Evolução: estou saindo do buraco? Série mensal e uma tendência em palavras
// simples. Puro (CLAUDE.md). Mês sem dado aparece como "sem dado", nunca é
// inventado: o menor ponto de caixa só existe nos meses em que o painel o
// registrou (instantâneos), o patrimônio nos meses com retrato.

import { resultadoDoMes } from "./fechamento.js";
import { competenciasComDados } from "./orcamento.js";
import { competenciaDeData, somarMeses } from "./tempo.js";
import { calcularVisaoConsolidada } from "./dividas.js";

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** Contas pagas depois do vencimento no mês (por competência do vencimento). */
export function pagasComAtraso(transacoes, competencia) {
  const lista = (transacoes || []).filter((t) => t.tipo === "despesa" && t.status === "pago" && !t.cartaoId && !t.faturaId && !t.semDia
    && t.pagoEm && t.data && t.pagoEm > t.data && competenciaDeData(t.data) === competencia);
  return { quantidade: lista.length, valorCentavos: lista.reduce((s, t) => s + (Number(t.valorCentavos) || 0), 0), diasMedios: lista.length ? Math.round(lista.reduce((s, t) => s + diasEntre(t.data, t.pagoEm), 0) / lista.length) : 0 };
}

/** Instantâneo de caixa de um mês, para guardar: o pior momento visto e quantas contas estavam atrasadas. */
export function mesclarInstantaneo(existente, { competencia, menorPontoCentavos, atrasadasQuantidade, atrasadasCentavos, livreGarantidoCentavos, hoje }) {
  const menor = existente && existente.menorPontoCentavos != null ? Math.min(existente.menorPontoCentavos, menorPontoCentavos) : menorPontoCentavos;
  const atrMax = existente ? Math.max(existente.atrasadasMaximo || 0, atrasadasQuantidade) : atrasadasQuantidade;
  return { competencia, menorPontoCentavos: menor, atrasadasQuantidade, atrasadasMaximo: atrMax, atrasadasCentavos, livreGarantidoCentavos, atualizadoEm: hoje };
}

export function montarEvolucao({ transacoes, categorias, dividas, snapshots, instantaneos, hoje, meses = 6 }) {
  const atual = competenciaDeData(hoje);
  const comDados = competenciasComDados(transacoes);
  const snap = (c) => (snapshots || []).find((s) => s.competencia === c) || null;
  const inst = (c) => (instantaneos || []).find((s) => s.competencia === c) || null;

  const serie = [];
  for (let i = meses - 1; i >= 0; i--) {
    const c = somarMeses(atual, -i);
    const s = snap(c);
    const n = inst(c);
    const r = resultadoDoMes(transacoes, categorias, c);
    serie.push({
      competencia: c, emAndamento: c === atual,
      temDados: comDados.has(c),
      pagasComAtraso: pagasComAtraso(transacoes, c),
      resultadoCentavos: comDados.has(c) ? r.resultadoCentavos : null,
      patrimonioLiquidoCentavos: s ? s.liquidoCentavos : null,
      dividaCentavos: s ? s.passivosCentavos : null,
      menorPontoCentavos: n ? n.menorPontoCentavos : null,
      atrasadasMaximo: n ? n.atrasadasMaximo : null,
    });
  }

  // Tendência: último mês FECHADO contra o anterior a ele (o mês corrente está incompleto).
  const fechados = serie.filter((p) => !p.emAndamento && p.temDados);
  const razoes = [];
  let pontos = 0;
  let comparados = 0;
  if (fechados.length >= 2) {
    const a = fechados[fechados.length - 2];
    const b = fechados[fechados.length - 1];
    const cmp = (rotulo, va, vb, { menorEMelhor, formato }) => {
      if (va == null || vb == null) return;
      comparados += 1;
      if (va === vb) { razoes.push({ rotulo, sentido: "igual", de: va, para: vb }); return; }
      const melhorou = menorEMelhor ? vb < va : vb > va;
      pontos += melhorou ? 1 : -1;
      razoes.push({ rotulo, sentido: melhorou ? "melhor" : "pior", de: va, para: vb, formato });
    };
    cmp("Contas pagas com atraso", a.pagasComAtraso.quantidade, b.pagasComAtraso.quantidade, { menorEMelhor: true, formato: "qtd" });
    cmp("Resultado do mês", a.resultadoCentavos, b.resultadoCentavos, { menorEMelhor: false, formato: "brl" });
    cmp("Dívida total", a.dividaCentavos, b.dividaCentavos, { menorEMelhor: true, formato: "brl" });
    cmp("Pior momento do caixa", a.menorPontoCentavos, b.menorPontoCentavos, { menorEMelhor: false, formato: "brl" });
    cmp("Patrimônio líquido", a.patrimonioLiquidoCentavos, b.patrimonioLiquidoCentavos, { menorEMelhor: false, formato: "brl" });
  }

  // Hoje: o que está em atraso agora e quanto das parcelas pesa sobre a renda do último mês fechado.
  const visao = calcularVisaoConsolidada(dividas || [], hoje);
  const ultimo = fechados[fechados.length - 1];
  const rendaUltimo = ultimo ? resultadoDoMes(transacoes, categorias, ultimo.competencia).receitaCentavos : 0;
  const comprometimentoPct = rendaUltimo > 0 ? Math.round((visao.comprometimentoMensalCentavos / rendaUltimo) * 100) : null;

  let status = "sem_dados";
  if (comparados >= 2) status = pontos > 0 ? "melhorando" : pontos < 0 ? "piorando" : "estavel";
  const bolaDeNeve = status === "piorando" && (comprometimentoPct != null && comprometimentoPct >= 40 || visao.quantidadeSemAcordo > 0);

  return { serie, tendencia: { status, comparados, razoes, bolaDeNeve }, hoje: { comprometimentoPct, dividasSemAcordo: visao.quantidadeSemAcordo, saldoProblemasCentavos: visao.saldoProblemasCentavos } };
}
