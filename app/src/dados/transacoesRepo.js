// Transações — o repositório mais importante do sistema, porque é aqui que
// as operações compostas (transferência, parcelamento, pagamento de fatura)
// gravam mais de um documento ligado corretamente. O `db` não tem
// transação (ver db.d.ts): cada escrita é sequencial e aceita, como o
// resto da plataforma, que uma falha no meio deixe um par incompleto — é
// a mesma limitação que qualquer escrita composta tem aqui.

import * as db from "./db.js";
import { uid } from "./id.js";
import { cartoes, ErroDeValidacao } from "./repositorios.js";
import { obterOuCriarFatura, marcarFaturaPaga } from "./faturasRepo.js";
import { padraoTransacao, validarTransacao } from "../domain/esquema.js";
import { competenciaFatura, gerarParcelas, construirParTransferencia } from "../domain/transacoes.js";
import { competenciaDeData, somarMeses } from "../domain/tempo.js";

const CAMINHO = "transacoes";

export { ErroDeValidacao };

async function buscarCartao(cartaoId) {
  const lista = await cartoes.listar();
  const item = lista.find((c) => c.id === cartaoId);
  if (!item) throw new ErroDeValidacao(["Cartão não encontrado."]);
  return item.dados;
}

function agora() {
  return new Date().toISOString();
}

export const transacoes = {
  caminho: CAMINHO,
  listar: () => db.listar(CAMINHO),
  assinar: (cb) => db.assinar(CAMINHO, cb),
  async atualizar(id, campos) {
    const atual = (await db.listar(CAMINHO)).find((t) => t.id === id);
    const dados = padraoTransacao({ ...(atual ? atual.dados : {}), ...campos });
    const erros = validarTransacao(dados);
    if (erros.length) throw new ErroDeValidacao(erros);
    return db.atualizar(CAMINHO, id, { ...campos, atualizadoEm: agora() });
  },
  /** Apaga a transação; se for perna de uma transferência, apaga o par
   * inteiro — uma perna órfã não quebra os totais, mas deixa a
   * contabilidade inconsistente (dinheiro "sumindo" de uma conta sem
   * "aparecer" na outra). */
  async apagar(id) {
    const todas = await db.listar(CAMINHO);
    const alvo = todas.find((t) => t.id === id);
    if (!alvo) return;
    if (alvo.dados.transferenciaId) {
      const par = todas.filter((t) => t.dados.transferenciaId === alvo.dados.transferenciaId);
      for (const p of par) await db.apagar(CAMINHO, p.id);
      return;
    }
    return db.apagar(CAMINHO, id);
  },
};

/** Receita ou despesa simples. Se for despesa num cartão, resolve (ou cria)
 * a fatura certa automaticamente — a compra nunca fica sem fatura (§5). */
export async function criarSimples(dadosParciais) {
  const base = padraoTransacao(dadosParciais);
  if (!base.competencia) base.competencia = competenciaDeData(base.data);
  if (base.tipo === "despesa" && base.cartaoId && !base.faturaId) {
    const cartao = await buscarCartao(base.cartaoId);
    const competenciaFat = competenciaFatura(cartao, base.data);
    base.faturaId = await obterOuCriarFatura(base.cartaoId, competenciaFat);
  }
  const erros = validarTransacao(base);
  if (erros.length) throw new ErroDeValidacao(erros);
  return db.criar(CAMINHO, { ...base, criadoEm: agora(), atualizadoEm: agora() });
}

/** Transferência entre duas contas próprias — nunca receita, nunca despesa
 * (regra central do produto; ver domain/transacoes.js). `origem`/`origemId`
 * passam para as duas pernas — usado pela Fase 11 (§18) quando a
 * transferência nasce de uma importação reconciliada, não de digitação
 * manual (padrão default preserva o comportamento de sempre). */
export async function criarTransferencia({ contaOrigemId, contaDestinoId, valorCentavos, data, descricao, origem = "manual", origemId = null }) {
  if (!contaOrigemId || !contaDestinoId) throw new ErroDeValidacao(["Escolha as duas contas."]);
  if (contaOrigemId === contaDestinoId) throw new ErroDeValidacao(["A origem e o destino precisam ser contas diferentes."]);
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) throw new ErroDeValidacao(["Informe um valor maior que zero."]);
  const competencia = competenciaDeData(data);
  const transferenciaId = uid("tr");
  const par = construirParTransferencia({ contaOrigemId, contaDestinoId, valorCentavos, data, competencia, descricao, transferenciaId });
  const t = agora();
  for (const perna of par) {
    await db.criar(CAMINHO, { ...padraoTransacao({ ...perna, origem, origemId }), criadoEm: t, atualizadoEm: t });
  }
  return transferenciaId;
}

