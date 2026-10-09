// Início enxuto (lista de 05/10, itens 50 a 58): quanto tem em cada conta e quando foi atualizado,
// com que saldo você chega até o dinheiro entrar (a conta aberta num toque), o que é certo de receber
// separado do que é só esperado, o que está atrasado numa faixa própria e o que vence nos próximos
// 7 dias, cada um com o seu "Paguei". O resto (cartões, simulação, ano, retrato, alertas) mora nas
// outras abas. O "+" do menu lança; aqui não tem outro botão de lançar.

import { pessoas, contas } from "../../dados/repositorios.js";
import { assinarInicio } from "../../dados/inicioRepo.js";
import { formatarBRL } from "../../domain/dinheiro.js";
import { formatarData, competenciaLabel, somarDias, hojeISO } from "../../domain/tempo.js";
import { escapeHtml } from "../utilitarios.js";
import { icone } from "../icones.js";
import * as privacidade from "../privacidade.js";
import { navegar } from "../navegacao.js";
import { abrirAtualizarSaldo } from "../atualizarSaldo.js";
import { avatarMarcaHtml } from "../avatarMarca.js";
import { chegadaAteAProximaEntrada, aReceber } from "../../domain/inicio.js";
import { baixarComPergunta } from "../baixaUI.js";
import { abrirLancamento } from "./transacoes.js";

let pararInicio = null;
let estadoInicio = null;
let container = null;
let linhasComBaixa = [];

function irPara(destino) {
  navegar(typeof destino === "string" ? { modulo: destino } : destino);
}

export default {
  async montar(alvo) {
    container = alvo;
    container.innerHTML = `<div class="tela-sub" style="margin-top:18px;">Carregando…</div>`;
    const [p, c] = await Promise.all([pessoas.listar(), contas.listar()]);
    if (!p.length) return renderizarPedindo("Ainda não há nenhuma pessoa cadastrada. Comece por aí: tudo no sistema pertence a alguém.", "Cadastrar pessoas", { modulo: "configuracoes", aba: "pessoas" });
    if (!c.length) return renderizarPedindo("Ainda não há nenhuma conta cadastrada. Sem isso não dá pra saber quanto dinheiro existe.", "Cadastrar conta", { modulo: "dinheiro", aba: "contas" });

    estadoInicio = null;
    pararInicio = assinarInicio((r) => { estadoInicio = r; renderizar(); });
  },
  desmontar() {
    if (pararInicio) { pararInicio(); pararInicio = null; }
    estadoInicio = null;
    container = null;
  },
};

function renderizarPedindo(texto, botao, destino) {
  container.innerHTML = `
    <div class="tela-head" style="margin-top:0;"><div><h2 class="tela-titulo">Início</h2></div></div>
    <div class="vazio">${escapeHtml(texto)}<div><button class="btn btn-primary" id="ir-pedido">${escapeHtml(botao)}</button></div></div>`;
  container.querySelector("#ir-pedido").addEventListener("click", () => irPara(destino));
}

