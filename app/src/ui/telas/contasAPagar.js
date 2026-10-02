// Aba "A pagar" de Dinheiro: as contas do mês, cada uma com seu estado
// (atrasada, vence hoje, a pagar, paga) e um peso visual diferente. Paguei é
// um toque, com aviso curto e "Desfazer". O progresso do mês é calculado na
// leitura (domain/contasDoMes.js), nunca gravado.

import * as tempo from "../../domain/tempo.js";
import { formatarBRL, paraCentavos } from "../../domain/dinheiro.js";
import { assinarContasDoMes } from "../../dados/contasRepo.js";
import { darBaixaTransacao, darBaixaEvento, darBaixaFatura, desfazerBaixa } from "../../dados/baixaRepo.js";
import { escapeHtml, mostrarToast } from "../utilitarios.js";
import { navegar } from "../navegacao.js";
import * as modal from "../modal.js";

const GRUPOS = [
  { id: "atrasada", titulo: "Atrasadas", dica: "Pagando estas primeiro, o mês sai do vermelho." },
  { id: "hoje", titulo: "Vencem hoje", dica: "" },
  { id: "a_pagar", titulo: "A pagar", dica: "" },
  { id: "paga", titulo: "Pagas", dica: "" },
];
const DESTINO_ORIGEM = {
  recorrencia: { modulo: "dinheiro", aba: "recorrencias" },
  divida: { modulo: "dividas" },
  fatura: { modulo: "dinheiro", aba: "cartoes" },
  transacao: { modulo: "dinheiro", aba: "transacoes" },
};

let mesVisivel = tempo.competenciaAtual();
let painel = null;
let parar = null;
let container = null;

export default {
  montar(alvo) {
    container = alvo;
    mesVisivel = tempo.competenciaAtual();
    assinar();
    renderizar();
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    container = null;
    painel = null;
  },
};

function assinar() {
  if (parar) parar();
  painel = null;
  parar = assinarContasDoMes(mesVisivel, (r) => { painel = r; renderizar(); });
}

function trocarMes(novo) {
  mesVisivel = novo;
  assinar();
  renderizar();
}

