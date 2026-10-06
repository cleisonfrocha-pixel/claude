// Domínio puro: transações. Este é o arquivo que decide se o produto conta
// dinheiro certo ou errado — ver CLAUDE.md, regras não negociáveis.
//
// A regra central mora aqui, num só lugar, para não poder vazar por
// esquecimento em alguma tela: transferência e pagamento de fatura NUNCA
// entram nos totais de receita ou despesa. Uma compra no cartão já é
// despesa no momento da compra; pagar a fatura depois é só a fatura sendo
// quitada — contar as duas seria contar o mesmo dinheiro duas vezes.
// "repasse" é o terceiro caso: dinheiro de OUTRA pessoa que passou pela conta (recebi
// e repassei a venda de um familiar, o pai que deu o dinheiro de um imposto). Mexe no
// saldo, mas não é renda nem gasto: contar seria inflar os dois lados.

import { somar, dividirCentavos } from "./dinheiro.js";
import { somarMeses, dataDeCompetencia } from "./tempo.js";

/** Tipos que entram na soma de receita/despesa do período. Todo o resto —
 * transferencia, pagamento_fatura — existe na lista de transações mas nunca
 * nesta soma. Ver o teste "regra de ouro" em testes/transacoes.test.js. */
const CONTA_COMO_RECEITA = new Set(["receita"]);
const CONTA_COMO_DESPESA = new Set(["despesa"]);

/**
 * Agrega uma lista de transações num intervalo de competências [de, ate]
 * (strings "AAAA-MM", inclusive nos dois lados). Não recalcula nada fora
 * do que foi passado — quem chama decide o universo (mês, período, tudo).
 */
export function agregarPeriodo(transacoes, { de, ate } = {}) {
  let receitas = 0, despesas = 0, transferencias = 0, pagamentosFatura = 0, repasses = 0;
  for (const t of transacoes || []) {
    if (de && t.competencia < de) continue;
    if (ate && t.competencia > ate) continue;
    const v = Number(t.valorCentavos) || 0;
    if (CONTA_COMO_RECEITA.has(t.tipo)) receitas += v;
    else if (CONTA_COMO_DESPESA.has(t.tipo)) despesas += v;
    else if (t.tipo === "transferencia") transferencias += v;
    else if (t.tipo === "pagamento_fatura") pagamentosFatura += v;
    else if (t.tipo === "repasse") repasses += v;
  }
  return {
    receitas, despesas, transferencias, pagamentosFatura, repasses,
    resultado: receitas - despesas,
  };
}

/** Açúcar para o caso mais comum: totais de uma única competência. */
export function totalizarMes(transacoes, competencia) {
  return agregarPeriodo(transacoes, { de: competencia, ate: competencia });
}

/** Soma só o que está de fato pago — para distinguir do previsto/agendado. */
export function agregarPeriodoPago(transacoes, intervalo) {
  return agregarPeriodo((transacoes || []).filter((t) => t.status === "pago"), intervalo);
}

/**
 * A qual competência de fatura uma compra no cartão pertence, dado o dia de
 * fechamento do cartão. Compra em ou antes do fechamento entra na fatura do
 * mês corrente; depois do fechamento, entra na do mês seguinte.
 * @param {{diaFechamento:number}} cartao
 * @param {string} dataCompraISO "AAAA-MM-DD"
 */
export function competenciaFatura(cartao, dataCompraISO) {
  const [anoStr, mesStr, diaStr] = dataCompraISO.split("-");
  const competenciaCompra = `${anoStr}-${mesStr}`;
  const dia = parseInt(diaStr, 10);
  const fechamento = cartao.diaFechamento || 1;
  return dia <= fechamento ? competenciaCompra : somarMeses(competenciaCompra, 1);
}

/**
 * Gera os objetos de parcela de uma compra parcelada — puro: não grava nada,
 * só calcula. `parcelaDeId` é escolhido por quem chama (é a chave que une as
 * parcelas) porque geração de id não é responsabilidade do domínio.
 * A soma das parcelas geradas é sempre exatamente valorTotalCentavos —
 * nunca sobra nem falta centavo (ver dividirCentavos).
 */
export function gerarParcelas({ valorTotalCentavos, quantidade, competenciaInicial, parcelaDeId, camposComuns = {}, dataPorParcela = false }) {
  const valores = dividirCentavos(valorTotalCentavos, quantidade);
  // Parcelado direto na conta (boleto, carnê, Pix parcelado): cada parcela vence um mês depois da
  // anterior, no mesmo dia. Sem isso todas nasciam na data da compra e viravam "atrasadas" juntas.
  const dia = Number((camposComuns.data || "").slice(8, 10)) || 1;
  return valores.map((valorCentavos, i) => ({
    ...camposComuns,
    ...(dataPorParcela && camposComuns.data ? { data: dataDeCompetencia(somarMeses(competenciaInicial, i), dia) } : {}),
    valorCentavos,
    competencia: somarMeses(competenciaInicial, i),
    parcelaDe: parcelaDeId,
    parcelaNum: i + 1,
    parcelaTotal: quantidade,
  }));
}