const dm = (d) => formatarData(d).slice(0, 5);
const curto = (t) => String(t || "").replace(/\s*\(.*$/, "").trim();

/** "05/10 às 14:16", da hora em que o saldo foi conferido; sem hora, só o dia. */
function quandoAtualizado(conta) {
  if (conta.saldoConferidoEm) {
    const d = new Date(conta.saldoConferidoEm);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm} às ${hh}:${mi}`;
    }
  }
  return conta.dataSaldoInicial ? dm(conta.dataSaldoInicial) : "sem data";
}

/** Item 50: o saldo de cada conta, com a hora da última atualização e o atalho para atualizar. */
function blocoContas(caixa) {
  const lista = [...caixa.detalhes.contasOperacao, ...caixa.detalhes.contasReserva]
    .filter((x) => x.saldoCentavos !== 0 || x.conta.saldoConferidoEm);
  return `
    <section class="inicio-bloco inicio-contas">
      <div class="inicio-contas-topo">
        <div><div class="home-saldo-rotulo" style="cursor:default;">Na conta agora</div>
          <div class="home-saldo-valor${caixa.saldoAtualCentavos < 0 ? " negativo" : ""}" data-valor>${formatarBRL(caixa.saldoAtualCentavos)}</div></div>
        <button class="home-topo-acao" id="botao-ocultar-home" title="Ocultar valores" aria-label="Ocultar valores"></button>
      </div>
      ${lista.map(({ conta, saldoCentavos }) => `
        <div class="fatura-linha"><span class="rotulo">${escapeHtml(conta.nome)}${conta.ehReserva ? " (reserva)" : ""}<small>atualizado em ${escapeHtml(quandoAtualizado(conta))}</small></span>
          <b class="${saldoCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(saldoCentavos)}</b></div>`).join("")}
      <button class="btn btn-ghost btn-atualizar-saldo" data-atualizar-saldo>Atualizar saldo</button>
    </section>`;
}

/** Item 52: uma linha, com a conta aberta num toque. */
function blocoChegada(caixa) {
  const c = chegadaAteAProximaEntrada(caixa);
  const entrada = c.entrada ? ` (quando entra ${escapeHtml(curto(c.entrada.descricao) || "a próxima entrada")}${c.entrada.certeza && c.entrada.certeza !== "confirmado" ? ", esperado" : ""})` : "";
  const buraco = caixa.primeiroBuraco;
  return `
    <section class="inicio-bloco">
      <h3>Você chega em ${escapeHtml(dm(c.ate))}${entrada} com <span class="${c.chegaComCentavos < 0 ? "valor-neg" : ""}" data-valor>${formatarBRL(c.chegaComCentavos)}</span></h3>
      ${c.diaDoMenor && c.menorCentavos < c.chegaComCentavos ? `<p class="tela-sub" style="margin:0 0 6px;">No caminho desce até <span data-valor>${formatarBRL(c.menorCentavos)}</span> em ${escapeHtml(dm(c.diaDoMenor))}.</p>` : ""}
      ${buraco ? `<p class="tela-sub valor-neg" style="margin:0 0 6px;">Em ${escapeHtml(dm(buraco.data))} falta dinheiro: <span data-valor>${formatarBRL(buraco.faltaCentavos)}</span>.</p>` : ""}
      <details class="inicio-detalhe"><summary>Ver a conta</summary>
        <div class="fatura-linha"><span class="rotulo">Na conta agora</span><b data-valor>${formatarBRL(caixa.saldoAtualCentavos)}</b></div>
        ${c.entraCentavos ? `<div class="fatura-linha"><span class="rotulo">Entra até lá</span><b class="valor-pos" data-valor>+${formatarBRL(c.entraCentavos)}</b></div>` : ""}
        <div class="fatura-linha"><span class="rotulo">Sai até lá (${c.saidas.length} ${c.saidas.length === 1 ? "conta" : "contas"})</span><b class="valor-neg" data-valor>−${formatarBRL(c.saiCentavos)}</b></div>
        <div class="fatura-linha"><span class="rotulo"><b>Você chega com</b></span><b data-valor>${formatarBRL(c.chegaComCentavos)}</b></div>
        ${c.saidas.length ? `<div class="tela-sub" style="margin:6px 0 2px;">O que sai:</div>${c.saidas.slice().sort((a, b) => b.valorCentavos - a.valorCentavos).slice(0, 12).map((s) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(s.descricao)}<small>${s.atrasado ? "atrasada" : s.semDia ? "verba do mês" : escapeHtml(dm(s.data))}</small></span><span data-valor>${formatarBRL(s.valorCentavos)}</span></div>`).join("")}${c.saidas.length > 12 ? `<div class="tela-sub">e mais ${c.saidas.length - 12}.</div>` : ""}` : ""}
      </details>
    </section>`;
}

