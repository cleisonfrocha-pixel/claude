// Domínio puro: o mapa dos próximos 12 meses. Responde "o que muda lá na
// frente e eu aguento?": para cada mês, quanto entra e sai de dinheiro
// seguro (confirmado + provável, nunca o incerto), quanto sobra e com quanto
// de saldo o mês termina. Por cima disso, os marcos (aluguel que começa,
// renda que acaba, parcela que quita) e o tamanho do buraco, se houver.
//
// Tudo sai do mesmo motor diário da projeção (calcularHorizonte): o mapa não
// tem conta própria, só corta o futuro mês a mês. Nada é gravado.

import { calcularHorizonte } from "./projecao.js";
import { competenciaDeData, somarMeses, diasNoMes, dataDeCompetencia } from "./tempo.js";
import { dataDaParcela } from "./dividas.js";

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** Marcos da vida financeira que mudam o mês: o que começa, o que acaba. */
export function marcosDosProximosMeses({ recorrencias, fontesRenda, dividas, hoje, meses = 12 }) {
  const atual = competenciaDeData(hoje);
  const ultimo = somarMeses(atual, meses - 1);
  const dentro = (c) => c && c > atual && c <= ultimo;
  const marcos = [];
  for (const r of recorrencias || []) {
    if (r.ativa === false) continue;
    const valor = Number(r.valorEstimadoCentavos) || 0;
    const receita = r.tipo === "receita";
    if (dentro(r.inicio)) marcos.push({ competencia: r.inicio, tipo: receita ? "entrada_nova" : "saida_nova", valorCentavos: valor, texto: `${r.descricao} começa`, origem: { tipo: "recorrencia", id: r.id } });
    if (r.fim && dentro(somarMeses(r.fim, 1))) marcos.push({ competencia: somarMeses(r.fim, 1), tipo: receita ? "entrada_acaba" : "saida_acaba", valorCentavos: valor, texto: `${r.descricao} termina`, origem: { tipo: "recorrencia", id: r.id } });
  }
  for (const f of fontesRenda || []) {
    if (f.ativa === false || !f.fim) continue;
    const c = somarMeses(f.fim, 1);
    if (dentro(c)) marcos.push({ competencia: c, tipo: "entrada_acaba", valorCentavos: Number(f.valorEsperadoCentavos) || 0, texto: `${f.nome} deixa de pagar`, origem: { tipo: "fonteRenda", id: f.id } });
  }
  for (const d of dividas || []) {
    const parcela = Number(d.valorParcelaCentavos) || 0;
    const total = Number(d.quantidadeParcelas) || 0;
    if (!(parcela > 0) || total <= (Number(d.parcelasPagas) || 0)) continue;
    const ultima = dataDaParcela(d, total - 1);
    const c = ultima ? somarMeses(competenciaDeData(ultima), 1) : null;
    if (dentro(c)) marcos.push({ competencia: c, tipo: "saida_acaba", valorCentavos: parcela, texto: `${d.nome} quita`, origem: { tipo: "divida", id: d.id } });
  }
  return marcos.sort((a, b) => a.competencia.localeCompare(b.competencia) || b.valorCentavos - a.valorCentavos);
}

/**
 * @param {object} p base (cadastros + transações) + saldoInicialCentavos,
 *   gastoDiaADiaMensalCentavos, hoje.
 */
export function mapaDeMeses({ saldoInicialCentavos, gastoDiaADiaMensalCentavos = 0, hoje, meses = 12, ...base }) {
  const atual = competenciaDeData(hoje);
  const marcos = marcosDosProximosMeses({ ...base, hoje, meses });
  const linhas = [];
  let anterior = { entradas: 0, saidas: 0, entradasIncerto: 0, saldo: saldoInicialCentavos };
  for (let i = 0; i < meses; i++) {
    const competencia = somarMeses(atual, i);
    const fim = dataDeCompetencia(competencia, diasNoMes(competencia));
    const h = calcularHorizonte({ ...base, gastoDiaADiaMensalCentavos, saldoInicialCentavos, hoje, dias: Math.max(0, diasEntre(hoje, fim)) });
    const entradas = h.entradasSeguroCentavos - anterior.entradas;
    const saidas = h.saidasSeguroCentavos - anterior.saidas;
    linhas.push({
      competencia, atual: i === 0,
      entradasCentavos: entradas, saidasCentavos: saidas, sobraCentavos: entradas - saidas,
      entradasIncertasCentavos: h.entradasIncertoCentavos - anterior.entradasIncerto,
      saldoFimCentavos: h.saldoFinalSeguroCentavos,
      marcos: marcos.filter((m) => m.competencia === competencia),
    });
    anterior = { entradas: h.entradasSeguroCentavos, saidas: h.saidasSeguroCentavos, entradasIncerto: h.entradasIncertoCentavos, saldo: h.saldoFinalSeguroCentavos };
  }
  return { linhas, marcos, buraco: acharBuraco(linhas), semDiaADia: !(gastoDiaADiaMensalCentavos > 0) };
}

/** O primeiro mês em que o saldo seguro vira negativo, o ponto mais baixo e
 * quanto falta por mês pra fechar. `null` quando o saldo aguenta os 12 meses.
 * A virada (`mesDaVirada`) é o primeiro mês em que a sobra mensal piora de
 * forma relevante e fica negativa: onde o mês passa a não se pagar. */
export function acharBuraco(linhas) {
  if (!linhas.length) return null;
  const negativo = linhas.find((l) => l.saldoFimCentavos < 0);
  const pior = linhas.reduce((m, l) => (l.saldoFimCentavos < m.saldoFimCentavos ? l : m), linhas[0]);
  // O mês corrente é só o que falta entrar e sair, não um mês inteiro: não serve de virada.
  const virada = linhas.find((l, i) => !l.atual && l.sobraCentavos < 0 && (i === 0 || linhas[i - 1].sobraCentavos >= 0 || l.sobraCentavos < linhas[i - 1].sobraCentavos - 100000));
  if (!negativo && !virada) return null;
  const deficitMensalCentavos = virada ? -virada.sobraCentavos : 0;
  return {
    mesDaVirada: virada ? virada.competencia : null,
    deficitMensalCentavos,
    primeiroMesNegativo: negativo ? negativo.competencia : null,
    pontoMaisBaixoCentavos: pior.saldoFimCentavos,
    mesDoPontoMaisBaixo: pior.competencia,
    faltaParaAguentarCentavos: Math.max(0, -pior.saldoFimCentavos),
    // Antes da virada, quanto o saldo ainda acumula: é o colchão que já se forma.
    saldoAntesDaViradaCentavos: virada ? (linhas[linhas.indexOf(virada) - 1]?.saldoFimCentavos ?? null) : null,
  };
}
