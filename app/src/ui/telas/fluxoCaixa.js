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

  // Só 7 e 30 dias: 90 dias e 12 meses projetavam "se nada mudar" (sem corte de gasto, sem fim de
  // parcela, sem renda nova) e davam números assustadores que não ajudam a decidir nada hoje. O ano
  // fica na aba Plano, com o histórico real.
  const visiveis = painel.horizontes.filter((x) => x.chave === "7d" || x.chave === "30d");
  const h = visiveis.find((x) => x.chave === horizonteSelecionado) || visiveis[0];
  const temIncerto = h.entradasIncertoCentavos !== 0 || h.saidasIncertoCentavos !== 0;

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Fluxo de caixa</h2>
        <p class="tela-sub">Quanto vai sobrar na conta em cada prazo, contando o que está marcado pra entrar e sair, as parcelas das dívidas e o gasto do dia a dia no ritmo dos últimos meses${painel.gastoDiaADiaMensalCentavos ? ` (<span data-valor>${formatarBRL(painel.gastoDiaADiaMensalCentavos)}</span> por mês)` : ""}. Renda que não é certa fica de fora.</p>
        ${painel.baseReal ? `<p class="tela-sub" style="margin-top:4px;">${escapeHtml(painel.baseReal.frase)}</p>` : ""}
      </div>
    </div>

    <div class="horizontes-grid">
      ${visiveis.map((x) => cartaoHorizonte(x)).join("")}
    </div>

    <div class="tela-head" style="margin-top:0;">
      <div>
        <h3 class="tela-titulo" style="font-size:17px;">${escapeHtml(h.rotulo)} · ${escapeHtml(h.funcao)}</h3>
        <p class="tela-sub">${escapeHtml(h.pergunta)}</p>
      </div>
    </div>

    ${h.saidaCritica
      ? `<div class="alerta-cobertura">
          <div class="titulo">Em ${escapeHtml(formatarData(h.saidaCritica.data).slice(0, 5))} a conta fica em <span class="valor-neg" data-valor>${formatarBRL(h.saidaCritica.saldoDepoisCentavos)}</span></div>
          <div class="texto">${maioresSaidas(h.saidaCritica.itens)}</div>
        </div>`
      : `<div class="alerta-tudo-coberto">Nos próximos ${escapeHtml(h.rotulo.toLowerCase())}, a conta não fica negativa em nenhum dia.</div>`}

    <div class="resumo-mes">
      <div class="resumo-item"><span>Tem hoje</span><b class="mono" data-valor>${formatarBRL(h.saldoInicialCentavos)}</b></div>
      <div class="resumo-item"><span>Entra</span><b class="mono valor-pos" data-valor>${formatarBRL(h.entradasSeguroCentavos)}</b></div>
      <div class="resumo-item"><span>Sai</span><b class="mono valor-neg" data-valor>${formatarBRL(h.saidasSeguroCentavos)}</b></div>
      <div class="resumo-item"><span>Fica</span><b class="mono ${h.saldoFinalSeguroCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(h.saldoFinalSeguroCentavos)}</b></div>
    </div>
    ${h.composicao ? `<div class="card" style="margin-top:12px;">
      ${linhasComposicao([["Entra confirmado", h.composicao.entradas.confirmado], ["Entra provável (ainda não é certo)", h.composicao.entradas.provavel]], "valor-pos")}
      ${linhasComposicao([["Contas atrasadas", h.composicao.saidas.atrasado], ["Contas com data", h.composicao.saidas.contas], ["Parcelas de dívida", h.composicao.saidas.parcelas], ["Cartões", h.composicao.saidas.cartoes], ["O que falta das verbas do mês", h.composicao.saidas.verbas], ["Gasto do dia a dia (média)", h.composicao.saidas.diaADia]], "valor-neg")}
    </div>` : ""}

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

function maioresSaidas(itens) {
  const lista = [...itens].sort((a, b) => b.valorCentavos - a.valorCentavos);
  if (!lista.length) return "";
  const top = lista.slice(0, 3).map((i) => `${escapeHtml(i.descricao)} (<span data-valor>${formatarBRL(i.valorCentavos)}</span>)`).join(", ");
  return `Pesa ${top}${lista.length > 3 ? ` e mais ${lista.length - 3}` : ""}.`;
}

function linhasComposicao(linhas, classe) {
  return linhas.filter(([, v]) => v > 0).map(([rotulo, v]) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(rotulo)}</span><b class="mono ${classe}" data-valor>${formatarBRL(v)}</b></div>`).join("");
}

function cartaoHorizonte(h) {
  const ativo = h.chave === horizonteSelecionado;
  const saldo = h.saldoFinalSeguroCentavos;
  return `
    <button class="horizonte-card${ativo ? " ativo" : ""}" data-horizonte="${h.chave}">
      <div class="rotulo">${h.saidaCritica ? '<span class="ponto-critico"></span>' : ""}Daqui a ${escapeHtml(h.rotulo)}</div>
      <div class="funcao">em conta, se nada mudar</div>
      <div class="net ${saldo < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(saldo)}</div>
    </button>`;
}