/** Item 51: o que é certo de receber, com data, e à parte o que só é esperado. */
function blocoReceber(caixa) {
  const r = aReceber(caixa.detalhes.entradas);
  if (!r.certo.length && !r.esperado.length) return "";
  const linha = (e) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(e.descricao || "Entrada")}<small>${escapeHtml(dm(e.data))}</small></span><b class="valor-pos" data-valor>${formatarBRL(e.valorCentavos)}</b></div>`;
  return `
    <section class="inicio-bloco">
      <h3>A receber</h3>
      ${r.certo.length ? r.certo.slice(0, 5).map(linha).join("") : `<p class="tela-sub" style="margin:0 0 6px;">Nada confirmado para entrar nos próximos 30 dias.</p>`}
      ${r.esperado.length ? `<details class="inicio-detalhe"><summary>Esperado, ainda não é certo: <span data-valor>${formatarBRL(r.esperadoCentavos)}</span></summary>${r.esperado.slice(0, 8).map(linha).join("")}</details>` : ""}
    </section>`;
}

/** Como dar baixa numa linha da agenda: lançamento, fatura ou conta que ainda só existe no cadastro.
 * Estimativa (uso do cartão, gasto médio) e verba do mês não têm "Paguei". */
function itemDeBaixa(i) {
  if (i.semDia || i.estimativa) return null;
  if (i.transacaoId) return { tipo: "transacao", transacaoId: i.transacaoId, descricao: i.descricao, valorCentavos: i.valorCentavos, contaSugeridaId: i.contaId || null, origem: i.origem };
  if (i.faturaId) return { tipo: "fatura", faturaId: i.faturaId, cartaoId: i.cartaoId, descricao: i.descricao, valorCentavos: i.valorCentavos, contaSugeridaId: i.contaId || null, origem: i.origem };
  if (i.evento && ["fonteRenda", "divida", "recorrencia"].includes(i.origem?.tipo)) return { tipo: "evento", evento: i.evento, descricao: i.descricao, valorCentavos: i.valorCentavos, origem: i.origem };
  return null;
}

function linhaComPaguei(i) {
  const baixa = itemDeBaixa(i);
  const indice = baixa ? linhasComBaixa.push(baixa) - 1 : -1;
  return `
    <div class="inicio-linha2">
      ${avatarMarcaHtml([i.descricao], { classe: "inicio-logo" })}
      <div class="inicio-linha2-corpo"><b>${escapeHtml(i.descricao || "")}</b>
        <small>${i.atrasado ? `venceu ${escapeHtml(dm(i.vencimento || i.data))}` : i.semDia ? "verba do mês" : escapeHtml(dm(i.data))}</small></div>
      <b class="mono valor-neg" data-valor>${formatarBRL(i.valorCentavos)}</b>
      ${indice >= 0 ? `<button class="btn btn-ghost btn-sm" data-paguei="${indice}">Paguei</button>` : ""}
    </div>`;
}

/** Os primeiros `n` à vista; o resto num "ver mais", para a tela não virar um rolo. */
function listaCurta(itens, n) {
  const primeiros = itens.slice(0, n).map(linhaComPaguei).join("");
  return itens.length > n ? `${primeiros}<details class="inicio-detalhe"><summary>Ver mais ${itens.length - n}</summary>${itens.slice(n).map(linhaComPaguei).join("")}</details>` : primeiros;
}

/** Item 55: atrasado numa faixa própria; os próximos 7 dias à parte, cada linha com data e Paguei. */
function blocoAgenda(caixa, hoje) {
  const compromissos = caixa.detalhes.compromissos;
  const atrasados = compromissos.filter((c) => c.atrasado).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
  const limite = somarDias(hoje, 7);
  const semana = compromissos.filter((c) => !c.atrasado && !c.semDia && c.data <= limite);
  return `
    ${atrasados.length ? `
    <section class="inicio-bloco inicio-atrasados">
      <h3>Atrasado (${atrasados.length}) · <span data-valor>${formatarBRL(atrasados.reduce((s, c) => s + c.valorCentavos, 0))}</span></h3>
      ${listaCurta(atrasados, 4)}
    </section>` : ""}
    <section class="inicio-bloco">
      <h3>Próximos 7 dias</h3>
      ${semana.length ? listaCurta(semana, 6) : `<p class="tela-sub" style="margin:0;">Nada vence nesta semana.</p>`}
      <button class="btn-link" data-ir-contas>Ver todas as contas do mês</button>
    </section>`;
}

function blocoMes(c) {
  if (!c || !c.resumo.quantidade) return "";
  const r = c.resumo;
  return `<section class="inicio-bloco"><button class="btn-link" data-ir-contas>Contas de ${escapeHtml(competenciaLabel(c.competencia).split(" ")[0].toLowerCase())}: ${r.quantidadePagas} de ${r.quantidade} pagas</button></section>`;
}

const ROTULO_RITMO = { "no ritmo": "no ritmo", acima: "gastando rápido", estourou: "passou da cota" };

/** Verbas do mês (lazer, combustível, mercado...): da cota de X, quanto já usou e quanto ainda pode. */
function blocoVerbas(verbas) {
  if (!verbas || !verbas.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>Suas verbas do mês</h3>
      ${verbas.map((v, i) => `
        <div class="verba-linha ritmo-${v.ritmo.replace(" ", "-")}">
          <div class="verba-topo"><b>${escapeHtml(curto(v.nome))}</b><span class="mono" data-valor>${formatarBRL(v.gastoCentavos)} de ${formatarBRL(v.totalCentavos)}</span></div>
          <div class="barra-limite"><span style="width:${v.percentual}%"></span></div>
          <div class="verba-base">
            <small>${v.excedenteCentavos > 0 ? `passou <span data-valor>${formatarBRL(v.excedenteCentavos)}</span>` : `ainda pode <b data-valor>${formatarBRL(v.restanteCentavos)}</b>${v.restanteCentavos > 0 ? ` (uns <span data-valor>${formatarBRL(v.porSemanaCentavos)}</span> por semana)` : ""}`} · ${ROTULO_RITMO[v.ritmo]}</small>
            <button class="btn-mini" data-gastei="${i}">Gastei</button>
          </div>
        </div>`).join("")}
    </section>`;
}

