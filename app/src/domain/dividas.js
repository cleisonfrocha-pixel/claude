// Domínio puro: dívidas e plano de saída (§11). A central mostra não só o
// saldo devido, mas a pressão que cada dívida exerce sobre o fluxo mensal.
//
// Saldo atual e status (ativa/atrasada/quitada) nunca são gravados — são
// sempre calculados a partir do saldo original e das parcelas pagas (regra
// "nada de total gravado" do CLAUDE.md). "Comprometimento mensal da renda"
// (bullet do blueprint) só divide de verdade pela renda a partir da Fase 8
// (§12, Renda) — até lá, mostra o comprometimento mensal em centavos.

import { somarMeses, competenciaDeData, dataDeCompetencia, hojeISO } from "./tempo.js";

export const STATUS_DIVIDA = ["ativa", "atrasada", "quitada"];

/** Valor presente de `n` parcelas iguais a uma taxa mensal (fração). */
function valorPresente(parcela, n, taxa) {
  if (n <= 0) return 0;
  if (!(taxa > 0)) return parcela * n;
  return parcela * (1 - (1 + taxa) ** -n) / taxa;
}

/** A taxa mensal (fração) que faz `n` parcelas de `parcela` valerem
 * `principal` hoje — os juros que o contrato embute sem dizer. Zero quando
 * o principal cadastrado já é a soma das parcelas (ou mais). */
function taxaImplicita(principal, parcela, n) {
  if (!(principal > 0) || !(parcela > 0) || n <= 0 || principal >= parcela * n) return 0;
  let baixo = 0, alto = 1;
  for (let i = 0; i < 80; i++) {
    const meio = (baixo + alto) / 2;
    if (valorPresente(parcela, n, meio) > principal) baixo = meio; else alto = meio;
  }
  return (baixo + alto) / 2;
}

/** Taxa mensal da dívida em fração: a informada; sem ela, a implícita no
 * contrato (principal, parcela, quantidade). */
export function taxaMensalEfetiva(divida) {
  const informada = Number(divida.taxaJurosMensalPct);
  if (divida.taxaJurosMensalPct != null && Number.isFinite(informada) && informada >= 0) return informada / 100;
  return taxaImplicita(Number(divida.saldoOriginalCentavos) || 0, Number(divida.valorParcelaCentavos) || 0, Number(divida.quantidadeParcelas) || 0);
}

/** Saldo devido agora: o que custaria quitar hoje.
 *
 * Com acordo (parcela > 0) é o valor presente das parcelas que faltam, na
 * taxa do contrato — é o que o credor cobra numa quitação antecipada.
 * Nem "original menos pago" (zera antes da última parcela quando os juros
 * estão embutidos na parcela e a dívida sumiria do plano), nem "parcelas
 * que faltam × parcela" (cobra juros futuros que quem quita não paga).
 *
 * Sem acordo (parcela zero) é o saldo cadastrado: o crescimento por juros
 * só aparece na simulação, que diz isso em voz alta. */
/** O que o credor cobra hoje, sem desconto: o valor com juros, se o cadastro tem. */
export function valorCobradoSemOfertaCentavos(divida) {
  return Math.max(0, Number(divida.valorComJurosCentavos) || 0, Number(divida.saldoOriginalCentavos) || 0);
}

/** Oferta de quitação que ainda vale: com valor e sem validade vencida. Devolve
 * { valorCentavos, validade, origem } ou null. Aceita a oferta guardada como
 * objeto ou nos campos soltos do formulário. */
export function ofertaVigente(divida, hoje = hojeISO()) {
  const o = divida.oferta || (Number(divida.ofertaValorCentavos) > 0
    ? { valorCentavos: divida.ofertaValorCentavos, validade: divida.ofertaValidade || null, origem: divida.ofertaOrigem || "" } : null);
  const valor = Number(o?.valorCentavos) || 0;
  if (!(valor > 0)) return null;
  if (o.validade && hoje && o.validade < hoje) return null;
  return { valorCentavos: valor, validade: o.validade || null, origem: o.origem || "" };
}

export function calcularSaldoAtual(divida, hoje = hojeISO()) {
  const parcela = Number(divida.valorParcelaCentavos) || 0;
  // Sem acordo, vale o que a pessoa realmente vai pagar: a oferta de quitação, se
  // existe e ainda vale (R$ 10.064 cobrados, R$ 3.522 na oferta: a dívida real é
  // R$ 3.522). Sem oferta, o valor cobrado com juros.
  if (!(parcela > 0)) {
    const oferta = ofertaVigente(divida, hoje);
    return oferta ? oferta.valorCentavos : valorCobradoSemOfertaCentavos(divida);
  }
  return Math.round(valorPresente(parcela, parcelasRestantes(divida), taxaMensalEfetiva(divida)));
}

export function parcelasRestantes(divida) {
  return Math.max(0, (Number(divida.quantidadeParcelas) || 0) - (Number(divida.parcelasPagas) || 0));
}

/** Data de vencimento da parcela de índice `indice` (0 = primeira),
 * contando a partir de `dataInicio` — mesmo padrão de rolagem de mês que
 * `dataVencimentoFatura` usa para cartões (o dia se mantém, o mês rola). */
export function dataDaParcela(divida, indice) {
  if (!divida.dataInicio) return null;
  const dia = Number(divida.dataInicio.slice(8, 10));
  const competencia = somarMeses(competenciaDeData(divida.dataInicio), indice);
  return dataDeCompetencia(competencia, dia);
}

