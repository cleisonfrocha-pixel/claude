// Ao lançar um gasto ou recebimento já pago, procura a conta que ele
// provavelmente quita e pergunta. Se a pessoa disser que sim, dá baixa nela em
// vez de criar um lançamento novo (que deixaria a conta prevista aberta).

import { transacoes } from "../dados/transacoesRepo.js";
import { candidatosDePagamento } from "../domain/conciliacao.js";
import { formatarBRL } from "../domain/dinheiro.js";
import { formatarData, hojeISO } from "../domain/tempo.js";
import { escapeHtml } from "./utilitarios.js";
import * as modal from "./modal.js";

/** Resolve com o id da conta prevista escolhida, "novo" (é outro lançamento) ou
 * null (fechou a janela sem decidir: nada é gravado). */
export async function perguntarSeQuita(lancamento) {
  if (lancamento.status !== "pago" || !["despesa", "receita"].includes(lancamento.tipo)) return "novo";
  const abertas = (await transacoes.listar()).map((t) => ({ id: t.id, ...t.dados }));
  const candidatos = candidatosDePagamento(lancamento, abertas, { hoje: hojeISO() });
  if (!candidatos.length) return "novo";
  return new Promise((resolver) => {
    let decidido = false;
    modal.abrir(`
      <div class="modal">
        <h2>Isso paga uma conta que já está na lista?</h2>
        <p class="tela-sub" style="margin-bottom:12px;">Você lançou <b>${escapeHtml(lancamento.descricao || "um pagamento")}</b> de <span data-valor>${formatarBRL(lancamento.valorCentavos)}</span>. Parece ser:</p>
        ${candidatos.map((c, i) => `
          <button class="fp-opcao" style="width:100%;text-align:left;" data-escolha="${escapeHtml(c.transacao.id)}">
            <span class="fp-opcao-corpo"><b>${escapeHtml(c.transacao.descricao)}</b><small>${c.verba ? "verba do mês: desconta daqui, sobra " + escapeHtml(formatarBRL(Math.max(0, c.transacao.valorCentavos - lancamento.valorCentavos))) : (c.transacao.status === "atrasado" ? "atrasada, " : "") + "vence " + escapeHtml(formatarData(c.transacao.data).slice(0, 5))}</small></span>
            <span class="fp-opcao-valor mono" data-valor>${formatarBRL(c.transacao.valorCentavos)}</span>
          </button>`).join("")}
        <div class="modal-actions" style="flex-wrap:wrap;margin-top:12px;">
          <button class="btn btn-ghost" data-escolha="novo">Não, é outro gasto</button>
          <button class="btn btn-ghost" data-escolha="cancelar">Cancelar</button>
        </div>
      </div>`, { onFechar: () => { if (!decidido) resolver(null); } });
    document.getElementById("overlay-modal").querySelectorAll("[data-escolha]").forEach((b) => b.addEventListener("click", () => {
      decidido = true;
      const v = b.dataset.escolha;
      resolver(v === "cancelar" ? null : v);
      modal.fechar();
    }));
  });
}
