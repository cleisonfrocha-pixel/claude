// Seções que abrem e fecham, cada uma com uma tela por dentro. A tela só é montada quando a seção abre
// (e desmontada quando fecha), então uma aba com várias telas pesadas começa curta e leve.

import { escapeHtml } from "../utilitarios.js";

export function criarTelaEmSecoes(secoes, { abertaPrimeira = true } = {}) {
  const montadas = new Map();
  return {
    montar(container) {
      container.innerHTML = secoes.map((s, i) => `
        <details class="renda-secao" data-secao-i="${i}"${abertaPrimeira && i === 0 ? " open" : ""}>
          <summary>${escapeHtml(s.titulo)}${s.resumo ? ` <small class="tela-sub" style="display:block;font-weight:400;">${escapeHtml(s.resumo)}</small>` : ""}</summary>
          <div class="secao-corpo" style="margin-top:12px;"></div>
        </details>`).join("");
      container.querySelectorAll("details[data-secao-i]").forEach((d) => {
        const i = Number(d.dataset.secaoI);
        const corpo = d.querySelector(".secao-corpo");
        const abrir = () => { if (!montadas.has(i)) { secoes[i].tela.montar(corpo); montadas.set(i, true); } };
        const fechar = () => { if (montadas.has(i)) { secoes[i].tela.desmontar?.(); montadas.delete(i); corpo.innerHTML = ""; } };
        d.addEventListener("toggle", () => (d.open ? abrir() : fechar()));
        if (d.open) abrir();
      });
    },
    desmontar() {
      for (const i of montadas.keys()) secoes[i].tela.desmontar?.();
      montadas.clear();
    },
  };
}
