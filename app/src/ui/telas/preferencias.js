import * as privacidade from "../privacidade.js";
import * as tema from "../tema.js";
import * as db from "../../dados/db.js";
import { VERSAO_ESQUEMA } from "../../domain/esquema.js";
import { escapeHtml } from "../utilitarios.js";

function rotuloModo(modo) {
  if (modo === "db") return "Sincronizado. Os dados acompanham você em qualquer aparelho.";
  if (modo === "local") return "Local neste navegador. Sem sincronização entre aparelhos ainda.";
  return "Verificando…";
}

export default {
  montar(container) {
    const oculto = privacidade.estaOculto();
    const temaEscuro = tema.temaAtual() === "escuro";
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;">
        <div>
          <h2 class="tela-titulo">Preferências</h2>
          <p class="tela-sub">Aparência, privacidade visual e informações do sistema.</p>
        </div>
      </div>
      <div class="lista-cartoes">
        <div class="item-cartao">
          <div class="item-corpo">
            <div class="item-titulo">Tema</div>
            <div class="item-sub">${temaEscuro ? "Escuro" : "Claro"}. Troque a qualquer momento.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="botao-tema">Usar ${temaEscuro ? "claro" : "escuro"}</button>
        </div>
        <div class="item-cartao">
          <div class="item-corpo">
            <div class="item-titulo">Ocultar valores</div>
            <div class="item-sub">Borra os números na tela. Útil para abrir o painel perto de outra pessoa.</div>
          </div>
          <button class="btn ${oculto ? "btn-primary" : "btn-ghost"} btn-sm" id="botao-ocultar">${oculto ? "Ativado" : "Desativado"}</button>
        </div>
        <div class="item-cartao">
          <div class="item-corpo">
            <div class="item-titulo">Armazenamento</div>
            <div class="item-sub" id="sub-armazenamento">Verificando…</div>
          </div>
        </div>
        <div class="item-cartao">
          <div class="item-corpo">
            <div class="item-titulo">Versão do esquema de dados</div>
            <div class="item-sub">v${escapeHtml(VERSAO_ESQUEMA)} · docs/MODELO-DE-DADOS.md no repositório</div>
          </div>
        </div>
      </div>
    `;
    container.querySelector("#botao-tema").addEventListener("click", () => {
      tema.alternar();
      this.montar(container);
    });
    container.querySelector("#botao-ocultar").addEventListener("click", () => {
      privacidade.alternar();
      this.montar(container);
    });
    (async () => {
      await db.inicializar();
      const el = container.querySelector("#sub-armazenamento");
      if (el) el.textContent = rotuloModo(db.modoAtual());
    })();
  },
  desmontar() {},
};