/**
 * Os números de cada fatura, num lugar só (item 10 da lista de 05/10: cada tela somava a fatura de
 * um jeito e algumas somavam o próprio pagamento e as compras canceladas como se fossem compra).
 * - compras: despesas da fatura, sem as canceladas;
 * - pago: pagamentos de fatura já feitos;
 * - falta: o que ainda vai sair da conta (compras menos o que já foi pago, nunca negativo);
 * - total: o tamanho da fatura. Fatura antiga paga sem as compras detalhadas vale pelo que foi
 *   pago; com detalhe parcial, vale o maior dos dois (o pedaço sem detalhe é `semDetalhe`).
 */
export function totaisPorFatura(transacoes) {
  const mapa = new Map();
  const de = (id) => {
    if (!mapa.has(id)) mapa.set(id, { comprasCentavos: 0, pagoCentavos: 0 });
    return mapa.get(id);
  };
  for (const t of transacoes || []) {
    if (!t.faturaId || t.status === "cancelado") continue;
    const v = Number(t.valorCentavos) || 0;
    if (t.tipo === "despesa") de(t.faturaId).comprasCentavos += v;
    else if (t.tipo === "pagamento_fatura" && t.status === "pago") de(t.faturaId).pagoCentavos += v;
  }
  for (const x of mapa.values()) {
    x.faltaCentavos = Math.max(0, x.comprasCentavos - x.pagoCentavos);
    x.totalCentavos = Math.max(x.comprasCentavos, x.pagoCentavos);
    x.semDetalheCentavos = Math.max(0, x.pagoCentavos - x.comprasCentavos);
  }
  return mapa;
}

const VAZIA = Object.freeze({ comprasCentavos: 0, pagoCentavos: 0, faltaCentavos: 0, totalCentavos: 0, semDetalheCentavos: 0 });
/**
 * Quanto de cada pagamento de fatura é gasto SEM compra detalhada: a fatura inteira, quando ninguém
 * lançou compra nenhuma dela, ou só o pedaço que passa das compras lançadas (detalhe parcial). Esse
 * pedaço é gasto real de categoria desconhecida; o resto do pagamento não é gasto (as compras já
 * contaram). Repartido entre os pagamentos da fatura na proporção de cada um, sem perder centavo.
 * Devolve Map(id do pagamento -> centavos sem detalhe).
 */
export function parteSemDetalhePorPagamento(transacoes) {
  const totais = totaisPorFatura(transacoes);
  const pagamentos = new Map();
  for (const t of transacoes || []) {
    if (t.tipo !== "pagamento_fatura" || t.status !== "pago") continue;
    if (!t.faturaId) continue;
    if (!pagamentos.has(t.faturaId)) pagamentos.set(t.faturaId, []);
    pagamentos.get(t.faturaId).push(t);
  }
  const saida = new Map();
  for (const t of transacoes || []) {
    if (t.tipo === "pagamento_fatura" && t.status === "pago" && !t.faturaId) saida.set(t.id ?? t, Number(t.valorCentavos) || 0);
  }
  for (const [faturaId, lista] of pagamentos) {
    const { semDetalheCentavos, pagoCentavos } = totais.get(faturaId);
    let distribuido = 0;
    lista.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    lista.forEach((t, i) => {
      const parte = i === lista.length - 1 ? semDetalheCentavos - distribuido : Math.floor(semDetalheCentavos * (Number(t.valorCentavos) || 0) / pagoCentavos);
      distribuido += parte;
      saida.set(t.id ?? t, parte);
    });
  }
  return saida;
}

/** A fatura está paga quando o que foi pago cobre as compras dela (fatura sem compra detalhada:
 * qualquer pagamento quita, porque não há como saber o total). */
export function faturaQuitada({ comprasCentavos, pagoCentavos }) {
  return pagoCentavos > 0 && pagoCentavos >= comprasCentavos;
}

/** Os números de uma fatura só (ver `totaisPorFatura`). */
export function totaisDaFatura(transacoes, faturaId) {
  return totaisPorFatura((transacoes || []).filter((t) => t.faturaId === faturaId)).get(faturaId) || VAZIA;
}

/**
 * Quais competências uma recorrência mensal ainda precisa ter provisionadas,
 * dado um horizonte de meses a partir de agora e as competências que já
 * existem para ela. Puro: devolve o que falta, não grava nada. Herdeiro do
 * `ensureProvisionedEntries` do GEDI (ver ARQUITETURA.md, seção de reuso).
 */
export function competenciasFaltantes(recorrencia, { competenciaAtual, horizonteMeses, competenciasExistentes }) {
  const existentes = new Set(competenciasExistentes || []);
  const faltam = [];
  for (let i = 0; i < horizonteMeses; i++) {
    const chave = somarMeses(competenciaAtual, i);
    if (recorrencia.inicio && chave < recorrencia.inicio) continue;
    if (recorrencia.fim && chave > recorrencia.fim) continue;
    if (!existentes.has(chave)) faltam.push(chave);
  }
  return faltam;
}