/** Compra parcelada — divide o valor sem perder centavo (dividirCentavos).
 *
 * Duas competências correm em paralelo, de propósito, e podem divergir:
 * a `competencia` da transação é sempre o mês-calendário da compra somado
 * ao número da parcela (parcela 1 em setembro, 2 em outubro, ...) — é o que
 * aparece no "quanto gastei em cada mês" (§7, §8, §13). A fatura de cada
 * parcela é resolvida à parte, pelo dia de fechamento do cartão (§5) — é o
 * "o que está na minha fatura de outubro". Uma compra feita depois do
 * fechamento cai na fatura do mês seguinte, mas continua contando como
 * despesa do mês em que foi feita: são perguntas diferentes, e misturá-las
 * foi um bug real desta fase (a primeira versão usava a competência da
 * fatura também como competência da transação — ver testes/transacoes.test.js
 * e a verificação de parcelamento no portão da Fase 1). */
export async function criarParcelamento({ valorTotalCentavos, quantidade, data, tipo = "despesa", cartaoId, contaId, categoriaId, pessoaId, descricao }) {
  if (!Number.isFinite(valorTotalCentavos) || valorTotalCentavos <= 0) throw new ErroDeValidacao(["Informe um valor total maior que zero."]);
  if (!Number.isInteger(quantidade) || quantidade < 2) throw new ErroDeValidacao(["Parcelamento precisa de 2 ou mais parcelas. Para 1x, lance como transação simples."]);
  if (!cartaoId && !contaId) throw new ErroDeValidacao(["Escolha uma conta ou um cartão."]);

  const competenciaInicial = competenciaDeData(data);
  let competenciaFaturaInicial = null;
  if (cartaoId) {
    const cartao = await buscarCartao(cartaoId);
    competenciaFaturaInicial = competenciaFatura(cartao, data);
  }

  const parcelaDeId = uid("pc");
  const camposComuns = { tipo, cartaoId: cartaoId || null, contaId: cartaoId ? null : contaId, categoriaId, pessoaId, descricao, data, status: "previsto", certeza: "provavel" };
  const partes = gerarParcelas({ valorTotalCentavos, quantidade, competenciaInicial, parcelaDeId, camposComuns });

  const t = agora();
  const ids = [];
  for (const parte of partes) {
    const dados = padraoTransacao(parte);
    if (cartaoId) {
      const competenciaFaturaDaParcela = somarMeses(competenciaFaturaInicial, parte.parcelaNum - 1);
      dados.faturaId = await obterOuCriarFatura(cartaoId, competenciaFaturaDaParcela);
    }
    // A primeira parcela normalmente já é o que está acontecendo agora.
    if (parte.parcelaNum === 1) { dados.status = "pago"; dados.certeza = "confirmado"; }
    const erros = validarTransacao(dados);
    if (erros.length) throw new ErroDeValidacao(erros);
    ids.push(await db.criar(CAMINHO, { ...dados, criadoEm: t, atualizadoEm: t }));
  }
  return { parcelaDeId, ids };
}

/** Paga uma fatura de cartão. É um débito da conta escolhida, mas NUNCA soma
 * de novo como despesa — as compras já foram contadas quando aconteceram
 * (ver domain/transacoes.js, agregarPeriodo). */
export async function registrarPagamentoFatura({ faturaId, contaId, valorCentavos, data, descricao }) {
  if (!faturaId) throw new ErroDeValidacao(["Escolha a fatura a pagar."]);
  if (!contaId) throw new ErroDeValidacao(["Escolha a conta de onde sai o pagamento."]);
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) throw new ErroDeValidacao(["Informe um valor maior que zero."]);
  const dados = padraoTransacao({
    tipo: "pagamento_fatura", contaId, faturaId, valorCentavos, data,
    competencia: competenciaDeData(data), descricao: descricao || "Pagamento de fatura", categoriaId: null,
  });
  const erros = validarTransacao(dados);
  if (erros.length) throw new ErroDeValidacao(erros);
  const id = await db.criar(CAMINHO, { ...dados, criadoEm: agora(), atualizadoEm: agora() });
  await marcarFaturaPaga(faturaId);
  return id;
}
