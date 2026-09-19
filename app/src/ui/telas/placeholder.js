// Tela de módulo ainda não construído. Honesto de propósito: em vez de uma
// tela vazia ou uma simulação de dado, diz claramente o que vai entrar ali
// e em qual fase — referência direta a docs/PLANO-DE-IMPLANTACAO.md.

import { escapeHtml } from "../utilitarios.js";

export function criarTelaPlaceholder({ titulo, descricao, faseRef, itens }) {
  return {
    montar(container) {
      container.innerHTML = `
        <div class="tela-head">
          <div>
            <h2 class="tela-titulo">${escapeHtml(titulo)}</h2>
            <p class="tela-sub">${escapeHtml(descricao)}</p>
          </div>
        </div>
        <div class="em-construcao">
          <div class="icone">🛠️</div>
          <h3>Ainda não construído</h3>
          <p>${escapeHtml(itens)}</p>
          <span class="fase-ref">chega na ${escapeHtml(faseRef)}</span>
        </div>
      `;
    },
    desmontar() {},
  };
}
