// Busca global: uma lupa no topo que procura em transações, dívidas, bens,
// recorrências, fontes de renda, cartões e contas, e leva até a tela certa.

import { carregarBase } from "../dados/base.js";
import { buscaGlobal } from "../domain/busca.js";
import { formatarBRL } from "../domain/dinheiro.js";
import { abrir as abrirModal, fechar as fecharModal } from "./modal.js";
import { navegar } from "./navegacao.js";
import { escapeHtml } from "./utilitarios.js";

export function ligarBuscaGlobal() {
  document.getElementById("btn-busca")?.addEventListener("click", abrir);
}

async function abrir() {
  const base = await carregarBase();
  abrirModal(`
    <div class="modal">
      <h2>Buscar</h2>
      <div class="filtros-barra"><input type="search" id="busca-texto" placeholder="Uma dívida, um gasto, um bem…" aria-label="Buscar em tudo" autocomplete="off"></div>
      <div id="busca-saida"><p class="tela-sub">Digite ao menos 2 letras.</p></div>
    </div>`);
  const entrada = document.getElementById("busca-texto");
  const saida = document.getElementById("busca-saida");
  let destinos = [];
  entrada.addEventListener("input", () => {
    const grupos = buscaGlobal(base, entrada.value);
    destinos = [];
    if (!grupos.length) { saida.innerHTML = `<p class="tela-sub">${entrada.value.trim().length < 2 ? "Digite ao menos 2 letras." : "Nada encontrado."}</p>`; return; }
    saida.innerHTML = grupos.map((g) => `
      <div class="busca-grupo">${escapeHtml(g.rotulo)}${g.total > g.itens.length ? ` (${g.total})` : ""}</div>
      ${g.itens.map((i) => { destinos.push(i.destino); return `
        <button class="busca-resultado" data-i="${destinos.length - 1}">
          <span>${escapeHtml(i.titulo || "")}${i.sub ? `<br><small class="tela-sub">${escapeHtml(i.sub)}</small>` : ""}</span>
          ${i.valorCentavos != null ? `<b class="mono" data-valor>${formatarBRL(i.valorCentavos)}</b>` : ""}
        </button>`; }).join("")}`).join("");
    saida.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { fecharModal(); navegar(destinos[Number(b.dataset.i)]); }));
  });
}
