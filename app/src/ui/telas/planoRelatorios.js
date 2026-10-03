// Plano › Relatórios. Pra onde o dinheiro está indo, em gráficos: o mês por grupo e por categoria, os próximos
// 12 meses, os gastos que passam batido, os cartões e a dívida de verdade. Números de domain/relatorios.js.

import { assinarRelatorios } from "../../dados/relatoriosRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { competenciaAtual, competenciaLabel, somarMeses, MESES_ABREV } from "../../domain/tempo.js";
import { rosca, barrasRanking, colunasEntraSai } from "../graficos.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";

let container = null;
let parar = null;
let rel = null;
let mes = competenciaAtual();

function assinar() {
  if (parar) parar();
  rel = null;
  parar = assinarRelatorios(mes, (r) => { rel = r; renderizar(); });
}

function trocarMes(novo) { mes = novo; assinar(); renderizar(); }

const abrev = (c) => MESES_ABREV[Number(c.slice(5, 7)) - 1];

function frasesDoMes(g) {
  const frases = [];
  if (g.grupos[0]) frases.push(`A maior fatia é <b>${escapeHtml(g.grupos[0].nome)}</b>, com ${Math.round(g.grupos[0].pct * 100)}% (<span data-valor>${formatarBRL(g.grupos[0].totalCentavos)}</span>).`);
  const dois = g.grupos.slice(0, 2).reduce((s, x) => s + x.pct, 0);
  if (g.grupos.length > 2) frases.push(`Os dois maiores grupos levam ${Math.round(dois * 100)}% do mês.`);
  return frases;
}

