// Aba "Calendário" de Planejamento — o calendário financeiro do §6. "O
// sistema precisa enxergar o que ainda não aconteceu" — por isso a grade
// só olha para frente (a partir de hoje) e o resumo de pressão/cobertura
// fica fixo numa janela de 90 dias, independente de para qual mês a grade
// está navegada.

import * as tempo from "../../domain/tempo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { assinarCalendario } from "../../dados/calendarioRepo.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import { baixarComPergunta } from "../baixaUI.js";

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
      <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Calendário</h2></div></div>
      <p class="tela-sub">Carregando…</p>`;
    return;
  }

  const hoje = painel.hoje;
  const noMesAtual = mesVisivel === tempo.competenciaAtual();

  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;">
      <div>
        <h2 class="tela-titulo">Calendário</h2>
        <p class="tela-sub">O que ainda vai acontecer, e em que dia isso aperta.</p>
      </div>
    </div>

    ${painel.semCobertura.length ? alertaCobertura(painel.semCobertura[0]) : `<div class="alerta-tudo-coberto">Nos próximos 90 dias, o dinheiro cobre tudo que está marcado pra sair, contando o que vai entrar.</div>`}

    <div class="mes-nav">
      <button class="icon-btn" id="mes-prev" aria-label="Mês anterior" ${noMesAtual ? "disabled" : ""}>‹</button>
      <div class="mes-nav-label">${escapeHtml(tempo.competenciaLabel(mesVisivel))}</div>
      <button class="icon-btn" id="mes-next" aria-label="Próximo mês">›</button>
    </div>

    <div class="calendario-cabecalho">${DIAS_SEMANA.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="calendario-grid" id="grade-calendario"></div>

    <div class="legenda-calendario">
      <span><span class="legenda-ponto" style="background:var(--text-faint);"></span>Tem compromisso</span>
      <span><span class="legenda-ponto" style="background:var(--danger);"></span>Dia em que o saldo fica negativo</span>
    </div>

    <div id="dia-detalhe"></div>
  `;

  renderizarGrade(hoje);
  renderizarDetalhe();

  const btnPrev = container.querySelector("#mes-prev");
  if (btnPrev && !noMesAtual) btnPrev.addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, -1)));
  container.querySelector("#mes-next").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, 1)));
}

/** Uma linha: o dia em que o saldo fica negativo e as três saídas que mais pesam nele. */
function alertaCobertura(dia) {
  const saidas = [...dia.itens].filter((i) => i.tipo !== "receita").sort((a, b) => b.valorCentavos - a.valorCentavos);
  const top = saidas.slice(0, 3).map((i) => `${escapeHtml(i.descricao)} (<span data-valor>${formatarBRL(i.valorCentavos)}</span>)`).join(", ");
  const resto = saidas.length > 3 ? ` e mais ${saidas.length - 3}` : "";
  return `<div class="alerta-cobertura">
      <div class="titulo">Em ${escapeHtml(tempo.formatarData(dia.data).slice(0, 5))} o saldo fica negativo: <span class="valor-neg" data-valor>${formatarBRL(dia.saldoDepoisCentavos)}</span></div>
      <div class="texto">${saidas.length ? `Pesa ${top}${resto}. Toque no dia para ver tudo.` : "Toque no dia para ver o que acontece nele."}</div>
    </div>`;
}

function renderizarGrade(hoje) {
  const alvo = container.querySelector("#grade-calendario");
  if (!alvo) return;

  const porData = new Map(painel.diasDoMesVisivel.map((d) => [d.data, d]));
  // Só o dia em que o saldo cruza o zero ganha cor: pintar todo dia negativo deixava o mês inteiro
  // vermelho e a cor parava de dizer alguma coisa.
  const diaQueCruza = painel.semCobertura[0]?.data || null;
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
      if (data === diaQueCruza) classes.push("dia-sem-cobertura");
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
          ${podeBaixar(item) ? `<button class="btn-mini btn-baixa" data-baixa-evento="${info.itens.indexOf(item)}">${item.tipo === "receita" ? "Recebi" : "Paguei"}</button>` : ""}
        </div>`).join("")}
      ${!info.coberto ? `<div class="erro-form" style="margin-top:10px;">Saldo projetado negativo neste dia: as contas do dia passam do dinheiro que você tem.</div>` : ""}
    </div>`;
  alvo.querySelectorAll("[data-baixa-evento]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = info.itens[Number(btn.getAttribute("data-baixa-evento"))];
      btn.disabled = true;
      await baixarComPergunta(
        { tipo: "evento", evento: { ...item, data: item.vencimento || info.data }, descricao: item.descricao, valorCentavos: item.valorCentavos, origem: item.origem },
        item.tipo === "receita" ? "receita" : "despesa",
      );
      btn.disabled = false;
    });
  });
}

function podeBaixar(item) {
  return !!(item.virtual && item.origem && ["fonteRenda", "divida", "recorrencia"].includes(item.origem.tipo));
}
