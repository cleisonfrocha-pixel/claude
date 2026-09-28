// Plano › Por pessoa. A leitura de um casal sem renda conjunta: cada um
// com o próprio mês (renda, gasto, parcelas, se cobre o essencial), a
// casa somada, quem cobre quem, e o que passou de uma conta pra outra.
// Todos os números vêm de domain/pessoas.js; aqui só se escreve a leitura.

import { assinarPainelPessoas } from "../../dados/visaoPessoasRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { competenciaLabel } from "../../domain/tempo.js";
import { SEM_DONO } from "../../domain/pessoas.js";
import { escapeHtml } from "../utilitarios.js";

let container = null;
let parar = null;
let painel = null;

function iniciais(nome) {
  return String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function brl(centavos, { sinal = false } = {}) {
  const txt = formatarBRL(centavos);
  return sinal && centavos > 0 ? `+${txt}` : txt;
}

function classeValor(centavos) {
  if (centavos > 0) return "valor-pos";
  if (centavos < 0) return "valor-neg";
  return "";
}

function linha(rotulo, valorHtml, sub = "") {
  return `<div class="fatura-linha"><span class="rotulo">${rotulo}${sub ? `<small>${sub}</small>` : ""}</span><b data-valor>${valorHtml}</b></div>`;
}

function nomeDe(id) {
  if (id === SEM_DONO) return "Sem responsável";
  return painel.pessoas.find((p) => p.pessoaId === id)?.nome || "Alguém";
}

function leituraPrincipal() {
  const { desequilibrio, pessoas } = painel;
  if (pessoas.length < 2) {
    return `<div class="reserva-nota"><span>Cadastre a outra pessoa em Configurações › Pessoas e marque o responsável de cada conta e dívida. A divisão aparece aqui na hora.</span></div>`;
  }
  if (!desequilibrio.comFalta.length) {
    return `<div class="alerta-tudo-coberto">Cada um cobre o próprio essencial e as próprias parcelas com a própria renda este mês.</div>`;
  }
  const faltas = desequilibrio.comFalta.map((f) => `${escapeHtml(nomeDe(f.pessoaId))} fica <b data-valor>${brl(f.faltaCentavos)}</b> abaixo`).join("; ");
  const quemCobre = pessoas.filter((p) => p.numeros.coberturaCentavos > 0).map((p) => escapeHtml(p.nome)).join(" e ");
  const coberto = desequilibrio.cobertoCentavos > 0 && quemCobre
    ? ` A folga de ${quemCobre} cobre <b data-valor>${brl(desequilibrio.cobertoCentavos)}</b> disso.` : "";
  const descoberto = desequilibrio.descobertoCentavos > 0
    ? ` Mesmo juntando os dois, faltam <b data-valor>${brl(desequilibrio.descobertoCentavos)}</b> para fechar essencial e parcelas.` : "";
  const classe = desequilibrio.descobertoCentavos > 0 ? "alerta-cobertura" : "reserva-nota";
  return `<div class="${classe}"><div class="texto">Com a própria renda, ${faltas} do que o essencial e as parcelas pedem.${coberto}${descoberto}</div></div>`;
}

function cartaoPessoa(p) {
  const n = p.numeros;
  const negativadas = p.dividas.filter((d) => d.negativada);
  return `
    <div class="divida-resumo pessoa-card">
      <div class="pessoa-cabeca">
        <div class="item-avatar">${escapeHtml(iniciais(p.nome))}</div>
        <div>
          <div class="titulo" style="margin:0;">${escapeHtml(p.nome)}</div>
          <div class="item-sub">${p.participacaoRendaPct != null ? `${p.participacaoRendaPct}% da renda da casa` : "sem renda este mês"}${p.participacaoCustoPct != null ? ` · ${p.participacaoCustoPct}% do gasto` : ""}</div>
        </div>
      </div>
      <div class="pessoa-destaque ${n.coberturaCentavos < 0 ? "negativo" : ""}">
        <span>${n.coberturaCentavos < 0 ? "Falta pra cobrir o próprio mês" : "Sobra depois do essencial e das parcelas"}</span>
        <b data-valor>${brl(Math.abs(n.coberturaCentavos))}</b>
      </div>
      ${linha("Renda do mês", `<span class="valor-pos">${brl(n.rendaCentavos)}</span>`)}
      ${linha("Gasto do mês", brl(n.despesasCentavos), `essencial ${formatarBRL(n.essencialCentavos)}`)}
      ${linha("Parcelas de dívida", brl(n.parcelasCentavos))}
      ${linha("Resultado do mês", `<span class="${classeValor(n.resultadoMesCentavos)}">${brl(n.resultadoMesCentavos, { sinal: true })}</span>`, "renda menos gasto")}
      ${linha("Saldo em conta", brl(n.saldoOperacaoCentavos), n.saldoReservaCentavos ? `mais ${formatarBRL(n.saldoReservaCentavos)} em reserva` : "")}
      ${linha("Dívidas", `<span class="${n.dividasSaldoCentavos > 0 ? "valor-neg" : ""}">${brl(n.dividasSaldoCentavos)}</span>`,
        [n.dividasAtivas ? `${n.dividasAtivas} ativa${n.dividasAtivas > 1 ? "s" : ""}` : "nenhuma",
          n.dividasAtrasadas ? `${n.dividasAtrasadas} atrasada${n.dividasAtrasadas > 1 ? "s" : ""}` : "",
          n.dividasNegativadas ? `${n.dividasNegativadas} negativada${n.dividasNegativadas > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "))}
      ${linha("Patrimônio líquido", `<span class="${classeValor(n.patrimonioLiquidoCentavos)}">${brl(n.patrimonioLiquidoCentavos)}</span>`)}
      ${negativadas.length ? `
        <div class="pessoa-negativadas">
          <div class="titulo-pequeno">Nome negativado</div>
          ${negativadas.map((d) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(d.nome)}${d.credor ? `<small>${escapeHtml(d.credor)}</small>` : ""}</span><b class="valor-neg" data-valor>${brl(d.saldoCentavos)}</b></div>`).join("")}
        </div>` : ""}
    </div>`;
}

function blocoCasa() {
  const c = painel.casa;
  return `
    <div class="resumo-mes">
      <div class="resumo-item"><span>Renda da casa</span><b class="mono valor-pos" data-valor>${brl(c.rendaCentavos)}</b></div>
      <div class="resumo-item"><span>Gasto da casa</span><b class="mono" data-valor>${brl(c.despesasCentavos)}</b></div>
      <div class="resumo-item"><span>Parcelas</span><b class="mono" data-valor>${brl(c.parcelasCentavos)}</b></div>
      <div class="resumo-item"><span>Sobra depois do essencial e das parcelas</span><b class="mono ${classeValor(c.coberturaCentavos)}" data-valor>${brl(c.coberturaCentavos)}</b></div>
    </div>
    ${c.dividasNegativadas ? `<div class="alerta-cobertura"><div class="titulo">${c.dividasNegativadas} ${c.dividasNegativadas === 1 ? "dívida negativada" : "dívidas negativadas"} na casa</div>
      <div class="texto">Somam <b data-valor>${brl(c.saldoNegativadoCentavos)}</b>. Nome sujo trava crédito e costuma ser o primeiro ponto de virada: veja em Caminhos quanto tempo cada estratégia leva pra limpar.</div></div>` : ""}`;
}

function blocoRepasses() {
  if (!painel.repasses.length) {
    return `<div class="plano-horizonte-vazio">Nenhuma transferência entre contas de pessoas diferentes este mês.</div>`;
  }
  return painel.repasses.map((r) => linha(
    `${escapeHtml(nomeDe(r.dePessoaId))} → ${escapeHtml(nomeDe(r.paraPessoaId))}`,
    brl(r.totalCentavos),
    `${r.quantidade} ${r.quantidade === 1 ? "transferência" : "transferências"}. Não conta como renda nem gasto de ninguém`,
  )).join("");
}

function blocoSemDono() {
  const s = painel.semDono;
  if (!s) return "";
  return `
    <div class="reserva-nota" style="margin-top:14px;">
      <span>${s.quantidadeLancamentos} ${s.quantidadeLancamentos === 1 ? "lançamento" : "lançamentos"}${s.dividas.length ? ` e ${s.dividas.length} ${s.dividas.length === 1 ? "dívida" : "dívidas"}` : ""} sem responsável. Entram na casa, mas não em nenhuma pessoa: marque o responsável (ou o dono da conta) pra divisão ficar certa.</span>
    </div>`;
}

function renderizar() {
  if (!container) return;
  if (!painel) {
    container.innerHTML = `<p class="tela-sub">Carregando…</p>`;
    return;
  }
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h3 class="tela-titulo" style="font-size:17px;">A casa em ${escapeHtml(competenciaLabel(painel.competencia))}</h3>
      <p class="tela-sub">A soma dos dois. Transferência entre vocês não conta como renda nem gasto</p></div></div>
    ${blocoCasa()}
    ${leituraPrincipal()}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Cada um</h3>
      <p class="tela-sub">O mês de cada pessoa só com o que é dela: renda, gasto, parcelas e dívidas</p></div></div>
    <div class="pessoas-grid">${painel.pessoas.map(cartaoPessoa).join("")}</div>
    ${blocoSemDono()}

    <div class="tela-head"><div><h3 class="tela-titulo" style="font-size:17px;">Quem passou dinheiro pra quem</h3>
      <p class="tela-sub">Transferências entre contas de pessoas diferentes no mês</p></div></div>
    <div class="divida-resumo">${blocoRepasses()}</div>
  `;
}

export default {
  montar(alvo) {
    container = alvo;
    painel = null;
    renderizar();
    if (parar) parar();
    parar = assinarPainelPessoas((r) => { painel = r; renderizar(); });
  },
  desmontar() {
    if (parar) { parar(); parar = null; }
    container = null;
    painel = null;
  },
};