/** A data em que a PRÓXIMA parcela (a primeira ainda não paga) vence. */
export function dataProximoVencimento(divida) {
  if (parcelasRestantes(divida) <= 0) return null;
  return dataDaParcela(divida, Number(divida.parcelasPagas) || 0);
}

/** A data da ÚLTIMA parcela — quando a dívida quita, sem nenhum aporte extra.
 * Dívida sem acordo (parcela zero) não tem data: não quita sozinha. */
export function dataEstimadaQuitacao(divida) {
  const total = Number(divida.quantidadeParcelas) || 0;
  if (total <= 0) return null;
  if (!(Number(divida.valorParcelaCentavos) > 0)) return null;
  return dataDaParcela(divida, total - 1);
}

/** Status sempre derivado na leitura: quitada (nada mais a pagar), atrasada
 * (a próxima parcela já devia ter vencido), ou ativa. */
export function statusDivida(divida, hoje) {
  if (parcelasRestantes(divida) <= 0) return "quitada";
  const proximo = dataProximoVencimento(divida);
  if (proximo && hoje && proximo < hoje) return "atrasada";
  return "ativa";
}

/** Como a dívida aparece pro usuário: "financiamento" é parcelado em dia,
 * com acordo e sem nome sujo (um carro sendo pago, por exemplo) e não é
 * dívida problema; "divida" é o que está atrasado, negativado, sem acordo ou
 * marcado em risco. O campo `tipo` ("financiamento"|"divida") do cadastro
 * decide quando o usuário quer forçar um lado. Quitada fica de fora. */
export function classificarDivida(divida, hoje) {
  if (statusDivida(divida, hoje) === "quitada") return "quitada";
  if (divida.tipo === "financiamento" || divida.tipo === "divida") {
    // Mesmo marcado como financiamento, atraso e nome sujo viram dívida.
    if (divida.tipo === "financiamento" && (divida.negativada || statusDivida(divida, hoje) === "atrasada")) return "divida";
    return divida.tipo;
  }
  const semAcordo = !(Number(divida.valorParcelaCentavos) > 0);
  if (semAcordo || divida.negativada || divida.emRisco || statusDivida(divida, hoje) === "atrasada") return "divida";
  return "financiamento";
}

/** Visão consolidada de todas as dívidas — cada número somado na leitura a
 * partir das dívidas individuais, nenhum total gravado. */
export function calcularVisaoConsolidada(dividas, hoje) {
  const todas = dividas || [];
  const ativas = todas.filter((d) => statusDivida(d, hoje) !== "quitada");
  const atrasadas = ativas.filter((d) => statusDivida(d, hoje) === "atrasada");
  const emRisco = ativas.filter((d) => d.emRisco);
  const negativadas = ativas.filter((d) => d.negativada);
  const semAcordo = ativas.filter((d) => !(Number(d.valorParcelaCentavos) > 0));

  const saldoTotalAtualCentavos = ativas.reduce((s, d) => s + calcularSaldoAtual(d), 0);
  const saldoTotalOriginalCentavos = todas.reduce((s, d) => s + (Number(d.saldoOriginalCentavos) || 0), 0);
  const comprometimentoMensalCentavos = ativas.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0);

  // Uma dívida sem acordo não quita sozinha — então o conjunto também não
  // tem data de quitação, em vez de mostrar a data só das que têm plano.
  const datasQuitacao = ativas.map((d) => dataEstimadaQuitacao(d)).filter(Boolean).sort();
  const dataQuitacaoTotal = semAcordo.length || !datasQuitacao.length ? null : datasQuitacao[datasQuitacao.length - 1];

  const problemas = ativas.filter((d) => classificarDivida(d, hoje) === "divida");
  const financiamentos = ativas.filter((d) => classificarDivida(d, hoje) === "financiamento");
  const soma = (l) => l.reduce((s, d) => s + calcularSaldoAtual(d), 0);

  return {
    // O que pesa como dívida de verdade (atrasada, negativada, sem acordo,
    // em risco) e o que é parcelado em dia: dois mundos que não se somam
    // num número vermelho só.
    quantidadeProblemas: problemas.length,
    saldoProblemasCentavos: soma(problemas),
    parcelasProblemasCentavos: problemas.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0),
    quantidadeFinanciamentos: financiamentos.length,
    saldoFinanciamentosCentavos: soma(financiamentos),
    parcelasFinanciamentosCentavos: financiamentos.reduce((s, d) => s + (Number(d.valorParcelaCentavos) || 0), 0),
    quantidadeAtivas: ativas.length,
    quantidadeAtrasadas: atrasadas.length,
    quantidadeEmRisco: emRisco.length,
    quantidadeNegativadas: negativadas.length,
    // Atrasadas que NÃO estão negativadas — pra não contar a mesma dívida
    // duas vezes quando a tela mostra as duas coisas lado a lado.
    quantidadeSoAtrasadas: atrasadas.filter((d) => !d.negativada).length,
    saldoNegativadoCentavos: negativadas.reduce((s, d) => s + calcularSaldoAtual(d), 0),
    quantidadeSemAcordo: semAcordo.length,
    saldoTotalAtualCentavos,
    saldoTotalOriginalCentavos,
    comprometimentoMensalCentavos,
    dataQuitacaoTotal,
  };
}
