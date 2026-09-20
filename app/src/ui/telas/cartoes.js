import { criarTelaCadastro } from "./telaCadastro.js";
import { cartoes, pessoas, contas } from "../../dados/repositorios.js";
import { transacoes } from "../../dados/transacoesRepo.js";
import { faturas } from "../../dados/faturasRepo.js";
import { BANDEIRAS_CARTAO } from "../../domain/esquema.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO, competenciaLabel } from "../../domain/tempo.js";
import { calcularVisaoCartao, dataFechamentoFatura } from "../../domain/cartoes.js";
import { escapeHtml } from "../utilitarios.js";

const ROTULO_BANDEIRA = {
  visa: "Visa", mastercard: "Mastercard", elo: "Elo", amex: "American Express", outra: "Outra",
};
const ROTULO_NIVEL = { normal: null, atencao: "perto do limite", critico: "no limite" };

function linhaFatura(rotulo, f, subRotulo) {
  if (!f) return `<div class="fatura-linha"><span class="rotulo">${escapeHtml(rotulo)}</span><span class="tela-sub" style="margin:0;">nenhuma</span></div>`;
  return `
    <div class="fatura-linha">
      <span class="rotulo">${escapeHtml(rotulo)}<small>${escapeHtml(subRotulo || `Vence ${formatarData(f.vencimento)}`)}</small></span>
      <b data-valor>${formatarBRL(f.totalCentavos)}</b>
    </div>`;
}

export default criarTelaCadastro({
  repo: cartoes,
  titulo: "Cartões",
  subtitulo: "Limite, fatura atual, próxima e o comprometimento futuro de cada cartão (§5).",
  rotuloNovo: "Novo cartão",
  singular: "Cartão",
  campos: [
    { id: "apelido", rotulo: "Apelido", tipo: "texto", obrigatorio: true, placeholder: "Ex.: Nubank Roxinho" },
    { id: "pessoaId", rotulo: "Responsável", tipo: "select-contexto", origemContexto: "pessoas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma pessoa" },
    { id: "contaPagamentoId", rotulo: "Conta de pagamento da fatura", tipo: "select-contexto", origemContexto: "contas", obrigatorio: true, permiteVazio: true, rotuloVazio: "Selecione uma conta" },
    { id: "bandeira", rotulo: "Bandeira", tipo: "select", opcoes: BANDEIRAS_CARTAO.map((b) => ({ valor: b, rotulo: ROTULO_BANDEIRA[b] })) },
    { id: "limiteTotalCentavos", rotulo: "Limite total", tipo: "moeda" },
    { id: "diaFechamento", rotulo: "Dia de fechamento", tipo: "numero", min: 1, max: 31, obrigatorio: true },
    { id: "diaVencimento", rotulo: "Dia de vencimento", tipo: "numero", min: 1, max: 31, obrigatorio: true },
  ],
  async carregarContexto() {
    const [listaPessoas, listaContas, listaTransacoes, listaFaturas] = await Promise.all([
      pessoas.listar(), contas.listar(), transacoes.listar(), faturas.listar(),
    ]);
    return {
      pessoas: listaPessoas.map((p) => ({ valor: p.id, rotulo: p.dados.nome })),
      contas: listaContas.map((c) => ({ valor: c.id, rotulo: c.dados.nome })),
      transacoes: listaTransacoes,
      faturas: listaFaturas,
    };
  },
  exibir(dados, contexto, id) {
    const pessoa = (contexto.pessoas || []).find((p) => p.valor === dados.pessoaId);
    const visao = visaoDoCartao(dados, id, contexto);
    const nivel = ROTULO_NIVEL[visao.nivelAlerta];
    return {
      titulo: dados.apelido,
      sub: `${ROTULO_BANDEIRA[dados.bandeira] || dados.bandeira}${pessoa ? " · " + pessoa.rotulo : ""} · disponível ${formatarBRL(visao.disponivelCentavos)}`,
      valorDireita: formatarBRL(dados.limiteTotalCentavos),
      tag: dados.status !== "ativo" ? dados.status : nivel,
      tagInativa: dados.status !== "ativo",
      tagClasse: dados.status === "ativo" ? visao.nivelAlerta : null,
    };
  },
  renderExtra(dados, id, contexto) {
    const visao = visaoDoCartao(dados, id, contexto);
    const barraClasse = visao.nivelAlerta !== "normal" ? ` ${visao.nivelAlerta}` : "";
    const largura = Math.min(100, visao.percentualUtilizado);
    return `
      <div class="tela-sub" style="margin:0 0 4px;">Utilizado <span data-valor>${formatarBRL(visao.utilizadoCentavos)}</span> de <span data-valor>${formatarBRL(visao.limiteTotalCentavos)}</span> (${Math.round(visao.percentualUtilizado)}%)</div>
      <div class="barra-limite${barraClasse}"><span style="width:${largura}%"></span></div>
      ${linhaFatura("Fatura atual", visao.faturaAtual, visao.faturaAtual ? (visao.faturaAtual.fechada
        ? `Fechada · vence ${formatarData(visao.faturaAtual.vencimento)}`
        : `Em aberto · fecha ${formatarData(dataFechamentoFatura(dados, visao.faturaAtual.competencia))}, vence ${formatarData(visao.faturaAtual.vencimento)}`) : null)}
      ${linhaFatura("Próxima fatura", visao.proximaFatura)}
      ${visao.comprometimentoFuturo.length ? `
        <div class="tela-sub" style="margin:12px 0 4px;">Compromisso futuro (parcelas)</div>
        ${visao.comprometimentoFuturo.map((f) => linhaFatura(competenciaLabel(f.competencia), f, `Vence ${formatarData(f.vencimento)}`)).join("")}
      ` : ""}
    `;
  },
});

function visaoDoCartao(dados, cartaoId, contexto) {
  const faturasDoCartao = (contexto.faturas || [])
    .filter((f) => f.dados.cartaoId === cartaoId)
    .map((f) => ({ id: f.id, ...f.dados }));
  return calcularVisaoCartao({
    cartao: dados,
    transacoesDoCartao: (contexto.transacoes || []).map((t) => t.dados),
    faturasDoCartao,
    hoje: hojeISO(),
  });
}
