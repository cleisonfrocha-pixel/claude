// "Atualizar saldo": uma folha só, com todas as contas, para o Cleison acertar o
// número quando abre o painel e ele está diferente do app do banco. Cada conta
// vem com o saldo que o painel calcula; ele digita o real e salva. A diferença
// fica registrada em `conferencias` (dados/pagamentoRepo.js), nunca some.

import { carregarBase } from "../dados/base.js";
import { conferirSaldo } from "../dados/pagamentoRepo.js";
import { calcularSaldoConta } from "../domain/caixa.js";
import { formatarBRL, paraCentavos } from "../domain/dinheiro.js";
import { abrir as abrirModal, fechar as fecharModal } from "./modal.js";
import { escapeHtml, mostrarToast } from "./utilitarios.js";

const paraCampo = (centavos) => (centavos / 100).toFixed(2).replace(".", ",");

export async function abrirAtualizarSaldo() {
  const base = await carregarBase();
  const ativas = base.contas.filter((c) => c.status === "ativa").map((c) => ({ conta: c, calculado: calcularSaldoConta(c, base.transacoes) }));
  if (!ativas.length) { mostrarToast("Nenhuma conta cadastrada."); return; }
  abrirModal(`
    <div class="modal">
      <h2>Atualizar saldo</h2>
      <p class="tela-sub" style="margin-bottom:12px;">Digite o saldo que aparece no app do banco. O painel refaz as contas a partir daí. Só muda o que você alterar.</p>
      ${ativas.map(({ conta, calculado }, i) => `
        <div class="field">
          <label for="as-${i}">${escapeHtml(conta.nome)} <small style="opacity:.7;">(painel: ${escapeHtml(formatarBRL(calculado))})</small></label>
          <input type="text" inputmode="decimal" id="as-${i}" value="${paraCampo(calculado)}">
        </div>`).join("")}
      <div class="erro-form" id="as-erro" hidden></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-as="cancelar">Cancelar</button>
        <button class="btn btn-primary" data-as="salvar">Salvar saldo</button>
      </div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-as="cancelar"]').addEventListener("click", fecharModal);
  raiz.querySelector('[data-as="salvar"]').addEventListener("click", async (ev) => {
    const botao = ev.currentTarget;
    const erro = raiz.querySelector("#as-erro");
    erro.hidden = true;
    try {
      const mudancas = [];
      ativas.forEach(({ conta, calculado }, i) => {
        const txt = raiz.querySelector(`#as-${i}`).value.trim();
        if (!txt) return;
        const informado = paraCentavos(txt);
        if (!Number.isFinite(informado)) throw new Error(`Valor inválido em ${conta.nome}.`);
        if (informado !== calculado) mudancas.push({ conta, informado });
      });
      if (!mudancas.length) { fecharModal(); mostrarToast("Os saldos já estavam certos."); return; }
      botao.disabled = true;
      for (const m of mudancas) await conferirSaldo(m.conta.id, m.informado);
      fecharModal();
      mostrarToast(mudancas.length === 1 ? `Saldo de ${mudancas[0].conta.nome} atualizado.` : `${mudancas.length} saldos atualizados.`);
    } catch (e) {
      botao.disabled = false;
      erro.textContent = e.message || "Não foi possível salvar.";
      erro.hidden = false;
    }
  });
}
