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
    const ativaOculta = config.abas.find((a) => a.id === abaAtiva)?.oculta;
    // Aba oculta (sem chip) tem um caminho de volta e, se pedido, um botão
    // flutuante de atalho nas outras abas.
    const voltar = ativaOculta ? `<button class="modulo-chip" data-aba="${escapeHtml(config.abas[0].id)}" role="tab">‹ ${escapeHtml(config.abas[0].rotulo)}</button>` : "";
    nav.innerHTML = voltar + config.abas.filter((a) => !a.oculta).map((a) => `
      <button class="modulo-chip${a.id === abaAtiva ? " ativo" : ""}" data-aba="${escapeHtml(a.id)}" role="tab">${escapeHtml(a.rotulo)}</button>
    `).join("");
    nav.querySelectorAll("[data-aba]").forEach((btn) => {
      btn.addEventListener("click", () => selecionar(btn.dataset.aba));
    });
    // Quando as abas não cabem na tela, um esmaecido na borda mostra que tem mais.
    const marcarRolagem = () => {
      nav.classList.toggle("rola-direita", nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 8);
      nav.classList.toggle("rola-esquerda", nav.scrollLeft > 8);
    };
    nav.addEventListener("scroll", marcarRolagem, { passive: true });
    requestAnimationFrame(marcarRolagem);
    const ativo = nav.querySelector(".ativo");
    if (ativo && ativo.scrollIntoView) requestAnimationFrame(() => nav.scrollTo({ left: Math.max(0, ativo.offsetLeft - 24), behavior: "auto" }));
    const flut = config.botaoFlutuante;
    if (flut && abaAtiva !== flut.aba) {
      const fab = document.createElement("button");
      fab.className = "fab-atalho";
      fab.type = "button";
      fab.textContent = flut.rotulo;
      fab.addEventListener("click", () => selecionar(flut.aba));
      containerAtual.appendChild(fab);
    }
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

  function definirAba(id) {
    if (config.abas.some((a) => a.id === id)) abaAtiva = id;
  }

  return { montar, desmontar, definirAba };
}
