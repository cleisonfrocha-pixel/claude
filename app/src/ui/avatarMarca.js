// Quadradinho com o logo da instituição (ou a sigla colorida) que aparece à esquerda dos itens.
// A decisão de qual marca usar está em domain/marcas.js; aqui só vira HTML. O logo é um SVG
// embutido (sem baixar imagem de lugar nenhum), então nunca fica quebrado.

import { marcaDe } from "../domain/marcas.js";
import { escapeHtml } from "./utilitarios.js";

/** `textos` = o que identifica o item (título, credor...). `classe` = classe de tamanho do quadradinho. */
export function avatarMarcaHtml(textos, { classe = "item-avatar" } = {}) {
  const m = marcaDe(...(Array.isArray(textos) ? textos : [textos]));
  const estilo = `background:${m.fundo};color:${m.texto};`;
  if (m.tipo === "logo") {
    return `<span class="${classe} marca" style="${estilo}" role="img" aria-label="${escapeHtml(m.titulo)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${m.d}" fill="currentColor"/></svg></span>`;
  }
  return `<span class="${classe} marca${m.pequena ? " marca-pequena" : ""}" style="${estilo}" aria-hidden="true">${escapeHtml(m.sigla)}</span>`;
}