const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function quando(i, hoje) {
  if (i.estado === "paga") return i.pagoEm ? `paga em ${diaMes(i.pagoEm)}` : "paga";
  if (i.semDia || !i.vencimento) return "sem dia fixo, até o fim do mês";
  if (i.estado === "atrasada") return `venceu dia ${diaMes(i.vencimento)} · atrasada há ${plural(i.diasAtraso, "dia", "dias")}`;
  if (i.estado === "hoje") return "vence hoje";
  const dias = Math.round((new Date(`${i.vencimento}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
  return `vence dia ${diaMes(i.vencimento)} · ${dias === 1 ? "amanhã" : `em ${dias} dias`}`;
}

function cartaoConta(i, hoje) {
  const paga = i.estado === "paga";
  return `
    <div class="conta-card estado-${i.estado}" data-chave="${escapeHtml(i.chave)}">
      <span class="conta-marca" aria-hidden="true">${paga ? "✓" : i.estado === "atrasada" ? "!" : ""}</span>
      <div class="conta-corpo">
        <div class="conta-titulo">${escapeHtml(i.descricao)}</div>
        <div class="conta-sub">${escapeHtml(quando(i, hoje))}</div>
      </div>
      <div class="conta-direita">
        <div class="conta-valor mono" data-valor>${formatarBRL(i.valorCentavos)}</div>
        <div class="conta-acoes">
          ${paga ? `<span class="conta-selo">Paga</span>` : `<button class="btn-mini btn-baixa conta-pagar" data-pagar>Paguei</button>`}
          <button class="btn-mini conta-mais" data-mais aria-label="Mais opções de ${escapeHtml(i.descricao)}">⋯</button>
        </div>
      </div>
    </div>`;
}

/** "A pagar" é a lista longa: quebra em esta semana, semana que vem, mais pra
 * frente e sem dia fixo, pra dar pra bater o olho. */
function porSemana(lista, hoje) {
  const dias = (i) => Math.round((new Date(`${i.vencimento}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
  const faixas = [
    ["Esta semana", (i) => i.vencimento && dias(i) <= 7],
    ["Semana que vem", (i) => i.vencimento && dias(i) > 7 && dias(i) <= 14],
    ["Mais pra frente", (i) => i.vencimento && dias(i) > 14],
    ["Sem dia fixo", (i) => !i.vencimento],
  ];
  return faixas.map(([rotulo, ok]) => {
    const sub = lista.filter(ok);
    return sub.length ? `<div class="conta-faixa">${rotulo}</div>${sub.map((i) => cartaoConta(i, hoje)).join("")}` : "";
  }).join("");
}

function mensagemDoMes(r) {
  const { resumo: s } = r;
  if (!s.quantidade) return "Nenhuma conta marcada neste mês.";
  if (s.faltaCentavos === 0) return "Mês em dia: tudo pago.";
  if (s.quantidadeAtrasadas) return `${plural(s.quantidadeAtrasadas, "conta atrasada", "contas atrasadas")} (${formatarBRL(s.atrasadasCentavos)}). Comece por elas.`;
  if (s.proxima) return `Nada atrasado. Próxima: ${s.proxima.descricao}, dia ${diaMes(s.proxima.vencimento)}.`;
  return "Nada atrasado.";
}

function renderizar() {
  if (!container) return;
  const titulo = `<div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">A pagar</h2>
    <p class="tela-sub">Cada conta do mês com o seu estado. Toque em Paguei quando pagar.</p></div></div>`;
  if (!painel) { container.innerHTML = `${titulo}<p class="tela-sub">Carregando…</p>`; return; }

  const { resumo: s, grupos, hoje } = painel;
  const classeBarra = s.quantidadeAtrasadas ? "critico" : "";
  container.innerHTML = `
    ${titulo}
    <div class="mes-nav">
      <button class="icon-btn" id="mes-prev" aria-label="Mês anterior">‹</button>
      <div class="mes-nav-label">${escapeHtml(tempo.competenciaLabel(mesVisivel))}</div>
      <button class="icon-btn" id="mes-next" aria-label="Próximo mês">›</button>
    </div>

    <div class="mes-progresso">
      <div class="mes-progresso-topo">
        <b>${s.quantidadePagas} de ${s.quantidade}</b> <span>contas pagas</span>
        <span class="mes-progresso-pct">${s.percentualPago}%</span>
      </div>
      <div class="barra-limite ${classeBarra}"><span style="width:${s.percentualPago}%"></span></div>
      <div class="mes-progresso-valores">
        <span><span data-valor>${formatarBRL(s.pagoCentavos)}</span> pagos</span>
        <span>faltam <b data-valor>${formatarBRL(s.faltaCentavos)}</b></span>
      </div>
      <div class="mes-progresso-msg ${s.quantidadeAtrasadas ? "alerta" : s.faltaCentavos === 0 && s.quantidade ? "ok" : ""}">${escapeHtml(mensagemDoMes(painel))}</div>
    </div>

    ${GRUPOS.map((g) => {
      const lista = grupos[g.id];
      if (!lista.length) return "";
      const soma = lista.reduce((t, i) => t + i.valorCentavos, 0);
      const cabeca = `<div class="conta-grupo-topo estado-${g.id}"><span class="conta-grupo-titulo">${g.titulo} <span class="conta-grupo-qtd">${lista.length}</span></span><span class="conta-grupo-soma mono" data-valor>${formatarBRL(soma)}</span></div>`;
      const corpo = `${g.dica ? `<div class="conta-grupo-dica">${g.dica}</div>` : ""}${g.id === "a_pagar" ? porSemana(lista, hoje) : lista.map((i) => cartaoConta(i, hoje)).join("")}`;
      return g.id === "paga"
        ? `<details class="conta-grupo estado-paga"><summary>${cabeca}</summary>${corpo}</details>`
        : `<section class="conta-grupo">${cabeca}${corpo}</section>`;
    }).join("")}
    ${s.quantidade === 0 ? `<div class="vazio">Nenhuma conta neste mês. Cadastre em Recorrências ou lance uma conta a pagar.</div>` : ""}
  `;

  container.querySelector("#mes-prev").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, -1)));
  container.querySelector("#mes-next").addEventListener("click", () => trocarMes(tempo.somarMeses(mesVisivel, 1)));
  container.querySelectorAll(".conta-card").forEach((el) => {
    const item = painel.itens.find((i) => i.chave === el.dataset.chave);
    el.querySelector("[data-pagar]")?.addEventListener("click", (ev) => pagar(item, ev.currentTarget));
    el.querySelector("[data-mais]")?.addEventListener("click", () => abrirMais(item));
  });
}

