// Várias telas, uma embaixo da outra, numa aba só (lista de 05/10, item 60: Agenda, Calendário e Fluxo
// viram uma tela; Contas e Cartões viram "Contas e cartões"). Cada tela continua sendo a mesma, com o
// seu montar/desmontar, só que cada uma no seu pedaço da página.

export function criarTelaEmPilha(telas) {
  return {
    montar(container) {
      container.innerHTML = telas.map((_, i) => `<div class="pilha-parte" data-parte="${i}"></div>`).join("");
      telas.forEach((t, i) => t.montar(container.querySelector(`[data-parte="${i}"]`)));
    },
    desmontar() {
      for (const t of telas) if (t.desmontar) t.desmontar();
    },
  };
}
