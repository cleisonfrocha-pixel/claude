// Início — versão da Fase 0. A Home completa do §25 (dinheiro, situação,
// próximas ações, fluxo, dívidas, patrimônio) chega nas Fases 2 e 7; por
// enquanto, esta tela confirma que os cadastros-base existem e guia para
// onde completá-los — é o portão da Fase 0, não a experiência final.

import { pessoas, contas, cartoes, categorias } from "../../dados/repositorios.js";
import { escapeHtml } from "../utilitarios.js";

function contadorCartao(rotulo, valor, sub) {
  return `
    <div class="item-cartao">
      <div class="item-corpo">
        <div class="item-titulo">${escapeHtml(rotulo)}</div>
        <div class="item-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="item-valor mono">${valor}</div>
    </div>`;
}

export default {
  async montar(container) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;">
        <div>
          <h2 class="tela-titulo">Início</h2>
          <p class="tela-sub">Fase 0: cadastros-base. O painel de "quanto posso gastar" chega na Fase 2.</p>
        </div>
      </div>
      <div id="resumo-inicio" class="lista-cartoes"></div>
    `;
    const [p, c, ca, cat] = await Promise.all([
      pessoas.listar(), contas.listar(), cartoes.listar(), categorias.listar(),
    ]);
    const alvo = container.querySelector("#resumo-inicio");
    if (!p.length) {
      alvo.innerHTML = `
        <div class="vazio">
          Ainda não há nenhuma pessoa cadastrada.<br>Comece por aí — tudo no sistema pertence a alguém.
          <div><button class="btn btn-primary" id="ir-configuracoes">Cadastrar pessoas</button></div>
        </div>`;
      alvo.querySelector("#ir-configuracoes").addEventListener("click", () => {
        document.querySelector('[data-modulo="configuracoes"]')?.click();
      });
      return;
    }
    alvo.innerHTML = [
      contadorCartao("Pessoas", String(p.length), p.map((x) => x.dados.nome).join(", ")),
      contadorCartao("Contas", String(c.length), c.length ? "cadastradas" : "nenhuma ainda"),
      contadorCartao("Cartões", String(ca.length), ca.length ? "cadastrados" : "nenhum ainda"),
      contadorCartao("Categorias", String(cat.length), cat.length ? "prontas para uso" : "nenhuma ainda"),
    ].join("");
  },
  desmontar() {},
};
