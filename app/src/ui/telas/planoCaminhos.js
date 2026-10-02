// Plano › Caminhos (§22, Fase 14). Os seis caminhos simulados lado a lado
// a partir dos dados reais: quando o nome limpa, quando a dívida zera,
// quando a reserva fecha, se algum mês aperta, e qual caminho os números
// sugerem, com o motivo escrito. Os ajustes (corte, renda extra, meta de
// reserva, horizonte) ficam só na memória da tela: nada de cenário é
// gravado (CLAUDE.md: simulação não escreve no dado real).

import { assinarBaseCenarios } from "../../dados/cenariosRepo.js";
import { compararCenarios } from "../../domain/cenarios.js";
import { formatarBRL, formatarBRLCurto, paraCentavos } from "../../domain/dinheiro.js";
import { somarMeses, competenciaAbrevAno, formatarData } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";

// A cor segue o cenário (nunca a posição no ranking): ordem fixa.
const COR = { atual: 1, quitacao: 2, corte: 3, renda: 4, conservador: 5, recuperacao: 6 };
const ESFORCO = ["nenhum esforço extra", "só disciplina", "uma mudança", "duas mudanças"];
const METRICAS = {
  divida: { rotulo: "Dívida total", campo: "dividaCentavos" },
  reserva: { rotulo: "Reserva", campo: "reservaCentavos" },
  patrimonio: { rotulo: "Patrimônio líquido", campo: "patrimonioCentavos" },
};

let container = null;
let parar = null;
let base = null;
const ajustes = { cortePct: 30, aumentoRendaCentavos: null, metaReservaMeses: 3, meses: 24, investimentoMinimoMensalCentavos: null };
let metrica = "divida";
let comparacao = null;

function quando(mes) {
  if (mes == null) return null;
  if (mes === 0) return "já";
  return `${mes} ${mes === 1 ? "mês" : "meses"} (${competenciaAbrevAno(somarMeses(base.competencia, mes))})`;
}

function linhaMarco(rotulo, mes, textoNunca) {
  const q = quando(mes);
  return `<div class="fatura-linha"><span class="rotulo">${rotulo}</span><b class="${q ? "" : "valor-neg"}">${q || textoNunca}</b></div>`;
}

function selos(c) {
  const lista = [];
  if (comparacao.recomendado.id === c.id) lista.push(`<span class="item-tag caminho-selo-sugerido">Sugerido</span>`);
  if (comparacao.destaques.maisRapidoNomeLimpo === c.id) lista.push(`<span class="item-tag">Limpa o nome primeiro</span>`);
  if (comparacao.destaques.maisRapidoSemDivida === c.id) lista.push(`<span class="item-tag">Zera dívida primeiro</span>`);
  if (comparacao.destaques.maiorPatrimonio === c.id) lista.push(`<span class="item-tag">Maior patrimônio</span>`);
  return lista.join("");
}

