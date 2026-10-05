// Plano › Meu ano. O que de fato aconteceu mês a mês: quanto entrou (por fonte), quanto saiu (por grupo),
// o resultado, e quanto da renda dá para contar. Números de domain/historicoAno.js; nada é inventado, e o
// mês de hoje aparece à parte porque ainda não fechou.

import { assinarHistoricoAno } from "../../dados/historicoAnoRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { competenciaLabel } from "../../domain/tempo.js";
import { rosca } from "../graficos.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";

let container = null;
let parar = null;
let dados = null;
let pessoaId = null; // null = a casa toda

const SELO = {
  fixa: ["fixa", "var(--good)", "veio todo mês, quase no mesmo valor"],
  irregular: ["irregular", "var(--warn)", "tem mês que vem, tem mês que não"],
  caiu: ["caiu", "var(--danger)", "nos últimos meses veio bem menos que antes"],
  eventual: ["eventual", "var(--text-2, inherit)", "apareceu poucas vezes"],
  avulsa: ["avulsa", "var(--text-2, inherit)", "várias entradas sem fonte cadastrada"],
};

const brl = (c) => `<span data-valor>${formatarBRL(c)}</span>`;
const sinal = (c) => `<b class="${c < 0 ? "valor-neg" : "valor-pos"}" data-valor>${formatarBRL(c)}</b>`;
const mesCurto = (c) => competenciaLabel(c).split(" ")[0];

function resumo(h) {
  if (!h.mesesFechados) return `<p class="tela-sub">Ainda não há um mês fechado com movimento. Quando houver, o resumo aparece aqui.</p>`;
  const t = h.tendencia;
  const frase = t
    ? `Nos últimos 3 meses fechados o resultado médio foi ${brl(t.resultadoMedioCentavos)}, contra ${brl(t.resultadoAnteriorCentavos)} nos 3 anteriores.`
    : "Preciso de pelo menos 5 meses fechados para comparar com o período anterior.";
  return `<div class="rel-numero">${sinal(h.resultadoMedioCentavos)}<small style="font-size:14px;font-weight:500;"> por mês, em média</small></div>
    <div class="rel-dica">${h.mesesFechados} meses fechados, de ${escapeHtml(mesCurto(h.de))} até ${escapeHtml(mesCurto(h.linhas.filter((l) => !l.parcial).slice(-1)[0].competencia))}. Resultado é o que entrou menos o que saiu de verdade, só do que foi pago.</div>
    <div class="fatura-linha"><span class="rotulo">Melhor mês</span><span>${escapeHtml(mesCurto(h.melhorMes.competencia))} · ${sinal(h.melhorMes.resultadoCentavos)}</span></div>
    <div class="fatura-linha"><span class="rotulo">Pior mês</span><span>${escapeHtml(mesCurto(h.piorMes.competencia))} · ${sinal(h.piorMes.resultadoCentavos)}</span></div>
    <p class="tela-sub" style="margin:10px 0 0;color:var(--text);">${frase}</p>`;
}

function linhaDoMes(l, pessoa) {
  const apoio = l.apoio;
  const textoApoio = pessoa
    ? (apoio.recebidoCentavos || apoio.enviadoCentavos
      ? `<div class="fatura-linha"><span class="rotulo">Apoio entre vocês <small>não entra na renda</small></span><span>${apoio.recebidoCentavos ? `recebeu ${brl(apoio.recebidoCentavos)}` : ""}${apoio.recebidoCentavos && apoio.enviadoCentavos ? " · " : ""}${apoio.enviadoCentavos ? `mandou ${brl(apoio.enviadoCentavos)}` : ""}</span></div>` : "")
    : (apoio.movimentadoCentavos ? `<div class="fatura-linha"><span class="rotulo">Passou de um para o outro <small>não é renda nem gasto</small></span>${brl(apoio.movimentadoCentavos)}</div>` : "");
  const rep = l.repasses.entradaCentavos || l.repasses.saidaCentavos
    ? `<div class="fatura-linha"><span class="rotulo">Repasses <small>dinheiro de outra pessoa que só passou por aqui</small></span><span>${l.repasses.entradaCentavos ? `entrou ${brl(l.repasses.entradaCentavos)}` : ""}${l.repasses.entradaCentavos && l.repasses.saidaCentavos ? " · " : ""}${l.repasses.saidaCentavos ? `saiu ${brl(l.repasses.saidaCentavos)}` : ""}</span></div>` : "";
  return `<details class="inicio-detalhe rel-grupo"><summary><span>${escapeHtml(mesCurto(l.competencia))}${l.parcial ? " (em andamento)" : ""}</span> ${sinal(l.resultadoCentavos)} <small>entrou ${formatarBRL(l.rendaCentavos)} · saiu ${formatarBRL(l.saidaCentavos)}</small></summary>
    <div class="rel-categoria"><div class="fatura-linha"><b>Entrou</b><b data-valor>${formatarBRL(l.rendaCentavos)}</b></div>
      ${l.fontes.map((f) => `<div class="fatura-linha rel-item"><span class="rotulo">${escapeHtml(f.nome)}<small>${f.ids.length} lançamento(s)</small></span>${brl(f.totalCentavos)}</div>`).join("") || `<p class="tela-sub">Nada entrou.</p>`}</div>
    <div class="rel-categoria"><div class="fatura-linha"><b>Saiu</b><b data-valor>${formatarBRL(l.saidaCentavos)}</b></div>
      ${l.grupos.map((g) => `<div class="fatura-linha rel-item"><span class="rotulo">${escapeHtml(g.nome)}<small>${g.ids.length} lançamento(s)</small></span>${brl(g.totalCentavos)}</div>`).join("") || `<p class="tela-sub">Nada saiu.</p>`}</div>
    ${textoApoio}${rep}
  </details>`;
}

