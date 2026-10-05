// Barra de evolução com três pedaços que somam o total: o que já foi feito, o que já está previsto
// e o que falta. Cada pedaço tem rótulo, valor e porcentagem escritos embaixo (a cor sozinha não
// carrega a informação). Usada em dívidas, contas do mês, metas: tudo que "evolui" até um total.

import { formatarBRL } from "../domain/dinheiro.js";
import { escapeHtml } from "./utilitarios.js";

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/** segmentos = [{ cor? (cor CSS que vale mais que o tipo), tipo: "pago"|"previsto"|"atrasado"|"falta"|"livre", rotulo, centavos, detalhe? }]  (verde = feito, amarelo = previsto, roxo listrado = falta, cinza = livre).
 * `totalRotulo` e `totalCentavos` abrem a barra; `rodape` é uma frase opcional embaixo. */
export function barraEvolucao({ totalRotulo = "Valor total", totalCentavos, segmentos, rodape = "", compacta = false }) {
  const soma = totalCentavos > 0 ? totalCentavos : segmentos.reduce((s, x) => s + x.centavos, 0);
  const visiveis = segmentos.filter((s) => s.centavos > 0);
  const descricao = segmentos.map((s) => `${s.rotulo} ${formatarBRL(s.centavos)} (${pct(s.centavos, soma)}%)`).join(", ");
  return `
    <div class="evo${compacta ? " evo-compacta" : ""}">
      <div class="evo-topo"><span>${escapeHtml(totalRotulo)}</span><b data-valor>${formatarBRL(soma)}</b></div>
      <div class="evo-barra" role="img" aria-label="${escapeHtml(descricao)}">
        ${visiveis.length ? visiveis.map((s) => `<span class="evo-seg ${s.tipo}" style="flex:${s.centavos} 1 0;${s.cor ? `background:${s.cor};` : ""}"></span>`).join("") : `<span class="evo-seg falta" style="flex:1 1 0;"></span>`}
      </div>
      <div class="evo-legenda">
        ${segmentos.map((s) => `
          <div class="evo-linha">
            <span class="evo-ponto ${s.tipo}"${s.cor ? ` style="background:${s.cor};"` : ""}></span>
            <span class="evo-rotulo">${escapeHtml(s.rotulo)}${s.detalhe ? `<small>${escapeHtml(s.detalhe)}</small>` : ""}</span>
            <span class="evo-valor"><b data-valor>${formatarBRL(s.centavos)}</b><small>${pct(s.centavos, soma)}%</small></span>
          </div>`).join("")}
      </div>
      ${rodape ? `<div class="evo-rodape">${rodape}</div>` : ""}
    </div>`;
}