/**
 * Constrói as duas pontas de uma transferência entre contas próprias — um
 * par de transações ligadas por transferenciaId, tipo 'transferencia' nas
 * duas, nunca 'despesa'/'receita'. É a implementação da regra mais
 * importante do produto (CLAUDE.md): transferência não é receita nem
 * despesa. `transferenciaId` também é escolhido por quem chama.
 */
export function construirParTransferencia({ contaOrigemId, contaDestinoId, valorCentavos, data, competencia, descricao, transferenciaId }) {
  const comum = { tipo: "transferencia", valorCentavos, data, competencia, descricao: descricao || "Transferência entre contas", transferenciaId, status: "pago", certeza: "confirmado" };
  return [
    { ...comum, contaId: contaOrigemId, cartaoId: null, direcao: "saida" },
    { ...comum, contaId: contaDestinoId, cartaoId: null, direcao: "entrada" },
  ];
}

/**
 * O efeito em centavos de uma transação sobre o saldo da SUA PRÓPRIA conta
 * (`transacao.contaId`) — nunca sobre uma conta arbitrária. Só transações
 * `status: "pago"` afetam saldo de verdade; previsto/agendado/atrasado
 * ainda não aconteceram de fato (entram no *comprometido*, não no saldo —
 * ver domain/caixa.js). `valorCentavos` é sempre uma magnitude positiva
 * (mesma convenção de agregarPeriodo); o sinal do efeito vem do `tipo` —
 * exceto transferência, que só sabe seu sinal pelo campo `direcao`, porque
 * as duas pernas compartilham o mesmo valor positivo.
 */
export function efeitoNaConta(transacao) {
  if (transacao.status !== "pago") return 0;
  if (!transacao.contaId) return 0; // despesa em cartão não mexe em conta até a fatura ser paga
  const v = Number(transacao.valorCentavos) || 0;
  if (transacao.tipo === "receita") return v;
  if (transacao.tipo === "despesa") return -v;
  if (transacao.tipo === "pagamento_fatura") return -v;
  if (transacao.tipo === "transferencia" || transacao.tipo === "repasse") return transacao.direcao === "entrada" ? v : -v;
  return 0;
}

/**
 * A quantos meses de distância da competência da fatura cai o vencimento,
 * dado que o dia de vencimento pode ser menor que o de fechamento (cartão
 * fecha dia 28, vence dia 5 — do mês seguinte). Convenção: vencimento no
 * mesmo mês da fatura quando diaVencimento >= diaFechamento; mês seguinte
 * quando é menor.
 */
export function competenciaVencimentoFatura(cartao, competenciaDaFatura) {
  return cartao.diaVencimento < cartao.diaFechamento ? somarMeses(competenciaDaFatura, 1) : competenciaDaFatura;
}

/** Data (AAAA-MM-DD) em que uma fatura vence, a partir da sua competência. */
export function dataVencimentoFatura(cartao, competenciaDaFatura) {
  return dataDeCompetencia(competenciaVencimentoFatura(cartao, competenciaDaFatura), cartao.diaVencimento);
}

/** Dia em que o dinheiro da fatura costuma SAIR da conta. Quem pedala paga logo
 * depois de fechar, antes do vencimento: `diaPagamentoHabitual` no cartão (o dia
 * do mês). Sem ele, ou se passar do vencimento, vale o vencimento. */
export function dataPagamentoPrevisto(cartao, competenciaDaFatura) {
  const venc = dataVencimentoFatura(cartao, competenciaDaFatura);
  const dia = Number(cartao.diaPagamentoHabitual) || 0;
  if (!dia) return venc;
  const habitual = dataDeCompetencia(competenciaVencimentoFatura(cartao, competenciaDaFatura), dia);
  const fechamento = dataDeCompetencia(competenciaDaFatura, cartao.diaFechamento);
  return habitual > fechamento && habitual < venc ? habitual : venc;
}

/**
 * O status "de verdade" de uma transação agora — mesma ideia de
 * `statusDivida` (§11, domain/dividas.js), aplicada a lançamento comum:
 * `previsto`/`agendado` cuja data já passou vira `atrasado` na leitura,
 * mesmo que ninguém tenha marcado assim manualmente. `pago`, `cancelado` e
 * um `atrasado` já gravado nunca mudam — já aconteceram, ou já é o que já
 * é. Sem isso, um compromisso vencido ficava "previsto" pra sempre.
 */
export function statusEfetivo(t, hoje) {
  if (t.status === "pago" || t.status === "cancelado" || t.status === "atrasado") return t.status;
  if (t.semDia && t.data && hoje) return t.data.slice(0, 7) < hoje.slice(0, 7) ? "atrasado" : t.status;
  if (hoje && t.data && t.data < hoje) return "atrasado";
  return t.status;
}
