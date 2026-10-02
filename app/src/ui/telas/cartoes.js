import { criarTelaCadastro } from "./telaCadastro.js";
import { cartoes, pessoas, contas } from "../../dados/repositorios.js";
import { transacoes } from "../../dados/transacoesRepo.js";
import { faturas } from "../../dados/faturasRepo.js";
import { BANDEIRAS_CARTAO } from "../../domain/esquema.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, hojeISO, competenciaLabel } from "../../domain/tempo.js";
import { calcularVisaoCartao, dataFechamentoFatura, faturasContadasEmDobro } from "../../domain/cartoes.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";

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
  subtitulo: "Limite, fatura atual, próxima e o que já está comprometido nas próximas faturas de cada cartão.",
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
    { id: "diaPagamentoHabitual", rotulo: "Dia em que você costuma pagar a fatura (opcional)", tipo: "numero", min: 1, max: 31 },
    { id: "limiteLivreCentavos", rotulo: "Limite livre que o app do banco mostra hoje (opcional)", tipo: "moeda" },
    { id: "limiteLivreEm", rotulo: "Dia em que você viu esse limite", tipo: "data" },
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
    const semUso = !temUso(id, contexto);
    const nivel = semUso ? null : ROTULO_NIVEL[visao.nivelAlerta];
    return {
      titulo: dados.apelido,
      sub: `${ROTULO_BANDEIRA[dados.bandeira] || dados.bandeira}${pessoa ? " · " + pessoa.rotulo : ""} · ${semUso ? "sem dado de uso ainda" : `disponível ${formatarBRL(visao.disponivelCentavos)}`}`,
      valorDireita: formatarBRL(dados.limiteTotalCentavos),
      tag: dados.status !== "ativo" ? dados.status : nivel,
      tagInativa: dados.status !== "ativo",
      tagClasse: dados.status === "ativo" && !semUso ? visao.nivelAlerta : null,
    };
  },
  aoRenderizarExtra(dados, id, contexto, elExtra) {
    elExtra.querySelectorAll("[data-cancelar-resumo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          for (const tid of btn.dataset.cancelarResumo.split(",")) await transacoes.atualizar(tid, { status: "cancelado" });
          mostrarToast("Resumo cancelado. A fatura agora vale só as compras detalhadas.");
        } catch (e) { btn.disabled = false; mostrarToast(e.message || "Não consegui cancelar."); }
      });
    });
  },
  renderExtra(dados, id, contexto) {
    const visao = visaoDoCartao(dados, id, contexto);
    if (!temUso(id, contexto)) {
      return `<div class="tela-sub" style="margin:0;">Sem dado de uso ainda: nenhuma compra ou fatura lançada neste cartão. O limite de <span data-valor>${formatarBRL(visao.limiteTotalCentavos)}</span> está cadastrado, mas o quanto já foi usado é desconhecido até chegar a primeira fatura.</div>`;
    }
    const barraClasse = visao.nivelAlerta !== "normal" ? ` ${visao.nivelAlerta}` : "";
    const largura = Math.min(100, visao.percentualUtilizado);
    const dobro = dobrosDoCartao(id, contexto);
    return `
      ${dobro.map((d) => `
        <div class="alerta-cobertura" style="margin:0 0 12px;">
          <div class="titulo">Fatura contada em dobro</div>
          <div class="texto">Tem <b data-valor>${formatarBRL(d.resumoCentavos)}</b> num lançamento resumido e mais <b data-valor>${formatarBRL(d.detalhadoCentavos)}</b> em compras detalhadas. Se as compras já cobrem a fatura, cancele o resumo pra não contar duas vezes.</div>
          <button class="btn btn-ghost" data-cancelar-resumo="${escapeHtml(d.resumos.join(","))}">Cancelar o resumo (<span data-valor>${formatarBRL(d.resumoCentavos)}</span>)</button>
        </div>`).join("")}
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

function dobrosDoCartao(cartaoId, contexto) {
  const todas = (contexto.transacoes || []).map((t) => ({ id: t.id, ...t.dados }));
  return faturasContadasEmDobro(todas).filter((d) => d.cartaoId === cartaoId);
}

/** Cartão sem compra nem fatura não tem "0% usado": tem dado nenhum. */
function temUso(cartaoId, contexto) {
  return (contexto.transacoes || []).some((t) => t.dados.cartaoId === cartaoId && t.dados.status !== "cancelado")
    || (contexto.faturas || []).some((f) => f.dados.cartaoId === cartaoId);
}

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
