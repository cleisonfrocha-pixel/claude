// Plano › Evolução. Estou saindo do buraco? Uma frase de tendência com os
// números que a sustentam, e a série dos últimos meses. Mês sem dado aparece
// como "sem dado". Os números vêm de domain/evolucao.js.

import { assinarEvolucao } from "../../dados/evolucaoRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { competenciaLabel } from "../../domain/tempo.js";
import { escapeHtml, ajudaHtml } from "../utilitarios.js";

let container = null;
let parar = null;
let ev = null;

const FRASE = {
  melhorando: ["Melhorando", "var(--accent)", "Entre os dois últimos meses fechados, mais coisas melhoraram do que pioraram."],
  estavel: ["Estável", "var(--warn)", "Entre os dois últimos meses fechados, melhorou e piorou na mesma medida."],
  piorando: ["Piorando", "var(--danger)", "Entre os dois últimos meses fechados, mais coisas pioraram do que melhoraram."],
  sem_dados: ["Ainda sem dados", "var(--text-2, inherit)", "Preciso de dois meses fechados com movimento para comparar. Nada foi inventado."],
};

const fmt = (v, formato) => (formato === "qtd" ? String(v) : formatarBRL(v));
const celula = (v, formato = "brl") => (v == null ? `<span style="opacity:.5;">sem dado</span>` : `<span data-valor>${fmt(v, formato)}</span>`);

function linhaSerie(rotulo, serie, pegar, formato, ajuda = "") {
  return `<div class="fatura-linha" style="align-items:flex-start;"><span class="rotulo">${escapeHtml(rotulo)} ${ajuda}</span></div>
    <div style="display:grid;grid-template-columns:repeat(${serie.length},1fr);gap:6px;margin:0 0 12px;font-size:12px;">
      ${serie.map((p) => `<div style="text-align:center;"><div style="opacity:.6;">${escapeHtml(competenciaLabel(p.competencia).slice(0, 3))}${p.emAndamento ? "*" : ""}</div><div>${celula(pegar(p), formato)}</div></div>`).join("")}
    </div>`;
}

function renderizar() {
  if (!container || !ev) return;
  const t = ev.tendencia;
  const [titulo, cor, frase] = FRASE[t.status];
  const razoes = t.razoes.filter((r) => r.sentido !== "igual");
  container.innerHTML = `
    <div class="inicio-bloco">
      <h3><span style="color:${cor};">●</span> ${escapeHtml(titulo)}</h3>
      <p class="tela-sub" style="margin:0 0 8px;">${escapeHtml(frase)}</p>
      ${razoes.map((r) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(r.rotulo)}</span><b class="${r.sentido === "melhor" ? "valor-pos" : "valor-neg"}" data-valor>${fmt(r.de, r.formato)} → ${fmt(r.para, r.formato)}</b></div>`).join("")}
      ${t.bolaDeNeve ? `<div class="mes-progresso-msg alerta" style="margin-top:10px;"><b>Risco de bola de neve.</b> A tendência piorou${ev.hoje.comprometimentoPct != null ? ` e as parcelas pesam ${ev.hoje.comprometimentoPct}% da renda do último mês` : ""}${ev.hoje.dividasSemAcordo ? `; há ${ev.hoje.dividasSemAcordo} dívidas sem acordo, que não quitam sozinhas` : ""}.</div>` : ""}
    </div>
    <div class="inicio-bloco">
      <h3>Mês a mês</h3>
      ${linhaSerie("Contas pagas com atraso", ev.serie, (p) => (p.temDados ? p.pagasComAtraso.quantidade : null), "qtd", ajudaHtml("Quantas contas foram pagas depois do vencimento naquele mês. Quanto menos, melhor."))}
      ${linhaSerie("Resultado do mês", ev.serie, (p) => p.resultadoCentavos, "brl", ajudaHtml("O que entrou menos o que saiu de verdade no mês (só o que foi pago)."))}
      ${linhaSerie("Pior momento do caixa", ev.serie, (p) => p.menorPontoCentavos, "brl", ajudaHtml("O ponto mais baixo que o caixa previsto tocou. O painel só registra a partir de quando começou a guardar."))}
      ${linhaSerie("Dívida total", ev.serie, (p) => p.dividaCentavos, "brl")}
      ${linhaSerie("Patrimônio líquido", ev.serie, (p) => p.patrimonioLiquidoCentavos, "brl")}
      <div class="tela-sub" style="margin:0;opacity:.7;">* mês em andamento, fora da comparação.</div>
    </div>`;
}

export default {
  async montar(alvo) {
    container = alvo;
    container.innerHTML = `<div class="tela-sub" style="margin-top:18px;">Carregando…</div>`;
    parar = assinarEvolucao((r) => { ev = r; renderizar(); });
  },
  desmontar() { if (parar) { parar(); parar = null; } ev = null; container = null; },
};
