// Aba "Fluxo de caixa" de Planejamento — os quatro horizontes do §7, lado
// a lado, cada um respondendo a uma pergunta diferente. A trilha "segura"
// (confirmado + provável) é a que decide se um horizonte tem saída
// crítica; incerto nunca é somado nela — só aparece como nota à parte
// (regra não negociável do CLAUDE.md).

import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData } from "../../domain/tempo.js";
import { assinarProjecao } from "../../dados/projecaoRepo.js";
import { escapeHtml } from "../utilitarios.js";

let horizonteSelecionado = "30d";
let painel = null;
let pararAssinatura = null;
let container = null;

export default {
  montar(alvo) {
    container = alvo;
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarProjecao((resultado) => { painel = resultado; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Fluxo de caixa</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  const h = painel.horizontes.find((x) => x.chave === horizonteSelecionado) || painel.horizontes[0];
  const temIncerto = h.entradasIncertoCentavos !== 0 || h.saidasIncertoCentavos !== 0;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Fluxo de caixa</h2>
        <p class="tela-sub">Quatro horizontes, cada um respondendo a uma pergunta diferente sobre o seu caixa.</p>
      </div>
    </div>

    <div class="horizontes-grid">
      ${painel.horizontes.map((x) => cartaoHorizonte(x)).join("")}
    </div>

    <div class="tela-head" style="margin-top:0;">
      <div>
        <h3 class="tela-titulo" style="font-size:17px;">${escapeHtml(h.rotulo)} — ${escapeHtml(h.funcao)}</h3>
        <p class="tela-sub">${escapeHtml(h.pergunta)}</p>
      </div>
    </div>

    ${h.saidaCritica
      ? `<div class="alerta-cobertura">
          <div class="titulo">Saída crítica em ${escapeHtml(h.rotulo)}</div>
          <div class="texto">Em ${escapeHtml(formatarData(h.saidaCritica.data))}, o saldo seguro projetado fica negativo
            (<span class="valor-neg" data-valor>${formatarBRL(h.saidaCritica.saldoDepoisCentavos)}</span>) por causa de
            ${escapeHtml(h.saidaCritica.itens.map((i) => i.descricao).join(", "))}
            — um gap de <span class="valor-neg" data-valor>${formatarBRL(h.saidaCritica.gapCentavos)}</span>.</div>
        </div>`
      : `<div class="alerta-tudo-coberto">Nos próximos ${escapeHtml(h.rotulo.toLowerCase())}, o saldo seguro projetado não fica negativo.</div>`}

    <div class="resumo-mes">
      <div class="resumo-item"><span>Entradas (seguro)</span><b class="mono valor-pos" data-valor>${formatarBRL(h.entradasSeguroCentavos)}</b></div>
      <div class="resumo-item"><span>Saídas (seguro)</span><b class="mono valor-neg" data-valor>${formatarBRL(h.saidasSeguroCentavos)}</b></div>
      <div class="resumo-item"><span>Saldo final seguro</span><b class="mono ${h.saldoFinalSeguroCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(h.saldoFinalSeguroCentavos)}</b></div>
    </div>

    ${temIncerto ? `
      <div class="nota-incerto">
        <span>Sem contar no saldo seguro: se tudo que é incerto se confirmar, o saldo final seria</span>
        <b data-valor>${formatarBRL(h.saldoFinalComIncertoCentavos)}</b>
      </div>` : ""}
  `;

  container.querySelectorAll("[data-horizonte]").forEach((btn) => {
    btn.addEventListener("click", () => {
      horizonteSelecionado = btn.dataset.horizonte;
      renderizar();
    });
  });
}

function cartaoHorizonte(h) {
  const net = h.entradasSeguroCentavos - h.saidasSeguroCentavos;
  const ativo = h.chave === horizonteSelecionado;
  return `
    <button class="horizonte-card${ativo ? " ativo" : ""}" data-horizonte="${h.chave}">
      <div class="rotulo">${h.saidaCritica ? '<span class="ponto-critico"></span>' : ""}${escapeHtml(h.rotulo)}</div>
      <div class="funcao">${escapeHtml(h.funcao)}</div>
      <div class="net ${net < 0 ? "valor-neg" : "valor-pos"}" data-valor>${net >= 0 ? "+" : ""}${formatarBRL(net)}</div>
    </button>`;
}
