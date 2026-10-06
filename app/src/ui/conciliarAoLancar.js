// Ao lançar um gasto ou recebimento já pago, procura a conta que ele
// provavelmente quita e pergunta. Se a pessoa disser que sim, dá baixa nela em
// vez de criar um lançamento novo (que deixaria a conta prevista aberta).

import { carregarBase } from "../dados/base.js";
import { candidatosDePagamento } from "../domain/conciliacao.js";
import { eventosFuturos } from "../domain/previstos.js";
import { diasNoMes, dataDeCompetencia } from "../domain/tempo.js";
import { formatarBRL } from "../domain/dinheiro.js";
import { formatarData, hojeISO } from "../domain/tempo.js";
import { escapeHtml } from "./utilitarios.js";
import * as modal from "./modal.js";

/** Resolve com o id da conta prevista escolhida, `{ evento }` quando a escolhida é uma conta que
 * ainda só existe no cadastro (renda da fonte, parcela de dívida, conta mensal ainda não gerada:
 * quem chama dá baixa no evento e o vínculo fica gravado), "novo" (é outro lançamento) ou null
 * (fechou a janela sem decidir: nada é gravado). */
export async function perguntarSeQuita(lancamento) {
  if (lancamento.status !== "pago" || !["despesa", "receita"].includes(lancamento.tipo)) return "novo";
  const base = await carregarBase();
  const hoje = hojeISO();
  // Contas previstas do mês do lançamento que ainda não viraram lançamento: entram na busca como se
  // fossem contas abertas, com um id próprio ("ev:N").
  const comp = (lancamento.data || hoje).slice(0, 7);
  const inicio = `${comp}-01` < hoje ? `${comp}-01` : hoje;
  const eventos = eventosFuturos({ ...base, de: inicio, ate: dataDeCompetencia(comp, diasNoMes(comp)), hoje })
    .filter((e) => e.tipo === lancamento.tipo && !e.estimativa && ["fonteRenda", "divida", "recorrencia"].includes(e.origem?.tipo));
  const comoConta = eventos.map((e, i) => ({ id: `ev:${i}`, tipo: e.tipo, status: e.atrasado ? "atrasado" : "previsto", data: e.vencimento || e.data, competencia: (e.vencimento || e.data).slice(0, 7), valorCentavos: e.valorCentavos, descricao: e.descricao, semDia: !!e.semDia }));
  const candidatos = candidatosDePagamento(lancamento, [...base.transacoes, ...comoConta], { hoje });
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
      resolver(v === "cancelar" ? null : v.startsWith("ev:") ? { evento: eventos[Number(v.slice(3))] } : v);
      modal.fechar();
    }));
  });
}
