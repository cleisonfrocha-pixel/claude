// Gráficos em HTML e SVG puro (sem biblioteca). Cores vêm de variáveis CSS (--viz-1…8) que mudam com o
// tema; nenhum valor aparece só em cor: todo gráfico tem legenda e uma tabela escondida ("Ver em tabela").

import { formatarBRL } from "../domain/dinheiro.js";
import { escapeHtml } from "./utilitarios.js";

const cor = (i) => `var(--viz-${(i % 8) + 1})`;

export function reaisCurto(centavos) {
  const v = Math.abs(centavos) / 100;
  const sinal = centavos < 0 ? "−" : "";
  if (v >= 1000) return `${sinal}${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",")} mil`;
  return `${sinal}${Math.round(v)}`;
}

export function tabelaEscondida(titulo, linhas, colunas) {
  return `<details class="viz-tabela"><summary>Ver em tabela</summary>
    <table><caption class="sr">${escapeHtml(titulo)}</caption>
      <thead><tr>${colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map((l) => `<tr>${l.map((c, i) => `<td${i ? ' class="mono" data-valor' : ""}>${escapeHtml(String(c))}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></details>`;
}

/** Parte do todo: rosca com as maiores fatias e "Outros", mais legenda (a legenda carrega nome, valor e %). */
export function rosca({ fatias, titulo, centroRotulo, centroValor, maximo = 6 }) {
  const ordenadas = fatias.filter((f) => f.valorCentavos > 0).sort((a, b) => b.valorCentavos - a.valorCentavos);
  const topo = ordenadas.slice(0, maximo);
  const resto = ordenadas.slice(maximo).reduce((s, f) => s + f.valorCentavos, 0);
  const lista = resto > 0 ? [...topo, { rotulo: "Demais", valorCentavos: resto, neutro: true }] : topo;
  const total = lista.reduce((s, f) => s + f.valorCentavos, 0);
  if (!(total > 0)) return `<p class="tela-sub">Sem gastos neste mês ainda.</p>`;
  const R = 52, C = 2 * Math.PI * R, FOLGA = 2;
  let acumulado = 0;
  const arcos = lista.map((f, i) => {
    const parte = (f.valorCentavos / total) * C;
    const dash = Math.max(0.5, parte - FOLGA);
    const svg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${f.neutro ? "var(--viz-neutro)" : cor(i)}" stroke-width="18" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-acumulado).toFixed(2)}" transform="rotate(-90 70 70)"><title>${escapeHtml(f.rotulo)}: ${formatarBRL(f.valorCentavos)} (${Math.round((f.valorCentavos / total) * 100)}%)</title></circle>`;
    acumulado += parte;
    return svg;
  }).join("");
  return `<figure class="viz-rosca" role="img" aria-label="${escapeHtml(titulo)}">
    <div class="viz-rosca-svg"><svg viewBox="0 0 140 140" width="160" height="160">${arcos}</svg>
      <div class="viz-rosca-centro"><small>${escapeHtml(centroRotulo || "")}</small><b data-valor>${escapeHtml(centroValor || formatarBRL(total))}</b></div></div>
    <ul class="viz-legenda">${lista.map((f, i) => `<li><span class="viz-chip" style="background:${f.neutro ? "var(--viz-neutro)" : cor(i)}"></span><span class="viz-nome">${escapeHtml(f.rotulo)}</span><span class="viz-num" data-valor>${formatarBRL(f.valorCentavos)}</span><span class="viz-pct">${Math.round((f.valorCentavos / total) * 100)}%</span></li>`).join("")}</ul>
  </figure>${tabelaEscondida(titulo, lista.map((f) => [f.rotulo, formatarBRL(f.valorCentavos), `${Math.round((f.valorCentavos / total) * 100)}%`]), ["Item", "Valor", "%"])}`;
}

/** Barras horizontais ordenadas. Cada linha pode ter dois tons (já pago e ainda a pagar). */
export function barrasRanking({ linhas, titulo, doisTons = false, rotuloA = "Já pago", rotuloB = "Ainda a pagar", cor1 = 0 }) {
  const max = Math.max(1, ...linhas.map((l) => l.valorCentavos));
  const html = linhas.map((l) => {
    const largura = (l.valorCentavos / max) * 100;
    const a = doisTons && l.valorCentavos > 0 ? (l.pagoCentavos / l.valorCentavos) * 100 : 100;
    return `<li class="viz-linha"><div class="viz-linha-topo"><span class="viz-nome">${escapeHtml(l.rotulo)}</span><span class="viz-num" data-valor>${formatarBRL(l.valorCentavos)}</span></div>
      <div class="viz-trilho"><div class="viz-barra" style="width:${largura.toFixed(1)}%"><i style="width:${a.toFixed(1)}%;background:${cor(cor1)}"></i>${doisTons && a < 100 ? `<i class="viz-tom2" style="width:${(100 - a).toFixed(1)}%;background:${cor(cor1)}"></i>` : ""}</div></div>
      ${l.sub ? `<div class="viz-sub">${escapeHtml(l.sub)}</div>` : ""}</li>`;
  }).join("");
  const legenda = doisTons ? `<div class="viz-legenda-h"><span><i class="viz-chip" style="background:${cor(cor1)}"></i>${escapeHtml(rotuloA)}</span><span><i class="viz-chip viz-chip-claro" style="background:${cor(cor1)}"></i>${escapeHtml(rotuloB)}</span></div>` : "";
  return `${legenda}<ul class="viz-ranking" aria-label="${escapeHtml(titulo)}">${html}</ul>${tabelaEscondida(titulo, linhas.map((l) => [l.rotulo, formatarBRL(l.valorCentavos)]), ["Item", "Valor"])}`;
}

/** 12 meses: colunas de entra e sai e a linha do saldo ao fim do mês. Uma escala só (reais), zero no meio quando há negativo. */
export function colunasEntraSai({ meses, titulo, rotulos }) {
  const W = 340, H = 190, ML = 6, MR = 6, MT = 14, MB = 24;
  const vals = meses.flatMap((m) => [m.entradasCentavos, m.saidasCentavos, m.saldoFimCentavos, 0]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const y = (v) => MT + ((max - v) / Math.max(1, max - min)) * (H - MT - MB);
  const passo = (W - ML - MR) / meses.length;
  const larg = Math.min(9, passo / 2.6);
  const base = y(0);
  const colunas = meses.map((m, i) => {
    const cx = ML + passo * i + passo / 2;
    const e = y(m.entradasCentavos), s = y(m.saidasCentavos);
    const bar = (x, topo, c, rotulo, v) => `<rect x="${(x - larg / 2).toFixed(1)}" y="${Math.min(topo, base).toFixed(1)}" width="${larg.toFixed(1)}" height="${Math.max(1, Math.abs(base - topo)).toFixed(1)}" rx="3" fill="${c}"><title>${escapeHtml(rotulo)}: ${formatarBRL(v)}</title></rect>`;
    return bar(cx - larg / 2 - 1, e, "var(--viz-1)", `${rotulos[i]} entra`, m.entradasCentavos) + bar(cx + larg / 2 + 1, s, "var(--viz-2)", `${rotulos[i]} sai`, m.saidasCentavos);
  }).join("");
  const pts = meses.map((m, i) => `${(ML + passo * i + passo / 2).toFixed(1)},${y(m.saldoFimCentavos).toFixed(1)}`);
  const linha = `<polyline points="${pts.join(" ")}" fill="none" stroke="var(--viz-3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const marcadores = meses.map((m, i) => `<circle cx="${(ML + passo * i + passo / 2).toFixed(1)}" cy="${y(m.saldoFimCentavos).toFixed(1)}" r="3.5" fill="var(--viz-3)" stroke="var(--viz-superficie)" stroke-width="2"><title>${escapeHtml(rotulos[i])}: termina com ${formatarBRL(m.saldoFimCentavos)}</title></circle>`).join("");
  const eixo = meses.map((m, i) => `<text x="${(ML + passo * i + passo / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="viz-eixo">${escapeHtml(rotulos[i])}</text>`).join("");
  const ultimo = meses[meses.length - 1];
  const rotuloFim = `<text x="${W - MR}" y="${(y(ultimo.saldoFimCentavos) - 8).toFixed(1)}" text-anchor="end" class="viz-rotulo-fim">${escapeHtml(reaisCurto(ultimo.saldoFimCentavos))}</text>`;
  const piorI = meses.reduce((p, m, i) => (m.saldoFimCentavos < meses[p].saldoFimCentavos ? i : p), 0);
  const rotuloPior = piorI !== meses.length - 1 ? `<text x="${(ML + passo * piorI + (piorI === 0 ? 0 : passo / 2)).toFixed(1)}" y="${(y(meses[piorI].saldoFimCentavos) + 17).toFixed(1)}" text-anchor="${piorI === 0 ? "start" : "middle"}" class="viz-rotulo-fim">${escapeHtml(reaisCurto(meses[piorI].saldoFimCentavos))}</text>` : "";
  return `<figure class="viz-colunas" role="img" aria-label="${escapeHtml(titulo)}">
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet"><line x1="${ML}" x2="${W - MR}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}" class="viz-zero"/>${colunas}${linha}${marcadores}${rotuloFim}${rotuloPior}${eixo}</svg>
    <div class="viz-legenda-h"><span><i class="viz-chip" style="background:var(--viz-1)"></i>Entra</span><span><i class="viz-chip" style="background:var(--viz-2)"></i>Sai</span><span><i class="viz-chip" style="background:var(--viz-3)"></i>Saldo ao fim do mês</span></div>
  </figure>${tabelaEscondida(titulo, meses.map((m, i) => [rotulos[i], formatarBRL(m.entradasCentavos), formatarBRL(m.saidasCentavos), formatarBRL(m.saldoFimCentavos)]), ["Mês", "Entra", "Sai", "Saldo ao fim"])}`;
}

let contadorLinha = 0;

/** Saldo ao fim de cada mês: uma linha só, com a faixa abaixo de zero em vermelho (é onde o dinheiro acaba),
 * o ponto mais baixo e o último marcados com valor, e opcionalmente um mês destacado (a virada). */
export function linhaSaldo({ meses, rotulos, titulo, destaqueIndice = null, destaqueRotulo = "" }) {
  const W = 340, H = 180, ML = 8, MR = 8, MT = 22, MB = 24;
  const id = `ls${++contadorLinha}`;
  const vals = [...meses.map((m) => m.saldoFimCentavos), 0];
  const max = Math.max(...vals), min = Math.min(...vals);
  const y = (v) => MT + ((max - v) / Math.max(1, max - min)) * (H - MT - MB);
  const passo = (W - ML - MR) / Math.max(1, meses.length - 1);
  const x = (i) => ML + passo * i;
  const base = y(0);
  const pts = meses.map((m, i) => [x(i), y(m.saldoFimCentavos)]);
  const linha = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `M${pts[0][0].toFixed(1)},${base.toFixed(1)} ${pts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ")} L${pts[pts.length - 1][0].toFixed(1)},${base.toFixed(1)} Z`;
  const piorI = meses.reduce((p, m, i) => (m.saldoFimCentavos < meses[p].saldoFimCentavos ? i : p), 0);
  const ult = meses.length - 1;
  const ancora = (i) => (i === 0 ? "start" : i === ult ? "end" : "middle");
  const rotuloPonto = (i, dy) => `<text x="${pts[i][0].toFixed(1)}" y="${(pts[i][1] + dy).toFixed(1)}" text-anchor="${ancora(i)}" class="viz-rotulo-fim">${escapeHtml(reaisCurto(meses[i].saldoFimCentavos))}</text>`;
  const destaque = destaqueIndice != null && meses[destaqueIndice]
    ? `<line x1="${x(destaqueIndice).toFixed(1)}" x2="${x(destaqueIndice).toFixed(1)}" y1="${MT - 6}" y2="${H - MB}" class="viz-zero" stroke-dasharray="3 3"/><text x="${x(destaqueIndice).toFixed(1)}" y="${MT - 9}" text-anchor="middle" class="viz-eixo">${escapeHtml(destaqueRotulo)}</text>` : "";
  const eixo = meses.map((m, i) => (i % 2 === 0 || meses.length < 8) ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${ancora(i)}" class="viz-eixo">${escapeHtml(rotulos[i])}</text>` : "").join("");
  return `<figure class="viz-colunas" role="img" aria-label="${escapeHtml(titulo)}">
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id="${id}-pos"><rect x="0" y="0" width="${W}" height="${base.toFixed(1)}"/></clipPath><clipPath id="${id}-neg"><rect x="0" y="${base.toFixed(1)}" width="${W}" height="${H}"/></clipPath></defs>
      <path d="${area}" fill="var(--good)" fill-opacity=".22" clip-path="url(#${id}-pos)"/>
      <path d="${area}" fill="var(--danger)" fill-opacity=".30" clip-path="url(#${id}-neg)"/>
      <line x1="${ML}" x2="${W - MR}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}" class="viz-zero"/>
      ${destaque}
      <polyline points="${linha}" fill="none" stroke="var(--viz-3)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(([px, py], i) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="${meses[i].saldoFimCentavos < 0 ? "var(--danger)" : "var(--viz-3)"}" stroke="var(--viz-superficie)" stroke-width="1.5"><title>${escapeHtml(rotulos[i])}: ${formatarBRL(meses[i].saldoFimCentavos)}</title></circle>`).join("")}
      ${rotuloPonto(piorI, piorI === ult ? -8 : 17)}${piorI !== ult ? rotuloPonto(ult, -8) : ""}${eixo}
    </svg>
    <div class="viz-legenda-h"><span><i class="viz-chip" style="background:var(--good)"></i>Saldo positivo</span><span><i class="viz-chip" style="background:var(--danger)"></i>Dinheiro acabou (abaixo de zero)</span></div>
  </figure>${tabelaEscondida(titulo, meses.map((m, i) => [rotulos[i], formatarBRL(m.saldoFimCentavos)]), ["Mês", "Saldo ao fim"])}`;
}