function cartaoCaminho(c) {
  const r = c.resultado;
  const temNegativada = base.dividas.some((d) => d.negativada);
  return `
    <div class="divida-resumo caminho-card${comparacao.recomendado.id === c.id ? " sugerido" : ""}">
      <div class="caminho-cabeca">
        <span class="caminho-cor" style="background:var(--serie-${COR[c.id]})"></span>
        <div style="min-width:0;">
          <div class="titulo" style="margin:0;">${escapeHtml(c.nome)}</div>
          <div class="item-sub">${ESFORCO[c.esforco]}</div>
        </div>
      </div>
      ${selos(c) ? `<div class="caminho-selos">${selos(c)}</div>` : ""}
      <p class="caminho-descricao">${escapeHtml(c.descricao)}</p>
      <div class="caminho-status ${r.viavel ? "ok" : "aperta"}">${r.viavel ? "Sobrevivência e investimento cobertos todo mês" : `Aperta no mês ${r.primeiroMesNegativo} (${competenciaAbrevAno(somarMeses(base.competencia, r.primeiroMesNegativo))}): nem o essencial fecha`}</div>
      ${r.dividasComAtraso.length ? `
        <div class="caminho-status aperta" style="margin-top:6px;">
          ${r.dividasComAtraso.map((d) => `${escapeHtml(d.nome)} fica sem pagar por ${d.quantidadeMeses} ${d.quantidadeMeses === 1 ? "mês" : "meses"} (a partir de ${competenciaAbrevAno(somarMeses(base.competencia, d.primeiroMes))})`).join("; ")}
        </div>` : ""}
      ${temNegativada ? linhaMarco("Nome limpo em", r.mesNomeLimpo, `não limpa em ${comparacao.meses} meses`) : ""}
      ${base.dividas.length ? linhaMarco("Dívidas zeradas em", r.mesDividaZerada, `não zera em ${comparacao.meses} meses`) : ""}
      ${r.metaReservaCentavos > 0 ? linhaMarco(`Reserva de ${comparacao.metaReservaMeses} meses em`, r.mesReservaMeta, "não chega") : ""}
      <div class="fatura-linha"><span class="rotulo">Sobra por mês<small>média dos meses fechados: renda menos todo o gasto e as parcelas</small></span><b class="${r.sobraMensalInicialCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(r.sobraMensalInicialCentavos)}</b></div>
      ${r.jurosAcumuladosCentavos > 0 ? `<div class="fatura-linha"><span class="rotulo">Juros pagos no período<small>das dívidas com acordo e o que as sem acordo crescem</small></span><b class="valor-neg" data-valor>${formatarBRL(r.jurosAcumuladosCentavos)}</b></div>` : ""}
      <div class="fatura-linha"><span class="rotulo">Patrimônio em 12 meses</span><b class="${r.em12Meses.patrimonioCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(r.em12Meses.patrimonioCentavos)}</b></div>
      <div class="fatura-linha"><span class="rotulo">Patrimônio em ${comparacao.meses} meses</span><b class="${r.final.patrimonioCentavos < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(r.final.patrimonioCentavos)}</b></div>
    </div>`;
}

function blocoSugerido() {
  const c = comparacao.cenarios.find((x) => x.id === comparacao.recomendado.id);
  return `
    <div class="hero-caixa caminho-hero">
      <div class="hero-caixa-label">Caminho sugerido pelos números</div>
      <div class="caminho-hero-nome">${escapeHtml(c.nome)}</div>
      <div class="hero-caixa-sub">${escapeHtml(comparacao.recomendado.motivo)}</div>
    </div>
    ${comparacao.base.apertoCaixa ? `
      <div class="alerta-cobertura" style="margin-top:12px;">
        <div class="titulo">Antes de qualquer caminho: ${escapeHtml(formatarData(comparacao.base.apertoCaixa.data))}</div>
        <div class="texto">A conta mês a mês fecha, mas nesse dia saem mais contas do que tem na conta: faltam <span class="valor-neg" data-valor>${formatarBRL(comparacao.base.apertoCaixa.faltaCentavos)}</span> até a próxima renda cair. Use a reserva ou adie um pagamento que dê pra adiar. O detalhe está em Planejamento.</div>
      </div>` : ""}`;
}

function blocoAjustes() {
  const aumento = ajustes.aumentoRendaCentavos != null
    ? ajustes.aumentoRendaCentavos
    : comparacao.cenarios.find((c) => c.id === "renda").aumentoCentavos;
  const investimento = ajustes.investimentoMinimoMensalCentavos != null
    ? ajustes.investimentoMinimoMensalCentavos
    : (base.investimentoMinimoMensalCentavos || 0);
  return `
    <div class="divida-resumo caminho-ajustes">
      <div class="field"><label for="aj-corte">Corte no não essencial (%)</label>
        <input id="aj-corte" type="number" min="0" max="100" step="5" value="${ajustes.cortePct}"></div>
      <div class="field"><label for="aj-renda">Renda extra por mês</label>
        <input id="aj-renda" type="text" inputmode="decimal" value="${(aumento / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}"></div>
      <div class="field"><label for="aj-reserva">Reserva (meses de essencial)</label>
        <select id="aj-reserva">${[3, 6, 12].map((m) => `<option value="${m}"${m === ajustes.metaReservaMeses ? " selected" : ""}>${m} meses</option>`).join("")}</select></div>
      <div class="field"><label for="aj-meses">Horizonte</label>
        <select id="aj-meses">${[12, 24, 36].map((m) => `<option value="${m}"${m === ajustes.meses ? " selected" : ""}>${m} meses</option>`).join("")}</select></div>
      <div class="field"><label for="aj-investimento">Investimento mínimo por mês<small>protegido, nunca vira pagamento de dívida</small></label>
        <input id="aj-investimento" type="text" inputmode="decimal" value="${(investimento / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}"></div>
    </div>`;
}

