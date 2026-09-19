// Planejamento — o calendário financeiro do §6. "O sistema precisa
// enxergar o que ainda não aconteceu" — por isso a grade só olha para
// frente (a partir de hoje) e o resumo de pressão/cobertura fica fixo numa
// janela de 90 dias, independente de para qual mês a grade está navegada.

import * as tempo from "../../domain/tempo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { assinarCalendario } from "../../dados/calendarioRepo.js";
import { escapeHtml } from "../utilitarios.js";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ROTULO_TIPO = { despesa: "Despesa", receita: "Receita", fatura: "Fatura de cartão" };

let mesVisivel = tempo.competenciaAtual();
let diaSelecionado = null;
let painel = null;
let pararAssinatura = null;
let container = null;

export default {
  montar(alvo) {
    container = alvo;
    mesVisivel = tempo.competenciaAtual();
    diaSelecionado = null;
    if (pararAssinatura) pararAssinatura();
    pararAssinatura = assinarCalendario(mesVisivel, (resultado) => { painel = resultado; renderizar(); });
    renderizar();
  },
  desmontar() {
    if (pararAssinatura) { pararAssinatura(); pararAssinatura = null; }
    container = null;
    painel = null;
  },
};

function trocarMes(novoMes) {
  mesVisivel = novoMes;
  diaSelecionado = null;
  painel = null;
  if (pararAssinatura) pararAssinatura();
  pararAssinatura = assinarCalendario(mesVisivel, (resultado) => { painel = resultado; renderizar(); });
  renderizar();
}

function renderizar() {
  if (!container) return;

  if (!painel) {
    container.innerHTML = `
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Planejamento</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  const hoje = painel.hoje;
  const noMesAtual = mesVisivel === tempo.competenciaAtual();

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Planejamento</h2>
        <p class="tela-sub">Calendário financeiro — o que ainda vai acontecer, e em que dia isso aperta.</p>
      </div>
    </div>

    ${painel.semCobertura.length
      ? `<div class="alerta-cobertura">
          <div class="titulo">${painel.semCobertura.length === 1 ? "1 dia sem cobertura suficiente" : `${painel.semCobertura.length} dias sem cobertura suficiente`} nos próximos 90 dias</div>
          <div class="texto">Em ${escapeHtml(tempo.formatarData(painel.semCobertura[0].data))}, o saldo projetado fica negativo
            (${formatarBRL(painel.semCobertura[0].saldoDepoisCentavos)}) por causa de ${escapeHtml(painel.semCobertura[0].itens.map((i) => i.descricao).join(", "))}.</div>
        </div>`
      : `<div class="alerta-tudo-coberto">Nos próximos 90 dias, tudo o que está previsto tem cobertura no saldo atual.</div>`}

    ${painel.piorDia ? `
      <div class="pressao-card">
        <div>
          <div class="rotulo">Dia de maior pressão</div>
          <div class="data">${escapeHtml(tempo.formatarData(painel.piorDia.data))}</div>
        </div>
        <b data-valor>-${formatarBRL(painel.piorDia.saidasCentavos - painel.piorDia.entradasCentavos)}</b>
      </div>` : ""}

    <div class="mes-nav">
      <button class="icon-btn" id="mes-prev" aria-label="Mês anterior" ${noMesAtual ? "disabled" : ""}>‹</button>
      <div class="mes-nav-label">${escapeHtml(tempo.competenciaLabel(mesVisivel))}</div>
      <button class="icon-btn" id="mes-next" aria-label="Próximo mês">›</button>
    </div>

    <div class="calendario-cabecalho">${DIAS_SEMANA.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="calendario-grid" id="grade-calendario"></div>

    <div class="legenda-calendario">
      <span><span class="legenda-ponto" style="background:var(--text-faint);"></span>Tem compromisso</span>
      <span><span class="legenda-ponto" style="background:var(--warn);"></span>Dia de maior pressão</span>
      <span><span class="legenda-ponto" style="background:var(--danger);"></span>Sem cobertura</span>
    </div>

    <div id="dia-detalhe"></div>
  `;

  renderizarGrade(hoje);
  renderizarDetalhe();

  const btnPrev = container.querySelector("#mes-prev");
  if (btnPrev && !noMesAtual) btnPrev.addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, -1)));
  container.querySelector("#mes-next").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, 1)));
}

function renderizarGrade(hoje) {
  const alvo = container.querySelector("#grade-calendario");
  if (!alvo) return;

  const porData = new Map(painel.diasDoMesVisivel.map((d) => [d.data, d]));
  const piorData = painel.piorDia ? painel.piorDia.data : null;
  const [ano, mes] = mesVisivel.split("-").map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDias = tempo.diasNoMes(mesVisivel);

  let html = "";
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="dia-celula dia-vazio"></div>`;
  for (let dia = 1; dia <= totalDias; dia++) {
    const data = `${mesVisivel}-${String(dia).padStart(2, "0")}`;
    const info = porData.get(data);
    const classes = ["dia-celula"];
    if (data === hoje) classes.push("dia-hoje");
    if (data === diaSelecionado) classes.push("dia-selecionado");
    if (info) {
      classes.push("tem-compromisso");
      if (!info.coberto) classes.push("dia-sem-cobertura");
      else if (data === piorData) classes.push("dia-pressao");
    }
    html += `<button class="${classes.join(" ")}" data-dia="${data}">${dia}<span class="dia-indicador"></span></button>`;
  }
  alvo.innerHTML = html;
  alvo.querySelectorAll("[data-dia]").forEach((btn) => {
    btn.addEventListener("click", () => {
      diaSelecionado = diaSelecionado === btn.dataset.dia ? null : btn.dataset.dia;
      renderizarGrade(hoje);
      renderizarDetalhe();
    });
  });
}

function renderizarDetalhe() {
  const alvo = container.querySelector("#dia-detalhe");
  if (!alvo) return;
  if (!diaSelecionado) {
    alvo.innerHTML = "";
    return;
  }
  const info = painel.diasDoMesVisivel.find((d) => d.data === diaSelecionado);
  if (!info) {
    alvo.innerHTML = `<div class="vazio">Nenhum compromisso em ${escapeHtml(tempo.formatarData(diaSelecionado))}.</div>`;
    return;
  }
  alvo.innerHTML = `
    <div class="item-cartao" style="display:block;">
      <div class="dia-detalhe-head">
        <span class="data">${escapeHtml(tempo.formatarData(info.data))}</span>
        <span class="saldo">Saldo projetado após este dia: <b class="mono" data-valor>${formatarBRL(info.saldoDepoisCentavos)}</b></span>
      </div>
      ${info.itens.map((item) => `
        <div class="fatura-linha">
          <span class="rotulo">${item.atrasado ? '<span class="tag-atrasado">Atrasado</span>' : ""}${escapeHtml(item.descricao)}<small>${escapeHtml(ROTULO_TIPO[item.tipo] || item.tipo)}</small></span>
          <b class="${item.tipo === "receita" ? "valor-pos" : "valor-neg"}" data-valor>${item.tipo === "receita" ? "+" : "−"}${formatarBRL(item.valorCentavos)}</b>
        </div>`).join("")}
      ${!info.coberto ? `<div class="erro-form" style="margin-top:10px;">Saldo projetado negativo neste dia — obrigação sem cobertura suficiente.</div>` : ""}
    </div>`;
}
