// Um jeito só de dar baixa em qualquer tela: pergunta de onde saiu (ou onde
// caiu), grava, e avisa com Desfazer. Quem chama só descreve o item.

import { pedirOrigemDoDinheiro } from "./folhaDePagamento.js";
import { darBaixaTransacao, darBaixaEvento, darBaixaFatura, desfazerBaixa } from "../dados/baixaRepo.js";
import { mostrarToast } from "./utilitarios.js";

/**
 * @param {object} item { tipo: "transacao"|"evento"|"fatura", transacaoId?, evento?, faturaId?, cartaoId?,
 *   descricao, valorCentavos, contaSugeridaId?, origem? }
 * @param {"despesa"|"receita"} sentido
 * @returns {Promise<object|null>} o descritor de desfazer, ou null se a pessoa desistiu
 */
export async function baixarComPergunta(item, sentido, { aoConcluir } = {}) {
  const permiteCartao = sentido === "despesa" && item.tipo !== "fatura" && item.origem?.tipo !== "divida";
  const resposta = await pedirOrigemDoDinheiro({
    descricao: item.descricao, valorCentavos: item.valorCentavos, sentido,
    contaSugeridaId: item.contaSugeridaId || null, permiteCartao, valorFixo: item.tipo === "fatura",
  });
  if (!resposta) return null;
  const { valorCentavos, contaId, cartaoId, dataPagamento } = resposta;
  try {
    let desfazer;
    if (item.tipo === "transacao") desfazer = await darBaixaTransacao(item.transacaoId, { valorCentavos, contaId, cartaoId, dataPagamento });
    else if (item.tipo === "evento") desfazer = await darBaixaEvento(item.evento, { valorCentavos, contaId, cartaoId, dataPagamento });
    else desfazer = await darBaixaFatura({ faturaId: item.faturaId, cartaoId: item.cartaoId, valorCentavos: item.valorCentavos, descricao: item.descricao, contaId, dataPagamento });
    mostrarToast(`${item.descricao} ${sentido === "receita" ? "recebida" : "paga"}.`, { acao: { rotulo: "Desfazer", fn: async () => {
      try { await desfazerBaixa(desfazer); mostrarToast("Desfeito."); } catch (e) { mostrarToast(e.message || "Não consegui desfazer."); }
    } } });
    if (aoConcluir) aoConcluir(desfazer);
    return desfazer;
  } catch (e) {
    mostrarToast(e.message || "Não consegui dar baixa.");
    return null;
  }
}