function renderizar() {
  if (!container) return;
  const nav = `<div class="mes-nav"><button class="icon-btn" id="rel-prev" aria-label="Mês anterior">‹</button><div class="mes-nav-label">${escapeHtml(competenciaLabel(mes))}</div><button class="icon-btn" id="rel-next" aria-label="Próximo mês">›</button></div>`;
  if (!rel) { container.innerHTML = `${nav}<p class="tela-sub">Carregando…</p>`; ligarNav(); return; }
  const g = rel.gastos;
  const meses = rel.serie;
  const rotulos = meses.map((m) => abrev(m.competencia));

  const bloco = (titulo, corpo, ajuda = "") => `<section class="inicio-bloco"><h3>${titulo} ${ajuda}</h3>${corpo}</section>`;

  const blocoMes = g.totalCentavos > 0 ? bloco(`Pra onde vai o dinheiro de ${escapeHtml(competenciaLabel(mes).split(" ")[0].toLowerCase())}`,
    `<div class="rel-numero" data-valor>${formatarBRL(g.totalCentavos)}</div>
     <div class="rel-dica"><span data-valor>${formatarBRL(g.pagoCentavos)}</span> já pagos · <span data-valor>${formatarBRL(g.previstoCentavos)}</span> ainda vão sair</div>
     ${rosca({ titulo: "Gastos do mês por grupo", centroRotulo: "no mês", fatias: g.grupos.map((x) => ({ rotulo: x.nome, valorCentavos: x.totalCentavos })) })}
     ${frasesDoMes(g).map((f) => `<p class="tela-sub" style="margin:10px 0 0;color:var(--text);">${f}</p>`).join("")}`,
    ajudaHtml("Soma de tudo que sai no mês: o que já foi pago e o que ainda está previsto, parcelas de dívida e recorrências incluídas. Compra no cartão conta na data da compra, e pagar a fatura não conta de novo.")) :
    bloco("Pra onde vai o dinheiro", `<p class="tela-sub">Nenhum gasto registrado neste mês.</p>`);

  // O que tem dentro de cada fatia (inclusive "Demais" e "Outros"): grupo > categoria > lançamento.
  const blocoDentro = g.totalCentavos > 0 ? bloco("O que tem dentro de cada grupo",
    `<p class="tela-sub" style="margin:0 0 10px;">Toque num grupo para ver as categorias e cada gasto que entrou na conta.</p>` +
    g.grupos.map((gr) => `<details class="inicio-detalhe rel-grupo"><summary><span>${escapeHtml(gr.nome)}</span> <b data-valor>${formatarBRL(gr.totalCentavos)}</b> <small>${Math.round(gr.pct * 100)}%</small></summary>
      ${gr.categorias.map((c) => `<div class="rel-categoria"><div class="fatura-linha"><span class="rotulo"><b>${escapeHtml(c.nome)}</b></span><b data-valor>${formatarBRL(c.totalCentavos)}</b></div>
        ${c.itens.map((i) => `<div class="fatura-linha rel-item"><span class="rotulo">${escapeHtml(i.descricao)}<small>${i.pago ? "já pago" : "ainda vai sair"}</small></span><span data-valor>${formatarBRL(i.valorCentavos)}</span></div>`).join("")}</div>`).join("")}
    </details>`).join("")) : "";

  const blocoCats = g.totalCentavos > 0 ? bloco("Cada categoria",
    barrasRanking({ titulo: "Gastos do mês por categoria", doisTons: true, linhas: g.categorias.slice(0, 12).map((c) => ({ rotulo: c.nome, valorCentavos: c.totalCentavos, pagoCentavos: c.pagoCentavos, sub: `${Math.round(c.pct * 100)}% do mês${c.essencial ? " · essencial" : ""}` })) }) +
    (g.categorias.length > 12 ? `<p class="tela-sub">Mais ${g.categorias.length - 12} categorias menores não aparecem aqui; veja na tabela.</p>` : "")) : "";

  const blocoMaiores = g.maioresItens.length ? bloco("Os 5 maiores gastos", g.maioresItens.map((i) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(i.descricao)}<small>${i.pago ? "já pago" : "ainda vai sair"}</small></span><b class="valor-neg" data-valor>−${formatarBRL(i.valorCentavos)}</b></div>`).join("")) : "";

  const pior = meses.reduce((p, m) => (m.saldoFimCentavos < p.saldoFimCentavos ? m : p), meses[0]);
  const blocoAno = meses.length ? bloco("Entra e sai nos próximos 12 meses",
    `<p class="rel-dica">${pior.saldoFimCentavos < 0 ? `O saldo fica negativo em ${escapeHtml(competenciaLabel(pior.competencia))} (<span data-valor>${formatarBRL(pior.saldoFimCentavos)}</span>).` : `O ponto mais baixo do saldo é em ${escapeHtml(competenciaLabel(pior.competencia))}: <span data-valor>${formatarBRL(pior.saldoFimCentavos)}</span>.`} Só renda confirmada ou provável; o mês atual mostra só o que falta.</p>
     ${colunasEntraSai({ meses, rotulos, titulo: "Entra, sai e saldo ao fim de cada mês" })}`,
    ajudaHtml("Vem do mesmo cálculo do Plano. Cada mês soma o que entra e o que sai com a data certa; o saldo é o que sobra na conta ao fim do mês.")) : "";

  const v = rel.vazamentos;
  const blocoVaza = v.itens.length ? bloco("Gastos que passam batido",
    `<div class="rel-numero" data-valor>${formatarBRL(v.mensalCentavos)}<small style="font-size:14px;font-weight:500;"> por mês</small></div>
     <div class="rel-dica">São <b data-valor>${formatarBRL(v.anualCentavos)}</b> por ano em assinaturas e pequenas cobranças fixas. Vale olhar uma por uma e cancelar a que você nem usa.</div>
     ${barrasRanking({ titulo: "Assinaturas e pequenos fixos", cor1: 3, linhas: v.itens.map((i) => ({ rotulo: i.descricao, valorCentavos: i.valorCentavos, sub: `${formatarBRL(i.valorCentavos * 12)} por ano` })) })}`) : "";

  const cartoes = rel.cartoes.filter((c) => c.proximaFatura.jaNaFaturaCentavos > 0 || c.previstoCentavos > 0);
  const blocoCartoes = cartoes.length ? bloco("Cartões: o que já está na próxima fatura",
    barrasRanking({ titulo: "Fatura em aberto por cartão", cor1: 1, linhas: cartoes.map((c) => ({ rotulo: c.apelido, valorCentavos: c.proximaFatura.jaNaFaturaCentavos, sub: `sai da conta dia ${c.proximaFatura.saiEm.slice(8, 10)}/${c.proximaFatura.saiEm.slice(5, 7)} · limite livre ${formatarBRL(c.limiteLivreCentavos)}${c.previstoCentavos ? ` · ${formatarBRL(c.previstoCentavos)} em compras ainda planejadas` : ""}` })) }),
    ajudaHtml("Compra no cartão é compromisso, mas o dinheiro só sai da conta no dia em que você paga a fatura.")) : "";

  const d = rel.dividas;
  const blocoDividas = d.itens.length ? bloco("Quanto você deve de verdade",
    `<div class="rel-numero" data-valor>${formatarBRL(d.totalCentavos)}</div>
     <div class="rel-dica">Dívidas em atraso ou negativadas: <b data-valor>${formatarBRL(d.problemasCentavos)}</b> · financiamentos em dia: <b data-valor>${formatarBRL(d.financiamentosCentavos)}</b>.${d.economiaCentavos > 0 ? ` Com as ofertas, você deixa de pagar <b class="valor-pos" data-valor>${formatarBRL(d.economiaCentavos)}</b>.` : ""}</div>
     ${barrasRanking({ titulo: "Dívidas por valor real", cor1: 7, linhas: d.itens.slice(0, 10).map((i) => ({ rotulo: i.nome, valorCentavos: i.valorCentavos, sub: i.classe === "trabalho" ? "paga com trabalho, não sai dinheiro" : i.classe === "financiamento" ? "financiamento em dia" : i.economiaCentavos ? `com desconto: economiza ${formatarBRL(i.economiaCentavos)}` : "" })) })}`) : "";

  container.innerHTML = `<div class="viz-raiz">${nav}${blocoMes}${blocoDentro}${blocoCats}${blocoMaiores}${blocoAno}${blocoVaza}${blocoCartoes}${blocoDividas}</div>`;
  ligarNav();
}

function ligarNav() {
  container?.querySelector("#rel-prev")?.addEventListener("click", () => trocarMes(somarMeses(mes, -1)));
  container?.querySelector("#rel-next")?.addEventListener("click", () => trocarMes(somarMeses(mes, 1)));
}

export default {
  async montar(alvo) { container = alvo; mes = competenciaAtual(); renderizar(); assinar(); },
  desmontar() { if (parar) { parar(); parar = null; } rel = null; container = null; },
};
