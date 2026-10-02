// A folha que abre quando a pessoa toca em Paguei ou Recebi: de onde saiu o
// dinheiro (ou em que conta caiu), quando, e quanto. Mostra o efeito antes de
// confirmar ("Next: R$ 5.829 → R$ 5.672"). Quem chama recebe a resposta ou null.

import { opcoesDePagamento } from "../dados/pagamentoRepo.js";
import { formatarBRL, paraCentavos } from "../domain/dinheiro.js";
import { hojeISO, somarDias, formatarData } from "../domain/tempo.js";
import { escapeHtml } from "./utilitarios.js";
import * as modal from "./modal.js";

/**
 * @param {object} p
 * @param {string} p.descricao    o que está sendo pago/recebido
 * @param {number} p.valorCentavos valor combinado
 * @param {"despesa"|"receita"} p.sentido
 * @param {string} [p.contaSugeridaId] conta que o cadastro já indica
 * @param {boolean} [p.permiteCartao] só despesa comum pode ir pro cartão
 * @param {boolean} [p.valorFixo] fatura: o valor é o da fatura
 */
export async function pedirOrigemDoDinheiro({ descricao, valorCentavos, sentido, contaSugeridaId = null, permiteCartao = true, valorFixo = false }) {
  const op = await opcoesDePagamento();
  const hoje = hojeISO();
  const entrada = sentido === "receita";
  const contas = op.contas.filter((c) => !c.ehReserva || true);
  const cartoes = entrada || !permiteCartao ? [] : op.cartoes;
  const escolhaInicial = contas.find((c) => c.id === contaSugeridaId) || contas.find((c) => !c.ehReserva) || contas[0];

  return new Promise((resolver) => {
    let confirmado = false;
    const opcoes = [
      ...contas.map((c) => ({ chave: `conta:${c.id}`, titulo: c.nome, sub: [c.pessoa, c.ehReserva ? "reserva" : ""].filter(Boolean).join(" · "), direita: formatarBRL(c.saldoCentavos), saldo: c.saldoCentavos })),
      ...cartoes.map((c) => ({ chave: `cartao:${c.id}`, titulo: `Cartão ${c.apelido}`, sub: "o dinheiro só sai quando a fatura for paga", direita: `${formatarBRL(c.disponivelCentavos)} livres`, limite: c.disponivelCentavos, pagadora: c.contaPagadoraNome, saldoPagadora: c.saldoPagadoraCentavos, pagaEm: c.pagaEm })),
    ];
    modal.abrir(`
      <div class="modal folha-pagamento">
        <h2>${entrada ? "Recebi" : "Paguei"}: ${escapeHtml(descricao)}</h2>
        <div class="field"><label for="fp-valor">Valor ${entrada ? "recebido" : "pago"}</label>
          <input type="text" inputmode="decimal" id="fp-valor" value="${formatarBRL(valorCentavos).replace("R$ ", "")}" ${valorFixo ? "readonly" : ""}></div>
        <div class="tela-sub" id="fp-resto" style="margin:-6px 0 10px;" hidden></div>
        <div class="field"><label>${entrada ? "Em qual conta caiu?" : "De onde saiu o dinheiro?"}</label>
          <div class="fp-opcoes" role="radiogroup">
            ${opcoes.map((o) => `
              <label class="fp-opcao"><input type="radio" name="fp-origem" value="${escapeHtml(o.chave)}" ${o.chave === `conta:${escolhaInicial?.id}` ? "checked" : ""}>
                <span class="fp-opcao-corpo"><b>${escapeHtml(o.titulo)}</b>${o.sub ? `<small>${escapeHtml(o.sub)}</small>` : ""}</span>
                <span class="fp-opcao-valor mono" data-valor>${escapeHtml(o.direita)}</span></label>`).join("")}
          </div></div>
        <div class="field"><label for="fp-quando">Quando</label>
          <select id="fp-quando"><option value="hoje">Hoje (${escapeHtml(formatarData(hoje).slice(0, 5))})</option><option value="ontem">Ontem (${escapeHtml(formatarData(somarDias(hoje, -1)).slice(0, 5))})</option><option value="outro">Outro dia…</option></select>
          <input type="date" id="fp-data" value="${hoje}" max="${hoje}" hidden></div>
        <div class="fp-depois" id="fp-depois"></div>
        <div class="erro-form" id="fp-erro" hidden></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-fp="cancelar">Cancelar</button>
          <button class="btn btn-primary" data-fp="confirmar">${entrada ? "Confirmar recebimento" : "Confirmar pagamento"}</button>
        </div>
      </div>`, { onFechar: () => { if (!confirmado) resolver(null); } });

    const raiz = document.getElementById("overlay-modal").querySelector(".folha-pagamento");
    const q = (s) => raiz.querySelector(s);
    const valorAtual = () => (valorFixo ? valorCentavos : paraCentavos(q("#fp-valor").value));
    const origemAtual = () => raiz.querySelector('input[name="fp-origem"]:checked')?.value || "";
    const opcaoAtual = () => opcoes.find((o) => o.chave === origemAtual());
    const dataAtual = () => { const m = q("#fp-quando").value; return m === "hoje" ? hoje : m === "ontem" ? somarDias(hoje, -1) : q("#fp-data").value; };

    function atualizar() {
      const v = valorAtual();
      const resto = valorCentavos - v;
      const elResto = q("#fp-resto");
      elResto.hidden = !(resto > 0 && !valorFixo);
      if (!elResto.hidden) elResto.innerHTML = `Pagamento parcial: o resto, <b data-valor>${formatarBRL(resto)}</b>, continua ${entrada ? "a receber" : "a pagar"}.`;
      const o = opcaoAtual();
      const alvo = q("#fp-depois");
      if (!o || !(v > 0)) { alvo.innerHTML = ""; return; }
      if (o.chave.startsWith("conta:")) {
        const depois = o.saldo + (entrada ? v : -v);
        alvo.innerHTML = `${escapeHtml(o.titulo)}: <span class="mono" data-valor>${formatarBRL(o.saldo)}</span> → <b class="mono ${depois < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(depois)}</b>${depois < 0 ? " <span class='valor-neg'>(fica negativa)</span>" : ""}`;
      } else {
        const depois = o.limite - v;
        alvo.innerHTML = `Limite livre: <span class="mono" data-valor>${formatarBRL(o.limite)}</span> → <b class="mono ${depois < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(depois)}</b>${depois < 0 ? " <span class='valor-neg'>(passa do limite)</span>" : ""}. ${o.pagadora && o.saldoPagadora != null ? `A fatura sai de ${escapeHtml(o.pagadora)}${o.pagaEm ? " por volta de " + escapeHtml(formatarData(o.pagaEm).slice(0, 5)) : ""} (saldo hoje <span class="mono" data-valor>${formatarBRL(o.saldoPagadora)}</span>${o.saldoPagadora - v < 0 ? ", <span class='valor-neg'>não cobre esta compra</span>" : ""}).` : "A conta só é debitada quando você pagar a fatura."}`;
      }
    }
    raiz.addEventListener("input", atualizar);
    raiz.addEventListener("change", (ev) => {
      if (ev.target.id === "fp-quando") q("#fp-data").hidden = ev.target.value !== "outro";
      atualizar();
    });
    q('[data-fp="cancelar"]').addEventListener("click", () => modal.fechar());
    q('[data-fp="confirmar"]').addEventListener("click", () => {
      const v = valorAtual();
      const erro = q("#fp-erro");
      const o = opcaoAtual();
      if (!(v > 0) || v > valorCentavos * 1.0001 + 1) { erro.textContent = v > valorCentavos ? "O valor é maior que o combinado. Ajuste o valor da conta primeiro." : "Informe um valor maior que zero."; erro.hidden = false; return; }
      if (!o) { erro.textContent = entrada ? "Escolha em qual conta o dinheiro caiu." : "Escolha de onde o dinheiro saiu."; erro.hidden = false; return; }
      if (!dataAtual()) { erro.textContent = "Escolha o dia."; erro.hidden = false; return; }
      confirmado = true;
      const [tipo, id] = o.chave.split(":");
      resolver({ valorCentavos: v, dataPagamento: dataAtual(), contaId: tipo === "conta" ? id : null, cartaoId: tipo === "cartao" ? id : null });
      modal.fechar();
    });
    atualizar();
  });
}