function blocoPrazos(prazos) {
  if (!prazos || !prazos.length) return "";
  return `
    <section class="inicio-bloco">
      <h3>Datas que pesam</h3>
      ${prazos.map((p) => `<div class="fatura-linha"><span class="rotulo">${escapeHtml(p.titulo)}<small>${escapeHtml(formatarData(p.data))}${p.nota ? " · " + escapeHtml(p.nota) : ""}</small></span><b>${p.diasAte < 0 ? "passou" : p.diasAte === 0 ? "hoje" : p.diasAte === 1 ? "amanhã" : `${p.diasAte} dias`}</b></div>`).join("")}
    </section>`;
}

function renderizar() {
  if (!container || !estadoInicio) return;
  const { caixa, contasMes, prazos, verbas } = estadoInicio;
  const hoje = estadoInicio.hoje || caixa.pontos?.[0]?.data || hojeISO();
  linhasComBaixa = [];
  container.innerHTML = `
    <div class="inicio-coluna">
      ${blocoContas(caixa)}
      ${blocoChegada(caixa)}
      ${blocoReceber(caixa)}
      ${blocoAgenda(caixa, hoje)}
      ${blocoVerbas(verbas)}
      ${blocoMes(contasMes)}
      ${blocoPrazos(prazos)}
    </div>`;

  container.querySelectorAll("[data-atualizar-saldo]").forEach((b) => b.addEventListener("click", abrirAtualizarSaldo));
  container.querySelectorAll("[data-ir-contas]").forEach((b) => b.addEventListener("click", () => irPara({ modulo: "dinheiro", aba: "apagar" })));
  container.querySelectorAll("[data-paguei]").forEach((b) => b.addEventListener("click", () => {
    const item = linhasComBaixa[Number(b.dataset.paguei)];
    if (item) baixarComPergunta(item, "despesa");
  }));
  container.querySelectorAll("[data-gastei]").forEach((b) => b.addEventListener("click", () => {
    const v = (estadoInicio.verbas || [])[Number(b.dataset.gastei)];
    if (v) abrirLancamento({ tipo: "despesa", status: "pago", titulo: `Gastei: ${curto(v.nome)}`, dica: `Entra na verba "${curto(v.nome)}" e abate do que ainda pode gastar.`, categoriaId: v.categoriaId, descricao: curto(v.nome) });
  }));
  ligarBotaoOcultar();
}

function ligarBotaoOcultar() {
  const botao = container?.querySelector("#botao-ocultar-home");
  if (!botao) return;
  const desenhar = () => {
    const oculto = privacidade.estaOculto();
    botao.innerHTML = icone(oculto ? "olhoFechado" : "olho", 19);
    botao.setAttribute("title", oculto ? "Mostrar valores" : "Ocultar valores");
  };
  desenhar();
  botao.addEventListener("click", () => { privacidade.alternar(); desenhar(); });
}