async function pagar(item, botao, valorCentavos) {
  if (botao) botao.disabled = true;
  try {
    let desfazer;
    if (item.tipo === "transacao") desfazer = await darBaixaTransacao(item.transacaoId, { valorCentavos });
    else if (item.tipo === "evento") desfazer = await darBaixaEvento(item.evento, { valorCentavos });
    else if (item.tipo === "fatura") desfazer = await darBaixaFatura({ faturaId: item.faturaId, cartaoId: item.cartaoId, valorCentavos: valorCentavos || item.valorCentavos, descricao: item.descricao });
    mostrarToast(`${item.descricao} paga.`, { acao: { rotulo: "Desfazer", fn: async () => {
      try { await desfazerBaixa(desfazer); mostrarToast("Desfeito."); } catch (e) { mostrarToast(e.message || "Não consegui desfazer."); }
    } } });
  } catch (e) {
    if (botao) botao.disabled = false;
    mostrarToast(e.message || "Não consegui dar baixa.");
  }
}

function abrirMais(item) {
  const podeOutroValor = item.estado !== "paga";
  modal.abrir(`
    <div class="modal">
      <h2>${escapeHtml(item.descricao)}</h2>
      <p class="tela-sub" style="margin-bottom:14px;"><span data-valor>${formatarBRL(item.valorCentavos)}</span> · ${escapeHtml(quando(item, painel.hoje))}</p>
      ${podeOutroValor ? `
        <div class="field"><label for="outro-valor">Paguei outro valor</label>
          <input type="text" inputmode="decimal" id="outro-valor" placeholder="${formatarBRL(item.valorCentavos).replace("R$ ", "")}"></div>
        <div class="erro-form" id="outro-erro" hidden></div>` : ""}
      <div class="modal-actions" style="flex-wrap:wrap;">
        <button class="btn btn-ghost" data-m="origem">Abrir o cadastro</button>
        ${podeOutroValor ? `<button class="btn btn-primary" data-m="pagar">Pagar esse valor</button>` : ""}
        <button class="btn btn-ghost" data-m="fechar">Fechar</button>
      </div>
    </div>`);
  const raiz = document.getElementById("overlay-modal");
  raiz.querySelector('[data-m="fechar"]').addEventListener("click", () => modal.fechar());
  raiz.querySelector('[data-m="origem"]').addEventListener("click", () => { modal.fechar(); navegar(DESTINO_ORIGEM[item.origem?.tipo] || DESTINO_ORIGEM.transacao); });
  raiz.querySelector('[data-m="pagar"]')?.addEventListener("click", () => {
    const valor = paraCentavos(raiz.querySelector("#outro-valor").value);
    if (!Number.isFinite(valor) || valor <= 0) {
      const erro = raiz.querySelector("#outro-erro");
      erro.textContent = "Informe um valor maior que zero.";
      erro.hidden = false;
      return;
    }
    modal.fechar();
    pagar(item, null, valor);
  });
}