function renderizar() {
  if (!container) return;
  if (!dados) { container.innerHTML = `<p class="tela-sub" style="margin-top:18px;">Carregando…</p>`; return; }
  const { historico: h, pessoas } = dados;
  const chips = `<div class="subabas" role="tablist" style="margin:0 0 12px;">
    <button class="modulo-chip${pessoaId == null ? " ativo" : ""}" data-pessoa="" role="tab">Casa toda</button>
    ${pessoas.map((p) => `<button class="modulo-chip${pessoaId === p.id ? " ativo" : ""}" data-pessoa="${escapeHtml(p.id)}" role="tab">${escapeHtml(p.nome.split(" ")[0])}</button>`).join("")}</div>`;
  const bloco = (titulo, corpo, ajuda = "") => `<section class="inicio-bloco"><h3>${titulo} ${ajuda}</h3>${corpo}</section>`;

  if (!h.linhas.length) {
    container.innerHTML = `<div class="viz-raiz">${chips}${bloco("Seu ano até agora", `<p class="tela-sub">Ainda não há lançamentos pagos para mostrar.</p>`)}</div>`;
    ligar(); return;
  }

  const fechadas = h.linhas.filter((l) => !l.parcial);
  const grupos = new Map();
  for (const l of fechadas) for (const g of l.grupos) grupos.set(g.nome, (grupos.get(g.nome) || 0) + g.totalCentavos);

  const blocoFontes = bloco("De onde vem o dinheiro",
    h.fontes.map((f) => {
      const [rotulo, cor, explica] = SELO[f.selo] || SELO.eventual;
      return `<div class="fatura-linha" style="align-items:flex-start;"><span class="rotulo"><b>${escapeHtml(f.nome)}</b> <span style="color:${cor};font-size:12px;">● ${rotulo}</span>
        <small>${escapeHtml(explica)}${f.baseadoEmMeses ? ` · menor mês ${formatarBRL(f.pisoCentavos)}, média ${formatarBRL(f.mediaCentavos)} em ${f.baseadoEmMeses} meses` : ""}</small></span>${brl(f.totalCentavos)}</div>`;
    }).join(""),
    ajudaHtml("O 'menor mês' é o piso: o mínimo que essa fonte pagou nos meses fechados desde que apareceu. É ele, e não o valor combinado, que o plano deveria contar como garantido."));

  const blocoSaidas = grupos.size ? bloco("Para onde foi o dinheiro",
    rosca({ titulo: "Saídas dos meses fechados por grupo", centroRotulo: `${fechadas.length} meses`, fatias: [...grupos.entries()].map(([rotulo, valorCentavos]) => ({ rotulo, valorCentavos })) }),
    ajudaHtml("'Cartão sem detalhe' é fatura paga da qual ainda não temos as compras: o dinheiro saiu, mas não sabemos em quê.")) : "";

  const sc = h.semClassificar;
  const blocoQualidade = sc.quantidade ? bloco("Quanto ainda falta classificar",
    `<div class="rel-numero">${Math.round(sc.percentual * 100)}%<small style="font-size:14px;font-weight:500;"> do gasto</small></div>
     <div class="rel-dica">${sc.quantidade} lançamentos, ${brl(sc.valorCentavos)}, estão em "Outros" ou sem nome claro. Em Dinheiro, na aba Revisar, uma resposta resolve todos do mesmo nome.</div>`) : "";

  container.innerHTML = `<div class="viz-raiz">${chips}
    ${bloco("Seu ano até agora", resumo(h))}
    ${bloco("Mês a mês", `<p class="tela-sub" style="margin:0 0 10px;">Toque num mês para ver de onde veio e para onde foi.</p>${h.linhas.map((l) => linhaDoMes(l, pessoaId)).join("")}`)}
    ${blocoFontes}${blocoSaidas}${blocoQualidade}</div>`;
  ligar();
}

function ligar() {
  container?.querySelectorAll("[data-pessoa]").forEach((b) => b.addEventListener("click", () => { pessoaId = b.dataset.pessoa || null; assinar(); }));
}

function assinar() {
  if (parar) parar();
  dados = null; renderizar();
  parar = assinarHistoricoAno({ pessoaId }, (r) => { dados = r; renderizar(); });
}

export default {
  async montar(alvo) { container = alvo; assinar(); },
  desmontar() { if (parar) { parar(); parar = null; } dados = null; container = null; },
};
