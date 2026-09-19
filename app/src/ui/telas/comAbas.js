// Fábrica de tela com sub-abas — usada por "Dinheiro" (Contas/Cartões) e
// "Configurações" (Pessoas/Categorias/Preferências). Cada aba é uma tela
// (com montar/desmontar) que só existe montada enquanto está selecionada.

import { escapeHtml } from "../utilitarios.js";

export function criarTelaComAbas(config) {
  let abaAtiva = config.abas[0].id;
  let containerAtual = null;

  function montar(container) {
    containerAtual = container;
    renderizarCasco();
  }

  function desmontar() {
    const aba = config.abas.find((a) => a.id === abaAtiva);
    if (aba && aba.tela.desmontar) aba.tela.desmontar();
    containerAtual = null;
  }

  function renderizarCasco() {
    containerAtual.innerHTML = `
      ${config.titulo ? `
        <div class="tela-head" style="margin-bottom:6px;">
          <div>
            <h2 class="tela-titulo">${escapeHtml(config.titulo)}</h2>
            ${config.subtitulo ? `<p class="tela-sub">${escapeHtml(config.subtitulo)}</p>` : ""}
          </div>
        </div>` : ""}
      <div class="subabas" role="tablist"></div>
      <div id="conteudo-aba"></div>
    `;
    const nav = containerAtual.querySelector(".subabas");
    nav.innerHTML = config.abas.map((a) => `
      <button class="modulo-chip${a.id === abaAtiva ? " ativo" : ""}" data-aba="${escapeHtml(a.id)}" role="tab">${escapeHtml(a.rotulo)}</button>
    `).join("");
    nav.querySelectorAll("[data-aba]").forEach((btn) => {
      btn.addEventListener("click", () => selecionar(btn.dataset.aba));
    });
    montarAbaAtiva();
  }

  function montarAbaAtiva() {
    const aba = config.abas.find((a) => a.id === abaAtiva);
    const alvo = containerAtual.querySelector("#conteudo-aba");
    aba.tela.montar(alvo);
  }

  function selecionar(id) {
    if (id === abaAtiva) return;
    const abaAnterior = config.abas.find((a) => a.id === abaAtiva);
    if (abaAnterior && abaAnterior.tela.desmontar) abaAnterior.tela.desmontar();
    abaAtiva = id;
    renderizarCasco();
  }

  return { montar, desmontar };
}
