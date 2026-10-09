// Metas da casa, num lugar só (lista de 05/10, item 82): quanto quer gastar, quanto precisa pra se recuperar
// e quanto investir. Antes o cadastro ficava em Renda e a pendência aparecia no Início.

import { obterMetas, definirMetas } from "../../dados/orcamentoRepo.js";
import { paraCentavos, formatarBRL, valorDigitadoValido } from "../../domain/dinheiro.js";
import { mostrarToast } from "../utilitarios.js";

const CAMPOS = [
  { id: "custoDesejadoCentavos", rotulo: "Quanto quero gastar por mês", nulo: true },
  { id: "metaRecuperacaoCentavos", rotulo: "Quanto preciso por mês pra me recuperar (opcional)", nulo: true },
  { id: "investimentoMinimoMensalCentavos", rotulo: "Investimento mínimo por mês", nulo: false },
];

let container = null;

async function renderizar() {
  const metas = await obterMetas();
  if (!container) return;
  container.innerHTML = `
    <h3 class="tela-titulo" style="font-size:17px;">Metas da casa</h3>
    <p class="tela-sub">Só você define, o painel nunca inventa. O investimento mínimo é protegido como o essencial.</p>
    ${CAMPOS.map((c) => `
      <div class="simulador-linha" style="margin-bottom:10px;">
        <div class="field"><label for="meta-${c.id}">${c.rotulo}</label>
          <input type="text" inputmode="decimal" id="meta-${c.id}" placeholder="0,00" value="${metas[c.id] ? formatarBRL(metas[c.id]).replace("R$ ", "") : ""}"></div>
        <button class="btn btn-ghost btn-sm" type="button" data-salvar="${c.id}">Salvar</button>
      </div>`).join("")}`;
  container.querySelectorAll("[data-salvar]").forEach((b) => b.addEventListener("click", async () => {
    const c = CAMPOS.find((x) => x.id === b.dataset.salvar);
    const v = container.querySelector(`#meta-${c.id}`).value.trim();
    if (v && !valorDigitadoValido(v)) { mostrarToast("Esse valor não parece um número."); return; }
    await definirMetas({ [c.id]: v ? paraCentavos(v) : (c.nulo ? null : 0) });
    mostrarToast("Meta salva.");
    renderizar();
  }));
}

export default {
  montar(alvo) { container = alvo; renderizar(); },
  desmontar() { container = null; },
};