// ---------- gráfico: uma linha por caminho, um eixo só ----------

// O SVG é desenhado na largura real do container (não escalado por
// viewBox), pra que o texto do eixo fique sempre em 13px, no celular e no
// computador. Redesenha quando a janela muda de tamanho.
let G = { w: 720, h: 240, esq: 62, dir: 16, topo: 12, base: 28 };
let pararRedimensionar = null;

function escalaY(valores) {
  let min = Math.min(0, ...valores);
  let max = Math.max(0, ...valores);
  if (max === min) max = min + 100000;
  const passo = Math.pow(10, Math.floor(Math.log10((max - min) / 4)));
  const multiplo = [1, 2, 2.5, 5, 10].find((m) => (max - min) / (m * passo) <= 4) * passo;
  min = Math.floor(min / multiplo) * multiplo;
  max = Math.ceil(max / multiplo) * multiplo;
  const marcas = [];
  for (let v = min; v <= max + 1; v += multiplo) marcas.push(v);
  return { min, max, marcas };
}

function grafico() {
  return `<div class="grafico-caminhos" id="grafico-caminhos"></div>`;
}

function desenharGrafico() {
  const campo = METRICAS[metrica].campo;
  const series = comparacao.cenarios.map((c) => ({
    id: c.id, nome: c.nome,
    pontos: [{ mes: 0, valor: pontoInicial(campo) }, ...c.resultado.serie.map((s) => ({ mes: s.mes, valor: s[campo] }))],
  }));
  const todos = series.flatMap((s) => s.pontos.map((p) => p.valor));
  const { min, max, marcas } = escalaY(todos);
  const n = comparacao.meses;
  const x = (mes) => G.esq + (mes / n) * (G.w - G.esq - G.dir);
  const y = (v) => G.topo + (1 - (v - min) / (max - min)) * (G.h - G.topo - G.base);
  const passoX = G.w < 520 ? (n <= 12 ? 6 : 12) : (n <= 12 ? 3 : 6);

  const grade = marcas.map((v) => `
    <line x1="${G.esq}" x2="${G.w - G.dir}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? "grafico-zero" : "grafico-grade"}"/>
    <text x="${G.esq - 8}" y="${y(v) + 4}" text-anchor="end" class="grafico-eixo">${escapeHtml(formatarBRLCurto(v))}</text>`).join("");
  const eixoX = [];
  for (let m = 0; m <= n; m += passoX) {
    const ancora = m === 0 ? "start" : m + passoX > n ? "end" : "middle";
    eixoX.push(`<text x="${x(m)}" y="${G.h - 8}" text-anchor="${ancora}" class="grafico-eixo">${m === 0 ? "hoje" : escapeHtml(competenciaAbrevAno(somarMeses(base.competencia, m)))}</text>`);
  }
  // O sugerido desenha por último (por cima) e mais grosso.
  // Ordem de desenho: os demais, depois "seguir como está" tracejado (é a
  // referência, e costuma coincidir com outro caminho), e o sugerido por
  // último e mais grosso.
  const peso = (id) => (id === comparacao.recomendado.id ? 2 : id === "atual" ? 1 : 0);
  const ordem = [...series].sort((a, b) => peso(a.id) - peso(b.id));
  const linhas = ordem.map((s) => `
    <polyline fill="none" stroke="var(--serie-${COR[s.id]})" stroke-width="${s.id === comparacao.recomendado.id ? 3.5 : 2}"
      ${s.id === "atual" && s.id !== comparacao.recomendado.id ? 'stroke-dasharray="6 5"' : ""}
      stroke-linejoin="round" stroke-linecap="round" points="${s.pontos.map((p) => `${x(p.mes).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ")}"/>`).join("");

  return `
      <svg width="${G.w}" height="${G.h}" viewBox="0 0 ${G.w} ${G.h}" role="img" aria-label="${escapeHtml(METRICAS[metrica].rotulo)} mês a mês em cada caminho">
        ${grade}
        ${eixoX.join("")}
        ${linhas}
        <line id="grafico-cursor" class="grafico-cursor" x1="0" x2="0" y1="${G.topo}" y2="${G.h - G.base}" visibility="hidden"/>
        <rect id="grafico-alvo" x="${G.esq}" y="${G.topo}" width="${G.w - G.esq - G.dir}" height="${G.h - G.topo - G.base}" fill="transparent"/>
      </svg>
      <div class="grafico-dica" id="grafico-dica" hidden></div>`;
}

function pintarGrafico() {
  const caixa = container?.querySelector("#grafico-caminhos");
  if (!caixa) return;
  const largura = Math.max(300, Math.floor(caixa.clientWidth));
  G = { w: largura, h: largura < 520 ? 210 : 250, esq: 62, dir: 16, topo: 12, base: 28 };
  caixa.innerHTML = desenharGrafico();
  ligarGrafico();
}

function pontoInicial(campo) {
  const divida = base.dividas.reduce((s, d) => s + d.saldoCentavos, 0);
  if (campo === "dividaCentavos") return divida;
  if (campo === "reservaCentavos") return base.reservaCentavos;
  return base.ativosCentavos + base.reservaCentavos + base.caixaCentavos - divida;
}

function ligarGrafico() {
  const caixa = container.querySelector("#grafico-caminhos");
  const svg = caixa?.querySelector("svg");
  const alvo = caixa?.querySelector("#grafico-alvo");
  const cursor = caixa?.querySelector("#grafico-cursor");
  const dica = caixa?.querySelector("#grafico-dica");
  if (!svg || !alvo) return;
  const campo = METRICAS[metrica].campo;
  const n = comparacao.meses;
  const mostrar = (ev) => {
    const r = svg.getBoundingClientRect();
    const xSvg = ev.clientX - r.left;
    const mes = Math.max(0, Math.min(n, Math.round(((xSvg - G.esq) / (G.w - G.esq - G.dir)) * n)));
    const xm = G.esq + (mes / n) * (G.w - G.esq - G.dir);
    cursor.setAttribute("x1", xm);
    cursor.setAttribute("x2", xm);
    cursor.setAttribute("visibility", "visible");
    const valores = comparacao.cenarios.map((c) => ({
      c, valor: mes === 0 ? pontoInicial(campo) : c.resultado.serie[mes - 1][campo],
    }));
    dica.innerHTML = `
      <div class="grafico-dica-titulo">${mes === 0 ? "Hoje" : `${escapeHtml(competenciaAbrevAno(somarMeses(base.competencia, mes)))} · mês ${mes}`}</div>
      ${valores.map(({ c, valor }) => `<div class="grafico-dica-linha"><span class="caminho-cor" style="background:var(--serie-${COR[c.id]})"></span><span>${escapeHtml(c.nome)}</span><b data-valor>${formatarBRL(valor)}</b></div>`).join("")}`;
    dica.hidden = false;
    const larguraCaixa = caixa.clientWidth;
    const aDireita = xm + 12 + dica.offsetWidth <= larguraCaixa - 4;
    dica.style.left = `${Math.max(4, aDireita ? xm + 12 : xm - 12 - dica.offsetWidth)}px`;
  };
  alvo.addEventListener("pointermove", mostrar);
  alvo.addEventListener("pointerdown", mostrar);
  alvo.addEventListener("pointerleave", () => { dica.hidden = true; cursor.setAttribute("visibility", "hidden"); });
}

// ---------- tela ----------

function recalcular() {
  comparacao = base && base.suficiente ? compararCenarios(base, ajustes) : null;
}

function renderizar() {
  if (!container) return;
  if (!base) {
    container.innerHTML = `<p class="tela-sub">Carregando…</p>`;
    return;
  }
  if (!comparacao) {
    container.innerHTML = `<div class="vazio">Os caminhos nascem da sua renda e do seu gasto reais. Lance pelo menos um mês de receitas e despesas (ou mande pelo chat) e os seis caminhos aparecem aqui.</div>`;
    return;
  }

  container.innerHTML = `
    ${blocoSugerido()}

    <div class="tela-head" style="margin-top:6px;"><div><h3 class="tela-titulo" style="font-size:17px;">Ajuste as premissas</h3>
      <p class="tela-sub">Tudo recalcula na hora. Nada aqui muda seus dados reais</p></div></div>
    ${blocoAjustes()}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Os caminhos lado a lado</h3>
      <p class="tela-sub">Toque no gráfico pra ver o valor de cada caminho mês a mês</p></div></div>
    <div class="divida-resumo">
      <div class="subabas" role="tablist" style="margin-bottom:10px;">
        ${Object.entries(METRICAS).map(([id, m]) => `<button class="modulo-chip${id === metrica ? " ativo" : ""}" data-metrica="${id}" role="tab">${m.rotulo}</button>`).join("")}
      </div>
      <div class="grafico-legenda">
        ${comparacao.cenarios.map((c) => `<span><span class="caminho-cor" style="background:var(--serie-${COR[c.id]})"></span>${escapeHtml(c.nome)}</span>`).join("")}
      </div>
      ${grafico()}
    </div>

    ${base.semHistorico ? `<p class="tela-sub" style="margin:0 0 12px;">Baseado no que você cadastrou para este mês, ainda sem histórico real. Fica mais preciso a cada mês fechado.</p>` : ""}
    <div class="caminhos-grid">${comparacao.cenarios.map(cartaoCaminho).join("")}</div>

    <details class="caminho-premissas">
      <summary>O que a simulação assume</summary>
      <ul>${comparacao.premissas.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </details>
  `;

  container.querySelectorAll("[data-metrica]").forEach((btn) => btn.addEventListener("click", () => {
    metrica = btn.dataset.metrica;
    renderizar();
  }));
  const aoMudar = () => {
    const corte = Number(container.querySelector("#aj-corte").value);
    ajustes.cortePct = Number.isFinite(corte) ? Math.max(0, Math.min(100, corte)) : 30;
    const renda = paraCentavos(container.querySelector("#aj-renda").value);
    ajustes.aumentoRendaCentavos = renda > 0 ? renda : null;
    ajustes.metaReservaMeses = Number(container.querySelector("#aj-reserva").value) || 3;
    ajustes.meses = Number(container.querySelector("#aj-meses").value) || 24;
    const investimento = paraCentavos(container.querySelector("#aj-investimento").value);
    ajustes.investimentoMinimoMensalCentavos = investimento > 0 ? investimento : 0;
    recalcular();
    renderizar();
  };
  ["#aj-corte", "#aj-renda", "#aj-reserva", "#aj-meses", "#aj-investimento"].forEach((sel) => container.querySelector(sel).addEventListener("change", aoMudar));
  pintarGrafico();
}

export default {
  montar(alvo) {
    container = alvo;
    base = null;
    comparacao = null;
    renderizar();
    if (parar) parar();
    parar = assinarBaseCenarios((b) => { base = b; recalcular(); renderizar(); });
    let espera = null;
    const aoRedimensionar = () => { clearTimeout(espera); espera = setTimeout(pintarGrafico, 150); };
    window.addEventListener("resize", aoRedimensionar);
    pararRedimensionar = () => { clearTimeout(espera); window.removeEventListener("resize", aoRedimensionar); };
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    if (pararRedimensionar) { pararRedimensionar(); pararRedimensionar = null; }
    container = null;
  },
};
