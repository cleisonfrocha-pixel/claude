// Fechamento do mês (§21): o que aconteceu, comparado com o mês anterior.
// Só leitura; nada aqui grava dado.

import { assinarFechamento } from "../../dados/fechamentoRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { competenciaAtual, competenciaLabel, somarMeses } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";

let container = null;
let parar = null;
let mes = competenciaAtual();
let dados = null;

export default {
  montar(alvo) {
    container = alvo;
    mes = somarMeses(competenciaAtual(), 0);
    assinar();
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    container = null;
    dados = null;
  },
};

function assinar() {
  if (parar) parar();
  dados = null;
  renderizar();
  parar = assinarFechamento(mes, (r) => { dados = r; renderizar(); });
}

const sinal = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
const classe = (v) => (v > 0 ? "valor-pos" : v < 0 ? "valor-neg" : "");

function bloco(titulo, corpo) {
  return `<section class="inicio-bloco"><h3>${titulo}</h3>${corpo}</section>`;
}

function renderizar() {
  if (!container) return;
  const nav = `
    <div class="mes-nav">
      <button class="icon-btn" id="fe-prev" aria-label="Mês anterior">‹</button>
      <div class="mes-nav-label">${escapeHtml(competenciaLabel(mes))}</div>
      <button class="icon-btn" id="fe-next" aria-label="Próximo mês">›</button>
      ${mes !== competenciaAtual() ? '<button class="btn btn-ghost btn-sm" id="fe-hoje">Mês atual</button>' : ""}
    </div>`;
  if (!dados) { container.innerHTML = nav + `<p class="tela-sub">Carregando…</p>`; ligar(); return; }
  const f = dados;
  const nenhum = f.atual.receitaCentavos === 0 && f.atual.despesaCentavos === 0 && f.naoRealizado.quantidade === 0;

  const resumo = bloco(`${f.situacao === "fechado" ? "Mês fechado" : "Mês em andamento"}`, `
    <div class="plano-onde">
      <div><span>Entrou (recebido)</span><b class="mono valor-pos" data-valor>${formatarBRL(f.atual.receitaCentavos)}</b></div>
      <div><span>Saiu (pago)</span><b class="mono valor-neg" data-valor>${formatarBRL(f.atual.despesaCentavos)}</b></div>
    </div>
    <div class="plano-sobra ${f.atual.resultadoCentavos < 0 ? "negativa" : ""}">
      <span>Resultado</span><b class="mono" data-valor>${sinal(f.atual.resultadoCentavos)}${formatarBRL(Math.abs(f.atual.resultadoCentavos))}</b>
    </div>
    ${f.variacaoResultadoCentavos != null
      ? `<p class="tela-sub" style="margin:8px 0 0;">Contra ${escapeHtml(competenciaLabel(f.anterior))}: <b class="${classe(f.variacaoResultadoCentavos)}" data-valor>${sinal(f.variacaoResultadoCentavos)}${formatarBRL(Math.abs(f.variacaoResultadoCentavos))}</b></p>`
      : `<p class="tela-sub" style="margin:8px 0 0;">Sem dados do mês anterior para comparar.</p>`}
    ${f.naoRealizado.quantidade ? `<p class="tela-sub" style="margin:8px 0 0;">Ainda aberto neste mês: <span data-valor>${formatarBRL(f.naoRealizado.receitaCentavos)}</span> a receber e <span data-valor>${formatarBRL(f.naoRealizado.despesaCentavos)}</span> a pagar (${f.naoRealizado.quantidade} lançamentos). Não entram no resultado acima.</p>` : ""}`);

  const mudancas = bloco("Maiores mudanças nos gastos", f.mudancas.length
    ? `<div class="inicio-lista">${f.mudancas.map((m) => `
        <div class="inicio-linha" style="grid-template-columns:1fr auto;">
          <span class="inicio-desc">${escapeHtml(m.nome)}<small> ${formatarBRL(m.anteriorCentavos)} → ${formatarBRL(m.atualCentavos)}</small></span>
          <b class="mono ${m.variacaoCentavos > 0 ? "valor-neg" : "valor-pos"}" data-valor>${sinal(m.variacaoCentavos)}${formatarBRL(Math.abs(m.variacaoCentavos))}</b>
        </div>`).join("")}</div>`
    : `<p class="tela-sub" style="margin:0;">Sem mudança relevante em relação ao mês anterior.</p>`);

  const p = f.patrimonio;
  const patrimonio = bloco("Dívida, patrimônio e reserva", p
    ? `<div class="plano-onde">
        <div><span>Patrimônio líquido</span><b class="mono ${classe(p.liquidoCentavos)}" data-valor>${formatarBRL(p.liquidoCentavos)}</b>
          ${p.variacaoLiquidoCentavos != null ? `<small data-valor>${sinal(p.variacaoLiquidoCentavos)}${formatarBRL(Math.abs(p.variacaoLiquidoCentavos))} no mês</small>` : ""}</div>
        <div><span>Dívidas</span><b class="mono" data-valor>${formatarBRL(p.passivosCentavos)}</b>
          ${p.variacaoDividaCentavos != null ? `<small data-valor>${sinal(p.variacaoDividaCentavos)}${formatarBRL(Math.abs(p.variacaoDividaCentavos))} no mês</small>` : ""}</div>
      </div>`
    : `<p class="tela-sub" style="margin:0;">Este mês não tem retrato de patrimônio guardado.</p>`);

  const decisoes = bloco("Decisões tomadas no mês", f.decisoesDoMes.length
    ? `<div class="inicio-lista">${f.decisoesDoMes.map((d) => `<div class="inicio-linha" style="grid-template-columns:1fr auto;"><span class="inicio-desc">${escapeHtml(d.titulo || d.id)}</span><small>${escapeHtml(d.status)}</small></div>`).join("")}</div>`
    : `<p class="tela-sub" style="margin:0;">Nenhuma decisão registrada neste mês.</p>`);

  const maior = Math.max(1, ...f.historico.map((h) => Math.abs(h.resultadoCentavos)));
  const historico = bloco("Últimos meses", f.historico.length
    ? `<div class="inicio-lista">${f.historico.map((h) => `
        <div class="inicio-linha" style="grid-template-columns:90px 1fr auto;">
          <span class="inicio-data">${escapeHtml(competenciaLabel(h.competencia))}</span>
          <span class="barra-limite${h.resultadoCentavos < 0 ? " critico" : ""}" style="margin:6px 0;"><span style="width:${Math.round(Math.abs(h.resultadoCentavos) / maior * 100)}%"></span></span>
          <b class="mono ${classe(h.resultadoCentavos)}" data-valor>${sinal(h.resultadoCentavos)}${formatarBRL(Math.abs(h.resultadoCentavos))}</b>
        </div>`).join("")}</div>`
    : `<p class="tela-sub" style="margin:0;">Ainda sem meses com movimento pago.</p>`);

  container.innerHTML = nav + (nenhum
    ? `<div class="vazio">Nada pago nem aberto em ${escapeHtml(competenciaLabel(mes))}.</div>`
    : `<div class="inicio-grade"><div class="inicio-principal">${resumo}${mudancas}</div><div class="inicio-lateral">${patrimonio}${decisoes}${historico}</div></div>`);
  ligar();
}

function ligar() {
  const ir = (n) => { mes = somarMeses(mes, n); assinar(); };
  container.querySelector("#fe-prev")?.addEventListener("click", () => ir(-1));
  container.querySelector("#fe-next")?.addEventListener("click", () => ir(1));
  container.querySelector("#fe-hoje")?.addEventListener("click", () => { mes = competenciaAtual(); assinar(); });
}
