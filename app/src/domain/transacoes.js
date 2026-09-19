// Domínio puro: transações. Este é o arquivo que decide se o produto conta
// dinheiro certo ou errado — ver CLAUDE.md, regras não negociáveis.
//
// A regra central mora aqui, num só lugar, para não poder vazar por
// esquecimento em alguma tela: transferência e pagamento de fatura NUNCA
// entram nos totais de receita ou despesa. Uma compra no cartão já é
// despesa no momento da compra; pagar a fatura depois é só a fatura sendo
// quitada — contar as duas seria contar o mesmo dinheiro duas vezes.

import { somar, dividirCentavos } from "./dinheiro.js";
import { somarMeses } from "./tempo.js";

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
  let receitas = 0, despesas = 0, transferencias = 0, pagamentosFatura = 0;
  for (const t of transacoes || []) {
    if (de && t.competencia < de) continue;
    if (ate && t.competencia > ate) continue;
    const v = Number(t.valorCentavos) || 0;
    if (CONTA_COMO_RECEITA.has(t.tipo)) receitas += v;
    else if (CONTA_COMO_DESPESA.has(t.tipo)) despesas += v;
    else if (t.tipo === "transferencia") transferencias += v;
    else if (t.tipo === "pagamento_fatura") pagamentosFatura += v;
  }
  return {
    receitas, despesas, transferencias, pagamentosFatura,
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
export function gerarParcelas({ valorTotalCentavos, quantidade, competenciaInicial, parcelaDeId, camposComuns = {} }) {
  const valores = dividirCentavos(valorTotalCentavos, quantidade);
  return valores.map((valorCentavos, i) => ({
    ...camposComuns,
    valorCentavos,
    competencia: somarMeses(competenciaInicial, i),
    parcelaDe: parcelaDeId,
    parcelaNum: i + 1,
    parcelaTotal: quantidade,
  }));
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
    { ...comum, contaId: contaOrigemId, cartaoId: null },
    { ...comum, contaId: contaDestinoId, cartaoId: null },
  ];
}
